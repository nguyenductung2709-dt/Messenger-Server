// import controllers
const express = require("express");
const cors = require("cors");
const swaggerUi = require('swagger-ui-express');
const fs = require("fs")
const YAML = require('yaml')

const file  = fs.readFileSync('./swagger/api-docs.yaml', 'utf8')
const swaggerDocument = YAML.parse(file)
const usersRouter = require("./controllers/users");
const conversationsRouter = require("./controllers/conversations");
const messagesRouter = require("./controllers/messages");
const authenticationRouter = require("./controllers/authentication");
const participantsRouter = require("./controllers/participants");
const friendsRouter = require("./controllers/friends");

// import middleware
const { unknownEndpoint, errorHandler } = require("./utils/middleware");

// initialize express app
const { app } = require("./socket/socket");

// allow cors to connect from frontend

app.use(cors());
require("dotenv").config();

app.use(express.json());
app.use("/api/users", usersRouter);
app.use("/api/auth", authenticationRouter);
app.use("/api/participants", participantsRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/friends", friendsRouter);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use(unknownEndpoint);
app.use(errorHandler);

module.exports = app;
