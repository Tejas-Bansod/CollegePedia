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

// Multer storage configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Increased to 10MB limit per image
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only JPEG and PNG images are allowed'));
  },
}).fields([
  { name: 'clg_images', maxCount: 10 }, // Up to 10 college images
  { name: 'clg_acmts_images', maxCount: 10 }, // Up to 10 accommodation images
]);

// Process and save images with compression and resizing
const processImages = async (files, type) => {
  const paths = [];
  for (const file of files) {
    const filename = `${type}-${uuidv4()}.jpg`;
    const filepath = path.join(__dirname, '../public/uploads', filename);
    await sharp(file.buffer)
      .resize({ width: 1200, fit: 'inside', withoutEnlargement: true }) // Resize to max 1200px width
      .jpeg({ quality: 80 }) // Compress to 80% quality
      .toFile(filepath);
    paths.push(`/uploads/${filename}`);
  }
  return paths;
};

// Multer error handling middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const errorMsg = 'File too large. Maximum size is 10MB per image.';
      if (req.method === 'POST' && req.path === '/submit') {
        return res.status(400).render('information/submit', {
          title: 'Submit College Information',
          user: req.user ? req.user.user : null,
          error: errorMsg,
        });
      } else if (req.method === 'PUT' && req.path.includes('/update/')) {
        const info_id = req.params.info_id;
        return Information.findOne({ info_id }).lean().then(information => {
          res.status(400).render('information/update', {
            title: 'Update College Information',
            user: req.user ? req.user.user : null,
            information: information || {},
            error: errorMsg,
          });
        }).catch(() => {
          res.status(500).render('error', { title: 'Error', msg: 'Server error' });
        });
      }
    }
    return res.status(400).render('error', { title: 'Error', msg: err.message });
  }
  next(err);
};
/**
 * @route GET /api/information/submit
 * @description Render form for submitting new college information
 * @access Agents, Institutions
 * @returns {HTML} Renders submit.ejs
 */
router.get('/submit', auth, checkRole(['Agents', 'Institutions']), (req, res) => {
  res.render('information/submit', {
    title: 'Submit College Information',
    user: req.user.user,
    error: null,
  });
});

/**
 * @route GET /api/information/update/:info_id
 * @description Render form for updating existing college information
 * @access Agents, Institutions (original submitter only)
 * @param {string} req.params.info_id - Information ID
 * @returns {HTML} Renders update.ejs with pre-filled data
 */
router.get('/update/:info_id', auth, checkRole(['Agents', 'Institutions']), async (req, res) => {
  try {
    const { info_id } = req.params;

    // Find INSInformationIDs document
    const insInfo = await INSInformationIDs.findOne({ info_id });
    if (!insInfo) {
      return res.status(404).render('error', { title: 'Error', msg: 'Information not found' });
    }

    // Check if user is the original submitter
    if (insInfo.posted_by_id.toString() !== req.user.id) {
      return res.status(403).render('error', {
        title: 'Error',
        msg: 'Unauthorized: You can only update your own submissions',
      });
    }

    // Find Information document
    const information = await Information.findOne({ info_id }).lean();
    if (!information) {
      return res.status(404).render('error', { title: 'Error', msg: 'Information not found' });
    }

    res.render('information/update', {
      title: 'Update College Information',
      user: req.user.user,
      information,
      error: null,
    });
  } catch (error) {
    console.error('Information update render error:', {
      message: error.message,
      info_id: req.params.info_id,
      user_id: req.user.id,
      role: req.user.role,
      stack: error.stack,
    });
    res.status(500).render('error', { title: 'Error', msg: 'Server error' });
  }
});

/**
 * @route POST /api/information/submit
 * @description Submit new college information with images
 * @access Agents, Institutions
 * @param {Object} req.body - Form data (multipart/form-data)
 * @param {string} req.body.clg_name - College name (required)
 * @param {string} [req.body.clg_heading] - College heading
 * @param {string} [req.body.clg_info1] - Additional info 1
 * @param {string} [req.body.clg_info2] - Additional info 2
 * @param {string} [req.body.clg_info3] - Additional info 3
 * @param {File[]} [req.files.clg_images] - College images (JPEG/PNG, max 10)
 * @param {Object[]} [req.body.clg_courses] - Courses offered (JSON string)
 * @param {string} req.body.clg_courses[].courses - Course name
 * @param {string} req.body.clg_courses[].syllabus - Course syllabus
 * @param {string[]} [req.body.clg_departments] - Departments (JSON string)
 * @param {number} [req.body.clg_rating] - Rating (0-5)
 * @param {string[]} [req.body.clg_acmts] - Accommodations (JSON string)
 * @param {File[]} [req.files.clg_acmts_images] - Accommodation images (JPEG/PNG, max 10)
 * @param {string} [req.body.clg_contact] - Contact info
 * @param {string} [req.body.clg_email] - College email
 * @param {Object} [req.body.clg_address] - Address details (JSON string)
 * @param {string} [req.body.clg_address.address] - Street address
 * @param {string} [req.body.clg_address.country] - Country
 * @param {string} [req.body.clg_address.state] - State
 * @param {string} [req.body.clg_address.city] - City
 * @param {string} [req.body.clg_address.pincode] - Pincode
 * @param {string} [req.body.clg_address_url] - Address URL
 * @param {number} [req.body.clg_since] - Year established
 * @returns {Object} Response with success message and info_id
 */
router.post('/submit', auth, checkRole(['Staff', 'Agents', 'Admin', 'Co-Admin', 'Institutions']), infoLimiter, upload, handleMulterError, async (req, res) => {
  try {
    const {
      clg_name,
      clg_heading,
      clg_info1,
      clg_info2,
      clg_info3,
      clg_courses,
      clg_departments,
      clg_rating,
      clg_acmts,
      clg_contact,
      clg_email,
      clg_address,
      clg_address_url,
      clg_since,
    } = req.body;

    // Input validation
    if (!clg_name) {
      return res.status(400).render('information/submit', {
        title: 'Submit College Information',
        user: req.user.user,
        error: 'College name is required',
      });
    }

    if (clg_rating && (clg_rating < 0 || clg_rating > 5)) {
      return res.status(400).render('information/submit', {
        title: 'Submit College Information',
        user: req.user.user,
        error: 'Rating must be between 0 and 5',
      });
    }

    if (clg_email && !/^\S+@\S+\.\S+$/.test(clg_email)) {
      return res.status(400).render('information/submit', {
        title: 'Submit College Information',
        user: req.user.user,
        error: 'Invalid email format',
      });
    }

    let parsedCourses = [];
    if (clg_courses) {
      try {
        parsedCourses = typeof clg_courses === 'string' ? JSON.parse(clg_courses) : clg_courses;
        if (!Array.isArray(parsedCourses)) {
          return res.status(400).render('information/submit', {
            title: 'Submit College Information',
            user: req.user.user,
            error: 'Courses must be an array',
          });
        }
        for (const course of parsedCourses) {
          if (!course.courses || !course.syllabus) {
            return res.status(400).render('information/submit', {
              title: 'Submit College Information',
              user: req.user.user,
              error: 'Each course must have a name and syllabus',
            });
          }
        }
      } catch (error) {
        return res.status(400).render('information/submit', {
          title: 'Submit College Information',
          user: req.user.user,
          error: 'Invalid courses format',
        });
      }
    }

    let parsedDepartments = [];
    if (clg_departments) {
      try {
        parsedDepartments = typeof clg_departments === 'string' ? JSON.parse(clg_departments) : clg_departments;
        if (!Array.isArray(parsedDepartments)) {
          return res.status(400).render('information/submit', {
            title: 'Submit College Information',
            user: req.user.user,
            error: 'Departments must be an array',
          });
        }
      } catch (error) {
        return res.status(400).render('information/submit', {
          title: 'Submit College Information',
          user: req.user.user,
          error: 'Invalid departments format',
        });
      }
    }

    let parsedAcmts = [];
    if (clg_acmts) {
      try {
        parsedAcmts = typeof clg_acmts === 'string' ? JSON.parse(clg_acmts) : clg_acmts;
        if (!Array.isArray(parsedAcmts)) {
          return res.status(400).render('information/submit', {
            title: 'Submit College Information',
            user: req.user.user,
            error: 'Accommodations must be an array',
          });
        }
      } catch (error) {
        return res.status(400).render('information/submit', {
          title: 'Submit College Information',
          user: req.user.user,
          error: 'Invalid accommodations format',
        });
      }
    }

    let parsedAddress = {};
    if (clg_address) {
      try {
        parsedAddress = typeof clg_address === 'string' ? JSON.parse(clg_address) : clg_address;
      } catch (error) {
        return res.status(400).render('information/submit', {
          title: 'Submit College Information',
          user: req.user.user,
          error: 'Invalid address format',
        });
      }
    }

    if (clg_since && clg_since < 1800) {
      return res.status(400).render('information/submit', {
        title: 'Submit College Information',
        user: req.user.user,
        error: 'Year established cannot be before 1800',
      });
    }

    // Process images
    const clgImagesPaths = req.files['clg_images']
      ? await processImages(req.files['clg_images'], 'clg')
      : [];
    const clgAcmtsImagesPaths = req.files['clg_acmts_images']
      ? await processImages(req.files['clg_acmts_images'], 'acmts')
      : [];

    // Generate unique info_id
    const info_id = uuidv4();

    // Create Information document
    const information = new Information({
      info_id,
      clg_name,
      clg_heading,
      clg_info1,
      clg_info2,
      clg_info3,
      clg_images_paths: clgImagesPaths,
      clg_courses: parsedCourses,
      clg_departments: parsedDepartments,
      clg_rating: clg_rating || 0,
      clg_acmts: parsedAcmts,
      clg_acmts_img_paths: clgAcmtsImagesPaths,
      clg_contact,
      clg_email,
      clg_address: parsedAddress,
      clg_address_url,
      clg_since,
    });

    await information.save();

    // Create INSInformationIDs document
    const insInfo = new INSInformationIDs({
      info_id,
      posted_by_id: req.user.id,
      posted_by_model: req.user.userType === 'staff' ? 'Staff' : 'User', // Agents are staff, Institutions are users
      verification: 'Pending',
    });

    await insInfo.save();

    res.redirect('/api/dashboard/' + (req.user.userType === 'staff' ? 'agent' : 'institution'));
  } catch (error) {
    console.error('Information submit error:', {
      message: error.message,
      user_id: req.user.id,
      role: req.user.role,
      stack: error.stack,
    });
    res.status(400).render('information/submit', {
      title: 'Submit College Information',
      user: req.user.user,
      error: error.message.includes('Only JPEG and PNG') ? error.message : 'Submission failed',
    });
  }
});


/**
 * @route PUT /api/information/update/:info_id
 * @description Update existing college information with optional image uploads
 * @access Agents, Institutions
 * @param {string} req.params.info_id - Information ID
 * @param {Object} req.body - Form data (multipart/form-data)
 * @param {string} [req.body.clg_name] - Updated college name
 * @param {string} [req.body.clg_heading] - Updated college heading
 * @param {string} [req.body.clg_info1] - Updated additional info 1
 * @param {string} [req.body.clg_info2] - Updated additional info 2
 * @param {string} [req.body.clg_info3] - Updated additional info 3
 * @param {File[]} [req.files.clg_images] - Updated college images
 * @param {Object[]} [req.body.clg_courses] - Updated courses (JSON string)
 * @param {string} [req.body.clg_courses[].courses] - Updated course name
 * @param {string} [req.body.clg_courses[].syllabus] - Updated course syllabus
 * @param {string[]} [req.body.clg_departments] - Updated departments (JSON string)
 * @param {number} [req.body.clg_rating] - Updated rating (0-5)
 * @param {string[]} [req.body.clg_acmts] - Updated accommodations (JSON string)
 * @param {File[]} [req.files.clg_acmts_images] - Updated accommodation images
 * @param {string} [req.body.clg_contact] - Updated contact info
 * @param {string} [req.body.clg_email] - Updated college email
 * @param {Object} [req.body.clg_address] - Updated address details (JSON string)
 * @param {string} [req.body.clg_address.address] - Updated street address
 * @param {string} [req.body.clg_address.country] - Updated country
 * @param {string} [req.body.clg_address.state] - Updated state
 * @param {string} [req.body.clg_address.city] - Updated city
 * @param {string} [req.body.clg_address.pincode] - Updated pincode
 * @param {string} [req.body.clg_address_url] - Updated address URL
 * @param {number} [req.body.clg_since] - Updated year established
 * @returns {Object} Response with success message
 */
router.put('/update/:info_id', auth, checkRole(['Agents', 'Institutions']), infoLimiter, upload, handleMulterError, async (req, res) => {
  try {
    const { info_id } = req.params;
    const {
      clg_name,
      clg_heading,
      clg_info1,
      clg_info2,
      clg_info3,
      clg_courses,
      clg_departments,
      clg_rating,
      clg_acmts,
      clg_contact,
      clg_email,
      clg_address,
      clg_address_url,
      clg_since,
    } = req.body;

    // Find INSInformationIDs document
    const insInfo = await INSInformationIDs.findOne({ info_id });
    if (!insInfo) {
      return res.status(404).render('error', { title: 'Error', msg: 'Information not found' });
    }

    // Check if user is the original submitter
    if (insInfo.posted_by_id.toString() !== req.user.id) {
      return res.status(403).render('error', {
        title: 'Error',
        msg: 'Unauthorized: You can only update your own submissions',
      });
    }

    // Find Information document
    const information = await Information.findOne({ info_id });
    if (!information) {
      return res.status(404).render('error', { title: 'Error', msg: 'Information not found' });
    }

    // Validate updates
    if (clg_rating && (clg_rating < 0 || clg_rating > 5)) {
      return res.status(400).render('information/update', {
        title: 'Update College Information',
        user: req.user.user,
        information: information.toObject(),
        error: 'Rating must be between 0 and 5',
      });
    }

    if (clg_email && !/^\S+@\S+\.\S+$/.test(clg_email)) {
      return res.status(400).render('information/update', {
        title: 'Update College Information',
        user: req.user.user,
        information: information.toObject(),
        error: 'Invalid email format',
      });
    }

    let parsedCourses = [];
    if (clg_courses) {
      try {
        parsedCourses = typeof clg_courses === 'string' ? JSON.parse(clg_courses) : clg_courses;
        if (!Array.isArray(parsedCourses)) {
          return res.status(400).render('information/update', {
            title: 'Update College Information',
            user: req.user.user,
            information: information.toObject(),
            error: 'Courses must be an array',
          });
        }
        for (const course of parsedCourses) {
          if (!course.courses || !course.syllabus) {
            return res.status(400).render('information/update', {
              title: 'Update College Information',
              user: req.user.user,
              information: information.toObject(),
              error: 'Each course must have a name and syllabus',
            });
          }
        }
      } catch (error) {
        return res.status(400).render('information/update', {
          title: 'Update College Information',
          user: req.user.user,
          information: information.toObject(),
          error: 'Invalid courses format',
        });
      }
    }

    let parsedDepartments = [];
    if (clg_departments) {
      try {
        parsedDepartments = typeof clg_departments === 'string' ? JSON.parse(clg_departments) : clg_departments;
        if (!Array.isArray(parsedDepartments)) {
          return res.status(400).render('information/update', {
            title: 'Update College Information',
            user: req.user.user,
            information: information.toObject(),
            error: 'Departments must be an array',
          });
        }
      } catch (error) {
        return res.status(400).render('information/update', {
          title: 'Update College Information',
          user: req.user.user,
          information: information.toObject(),
          error: 'Invalid departments format',
        });
      }
    }

    let parsedAcmts = [];
    if (clg_acmts) {
      try {
        parsedAcmts = typeof clg_acmts === 'string' ? JSON.parse(clg_acmts) : clg_acmts;
        if (!Array.isArray(parsedAcmts)) {
          return res.status(400).render('information/update', {
            title: 'Update College Information',
            user: req.user.user,
            information: information.toObject(),
            error: 'Accommodations must be an array',
          });
        }
      } catch (error) {
        return res.status(400).render('information/update', {
          title: 'Update College Information',
          user: req.user.user,
          information: information.toObject(),
          error: 'Invalid accommodations format',
        });
      }
    }

    let parsedAddress = {};
    if (clg_address) {
      try {
        parsedAddress = typeof clg_address === 'string' ? JSON.parse(clg_address) : clg_address;
      } catch (error) {
        return res.status(400).render('information/update', {
          title: 'Update College Information',
          user: req.user.user,
          information: information.toObject(),
          error: 'Invalid address format',
        });
      }
    }

    if (clg_since && clg_since < 1800) {
      return res.status(400).render('information/update', {
        title: 'Update College Information',
        user: req.user.user,
        information: information.toObject(),
        error: 'Year established cannot be before 1800',
      });
    }

    // Process new images (append to existing if provided)
    const clgImagesPaths = req.files['clg_images']
      ? [...information.clg_images_paths, ...(await processImages(req.files['clg_images'], 'clg'))]
      : information.clg_images_paths;
    const clgAcmtsImagesPaths = req.files['clg_acmts_images']
      ? [...information.clg_acmts_img_paths, ...(await processImages(req.files['clg_acmts_images'], 'acmts'))]
      : information.clg_acmts_img_paths;

    // Update fields if provided
    if (clg_name) information.clg_name = clg_name;
    if (clg_heading !== undefined) information.clg_heading = clg_heading;
    if (clg_info1 !== undefined) information.clg_info1 = clg_info1;
    if (clg_info2 !== undefined) information.clg_info2 = clg_info2;
    if (clg_info3 !== undefined) information.clg_info3 = clg_info3;
    information.clg_images_paths = clgImagesPaths;
    if (parsedCourses.length > 0) information.clg_courses = parsedCourses;
    if (parsedDepartments.length > 0) information.clg_departments = parsedDepartments;
    if (clg_rating !== undefined) information.clg_rating = clg_rating;
    if (parsedAcmts.length > 0) information.clg_acmts = parsedAcmts;
    information.clg_acmts_img_paths = clgAcmtsImagesPaths;
    if (clg_contact !== undefined) information.clg_contact = clg_contact;
    if (clg_email !== undefined) information.clg_email = clg_email;
    if (Object.keys(parsedAddress).length > 0) information.clg_address = parsedAddress;
    if (clg_address_url !== undefined) information.clg_address_url = clg_address_url;
    if (clg_since !== undefined) information.clg_since = clg_since;

    await information.save();

    // Reset verification status
    insInfo.verification = 'Pending';
    insInfo.approved_by_id = null;
    insInfo.approved_by_model = null;
    insInfo.rejection_reason = null;
    await insInfo.save();

    res.redirect('/api/dashboard/' + (req.user.userType === 'staff' ? 'agent' : 'institution'));
  } catch (error) {
    console.error('Information update error:', {
      message: error.message,
      info_id: req.params.info_id,
      user_id: req.user.id,
      role: req.user.role,
      stack: error.stack,
    });
    res.status(400).render('information/update', {
      title: 'Update College Information',
      user: req.user.user,
      information: (await Information.findOne({ info_id: req.params.info_id }).lean()) || {},
      error: error.message.includes('Only JPEG and PNG') ? error.message : 'Update failed',
    });
  }
});

/**
 * @route POST /api/information/approve/:info_id
 * @description Approve or reject college information
 * @access Staff, Agents, Admin, Co-Admin
 * @param {string} req.params.info_id - Information ID
 * @param {Object} req.body - Request body
 * @param {string} req.body.status - Approval status ('Approved' or 'Rejected')
 * @param {string} [req.body.reason] - Reason for rejection (optional)
 * @returns {Object} Response with success message
 */
router.post('/approve/:info_id', auth, checkRole(['Staff', 'Agents', 'Admin', 'Co-Admin']), async (req, res) => {
  try {
    const { info_id } = req.params;
    const { status, reason } = req.body;

    // Input validation
    if (!status || !['Approved', 'Rejected'].includes(status)) {
      return res.status(400).render('information/approve', {
        title: 'Approve College Information',
        user: req.user,
        information: await Information.findOne({ info_id }).lean(),
        error: 'Status must be Approved or Rejected',
      });
    }

    if (status === 'Rejected' && !reason) {
      return res.status(400).render('information/approve', {
        title: 'Approve College Information',
        user: req.user,
        information: await Information.findOne({ info_id }).lean(),
        error: 'Reason is required for rejection',
      });
    }

    // Find INSInformationIDs document
    const insInfo = await INSInformationIDs.findOne({ info_id });
    if (!insInfo) {
      return res.status(404).render('error', { title: 'Error', msg: 'Information not found' });
    }

    // Update verification status
    insInfo.verification = status;
    insInfo.approved_by_id = req.user.id;
    insInfo.approved_by_model = req.user.userType === 'admin' ? 'Admin' : 'Staff';
    insInfo.rejection_reason = status === 'Rejected' ? reason : null;

    await insInfo.save();

    res.redirect('/api/dashboard/' + (req.user.userType === 'admin' ? 'admin' : 'agent'));
  } catch (error) {
    console.error('Information approve error:', {
      message: error.message,
      info_id: req.params.info_id,
      user_id: req.user.id,
      role: req.user.role,
      stack: error.stack,
    });
    res.status(500).render('error', { title: 'Error', msg: 'Server error' });
  }
});

/**
 * @route GET /api/information/:info_id
 * @description Render approved college information by info_id
 * @access Public
 * @param {string} req.params.info_id - Information ID
 * @returns {HTML} Renders view.ejs with single college details
 */
router.get('/:info_id', async (req, res) => {
  try {
    const { info_id } = req.params;

    // Find approved INSInformationIDs document
    const insInfo = await INSInformationIDs.findOne({ info_id, verification: 'Approved' });
    if (!insInfo) {
      return res.status(404).render('error', { title: 'Error', msg: 'College information not found or not approved' });
    }

    // Find Information document
    const information = await Information.findOne({ info_id }).lean();
    if (!information) {
      return res.status(404).render('error', { title: 'Error', msg: 'College information not found' });
    }

    res.render('information/view', {
      title: information.clg_name,
      information,
      informations: null, // Single view, no list
    });
  } catch (error) {
    console.error('Information view error:', {
      message: error.message,
      info_id: req.params.info_id,
      stack: error.stack,
    });
    res.status(500).render('error', { title: 'Error', msg: 'Server error' });
  }
});

/**
 * @route GET /api/information
 * @description Render list of all approved college information
 * @access Public
 * @returns {HTML} Renders view.ejs with list of colleges
 */
router.get('/', async (req, res) => {
  try {
    // Find all approved INSInformationIDs
    const approvedInfos = await INSInformationIDs.find({ verification: 'Approved' }).lean();
    const infoIds = approvedInfos.map(info => info.info_id);

    // Find corresponding Information documents
    const informations = await Information.find({ info_id: { $in: infoIds } }).lean();

    res.render('information/view', {
      title: 'College Information',
      information: null, // List view, no single college
      informations,
    });
  } catch (error) {
    console.error('Information list view error:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).render('error', { title: 'Error', msg: 'Server error' });
  }
});

/**
 * @route GET /api/information/approve/:info_id
 * @description Render form for approving college information
 * @access Staff, Agents, Admin, Co-Admin
 * @param {string} req.params.info_id - Information ID
 * @returns {HTML} Renders approve.ejs with college details
 */
router.get('/approve/:info_id', auth, checkRole(['Staff', 'Agents', 'Admin', 'Co-Admin']), async (req, res) => {
  try {
    const { info_id } = req.params;

    // Find INSInformationIDs document
    const insInfo = await INSInformationIDs.findOne({ info_id });
    if (!insInfo) {
      return res.status(404).render('error', { title: 'Error', msg: 'Information not found' });
    }

    // Find Information document
    const information = await Information.findOne({ info_id }).lean();
    if (!information) {
      return res.status(404).render('error', { title: 'Error', msg: 'Information not found' });
    }

    res.render('information/approve', {
      title: 'Approve College Information',
      user: req.user,
      information,
      error: null,
    });
  } catch (error) {
    console.error('Information approve render error:', {
      message: error.message,
      info_id: req.params.info_id,
      user_id: req.user.id,
      role: req.user.role,
      stack: error.stack,
    });
    res.status(500).render('error', { title: 'Error', msg: 'Server error' });
  }
});

/**
 * @route DELETE /api/information/:info_id
 * @description Delete college information and associated images
 * @access Agents, Institutions (original submitter), Staff, Admin, Co-Admin
 * @param {string} req.params.info_id - Information ID
 * @returns {Object} Response with success message
 */
router.delete('/:info_id', auth, async (req, res) => {
  try {
    const { info_id } = req.params;

    // Find INSInformationIDs document
    const insInfo = await INSInformationIDs.findOne({ info_id });
    if (!insInfo) {
      return res.status(404).render('error', { title: 'Error', msg: 'Information not found' });
    }

    // Check if user is the original submitter or has Staff/Admin role
    const isSubmitter = insInfo.posted_by_id.toString() === req.user.id;
    const isStaff = ['Staff', 'Agents', 'Admin', 'Co-Admin'].includes(req.user.role);
    if (!isSubmitter && !isStaff) {
      return res.status(403).render('error', {
        title: 'Error',
        msg: 'Unauthorized: You can only delete your own submissions or must be Staff',
      });
    }

    // Find Information document
    const information = await Information.findOne({ info_id });
    if (!information) {
      return res.status(404).render('error', { title: 'Error', msg: 'Information not found' });
    }

    // Delete images from /public/uploads/
    const allImages = [...information.clg_images_paths, ...information.clg_acmts_img_paths];
    for (const imagePath of allImages) {
      const filePath = path.join(__dirname, '../public', imagePath);
      try {
        await fs.unlink(filePath);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error('Failed to delete image:', { imagePath, error: err.message });
        }
      }
    }

    // Delete documents
    await Information.deleteOne({ info_id });
    await INSInformationIDs.deleteOne({ info_id });

    // Redirect to appropriate dashboard
    if (req.user.userType === 'admin') {
      res.redirect('/api/dashboard/admin');
    } else if (req.user.userType === 'staff') {
      res.redirect('/api/dashboard/agent');
    } else {
      res.redirect('/api/dashboard/institution');
    }
  } catch (error) {
    console.error('Information delete error:', {
      message: error.message,
      info_id: req.params.info_id,
      user_id: req.user.id,
      role: req.user.role,
      stack: error.stack,
    });
    res.status(500).render('error', { title: 'Error', msg: 'Server error' });
  }
});



module.exports = router;