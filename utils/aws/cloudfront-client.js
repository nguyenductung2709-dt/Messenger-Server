const { CloudFrontClient } = require("@aws-sdk/client-cloudfront");
const { BUCKET_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = require('../config');

const cloudfront = new CloudFrontClient({
  region: BUCKET_REGION, 
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  }
});

module.exports = cloudfront;
