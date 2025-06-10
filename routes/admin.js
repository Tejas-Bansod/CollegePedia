/**
 * @file routes/admin.js
 * @description Routes for admin registration and login in the Collegepedia project.
 * @module routes/admin
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); // Added import for bcryptjs
const { hashPassword, generateToken } = require('../utils/authUtils');
const { v4: uuidv4 } = require('uuid');
const { Admin } = require('../models');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/roles');
const rateLimit = require('express-rate-limit');
const { User, Staff, INSInformationIDs, Information } = require('../models'); // Correct imports
const mongoose = require('mongoose');
// Rate limiting for admin routes
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit to 5 attempts
  message: 'Too many attempts, please try again after 15 minutes',
});

/**
 * @route POST /api/admin/bootstrap
 * @description Bootstrap the first admin (one-time setup, restricted by env variable)
 * @access Restricted
 * @param {Object} req.body - Request body
 * @param {string} req.body.f_name - First name
 * @param {string} req.body.l_name - Last name
 * @param {string} req.body.admin_id - Unique admin ID
 * @param {string} req.body.password - Password (min 8 characters)
 * @param {string[]} req.body.roles - Roles (Co-Admin, Admin)
 * @returns {Object} Response with success message
 */
router.post('/bootstrap', adminLimiter, async (req, res) => {
  if (process.env.ALLOW_BOOTSTRAP !== 'true') {
    return res.status(403).json({ msg: 'Bootstrap route is disabled' });
  }
  try {
    const { f_name, l_name, admin_id, password, roles } = req.body;

    // Input validation
    if (!f_name || !l_name || !admin_id || !password || !roles) {
      return res.status(400).json({ msg: 'All fields are required' });
    }

    if (admin_id.length < 4) {
      return res.status(400).json({ msg: 'Admin ID must be at least 4 characters' });
    }

    const validRoles = ['Co-Admin', 'Admin'];
    if (!Array.isArray(roles) || !roles.every((role) => validRoles.includes(role))) {
      return res.status(400).json({ msg: 'Invalid role specified' });
    }

    // Check for existing admin
    const existingAdmin = await Admin.findOne({ admin_id });
    if (existingAdmin) {
      return res.status(409).json({ msg: 'Admin ID already exists' });
    }

    // Hash password
    const hashed_pass = await hashPassword(password);

    // Create admin
    const admin = new Admin({
      admin_id,
      user_name: { f_name, l_name },
      hashed_pass,
      roles,
      ip: req.ip,
      browser: req.get('User-Agent'),
    });

    await admin.save();

    // Disable bootstrap after first admin creation
    process.env.ALLOW_BOOTSTRAP = 'false';

    res.status(201).json({ msg: 'First admin registered successfully' });
  } catch (error) {
    console.error('Admin bootstrap error:', {
      message: error.message,
      admin_id: req.body.admin_id,
      stack: error.stack,
    });
    if (error.message.includes('already exists')) {
      return res.status(409).json({ msg: error.message });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * @route POST /api/admin/register
 * @description Register a new admin (admin only)
 * @access Admin
 * @param {Object} req.body - Request body
 * @param {string} req.body.f_name - First name
 * @param {string} req.body.l_name - Last name
 * @param {string} req.body.admin_id - Unique admin ID
 * @param {string} req.body.password - Password (min 8 characters)
 * @param {string[]} req.body.roles - Roles (Co-Admin, Admin)
 * @returns {Object} Response with success message
 */
router.post('/register', auth, checkRole(['Admin']), adminLimiter, async (req, res) => {
  try {
    const { f_name, l_name, admin_id, password, roles } = req.body;

    // Input validation
    if (!f_name || !l_name || !admin_id || !password || !roles) {
      return res.status(400).json({ msg: 'All fields are required' });
    }

    if (admin_id.length < 4) {
      return res.status(400).json({ msg: 'Admin ID must be at least 4 characters' });
    }

    const validRoles = ['Co-Admin', 'Admin'];
    if (!Array.isArray(roles) || !roles.every((role) => validRoles.includes(role))) {
      return res.status(400).json({ msg: 'Invalid role specified' });
    }

    // Check for existing admin
    const existingAdmin = await Admin.findOne({ admin_id });
    if (existingAdmin) {
      return res.status(409).json({ msg: 'Admin ID already exists' });
    }

    // Hash password
    const hashed_pass = await hashPassword(password);

    // Create admin
    const admin = new Admin({
      admin_id,
      user_name: { f_name, l_name },
      hashed_pass,
      roles,
      ip: req.ip,
      browser: req.get('User-Agent'),
    });

    await admin.save();

    res.status(201).json({ msg: 'Admin registered successfully' });
  } catch (error) {
    console.error('Admin register error:', {
      message: error.message,
      admin_id: req.body.admin_id,
      stack: error.stack,
    });
    if (error.message.includes('already exists')) {
      return res.status(409).json({ msg: error.message });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * @route POST /api/admin/login
 * @description Authenticate an admin
 * @access Public
 * @param {Object} req.body - Request body
 * @param {string} req.body.admin_id - Admin ID
 * @param {string} req.body.password - Password
 * @returns {Object} Response with success message, JWT token, role, and redirect URL
 */
router.post('/login', adminLimiter, async (req, res) => {
  try {
    const { admin_id, password } = req.body;

    // Input validation
    if (!admin_id || !password) {
      return res.status(400).json({ msg: 'Admin ID and password are required' });
    }

    // Find admin
    const admin = await Admin.findOne({ admin_id }).lean();
    if (!admin) {
      return res.status(401).json({ msg: 'Invalid Admin ID or password' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, admin.hashed_pass);
    if (!isMatch) {
      return res.status(401).json({ msg: 'Invalid Admin ID or password' });
    }

    // Generate JWT
    const token = generateToken({
      id: admin._id,
      role: admin.roles[0],
      userType: 'admin',
    });

    // Set token in cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    // Redirect to admin dashboard
    const redirectUrl = '/api/dashboard/admin';

    res.status(200).json({
      msg: 'Login successful',
      token,
      role: admin.roles[0],
      redirectUrl,
    });
  } catch (error) {
    console.error('Admin login error:', {
      message: error.message,
      admin_id: req.body.admin_id,
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

/**
 * @route GET /api/admin/users
 * @description List all users with filtering, searching, and pagination
 * @access Admin, Co-Admin
 * @returns {HTML} Renders admin/users.ejs with user list and status stats
 */
router.get('/users', auth, checkRole(['Admin', 'Co-Admin']), async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    let query = {};
    if (status && ['Active', 'Hold', 'Banned'].includes(status)) {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { 'user_name.f_name': { $regex: search, $options: 'i' } },
        { 'user_name.l_name': { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    // Fetch users
    const users = await User.find(query)
      .select('user_name email roles status verification user_id')
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Count total users for pagination
    const totalUsers = await User.countDocuments(query);

    // Aggregate status stats for chart
    const statusStats = await User.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const statsObj = { active: 0, hold: 0, banned: 0 };
    statusStats.forEach(s => {
      if (s._id === 'Active') statsObj.active = s.count;
      if (s._id === 'Hold') statsObj.hold = s.count;
      if (s._id === 'Banned') statsObj.banned = s.count;
    });

    res.render('admin/users', {
      title: 'User Management',
      user: req.user.user,
      users,
      stats: statsObj,
      page: parseInt(page),
      totalPages: Math.ceil(totalUsers / parseInt(limit)),
      currentStatus: status || '',
      currentSearch: search || '',
      error: null,
    });
  } catch (error) {
    console.error('User management error:', {
      message: error.message,
      user_id: req.user.id,
      role: req.user.role,
      stack: error.stack,
      time: new Date().toISOString(),
    });
    res.status(500).render('error', {
      title: 'Error',
      msg: 'Failed to fetch users',
    });
  }
});

/**
 * @route PUT /api/admin/users/:id/status
 * @description Update a user’s status (Active, Hold, Banned)
 * @access Admin, Co-Admin
 * @returns {JSON} Success or error message
 */
router.put('/users/:id/status', auth, checkRole(['Admin', 'Co-Admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Active', 'Hold', 'Banned'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Use Active, Hold, or Banned.' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid user ID format.' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent self-modification by admin (check Admin schema)
    const admin = await Admin.findOne({ admin_id: req.user.id });
    if (admin && user.user_id === req.user.id) {
      return res.status(403).json({ error: 'Cannot modify own status' });
    }

    user.status = status;
    await user.save();

    res.status(200).json({ message: 'User status updated successfully.' });
  } catch (error) {
    console.error('User status update error:', {
      message: error.message,
      user_id: req.params.id,
      status: req.body.status,
      admin_id: req.user.id,
      stack: error.stack,
      time: new Date().toISOString(),
      updatedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) 
    });
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

/**
 * @route GET /api/admin/analytics
 * @description Display submission statistics, user counts, college counts, and recent activity
 * @access Admin, Co-Admin
 * @returns {HTML} Renders admin/analytics.ejs with data
 */
router.get('/analytics', auth, checkRole(['Admin', 'Co-Admin']), async (req, res) => {
  try {
    // Aggregate stats
    const stats = await INSInformationSchema.aggregate([
      {
      $group: {
        _id: status.verification,
        count: stats.countDocuments(),
      },
  }]);

    const statsObj = { total: 0, pending: 0, accepted: 0, rejected: 0 };
    stats.forEach(stat => {
      if (stat._id === 'Pending') statsObj.pending += stat.count;
      if (stat._id === 'Approved') statsObj.accepted += stat.count;
      if (stat._id === 'Rejected') statsObj.rejected += stat.count;
      statsObj.total += stat.count;
    });

    // Count total users
    const totalUsers = await User.countDocuments();

    // Count total colleges
    const totalColleges = await Information.countDocuments();

    // Count recent activity (submissions in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentActivity = await INSInformationSchema.countDocuments({
      created_at: { $gte: thirtyDaysAgo },
    });

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    // Fetch recent submissions (last 30 days)
    const recentSubmissions = await INSInformationSchema.find({
      created_at: { $gte: thirtyDaysAgo },
    })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const infoIds = recentSubmissions.map(sub => sub.info_id);
    const informations = await Information.find({ info_id: { $in: infoIds } })
      .select('info_id clg_name')
      .lean();

    const submissions = await Promise.all(
      recentSubmissions.map(async sub => {
        const info = informations.find(i => i.info_id === sub.info_id) || {};
        // Lookup user by posted_by_id (string, matches User.user_id)
        const user = await User.findOne({ user_id: sub.posted_by_id })
          .select('user_name')
          .lean();
        const posted_by_name = user
          ? `${user.user_name.f_name} ${user.user_name.l_name}`
          : 'Unknown';
        return {
          info_id: sub.info_id,
          clg_name: info.clg_name || 'Unnamed',
          verification: sub.verification,
          posted_by_name,
          submitted_at: sub.created_at.toISOString().split('T')[0], // Format as YYYY-MM-DD
        };
      })
    );

    res.render('admin/analytics', {
      title: 'Analytics Dashboard',
      user: req.user.user,
      stats: statsObj,
      totalUsers,
      totalColleges,
      recentActivity,
      recentSubmissions: submissions,
      page,
      error: null,
    });
  } catch (error) {
    console.error('Analytics error:', {
      message: error.message,
      user_id: req.user.id,
      role: req.user.role,
      stack: error.stack,
      time: new Date().toISOString(),
    });
    res.status(500).render('error', {
      title: 'Error',
      msg: 'Failed to fetch analytics data',
    });
  }
});

module.exports = router;