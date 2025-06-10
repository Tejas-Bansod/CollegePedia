/**
 * @file models/information.js
 * @description Mongoose schema for Information model, storing college details.
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Information Schema
 * @typedef {Object} Information
 * @property {string} info_id - Unique identifier for the information
 * @property {string} clg_name - College name
 * @property {string} [clg_heading] - College heading
 * @property {string} [clg_info1] - Additional info 1
 * @property {string} [clg_info2] - Additional info 2
 * @property {string} [clg_info3] - Additional info 3
 * @property {string[]} clg_images_paths - Paths to college images
 * @property {Object[]} clg_courses - Courses offered
 * @property {string} clg_courses.courses - Course name
 * @property {string} clg_courses.syllabus - Course syllabus
 * @property {string[]} clg_departments - Departments
 * @property {number} clg_rating - Rating (0-5)
 * @property {string[]} clg_acmts - Accommodations
 * @property {string[]} clg_acmts_img_paths - Paths to accommodation images
 * @property {string} [clg_contact] - Contact info
 * @property {string} [clg_email] - College email
 * @property {Object} clg_address - Address details
 * @property {string} [clg_address.address] - Street address
 * @property {string} [clg_address.country] - Country
 * @property {string} [clg_address.state] - State
 * @property {string} [clg_address.city] - City
 * @property {string} [clg_address.pincode] - Pincode
 * @property {string} [clg_address_url] - Address URL
 * @property {number} [clg_since] - Year established
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */
const InformationSchema = new Schema(
  {
    info_id: {
      type: String,
      required: [true, 'Info ID is required'],
      unique: true,
      trim: true,
    },
    clg_name: {
      type: String,
      required: [true, 'College name is required'],
      trim: true,
      minlength: [2, 'College name must be at least 2 characters'],
    },
    clg_heading: {
      type: String,
      trim: true,
    },
    clg_info1: {
      type: String,
      trim: true,
    },
    clg_info2: {
      type: String,
      trim: true,
    },
    clg_info3: {
      type: String,
      trim: true,
    },
    clg_images_paths: [{
      type: String,
      trim: true,
    }],
    clg_courses: [{
      courses: {
        type: String,
        trim: true,
      },
      syllabus: {
        type: String,
        trim: true,
      },
    }],
    clg_departments: [{
      type: String,
      trim: true,
    }],
    clg_rating: {
      type: Number,
      min: [0, 'Rating cannot be less than 0'],
      max: [5, 'Rating cannot be more than 5'],
      default: 0,
    },
    clg_acmts: [{
      type: String,
      trim: true,
    }],
    clg_acmts_img_paths: [{
      type: String,
      trim: true,
    }],
    clg_contact: {
      type: String,
      trim: true,
    },
    clg_email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    clg_address: {
      address: { type: String, trim: true },
      country: { type: String, trim: true },
      state: { type: String, trim: true },
      city: { type: String, trim: true },
      pincode: { type: String, trim: true },
    },
    clg_address_url: {
      type: String,
      trim: true,
    },
    clg_since: {
      type: Number,
      min: [1800, 'Year established cannot be before 1800'],
    },
  },
  {
    timestamps: true,
  }
);

// Index for non-unique field
InformationSchema.index({ clg_name: 1 });

// Custom error handling
InformationSchema.post('save', function (error, doc, next) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    next(new Error(`${field} already exists`));
  } else {
    next(error);
  }
});

module.exports = mongoose.model('Information', InformationSchema);