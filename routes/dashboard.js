/**
 * @file routes/information.js
 * @description Routes for submitting, updating, approving, deleting, and managing college information forms in the Collegepedia project.
 * @module routes/information
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { Information, INSInformationIDs } = require('../models');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/roles');
const rateLimit = require('express-rate-limit');

// Rate limiting for submission and update routes
// Rate limiting for submission and update routes
const infoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit to 10 attempts
  message: 'Too many requests, please try again after 15 minutes',
});


/**
 * @route GET /api/dashboard/pending
 * @description Fetch and display all pending college information submissions
 * @access Staff, Agents, Admin, Co-Admin
 * @returns {HTML} Renders pending.ejs with list of pending submissions
 */
router.get('/pending', auth, checkRole(['Staff', 'Agents', 'Admin', 'Co-Admin']), async (req, res) => {
  try {
    // Fetch pending submissions
    const pendingSubmissions = await INSInformationIDs.find({ verification: 'Pending' })
      .lean();

    if (!pendingSubmissions.length) {
      return res.render('information/pending-applications', {
        title: 'Pending Submissions',
        user: req.user.user,
        submissions: [],
        error: null,
      });
    }

    // Get info_ids
    const infoIds = pendingSubmissions.map(sub => sub.info_id);

    // Fetch corresponding Information documents
    const informations = await Information.find({ info_id: { $in: infoIds } })
      .select('info_id clg_name clg_heading')
      .lean();

    // Map submissions with information
    const submissions = pendingSubmissions.map(sub => {
      const info = informations.find(i => i.info_id === sub.info_id) || {};
      return {
        info_id: sub.info_id,
        clg_name: info.clg_name || 'Unnamed College',
        clg_heading: info.clg_heading || 'No heading',
        posted_by_id: sub.posted_by_id,
        posted_by_model: sub.posted_by_model,
      };
    });

    res.render('information/pending-applications', {
      title: 'Pending Submissions',
      user: req.user.user,
      submissions,
      error: null,
    });
  } catch (error) {
    console.error('Pending submissions error:', {
      message: error.message,
      user_id: req.user.id,
      role: req.user.role,
      stack: error.stack,
    });
    res.status(500).render('error', {
      title: 'Error',
      msg: 'Failed to fetch pending submissions',
    });
  }
});

/**
 * @route GET /api/dashboard/my-submissions
 * @description Retrieve all college information submissions by the authenticated user
 * @access Agents, Institutions
 * @returns {HTML} Renders information/my-submissions.ejs with list of submissions
 */
router.get('/my-submissions', auth, checkRole(['Agents', 'Institutions']), async (req, res) => {
  try {
    // Fetch submissions by user
    const submissions = await INSInformationIDs.find({ posted_by_id: req.user.id })
      .lean();

    if (!submissions.length) {
      return res.render('information/my-submissions', {
        title: 'My Submissions',
        user: req.user.user,
        submissions: [],
        informations: [],
        error: null,
      });
    }

    const infoIds = submissions.map(sub => sub.info_id);
    const informations = await Information.find({ info_id: { $in: infoIds } })
      .select('info_id clg_name clg_heading clg_images_paths')
      .lean();

    res.render('information/my-submissions', {
      title: 'My Submissions',
      user: req.user.user,
      submissions,
      informations,
      error: null,
    });
  } catch (error) {
    console.error('My submissions error:', {
      message: error.message,
      user_id: req.user.id,
      role: req.user.role,
      stack: error.stack,
    });
    res.status(500).render('error', {
      title: 'Error',
      msg: 'Failed to fetch submissions',
    });
  }
});


/**
 * @route GET /api/dashboard/analytics
 * @description Display submission statistics and recent activity
 * @access Admin, Co-Admin
 * @returns {HTML} Renders admin/analytics.ejs with stats and recent submissions
 */
router.get('/analytics', auth, checkRole(['Admin', 'Co-Admin']), async (req, res) => {
  try {
    // Aggregate submission stats
    const stats = await INSInformationIDs.aggregate([
      {
        $group: {
          _id: '$verification',
          count: { $sum: 1 },
        },
      },
    ]);

    const statsObj = { total: 0, pending: 0, approved: 0, rejected: 0 };
    stats.forEach(s => {
      if (s._id === 'Pending') statsObj.pending = s.count;
      if (s._id === 'Approved') statsObj.approved = s.count;
      if (s._id === 'Rejected') statsObj.rejected = s.count;
      statsObj.total += s.count;
    });

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Fetch recent submissions (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentSubmissions = await INSInformationIDs.find({
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
        let posted_by_name = 'Unknown';
        if (sub.posted_by_model === 'User') {
          const user = await User.findById(sub.posted_by_id).select('user_name').lean();
          posted_by_name = user ? `${user.user_name.f_name} ${user.user_name.l_name}` : 'Unknown';
        } else if (sub.posted_by_model === 'Staff') {
          const staff = await Staff.findById(sub.posted_by_id).select('f_name l_name').lean();
          posted_by_name = staff ? `${staff.f_name} ${staff.l_name}` : 'Unknown';
        }
        return {
          info_id: sub.info_id,
          clg_name: info.clg_name || 'Unnamed',
          verification: sub.verification,
          posted_by_name,
        };
      })
    );

    res.render('admin/analytics', {
      title: 'Analytics Dashboard',
      user: req.user.user,
      stats: statsObj,
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


