# Setup

1. Firstly install needed dependecies
```
yarn install
```

2. Create an twilio account and initialize .env file with following values
```
TWILIO_SID="TWILIO_ACCOUNT_SID"
AUTH_TOKEN="TWILIO_AUTH_TOKEN"
TWILIO_PHONE="TWILIO_PHONE_NUMBER"
```

3. Tunnel localhost via ngrok and set .env variable
```
TUNNELED_URL="NGROK_HTTPS_URL"
```

4. Start with
```
yarn start:dev
```