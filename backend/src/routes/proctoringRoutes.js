const express = require('express');
const router = express.Router();
const {
  recordViolation,
  getSessionStatus,
  getCandidates,
  unlockCandidate,
  resetCandidate
} = require('../controllers/proctoringController');
const { protect, requireSubAdminOrAdmin } = require('../middleware/auth');

router.post('/:quizId/violation', protect, recordViolation);
router.get('/:quizId/session-status', protect, getSessionStatus);
router.get('/candidates', protect, requireSubAdminOrAdmin, getCandidates);
router.post('/submissions/:id/unlock', protect, requireSubAdminOrAdmin, unlockCandidate);
router.post('/submissions/:id/reset', protect, requireSubAdminOrAdmin, resetCandidate);

module.exports = router;
