const express = require('express');
const app = express();

const bodyParser = require('body-parser');
const dotenv = require('dotenv');

dotenv.config();

const client = require('twilio')(process.env.TWILIO_SID, process.env.AUTH_TOKEN);

app.use(bodyParser.json());

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

app.post('/twilio', (req, res) => {
    res.set('Content-Type', 'text/xml');

    const voiceResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Say>${unknown_response}</Say>
    </Response>
    `;

    res.send(voiceResponse);
});

app.listen(3000, () => console.log("Running on 3000!"));