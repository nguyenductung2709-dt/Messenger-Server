/* eslint-disable no-undef */
require("dotenv").config();

module.exports = {
  DATABASE_URL:
    process.env.NODE_ENV === "test"
      ? process.env.TEST_DATABASE_URL
      : process.env.DATABASE_URL,
  PORT: process.env.PORT || 3000,
  SECRET: process.env.SECRET,
  APP_URL: process.env.APP_URL,
  // CloudFront config
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  CLOUD_FRONT_DISTRIBUTION_ID: process.env.CLOUD_FRONT_DISTRIBUTION_ID,
  CDN_URL: process.env.CDN_URL,
  CLOUDFRONT_PRIVATE_KEY: process.env.CLOUDFRONT_PRIVATE_KEY,
  CLOUDFRONT_KEY_PAIR_ID: process.env.CLOUDFRONT_KEY_PAIR_ID,
  // AWS S3 config
  BUCKET_REGION: process.env.BUCKET_REGION,
  BUCKET_NAME: process.env.BUCKET_NAME,
  // Google Mailing config
  GOOGLE_USER: process.env.GOOGLE_USER,
  GOOGLE_PASS: process.env.GOOGLE_PASS,
  // GoogleOAuth2 config
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  // Bcrypt
  SALT_ROUNDS: 10,
};
