/**
 * @file routes/staff.js
 * @description Routes for staff registration and login in the Collegepedia project.
 * @module routes/staff
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); // Added import for bcryptjs
const { hashPassword, generateToken } = require('../utils/authUtils');
const { v4: uuidv4 } = require('uuid');
const { Staff } = require('../models');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/roles');
const rateLimit = require('express-rate-limit');

// Rate limiting for staff routes
const staffLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit to 5 attempts
  message: 'Too many attempts, please try again after 15 minutes',
});

/**
 * @route POST /api/staff/register
 * @description Register a new staff member (admin only)
 * @access Admin
 * @param {Object} req.body - Request body
 * @param {string} req.body.f_name - First name
 * @param {string} req.body.l_name - Last name
 * @param {string} req.body.staff_id - Unique staff ID
 * @param {string} req.body.password - Password (min 8 characters)
 * @param {string[]} req.body.roles - Roles (Staff, Agents)
 * @returns {Object} Response with success message
 */
router.post('/register', auth, checkRole(['Admin']), staffLimiter, async (req, res) => {
  try {
    const { f_name, l_name, staff_id, password, roles } = req.body;

    // Input validation
    if (!f_name || !l_name || !staff_id || !password || !roles) {
      return res.status(400).json({ msg: 'All fields are required' });
    }

    if (staff_id.length < 4) {
      return res.status(400).json({ msg: 'Staff ID must be at least 4 characters' });
    }

    const validRoles = ['Staff', 'Agents'];
    if (!Array.isArray(roles) || !roles.every((role) => validRoles.includes(role))) {
      return res.status(400).json({ msg: 'Invalid role specified' });
    }

    // Check for existing staff
    const existingStaff = await Staff.findOne({ staff_id });
    if (existingStaff) {
      return res.status(409).json({ msg: 'Staff ID already exists' });
    }

    // Hash password
    const hashed_pass = await hashPassword(password);

    // Generate unique staff_id if not provided
    const finalStaffId = staff_id || uuidv4();

    // Create staff
    const staff = new Staff({
      staff_id: finalStaffId,
      user_name: { f_name, l_name },
      hashed_pass,
      roles,
      ip: req.ip,
      browser: req.get('User-Agent'),
    });

    await staff.save();

    res.status(201).json({ msg: 'Staff registered successfully' });
  } catch (error) {
    console.error('Staff register error:', {
      message: error.message,
      staff_id: req.body.staff_id,
      stack: error.stack,
    });
    if (error.message.includes('already exists')) {
      return res.status(409).json({ msg: error.message });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * @route POST /api/staff/login
 * @description Authenticate a staff member
 * @access Public
 * @param {Object} req.body - Request body
 * @param {string} req.body.staff_id - Staff ID
 * @param {string} req.body.password - Password
 * @returns {Object} Response with success message, JWT token, role, and redirect URL
 */
router.post('/login', staffLimiter, async (req, res) => {
  try {
    const { staff_id, password } = req.body;

    // Input validation
    if (!staff_id || !password) {
      return res.status(400).json({ msg: 'Staff ID and password are required' });
    }

    // Find staff
    const staff = await Staff.findOne({ staff_id }).lean();
    if (!staff) {
      return res.status(401).json({ msg: 'Invalid Staff ID or password' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, staff.hashed_pass);
    if (!isMatch) {
      return res.status(401).json({ msg: 'Invalid Staff ID or password' });
    }

    // Generate JWT
    const token = generateToken({
      id: staff._id,
      userType: 'staff',
      role: staff.roles[0],
    });

    // Set token in cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    // Determine redirect URL based on role
    const redirectUrl = staff.roles[0] === 'Staff' ? '/api/dashboard/staff' : '/api/dashboard/agent';

    res.status(200).json({
      msg: 'Login successful',
      token,
      role: staff.roles[0],
      redirectUrl,
    });
  } catch (error) {
    console.error('Staff login error:', {
      message: error.message,
      staff_id: req.body.staff_id,
      code: error.code,
      stack: error.stack,
    });
    if (error.name === 'MongoServerError') {
      return res.status(500).json({ msg: 'Database error, please try again later' });
    }
    if (error.message.includes('bcrypt')) {
      return res.status(500).json({ msg: 'Password verification failed' });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;