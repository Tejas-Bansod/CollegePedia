/**
 * @file models/insInformationIds.js
 * @description Mongoose schema for INSInformationIDs model, tracking college information submissions.
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * INSInformationIDs Schema
 * @typedef {Object} INSInformationIDs
 * @property {string} info_id - Unique identifier for the information
 * @property {string} posted_by_id - ID of the user who posted (references User)
 * @property {string} verification - Verification status (Pending, Approved, Rejected)
 * @property {string} [approved_by_id] - ID of the approver (references Staff or Admin)
 * @property {string} [approved_by_model] - Model of the approver (Staff or Admin)
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */
const INSInformationIDsSchema = new Schema(
  {
    info_id: {
      type: String,
      required: [true, 'Info ID is required'],
      unique: true,
      trim: true,
    },
    posted_by_id: {
      type: String,
      required: [true, 'Posted by ID is required'],
      ref: 'User',
      trim: true,
    },
    verification: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
    },
    approved_by_id: {
      type: String,
      refPath: 'approved_by_model',
      trim: true,
    },
    approved_by_model: {
      type: String,
      enum: ['Staff', 'Admin'],
    },
  },
  {
    timestamps: true,
  }
);

// Index for non-unique field
INSInformationIDsSchema.index({ posted_by_id: 1 });

// Custom error handling
INSInformationIDsSchema.post('save', function (error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    next(new Error(`${field} already exists`));
  } else {
    next(error);
  }
});

module.exports = mongoose.model('INSInformationIDs', INSInformationIDsSchema);