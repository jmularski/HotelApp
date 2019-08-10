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
const twillioConfig = require('./twilio.config').default;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

let unknown_data = '';
let final_translation = '';
let call_status = false;

const handleTranslation = () =>
  setInterval(() => {
    if (call_status) {
      call_status = false;
      return final_translation;
    }
  }, 1000);

function unknown_response(data) {
  unknown_data = data;
  client.calls
    .create(twillioConfig)
    .then(handleTranslation)
    .catch(error => console.log(error));
}

app.post('/event', (req, res) => {
  call_status = true;
  res.sendStatus(200);
});

app.post('/unknownquestionresponse', async (req, res) => {
  const speechData = req.body.SpeechResult;

  try {
    let [translations] = await translate.translate(speechData, 'it');
    final_translation = translations;
    res.sendStatus(200);
  } catch (error) {
    throw new Error(error);
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
  unknown_response(`I need a taxi from ${addressFrom} to hotel at ${date}`);
}

async function botResponseLoader(intentName, queryText, parameters) {
  console.log(intentName);
  if (intentName === 'Default Fallback Intent')
    return { fulfillmentText: unknown_response(queryText) };
  if (intentName === 'booking.create')
    return {
      fulfillmentText: await booking(parameters),
    };
  if (intentName === 'booking.taxi')
    return { fulfillmentText: callTaxi(parameters) };
}

app.post('/dialogFlow', async (req, res) => {
  const query = req.body.queryResult;
  const queryText = query.queryText;
  const intentName = query.intent.displayName;

  res.send(await botResponseLoader(intentName, queryText, query.parameters));
});

const createQueryParams = (date, adults) => {
  const arrival_date = date.startDate.slice(0, 10);
  const departure_date = date.endDate.slice(0, 10);

  return {
    languagecode: 'en-us',
    travel_purpose: 'leisure',
    recommend_for: '3',
    rec_guest_qty: `${adults}, 1`,
    hotel_id: '241493',
    arrival_date,
    departure_date,
  };
};

const getCheapestRoomPrice = async data => {
  const body = data[0];

  const cheapestBlockId = body.cheapest_block_id;
  const cheapestBlock = body.block.find(
    block => block.block_id === cheapestBlockId
  );

  if (cheapestBlock === undefined) {
    return 'All rooms are booked, choose different date';
  } else {
    return `The cheapest room with given parameters costs ${
      cheapestBlock.min_price.price
    } ${cheapestBlock.min_price.currency}, do you want to book it?`;
  }
};

async function booking({ date, adults }) {
  let outputMessage = '';
  try {
    const { data } = await axios.get(
      `${process.env.RAPID_API_HOST}/properties/get-rooms`,
      { params: createQueryParams(date, adults), headers: rapidApiConfig }
    );
    outputMessage = await getCheapestRoomPrice(data);
  } catch (error) {
    throw new Error(error);
  } finally {
    return outputMessage.toString();
  }
}

app.listen(3000, () => console.log('Running on 3000!'));
