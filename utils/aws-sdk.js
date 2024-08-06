const crypto = require("crypto");
const { PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const s3 = require("./s3user");
// eslint-disable-next-line no-undef
const bucketName = process.env.BUCKET_NAME;

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
  const getObjectParams = {
    Bucket: bucketName,
    Key,
  };
  const command = new GetObjectCommand(getObjectParams);
  return getSignedUrl(s3, command, { expiresIn: 3600 });
};

module.exports = {
  randomFileName,
  uploadFile,
  generateSignedUrl,
};
