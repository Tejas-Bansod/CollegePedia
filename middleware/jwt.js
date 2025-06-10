/**
 * @file middleware/jwt.js
 * @description Middleware to verify JWT tokens from cookies or Authorization header.
 * Sets req.user with { id, role, userType } on successful verification.
 * @module middleware/jwt
 */
const jwt = require('jsonwebtoken');

/**
 * Verifies JWT token and attaches decoded payload to req.user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const verifyJWT = (req, res, next) => {
  // Check for token in cookies or Authorization header
  const token = req.cookies.token || req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  try {
    // Decode token; payload includes id, role (e.g., Users, Institutions, Staff, Agents, Co-Admin, Admin), userType (user, staff, admin)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('JWT verification error:', error.message);
    return res.status(401).json({ msg: error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token' });
  }
};

module.exports = verifyJWT;