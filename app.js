// Import environment variables
require("dotenv").config();

// Import controllers and libraries
const express = require("express");
const cors = require("cors");
const swaggerUi = require('swagger-ui-express');
const fs = require("fs");
const YAML = require('yaml');
const helmet = require('helmet');
const passport = require("passport");
require("./utils/passport"); // Ensure this file exports the passport configuration
const cookieSession = require("cookie-session");

// Import routers
const usersRouter = require("./controllers/users");
const conversationsRouter = require("./controllers/conversations");
const messagesRouter = require("./controllers/messages");
const authenticationRouter = require("./controllers/authentication");
const participantsRouter = require("./controllers/participants");
const friendsRouter = require("./controllers/friends");

// Import middleware
const { unknownEndpoint, errorHandler } = require("./utils/middleware");

// Initialize express app
const { app } = require("./socket/socket");

// Load and parse Swagger documentation
const file = fs.readFileSync('./swagger/api-docs.yaml', 'utf8');
const swaggerDocument = YAML.parse(file);

// Set up security-related middleware
app.use(helmet());

// Enable CORS
app.use(cors());

// Configure cookie-based session
app.use(
	cookieSession({
		name: "session",
		// eslint-disable-next-line no-undef
		keys: [process.env.SESSION_KEY || "defaultSessionKey"], // Use environment variable for session key
		maxAge: 24 * 60 * 60 * 1000, // 24 hours
	})
);

// Initialize Passport.js
app.use(passport.initialize());
app.use(passport.session());

// Set up JSON parsing and routes
app.use(express.json());
app.use("/api/users", usersRouter);
app.use("/api/auth", authenticationRouter);
app.use("/api/participants", participantsRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/friends", friendsRouter);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Handle unknown endpoints and errors
app.use(unknownEndpoint);
app.use(errorHandler);

module.exports = app;
