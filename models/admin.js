/**
 * @file models/admin.js
 * @description Mongoose schema for Admin model, representing co-admins and admins.
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Admin Schema
 * @typedef {Object} Admin
 * @property {string} admin_id - Unique identifier for the admin
 * @property {Object} user_name - Admin's full name
 * @property {string} user_name.f_name - First name
 * @property {string} user_name.l_name - Last name
 * @property {string} hashed_pass - Hashed password
 * @property {string[]} roles - Roles (Co-Admin, Admin)
 * @property {string} [ip] - IP address of last login
 * @property {string} [browser] - Browser of last login
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */
const AdminSchema = new Schema(
  {
    admin_id: {
      type: String,
      required: [true, 'Admin ID is required'],
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
      type: [{ type: String, enum: ['Co-Admin', 'Admin'] }],
      required: [true, 'At least one role is required'],
      default: ['Co-Admin'],
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
AdminSchema.post('save', function (error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    next(new Error(`${field} already exists`));
  } else {
    next(error);
  }
});

module.exports = mongoose.model('Admin', AdminSchema);