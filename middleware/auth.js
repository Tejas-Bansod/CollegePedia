/**
 * @file middleware/auth.js
 * @description Middleware to authenticate requests by verifying JWT and validating user existence.
 * Sets req.user with decoded token and full user object. Redirects to login for web routes or returns JSON for API routes.
 * @module middleware/auth
 */
const { User, Staff, Admin } = require('../models');
const verifyJWT = require('./jwt');

/**
 * Authenticates request by verifying JWT and checking user in database
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const auth = async (req, res, next) => {
  // Determine if this is an API route
  const isApiRoute = req.path.startsWith('/api/');

  // Helper to handle unauthorized responses
  const handleUnauthorized = (msg) => {
    if (isApiRoute) {
      return res.status(401).json({ msg });
    }
    res.clearCookie('token');
    if (req.path.startsWith('/dashboard/staff') || req.path.startsWith('/dashboard/agent') || req.path.startsWith('/staff/register')) {
      return res.redirect('/staff/login');
    }
    if (req.path.startsWith('/dashboard/admin') || req.path.startsWith('/admin/register') || req.path.startsWith('/admin/login')) {
      return res.redirect('/admin/login');
    }
    return res.redirect('/login');
  };

  // Verify JWT first
  verifyJWT(req, res, async () => {
    try {
      // Validate token payload
      if (!req.user || !req.user.id || !req.user.userType) {
        return handleUnauthorized('Invalid token payload');
      }

      const { id, userType } = req.user;
      let user;

      // Find user based on userType
      if (userType === 'user') {
        user = await User.findById(id);
      } else if (userType === 'staff') {
        user = await Staff.findById(id);
      } else if (userType === 'admin') {
        user = await Admin.findById(id);
      } else {
        return handleUnauthorized('Invalid user type');
      }

      if (!user) {
        return handleUnauthorized('User not found, authorization denied');
      }

      // Attach full user object and role to request
      req.user = {
        ...req.user,
        role: user.roles[0], // Use first role for consistency
        user,
      };

      // Debug logging
      // console.log('Auth middleware:', {
      //   userId: id,
      //   userType,
      //   role: req.user.role,
      //   path: req.path,
      // });

      next();
    } catch (error) {
      console.error('Auth middleware error:', {
        message: error.message,
        userId: req.user?.id,
        userType: req.user?.userType,
        path: req.path,
      });
      if (isApiRoute) {
        return res.status(500).json({ msg: 'Server error' });
      }
      res.clearCookie('token');
      return handleUnauthorized('Authentication failed');
    }
  });
};

module.exports = auth;