/**
 * @file models/index.js
 * @description Centralized export of all Mongoose models for the Collegepedia project.
 * Ensures all models are properly defined and provides logging for initialization.
 * @module models
 */
const mongoose = require('mongoose');
const User = require('./user');
const Staff = require('./staff');
const Admin = require('./admin');
const INSInformationIDs = require('./insInformationIds');
const Information = require('./information');
const VerificationToken = require('./verificationToken');

/**
 * Validates that a Mongoose model is properly defined
 * @param {string} modelName - Name of the model
 * @param {mongoose.Model} model - Mongoose model instance
 * @throws {Error} If the model is undefined or invalid
 */
const validateModel = (modelName, model) => {
  if (!model || typeof model !== 'function' || !model.modelName) {
    throw new Error(`Model ${modelName} is not properly defined`);
  }
};

/**
 * All Mongoose models for the Collegepedia project
 * @typedef {Object} Models
 * @property {mongoose.Model} User - User model (Users, Institutions)
 * @property {mongoose.Model} Staff - Staff model (Staff, Agents)
 * @property {mongoose.Model} Admin - Admin model (Co-Admin, Admin)
 * @property {mongoose.Model} INSInformationIDs - Tracks college information submissions
 * @property {mongoose.Model} Information - Stores college details
 * @property {mongoose.Model} VerificationToken - Stores email verification tokens
 */
const models = {
  User,
  Staff,
  Admin,
  INSInformationIDs,
  Information,
  VerificationToken,
};

// Validate all models and log initialization
try {
  Object.entries(models).forEach(([modelName, model]) => {
    validateModel(modelName, model);
    console.log(`Model ${modelName} initialized successfully`);
  });

  if (mongoose.connection.readyState !== 1) {
    console.warn('Mongoose is not connected. Ensure connectDB is called before using models.');
  }
} catch (error) {
  console.error('Error initializing models:', error.message);
  throw error;
}

module.exports = models;