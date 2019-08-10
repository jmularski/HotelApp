const express = require('express');
const app = express();

const bodyParser = require('body-parser');
const dotenv = require('dotenv');
dotenv.config();

const { Translate } = require('@google-cloud/translate');
const translate = new Translate({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: './translation.json',
});
const axios = require('axios');
const client = require('twilio')(
  process.env.TWILIO_SID,
  process.env.AUTH_TOKEN
);

const rapidApiConfig = require('./rapid-api.config').default;
// const twillioConfig = require('./twilio.config').default;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

let unknown_data = '';
let final_translation = '';
let call_status = false;

// let callersQueue = [];

function unknown_response(data) {
  unknown_data = data;
  client.calls
    .create({
      url: `${process.env.TUNNELED_URL}/twilio`,
      to: '+48785757810',
      from: process.env.TWILIO_PHONE,
      statusCallback: `${process.env.TUNNELED_URL}/event`,
      statusCallbackEvent: ['completed'],
    })
    .then(call => {
      setInterval(() => {
        if (call_status) {
          call_status = false;
          return final_translation;
        }
      }, 1000);
    })
    .catch(err => console.log(err));
}

app.post('/event', (req, res) => {
  call_status = true;
  res.sendStatus(200);
});

app.post('/unknownquestionresponse', async (req, res) => {
  const speechData = req.body.SpeechResult;

  console.log(speechData);

  try {
    let [translations] = await translate.translate(speechData, 'it');
    final_translation = translations;
    res.sendStatus(200);
  } catch (e) {
    console.log(e);
  }
});

app.post('/twilio', async (req, res) => {
  res.set('Content-Type', 'text/xml');

  let [translations] = await translate.translate(unknown_data, 'it');

  const voiceResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Say language="it">${translations}</Say>
        <Gather input="speech" action="${
          process.env.TUNNELED_URL
        }/unknownquestionresponse">
            <Say language="it">Per favore, rispondi alla domanda</Say>
        </Gather>
    </Response>
    `;

  res.send(voiceResponse);
});

function callTaxi({ date, addressFrom }) {
  unknown_response(
    `I need a taxi from ${addressFrom} to hotel at ${date}`
  );
}

async function botResponseLoader(intentName, queryText, parameters) {
  if (intentName === 'Default Fallback Intent')
    return { fulfillmentText: unknown_response(queryText) };
  if (intentName === 'booking.create')
    return { fulfillmentText: `The cheapest room with given parameters costs ${await booking(parameters)}, do you want to book it?` };
  if (intentName === 'booking.taxi')
    return { fulfillmentText: callTaxi(parameters) };
}

app.post('/dialogFlow', async (req, res) => {
  const query = req.body.queryResult;
  const queryText = query.queryText;
  const intentName = query.intent.displayName;

  res.send(await botResponseLoader(intentName, queryText, query.parameters));
});

const createQueryParams = (date, adults) => ({
  languagecode: 'en-us',
  travel_purpose: 'leisure',
  recommend_for: '3',
  rec_guest_qty: `${adults}, 1`,
  hotel_id: '241493',
  arrival_date: date.startDate,
  departure_date: date.endDate,
});

async function booking({ date, adults }) {
  //   console.log(date, adults);
  let minPrice;
  try {
    console.log('tesqt');
    const { data } = await axios.get(
      `${process.env.RAPID_API_HOST}/properties/get-rooms`,
      { params: createQueryParams(date, adults), headers: rapidApiConfig }
    );
    console.log(data);
    // minPrice = await getCheapestRoomPrice(data);
    const body = data[0];

    const cheapestBlockId = body.cheapest_block_id;
    const cheapestBlock = body.block.find(
      block => block.block_id === cheapestBlockId
    );

    minPrice = cheapestBlock.min_price.price;
    console.log(minPrice);
  } catch (error) {
    throw new Error(error);
  } finally {
    return minPrice.toString();
  }
}

app.listen(3000, () => console.log('Running on 3000!'));
