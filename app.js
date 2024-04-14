const config = require("./utils/config");
const middleware = require("./utils/middleware");

//import controllers
const usersRouter = require("./controllers/users");
const conversationsRouter = require("./controllers/conversations");
const messagesRouter = require("./controllers/messages");
const authenticationRouter = require("./controllers/authentication");
const participantsRouter = require("./controllers/participants");
const friendsRouter = require("./controllers/friends");

//initialize express app
const express = require("express");
const app = express();

//allow cors to connect from frontend
const cors = require("cors");
app.use(cors());
require("dotenv").config();
app.use(express.json());
app.use("/api/users", usersRouter);
app.use("/api/auth", authenticationRouter);
app.use("/api/participants", participantsRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/friends", friendsRouter);

module.exports = app;
