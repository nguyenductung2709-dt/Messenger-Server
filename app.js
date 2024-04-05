const config = require('./utils/config')
const middleware = require('./utils/middleware')
const usersRouter = require('./controllers/users')
const conversationsRouter = require('./controllers/conversations')
const messagesRouter = require('./controllers/messages')
const attachmentsRouter = require('./controllers/attachments')
const imagesRouter = require('./controllers/images')
const authenticationRouter = require('./controllers/authentication')
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/users', usersRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/attachments', attachmentsRouter);
app.use('/api/images', imagesRouter);
app.use('/api/auth', authenticationRouter);

module.exports = app;
