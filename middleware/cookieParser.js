/**
 * @file middleware/cookieParser.js
 * @description Middleware to parse cookies from incoming requests.
 * @module middleware/cookieParser
 */
const cookieParser = require('cookie-parser');

module.exports = cookieParser();