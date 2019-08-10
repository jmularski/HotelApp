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
const unirest = require('unirest');
const axios = require('axios');
const client = require('twilio')(
  process.env.TWILIO_SID,
  process.env.AUTH_TOKEN
);

const rapidApiConfig = require('./rapid-api.config').default;
// const twillioConfig = require('./twilio.config').default;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

let unknown_data = 'Hello world!';
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
      // const queueLength = callersQueue.length;
      // callersQueue.push
      setInterval(() => {
        if (call_status) {
          call_status = false;
          //   console.log(final_translation);
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

  //   console.log(speechData);

  try {
    let [translations] = await translate.translate(speechData, 'it');
    final_translation = translations;
  } catch (e) {
    console.log(e);
  }
});

app.post('/twilio', async (req, res) => {
  res.set('Content-Type', 'text/xml');

  let [translations] = await translate.translate(unknown_data, 'it');

  const voiceResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Say>${translations}</Say>
        <Gather input="speech" action="${
          process.env.TUNNELED_URL
        }/unknownquestionresponse">
            <Say>Per favore, rispondi alla domanda</Say>
        </Gather>
    </Response>
    `;

  res.send(voiceResponse);
});

function callTaxi({ time, addressFrom, addressTo }) {
  unknown_response(
    `I need a taxi from ${addressFrom} to ${addressTo} at ${time}`
  );
}

async function botResponseLoader(intentName, queryText, parameters) {
  if (intentName === 'Default Fallback Intent')
    return { fulfillmentText: unknown_response(queryText) };
  if (intentName === 'booking.create')
    return { fulfillmentText: await booking(parameters) };
  if (intentName === 'booking.taxi')
    return { fulfillmentText: callTaxi(parameters) };
}

app.post('/dialogFlow', async (req, res) => {
  const query = req.body.queryResult;
  const queryText = query.queryText;
  const intentName = query.intent.displayName;

  //   console.log(query);
  //   console.log(intentName);

  res.send(await botResponseLoader(intentName, queryText, query.parameters));
});

const createQueryParams = (date, adults) => ({
  languagecode: 'en-us',
  travel_purpose: 'leisure',
  rec_children_qty: '1,1',
  rec_children_age: '5,7',
  recommend_for: '3',
  rec_guest_qty: '2,2',
  hotel_id: '241493',
  arrival_date: '2019-10-11',
  departure_date: '2019-10-14',
});

// const getCheapestRoomPrice =  result => {
//   const body = result.body[0];

//   const cheapestBlockId = body.cheapest_block_id;
//   const cheapestBlock = body.block.find(
//     block => block.block_id === cheapestBlockId
//   );

//   return cheapestBlock.min_price.price;
// };

async function booking({ date, adults }) {
  //   console.log(date, adults);
  let minPrice;
  try {
    console.log('tesqt');
    const { data } = await axios.get(
      `${process.env.RAPID_API_HOST}/properties/get-rooms`,
      { params: createQueryParams(), headers: rapidApiConfig }
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

  //   await unirest
  //     .get(`${process.env.RAPID_API_HOST}/properties/get-rooms`)
  //     .query(createQueryParams())
  //     .headers(rapidApiConfig)
  //     .end(result => {
  //       if (result.error) throw new Error(result.error);

  //       const body = result.body[0];

  //       const cheapestBlockId = body.cheapest_block_id;
  //       const cheapestBlock = body.block.find(
  //         block => block.block_id === cheapestBlockId
  //       );

  //       minPrice = cheapestBlock.min_price.price;
  //       return new Promise(
  //         (resolve, reject) => resolve => {
  //           minPrice = cheapestBlock.min_price.price.toString();
  //         },
  //         false
  //       );
  //     });

  // await console.log(minPrice.toString());
  //   return minPrice.toString();

  // console.log(test);
}

app.listen(3000, () => console.log('Running on 3000!'));
