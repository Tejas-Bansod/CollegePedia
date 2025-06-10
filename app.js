const express = require('express');
const connectDB = require('./config/db');
const dotenv = require('dotenv');
const cookieParser = require('./middleware/cookieParser');
const authRoutes = require('./routes/user');
const staffRoutes = require('./routes/staff');
const checkRole = require('./middleware/roles');
const adminRoutes = require('./routes/admin');
const infoRoutes = require('./routes/information'); // Add information routes
const dashboardRoutes = require('./routes/dashboard'); // Import dashboard routes
const path = require('path');
const { User, Staff, Admin, Information, INSInformationIDs } = require('./models'); // Import required models
const auth = require('./middleware/auth');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken'); // Import jwt for token verification


dotenv.config({ path: path.join(__dirname, '.env') });

// Validate JWT_SECRET
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set in .env file');
  process.exit(1);
}

const app = express();

// Connect to database
connectDB();

// Rate limiting for login and registration routes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit to 5 attempts
  message: 'Too many attempts, please try again after 15 minutes',
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser);

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));

// Static Files
app.use(express.static(path.join(__dirname, '/public')));

// Rendering HTML pages
app.get('/', (req, res) => {
  res.render('index', { title: 'Collegepedia' });
});

app.get('/api', (req, res) => {
  res.send('API is working');
});
app.get('/api/about', (req, res) => {
  res.render('about', { title: 'About | Collegepedia' });
});
app.get('/api/contact', (req, res) => {
  res.render('contact', { title: 'contact | Collegepedia' });
});

app.get('/api/register', loginLimiter, (req, res) => {
  res.render('register', { title: 'Register' });
});

app.get('/api/login', loginLimiter, async (req, res) => {
  try {
    const token = req.cookies.token;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (user) {
        const redirectUrl = user.roles[0] === 'Users' ? '/dashboard/user' : '/dashboard/institution';
        return res.redirect(redirectUrl);
      }
    }
  } catch (error) {
    res.clearCookie('token');
  }
  res.render('login', { title: 'Login' });
});

app.get('/api/staff/register', auth, checkRole(['Admin']), (req, res) => {
  res.render('staff/register', { title: 'Register Staff' });
});

app.get('/api/staff/login', loginLimiter, async (req, res) => {
  try {
    const token = req.cookies.token;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const staff = await Staff.findById(decoded.id);
      if (staff) {
        const redirectUrl = staff.roles[0] === 'Staff' ? '/dashboard/staff' : '/dashboard/agent';
        return res.redirect(redirectUrl);
      }
    }
  } catch (error) {
    res.clearCookie('token');
  }
  res.render('staff/login', { title: 'Staff Login' });
});

app.get('/api/admin/login', loginLimiter, async (req, res) => {
  try {
    const token = req.cookies.token;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const admin = await Admin.findById(decoded.id);
      if (admin && decoded.userType === 'admin') {
        return res.redirect('/dashboard/admin');
      }
    }
  } catch (error) {
    res.clearCookie('token');
  }
  res.render('admin/login', { title: 'Admin Login' });
});

app.get('/api/admin/register', auth, checkRole(['Admin']), (req, res) => {
  res.render('admin/register', { title: 'Register Admin' });
});

app.get('/api/admin/staff/register', auth, checkRole(['Admin']), (req, res) => {
  res.render('staff/register', { title: 'Register Admin' });
});

app.get('/api/dashboard/user', auth, (req, res) => {
  if (!req.user.user) {
    console.error('No user object in req.user for user dashboard', {
      userId: req.user?.id,
      userType: req.user?.userType,
    });
    return res.status(401).render('error', { title: 'Error', msg: 'Session expired, please log in again' });
  }
  res.render('dashboard/user', { title: 'User Dashboard', user: req.user.user });
});

app.get('/api/dashboard/institution', auth, (req, res) => {
  if (!req.user.user) {
    console.error('No user object in req.user for institution dashboard', {
      userId: req.user?.id,
      userType: req.user?.userType,
    });
    return res.status(401).render('error', { title: 'Error', msg: 'Session expired, please log in again' });
  }
  res.render('dashboard/institution', { title: 'Institution Dashboard', user: req.user.user });
});

app.get('/api/dashboard/staff', auth, (req, res) => {
  if (!req.user.user) {
    console.error('No user object in req.user for staff dashboard', {
      userId: req.user?.id,
      userType: req.user?.userType,
    });
    return res.status(401).render('error', { title: 'Error', msg: 'Session expired, please log in again' });
  }
  res.render('dashboard/staff', { title: 'Staff Dashboard', user: req.user.user });
});

app.get('/api/dashboard/agent', auth, (req, res) => {
  if (!req.user.user) {
    console.error('No user object in req.user for agent dashboard', {
      userId: req.user?.id,
      userType: req.user?.userType,
    });
    return res.status(401).render('error', { title: 'Error', msg: 'Session expired, please log in again' });
  }
  res.render('dashboard/agent', { title: 'Agent Dashboard', user: req.user.user });
});

app.get('/api/dashboard/admin', auth, async (req, res) => {
  if (!req.user.user) {
    console.error('No user object in req.user for admin dashboard', {
      userId: req.user?.id,
      userType: req.user?.userType,
    });
    return res.status(401).render('error', { title: 'Error', msg: 'Session expired, please log in again' });
  }
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

    res.render('dashboard/admin', {
      title: 'Admin Dashboard',
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

app.get('/api/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  const redirectUrl = req.query.redirect || '/';
  res.redirect(redirectUrl);
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/information', infoRoutes); 
app.use('/api/dashboard', dashboardRoutes); // Add dashboard routes

/**
 * @route GET /api/search
 * @description Search approved colleges by name, ID, heading, or additional info
 * @access Public
 * @param {string} req.query.q - Search query
 * @returns {Array} JSON array of matching colleges with info_id, clg_name, and image
 */
app.get('/api/search', async (req, res) => {
  console.log(`Accessing /api/search with query: ${req.query.q} at ${new Date().toISOString()}`);
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 1) {
      console.log('Search query empty, returning 400');
      return res.status(400).json({ msg: 'Search query cannot be empty' });
    }

    // Escape regex special characters
    const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedQuery, 'i');

    // Fetch approved info_ids
    const approvedInfoIds = await INSInformationIDs.find({ verification: 'Approved' }).lean();
    if (!approvedInfoIds.length) {
      console.log('No approved colleges found, returning empty array');
      return res.status(200).json([]); // No approved entries
    }

    const infoIdList = approvedInfoIds.map(entry => entry.info_id);

    // Search Information by approved info_id
    const matches = await Information.find({
      info_id: { $in: infoIdList },
      $or: [
        { clg_name: regex },
        { info_id: regex },
        { clg_heading: regex }, // Added search by clg_heading
        { clg_info1: regex },
        { clg_info2: regex },
        { clg_info3: regex },
      ]
    })
    .select('info_id clg_name clg_images_paths')
    .limit(10)
    .lean();

    // Format result
    const result = matches.map(college => ({
      info_id: college.info_id,
      clg_name: college.clg_name || 'Unnamed College',
      image: (college.clg_images_paths?.[0]) || '/images/placeholder.jpg'
    }));

    console.log(`Search successful, returning ${result.length} results`);
    res.status(200).json(result);
  } catch (error) {
    console.error('Search error:', {
      message: error.message,
      stack: error.stack,
      time: new Date().toISOString(),
      query: req.query.q
    });
    res.status(500).json({ msg: 'Unable to fetch results, try again later.' });
  }
});

/**
 * @route GET /api/search-page
 * @description Render search page for colleges
 * @access Public
 * @returns {HTML} Renders search.ejs
 */
app.get('/api/search-page', (req, res) => {
  console.log('Accessing /api/search-page at', new Date().toISOString());
  res.render('information/search', {
    title: 'Search Colleges',
  });
});

// 404 Error Handling
app.use((req, res, next) => {
  console.log(`404 Not Found: ${req.method} ${req.url}`);
  if (req.url.startsWith('/api/')) {
    return res.status(404).json({ msg: 'API endpoint not found' });
  }
  res.status(404).render('error', { title: 'Error', msg: 'Page not found' });
});

// Global Error Handling
app.use((err, req, res, next) => {
  console.error('Server error:', err.message, err.stack);
  if (req.url.startsWith('/api/')) {
    return res.status(500).json({ msg: 'Server error' });
  }
  res.status(500).render('error', { title: 'Error', msg: 'Server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));