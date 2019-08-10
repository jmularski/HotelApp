exports.default = {
  url: `${process.env.TUNNELED_URL}/twilio`,
  to: '+48785757810',
  from: process.env.TWILIO_PHONE,
  statusCallback: `${process.env.TUNNELED_URL}/event`,
  statusCallbackEvent: ['completed'],
};
