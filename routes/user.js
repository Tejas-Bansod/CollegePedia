/**
 * @file routes/auth.js
 * @description Authentication routes for user registration and email verification in the Collegepedia project.
 * @module routes/auth
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { hashPassword, generateToken } = require('../utils/authUtils');
const { v4: uuidv4 } = require('uuid');
const { User, VerificationToken } = require('../models');
const sendEmail = require('../utils/sendEmail');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/roles');
const rateLimit = require('express-rate-limit');

// Rate limiting for user routes
const userLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit to 5 attempts
  message: 'Too many attempts, please try again after 15 minutes',
});

/**
 * @route POST /api/auth/register
 * @description Register a new user and send verification email
 * @access Public
 * @param {Object} req.body - Request body
 * @param {string} req.body.f_name - First name
 * @param {string} req.body.l_name - Last name
 * @param {string} req.body.email - Email address
 * @param {string} req.body.password - Password (min 8 characters)
 * @param {string} [req.body.role] - Role (Users or Institutions, default: Users)
 * @returns {Object} Response with success message and JWT token
 */
router.post('/register', userLimiter, async (req, res) => {
  try {
    const { f_name, l_name, email, password, role } = req.body;

    if (!f_name || !l_name || !email || !password) {
      return res.status(400).json({ msg: 'All fields are required' });
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ msg: 'Invalid email format' });
    }

    const validRoles = ['Users', 'Institutions'];
    const userRole = role && validRoles.includes(role) ? role : 'Users';

    if (userRole === 'Institutions') {
      const publicDomains = [
        'gmail.com',
        'yahoo.com',
        'hotmail.com',
        'outlook.com',
        'aol.com',
        'icloud.com',
        'protonmail.com',
        'mail.com',
      ];
      const emailDomain = email.split('@')[1].toLowerCase();
      if (publicDomains.includes(emailDomain)) {
        return res.status(400).json({
          msg: 'Institutions must use a professional email (not gmail.com, yahoo.com, etc.)',
        });
      }
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ msg: 'Email already exists' });
    }

    const hashed_pass = await hashPassword(password);
    const user_id = uuidv4();

    const user = new User({
      user_id,
      user_name: { f_name, l_name },
      email,
      hashed_pass,
      roles: [userRole],
      verification: 'Pending',
      status: 'Active',
      ip: req.ip,
      browser: req.get('User-Agent'),
    });

    await user.save();

    const verificationToken = uuidv4();
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const tokenDoc = new VerificationToken({
      user_id: user._id,
      token: verificationToken,
      expires_at,
    });

    await tokenDoc.save();

    const verificationUrl = `http://${req.get('host')}/api/auth/verify/${verificationToken}`;
    await sendEmail({
      to: email,
      subject: 'Verify Your Collegepedia Account',
      text: `Please verify your email by clicking the link: ${verificationUrl}`,
      html: `
        <div style="background-color: #f9f9fc; padding: 40px 0; font-family: Arial, sans-serif;">
          <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 30px;">
            <h2 style="color: #6a0dad; text-align: center; margin-bottom: 20px;">Welcome to Collegepedia!</h2>
            <p style="font-size: 16px; color: #333333; line-height: 1.6;">
              Hi ${f_name},
            </p>
            <p style="font-size: 16px; color: #333333; line-height: 1.6;">
              Thanks for signing up! You're one step away from unlocking everything Collegepedia offers. Just confirm your email by clicking the button below:
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="background-color: #6a0dad; color: white; text-decoration: none; padding: 14px 28px; font-size: 16px; border-radius: 5px; display: inline-block;">
                Verify Email
              </a>
            </div>
            <p style="font-size: 14px; color: #888888;">
              This link will expire in 24 hours. If you didn’t sign up, feel free to ignore this message.
            </p>
            <hr style="border: none; border-top: 1px solid #eeeeee; margin: 30px 0;">
            <p style="font-size: 12px; color: #aaaaaa; text-align: center;">
              &copy; ${new Date().getFullYear()} Collegepedia. All rights reserved.
            </p>
          </div>
        </div>
      `,
    });

    const token = generateToken({
      id: user._id,
      role: userRole,
      userType: 'user',
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    res.status(201).json({
      msg: 'User registered successfully, verification email sent',
      token,
    });
  } catch (error) {
    console.error('Register error:', {
      message: error.message,
      email: req.body.email,
    });
    if (error.message.includes('already exists')) {
      return res.status(409).json({ msg: error.message });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * @route POST /api/auth/login
 * @description Authenticate a verified user with email and password
 * @access Public
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - Email address
 * @param {string} req.body.password - Password
 * @returns {Object} Response with success message, JWT token, and role
 */
router.post('/login', userLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      return res.status(400).json({ msg: 'Email and password are required' });
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ msg: 'Invalid email format' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ msg: 'Invalid email or password' });
    }

    // Check verification status
    if (user.verification !== 'Verified') {
      return res.status(403).json({ msg: 'Please verify your email before logging in' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.hashed_pass);
    if (!isMatch) {
      return res.status(401).json({ msg: 'Invalid email or password' });
    }

    // Check account status
    if (user.status === 'Hold') {
      return res.status(403).json({ msg: 'Your account is on hold. Please contact support.' });
    }
    if (user.status === 'Banned') {
      return res.status(403).json({ msg: 'Your account has been permanently banned.' });
    }


    // Generate JWT
    const token = generateToken({
      id: user._id,
      role: user.roles[0],
      userType: 'user',
    });

    // Set token in cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    // Determine redirect URL based on role
    const redirectUrl = user.roles[0] === 'Users' ? 'dashboard/user' : 'dashboard/institution';

    res.status(200).json({
      msg: 'Login successful',
      token,
      role: user.roles[0],
      redirectUrl,
    });
  } catch (error) {
    console.error('Login error:', {
      message: error.message,
      email: req.body.email,
    });
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * @route GET /api/auth/logout
 * @description Log out user by clearing JWT cookie
 * @access Public
 * @returns {Object} Response with success message
 */
router.get('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  res.status(200).json({ msg: 'Logged out successfully' });
});

/**
 * @route GET /api/auth/verify/:token
 * @description Verify user email using token
 * @access Public
 * @param {string} req.params.token - Verification token
 * @returns {Object} Response with success or error message
 */
router.get('/verify/:token', userLimiter, async (req, res) => {
  try {
    const { token } = req.params;

    // Find verification token
    const tokenDoc = await VerificationToken.findOne({
      token,
      expires_at: { $gt: new Date() },
    });

    if (!tokenDoc) {
      return res.status(400).json({ msg: 'Invalid or expired token' });
    }

    // Update user verification status
    const user = await User.findById(tokenDoc.user_id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (user.verification === 'Verified') {
      return res.status(400).json({ msg: 'Email already verified' });
    }

    user.verification = 'Verified';
    await user.save();

    // Delete used token
    await VerificationToken.deleteOne({ token });

    res.status(200).json({ msg: 'Email verified successfully' });
  } catch (error) {
    console.error('Verification error:', {
      message: error.message,
      token: req.params.token,
    });
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * @route POST /api/auth/resend-verification
 * @description Resend verification email to a user with Pending verification status
 * @access Public, rate-limited
 * @returns {JSON} Success or error message
 */
router.post('/resend-verification', userLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ msg: 'Invalid email address' });
    }

    const user = await User.findOne({ email }).lean();
    if (!user) {
      return res.status(400).json({ msg: 'User not found' });
    }
    if (user.verification === 'Verified') {
      return res.status(400).json({ msg: 'Email already verified' });
    }

    const verificationToken = uuidv4();
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await VerificationToken.findOneAndUpdate(
      { user_id: user._id },
      { token: verificationToken, expires_at },
      { upsert: true }
    );

    const verificationUrl = `http://${req.get('host')}/api/auth/verify/${verificationToken}`;
    await sendEmail({
      to: email,
      subject: 'Verify Your Collegepedia Account',
      text: `Please verify your email by clicking the following link: ${verificationUrl}`,
      html: `
        <div style="background-color: #f9f9fc; padding: 40px 0; font-family: Arial, sans-serif;">
          <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 30px;">
            <h2 style="color: #6a0dad; text-align: center; margin-bottom: 20px;">Verify Your Collegepedia Account</h2>
            <p style="font-size: 16px; color: #333333; line-height: 1.6;">
              Hi there,
            </p>
            <p style="font-size: 16px; color: #333333; line-height: 1.6;">
              You're almost ready to start exploring Collegepedia. Please confirm that <strong>${email}</strong> is your email address by clicking the button below:
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="background-color: #6a0dad; color: white; text-decoration: none; padding: 14px 28px; font-size: 16px; border-radius: 5px; display: inline-block;">
                Verify Email
              </a>
            </div>
            <p style="font-size: 14px; color: #888888;">
              This link will expire in 24 hours. If you didn’t request this, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #eeeeee; margin: 30px 0;">
            <p style="font-size: 12px; color: #aaaaaa; text-align: center;">
              &copy; ${new Date().getFullYear()} Collegepedia. All rights reserved.
            </p>
          </div>
        </div>
      `,
    });

    res.status(200).json({ msg: 'Verification email resent successfully' });
  } catch (error) {
    console.error('Resend verification error:', {
      message: error.message,
      email: req.body.email,
      stack: error.stack,
    });
    res.status(500).json({ msg: 'Failed to resend verification email' });
  }
});



/**
 * @route PUT /api/user/profile
 * @description Update the authenticated user's profile
 * @access Users, Institutions
 * @returns {JSON} Success or error message, redirects to /api/user/profile
 */
router.put('/profile', auth, checkRole(['Users', 'Institutions']), async (req, res) => {
  try {
    const { f_name, l_name, password } = req.body;

    // Validate inputs
    if (!f_name || !l_name || f_name.length < 2 || l_name.length < 2) {
      return res.status(400).json({ msg: 'First and last names must be at least 2 characters' });
    }

    const updateFields = {
      'user_name.f_name': f_name,
      'user_name.l_name': l_name,
    };

    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ msg: 'Password must be at least 8 characters' });
      }
      updateFields.password = await hashPassword(password);
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true }
    ).select('user_name email roles status verification');

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.status(200).json({ msg: 'Profile updated successfully' });
  } catch (error) {
    console.error('Profile update error:', {
      message: error.message,
      user_id: req.user.id,
      role: req.user.role,
      stack: error.stack,
    });
    res.status(500).json({ msg: 'Failed to update profile' });
  }
});

module.exports = router;