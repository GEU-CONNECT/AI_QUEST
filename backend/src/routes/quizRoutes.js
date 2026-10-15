const express = require('express');
const router = express.Router();
const {
  listQuizzes,
  getQuiz,
  verifyAccessCode,
  saveProgress,
  getSessionStatus,
  submitQuiz,
  createQuiz
} = require('../controllers/quizController');
const { protect, requireAdmin } = require('../middleware/auth');

router.get('/', protect, listQuizzes);
router.post('/', protect, requireAdmin, createQuiz);
router.get('/:id', protect, getQuiz);
router.get('/:id/session-status', protect, getSessionStatus);
router.post('/:id/verify-access', protect, verifyAccessCode);
router.post('/:id/save-progress', protect, saveProgress);
router.post('/:id/submit', protect, submitQuiz);

module.exports = router;
