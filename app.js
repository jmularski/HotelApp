const express = require('express');
const app = express();

const bodyParser = require('body-parser');
const dotenv = require('dotenv');

dotenv.config();

const client = require('twilio')(
  process.env.TWILIO_SID,
  process.env.AUTH_TOKEN
);

const { Translate } = require('@google-cloud/translate');
const translate = new Translate({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: './translation.json',
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

let unknown_data = 'Hello world!';
let final_translation = '';
let call_status = false;

function unknown_response(data) {
  unknown_data = data;

  client.calls
    .create({
      url: `${process.env.TUNNELED_URL}/twilio`,
      to: '+48785757810',
      from: process.env.TWILIO_PHONE,
      statusCallback: `${process.env.TUNNELED_URL}/event`,
      statusCallbackEvent: ['completed']
    })
    .then(call => {
      setInterval(() => {
        if(call_status) {
          call_status = false;
          console.log(final_translation);
          return final_translation;
        } 
      }, 1000)
    })
    .catch(err => console.log(err));
}

app.post('/event', (req, res) => {
    call_status = true;
    res.sendStatus(200);
})

app.post('/unknownquestionresponse', async (req, res) => {
  const speechData = req.body.SpeechResult;

  console.log(speechData);

  try {
    let [translations] = await translate.translate(speechData, 'it');
    final_translation = translations;
  } catch(e) {
    console.log(e);
  }
});

app.post('/twilio', async (req, res) => {
  res.set('Content-Type', 'text/xml');

  let [translations] = await translate.translate(unknown_data, 'it');

  const voiceResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Say>${translations}</Say>
        <Gather input="speech" action="${process.env.TUNNELED_URL}/unknownquestionresponse" speechTimeout="2">
            <Say>Per favore, rispondi alla domanda</Say>
        </Gather>
    </Response>
    `;

  res.send(voiceResponse);
});

function botResponseLoader(intentName, queryText) {
  if (intentName === 'Default Fallback Intent')
    return { 'fulfillmentText': unknown_response(queryText) };
}

app.post('/dialogFlow', (req, res) => {
  const query = req.body.queryResult;
  const queryText = query.queryText;
  const intentName = query.intent.displayName;

  console.log(intentName);

  res.send(botResponseLoader(intentName, queryText));
});

app.listen(3000, () => console.log('Running on 3000!'));
