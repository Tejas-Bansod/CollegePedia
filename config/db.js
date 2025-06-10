/**
 * @file config/db.js
 * @description Establishes connection to MongoDB using Mongoose for the Collegepedia project.
 * @module config/db
 */
const mongoose = require('mongoose');

/**
 * Connects to MongoDB database
 * @returns {Promise<void>} Resolves when connection is successful, exits process on failure
 */
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost/collegepedia');
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1); // Exit process on connection failure
  }
};

module.exports = connectDB;