require('dotenv').config()

module.exports = {
    DATABASE_URL: process.env.NODE_ENV === "test" ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL,
    PORT: process.env.PORT || 3000,
    SECRET: process.env.SECRET,
}