const express = require('express');
const router = express.Router();
const {
  getStudents,
  exportStudentsExcel,
  getSubAdmins,
  createSubAdmin,
  deleteSubAdmin,
  getSubmissions,
  deleteSubmission,
  deleteAllSubmissions,
  unlockSubmission,
  lockSubmission,
  resetSubmission,
  getResults,
  exportResultsExcel,
  getEventOverview,
  getLeaderboard,
  getLiveMonitor,
  getRecoveryReport,
  triggerRecovery,
  getExecutiveAudit
} = require('../controllers/adminController');
const { listQuizzes } = require('../controllers/quizController');
const { protect, requireAdmin, requireSubAdminOrAdmin } = require('../middleware/auth');

// Quizzes alias for Admin
router.get('/quizzes', protect, requireAdmin, listQuizzes);

// Student Roster (Admin Only)
router.get('/students', protect, requireAdmin, getStudents);
router.get('/export/students', protect, requireAdmin, exportStudentsExcel);

// Sub-Admin Management (Admin Only)
router.get('/subadmins', protect, requireAdmin, getSubAdmins);
router.post('/subadmins', protect, requireAdmin, createSubAdmin);
router.delete('/subadmins/:id', protect, requireAdmin, deleteSubAdmin);

// Submissions Ledger & Evaluation
router.get('/submissions', protect, requireAdmin, getSubmissions);
router.delete('/submissions/all', protect, requireAdmin, deleteAllSubmissions);
router.delete('/submissions/:id', protect, requireAdmin, deleteSubmission);
router.post('/submissions/:id/unlock', protect, requireSubAdminOrAdmin, unlockSubmission);
router.post('/submissions/:id/lock', protect, requireSubAdminOrAdmin, lockSubmission);
router.post('/submissions/:id/reset', protect, requireSubAdminOrAdmin, resetSubmission);

// Ranked Results & Leaderboard with Tab Switch Violation Telemetry
router.get('/results', protect, requireAdmin, getResults);
router.get('/export/results', protect, requireAdmin, exportResultsExcel);

// Event Overview & Realtime Monitoring
router.get('/overview', protect, requireAdmin, getEventOverview);
router.get('/leaderboard', protect, requireSubAdminOrAdmin, getLeaderboard);
router.get('/live-monitor', protect, requireAdmin, getLiveMonitor);
router.get('/recovery-report', protect, requireAdmin, getRecoveryReport);
router.post('/trigger-recovery', protect, requireAdmin, triggerRecovery);
router.get('/executive-audit', protect, requireAdmin, getExecutiveAudit);

module.exports = router;
