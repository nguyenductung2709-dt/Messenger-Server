const { S3Client } = require("@aws-sdk/client-s3");
const dotenv = require("dotenv");
const { BUCKET_REGION } = require("../config");

dotenv.config();

const s3 = new S3Client({
  region: BUCKET_REGION,
});

module.exports = s3;
