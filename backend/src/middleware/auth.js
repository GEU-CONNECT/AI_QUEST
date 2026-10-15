const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'ai_quest_event_2026_jwt_secret_secure_key';

const protect = async (req, res, next) => {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied: No authentication token provided.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session: User record no longer exists.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token verification failed: Invalid or expired session.'
    });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Access restricted: Super Administrator privileges required.'
    });
  }
  next();
};

const requireSubAdminOrAdmin = (req, res, next) => {
  if (!req.user || !['ADMIN', 'SUBADMIN'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access restricted: Invigilator Sub-Admin or Administrator privileges required.'
    });
  }
  next();
};

const requireStudent = (req, res, next) => {
  if (!req.user || req.user.role !== 'STUDENT') {
    return res.status(403).json({
      success: false,
      message: 'Access restricted: Student candidate privileges required.'
    });
  }
  next();
};

module.exports = {
  protect,
  requireAdmin,
  requireSubAdminOrAdmin,
  requireStudent
};
