/**
 * @file models/user.js
 * @description Mongoose schema for User model, representing normal users and institutions.
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * User Schema
 * @typedef {Object} User
 * @property {string} user_id - Unique identifier for the user
 * @property {Object} user_name - User's full name
 * @property {string} user_name.f_name - First name
 * @property {string} user_name.l_name - Last name
 * @property {string} email - Unique email address
 * @property {string} hashed_pass - Hashed password
 * @property {string[]} roles - Roles (Users, Institutions)
 * @property {string} verification - Verification status (Pending, Verified)
 * @property {string} status - Account status (Active, Hold, Banned)
 * @property {string} [ip] - IP address of last login
 * @property {string} [browser] - Browser of last login
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */
const UserSchema = new Schema(
  {
    user_id: {
      type: String,
      required: [true, 'User ID is required'],
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
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    hashed_pass: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
    },
    roles: {
      type: [{ type: String, enum: ['Users', 'Institutions'] }],
      required: [true, 'At least one role is required'],
      default: ['Users'],
    },
    verification: {
      type: String,
      enum: ['Pending', 'Verified'],
      default: 'Pending',
    },
    status: {
      type: String,
      enum: ['Active', 'Hold', 'Banned'],
      default: 'Active',
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

// Pre-save hook to ensure email is lowercase
UserSchema.pre('save', function (next) {
  if (this.email) {
    this.email = this.email.toLowerCase();
  }
  next();
});

// Custom error handling for unique constraints
UserSchema.post('save', function (error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    next(new Error(`${field} already exists`));
  } else {
    next(error);
  }
});

module.exports = mongoose.model('User', UserSchema);