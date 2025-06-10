/**
 * @file models/verificationToken.js
 * @description Mongoose schema for VerificationToken model, storing email verification tokens.
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * VerificationToken Schema
 * @typedef {Object} VerificationToken
 * @property {mongoose.Types.ObjectId} user_id - Reference to User
 * @property {string} token - Unique verification token
 * @property {Date} expires_at - Token expiration date
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */
const VerificationTokenSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      required: [true, 'User ID is required'],
      ref: 'User',
      unique: true, // One token per user
    },
    token: {
      type: String,
      required: [true, 'Token is required'],
      unique: true,
      trim: true,
    },
    expires_at: {
      type: Date,
      required: [true, 'Expiration date is required'],
    },
  },
  {
    timestamps: true,
  }
);

// Custom error handling for unique constraints
VerificationTokenSchema.post('save', function (error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    next(new Error(`${field} already exists`));
  } else {
    next(error);
  }
});

module.exports = mongoose.model('VerificationToken', VerificationTokenSchema);