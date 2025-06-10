/**
 * @file middleware/roles.js
 * @description Middleware to check if user has required roles.
 */
module.exports = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ msg: 'Access denied: No role assigned' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ msg: `Access denied: Requires one of ${allowedRoles.join(', ')} roles` });
    }

    next();
  };
};