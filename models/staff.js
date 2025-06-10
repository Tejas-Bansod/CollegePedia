/**
 * @file models/staff.js
 * @description Mongoose schema for Staff model, representing staff and agents.
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Staff Schema
 * @typedef {Object} Staff
 * @property {string} staff_id - Unique identifier for the staff
 * @property {Object} user_name - Staff's full name
 * @property {string} user_name.f_name - First name
 * @property {string} user_name.l_name - Last name
 * @property {string} hashed_pass - Hashed password
 * @property {string[]} roles - Roles (Staff, Agents)
 * @property {string} [ip] - IP address of last login
 * @property {string} [browser] - Browser of last login
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */
const StaffSchema = new Schema(
  {
    staff_id: {
      type: String,
      required: [true, 'Staff ID is required'],
      unique: true,
      trim: true,
    },
    user_name: {
      f_name: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
        minlength: [2, 'First name must be at least 2 characters'],
      },
      l_name: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
        minlength: [2, 'Last name must be at least 2 characters'],
      },
    },
    hashed_pass: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
    },
    roles: {
      type: [{ type: String, enum: ['Staff', 'Agents'] }],
      required: [true, 'At least one role is required'],
      default: ['Staff'],
    },
    ip: {
      type: String,
      trim: true,
    },
    browser: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Custom error handling
StaffSchema.post('save', function (error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    next(new Error(`${field} already exists`));
  } else {
    next(error);
  }
});

module.exports = mongoose.model('Staff', StaffSchema);