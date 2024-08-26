const crypto = require("crypto");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/cloudfront-signer");
const { BUCKET_NAME, CDN_URL, CLOUDFRONT_PRIVATE_KEY, CLOUDFRONT_KEY_PAIR_ID } = require('../config')
const s3 = require("./s3user");

const bucketName = BUCKET_NAME;

const randomFileName = (bytes = 32) =>
  crypto.randomBytes(bytes).toString("hex"); // generate random image name to avoid conflicts

const uploadFile = async (fileName, fileBuffer, fileContent) => {
  const params = {
    Bucket: bucketName,
    Key: fileName,
    Body: fileBuffer,
    ContentType: fileContent,
  };
  const command = new PutObjectCommand(params);
  await s3.send(command);
};

const generateSignedUrl = async (Key) => {
  return getSignedUrl({
    url: CDN_URL + Key,
    dateLessThan: new Date(Date.now() + 1000 * 60 * 60 * 24),
    privateKey: CLOUDFRONT_PRIVATE_KEY,
    keyPairId: CLOUDFRONT_KEY_PAIR_ID,
  })
};

module.exports = {
  randomFileName,
  uploadFile,
  generateSignedUrl,
};
