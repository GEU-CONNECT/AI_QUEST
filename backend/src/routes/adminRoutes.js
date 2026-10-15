const express = require('express');
const router = express.Router();
const {
  getStudents,
  exportStudentsExcel,
  getSubAdmins,
  getEventOverview,
  getLeaderboard,
  getLiveMonitor,
  getRecoveryReport,
  triggerRecovery,
  getExecutiveAudit
} = require('../controllers/adminController');
const { protect, requireAdmin, requireSubAdminOrAdmin } = require('../middleware/auth');

router.get('/students', protect, requireAdmin, getStudents);
router.get('/export/students', protect, requireAdmin, exportStudentsExcel);
router.get('/subadmins', protect, requireAdmin, getSubAdmins);
router.get('/overview', protect, requireAdmin, getEventOverview);
router.get('/leaderboard', protect, requireSubAdminOrAdmin, getLeaderboard);
router.get('/live-monitor', protect, requireAdmin, getLiveMonitor);
router.get('/recovery-report', protect, requireAdmin, getRecoveryReport);
router.post('/trigger-recovery', protect, requireAdmin, triggerRecovery);
router.get('/executive-audit', protect, requireAdmin, getExecutiveAudit);

module.exports = router;
