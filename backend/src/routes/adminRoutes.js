const express = require('express');
const router = express.Router();
const {
  getStudents,
  exportStudentsExcel,
  getSubAdmins,
  getEventOverview,
  getLeaderboard,
  getLiveMonitor
} = require('../controllers/adminController');
const { protect, requireAdmin, requireSubAdminOrAdmin } = require('../middleware/auth');

router.get('/students', protect, requireAdmin, getStudents);
router.get('/export/students', protect, requireAdmin, exportStudentsExcel);
router.get('/subadmins', protect, requireAdmin, getSubAdmins);
router.get('/overview', protect, requireAdmin, getEventOverview);
router.get('/leaderboard', protect, requireSubAdminOrAdmin, getLeaderboard);
router.get('/live-monitor', protect, requireAdmin, getLiveMonitor);

module.exports = router;
