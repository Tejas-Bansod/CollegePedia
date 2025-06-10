/**
 * @file utils/authUtils.js
 * @description Utility functions for authentication-related tasks.
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * Hash a password using bcrypt
 * @param {string} password - Plaintext password
 * @returns {Promise<string>} Hashed password
 * @throws {Error} If password is invalid
 */
exports.hashPassword = async (password) => {
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

/**
 * Generate a JWT token
 * @param {Object} payload - JWT payload
 * @returns {string} JWT token
 */
exports.generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
};

module.exports = exports;