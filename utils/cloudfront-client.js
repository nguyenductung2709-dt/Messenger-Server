const { CloudFrontClient } = require("@aws-sdk/client-cloudfront");

const cloudfront = new CloudFrontClient({
  region: process.env.BUCKET_REGION, 
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

module.exports = cloudfront;
