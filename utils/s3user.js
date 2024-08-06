const { S3Client } = require("@aws-sdk/client-s3");
const dotenv = require("dotenv");

dotenv.config();

// eslint-disable-next-line no-undef
const bucketRegion = process.env.BUCKET_REGION;

const s3 = new S3Client({
  region: bucketRegion,
});

module.exports = s3;
