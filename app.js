const express = require('express');
const app = express();

const bodyParser = require('body-parser');
const dotenv = require('dotenv');

dotenv.config();

const client = require('twilio')(process.env.TWILIO_SID, process.env.AUTH_TOKEN);

const { Translate } = require('@google-cloud/translate'); 
const translate = new Translate({
    projectId: process.env.GCP_PROJECT_ID,
    keyFilename: './VizGov-e98255c0ab5d.json'
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

let unknown_response = "Hello world!";

app.get('/unknown_response/:resp', (req, res) => {
    unknown_response = req.params.resp;

    client.calls
        .create({
            url: `${process.env.TUNNELED_URL}/twilio`,
            to: "+48785757810",
            from: process.env.TWILIO_PHONE
        })
        .then(call => {
            res.sendStatus(200);
        })
        .catch(err => console.log(err));
});

app.post('/unknownquestionresponse', async (req, res) => {
    const speechData = req.body.SpeechResult;

    const [translations] = await translate.translate(speechData, 'en-US');

    res.send(translations);
});

app.post('/twilio', async (req, res) => {
    res.set('Content-Type', 'text/xml');

    let [translations] = await translate.translate(unknown_response, 'it'); 

    const voiceResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Say>${translations}</Say>
        <Gather input="speech" action="${process.env.TUNNELED_URL}/unknownquestionresponse">
            <Say>Per favore, rispondi alla domanda</Say>
        </Gather>
    </Response>
    `;

    res.send(voiceResponse);
});

app.listen(3000, () => console.log("Running on 3000!"));