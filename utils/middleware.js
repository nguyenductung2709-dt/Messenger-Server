const Sequelize = require('sequelize');
const { SECRET } = require('./config.js');
const jwt = require('jsonwebtoken');
const { User, Session } = require('../models/index');

const errorHandler = (error, request, response, next) => {
    logger.error(error.message)
  
    if (error.name === 'CastError') {
      return response.status(400).send({ error: 'malformatted id' })
    } else if (error.name === 'ValidationError') {
      return response.status(400).json({ error: error.message })
    } 
      else if (error.name === 'JsonWebTokenError') {
      return response.status(401).json({
        error: 'invalid token'
      })
  
    } else if (error.name === 'TokenExpiredError') {
      return response.status(401).json({
        error: 'token expired'
      })
    }
  
    next(error)
  }

const getTokenFrom = req => {
  const authorization = req.headers.authorization;
  if (authorization && authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.substring(7);
  }
  return null;
};

const tokenExtractor = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (authorization && authorization.toLowerCase().startsWith('bearer ')) {
    const token = authorization.substring(7);
    try {
      const decodedToken = jwt.verify(token, SECRET);
      req.decodedToken = decodedToken;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Token invalid' });
    }
  } else {
    return res.status(401).json({ error: 'Token missing' });
  }
};

const validateSession = async ({ id, token }) => {
  const session = await Session.findOne({
    where: {
      userId: id
    }
  });
  return session && session.token === token;
};

const findUserSession = async (req, res, next) => {
  try {
    const token = getTokenFrom(req)
    const decodedToken = jwt.verify(token, SECRET)
    req.user = await User.findByPk(decodedToken.id)
    const id = req.user.id
    const validSession = await validateSession({id, token})
    if (!decodedToken.id || !validSession) {
        throw Error('Session not valid!')
    }
    if(req.user.disabled){
        throw Error('User disabled!')
    }
    next()
} catch (error) {
    next(error)
}
};

module.exports = {
  errorHandler,
  tokenExtractor,
  validateSession,
  findUserSession
};
