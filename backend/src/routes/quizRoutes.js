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
const { recordViolation } = require('../controllers/proctoringController');
const { getAcademicMap, getAcademicStudents } = require('../controllers/academicController');
const { protect, requireAdmin } = require('../middleware/auth');
const prisma = require('../config/db');

const getProctoringRules = async (req, res, next) => {
  try {
    const rules = await prisma.proctoringRule.findFirst({
      where: { isCurrent: true }
    });
    res.json({
      success: true,
      rules: rules || {
        maxTabSwitches: 3,
        violationAction: 'AUTO_LOCK',
        enforceFullscreen: true,
        showWarningModal: true
      }
    });
  } catch (error) {
    next(error);
  }
};

router.get('/proctoring-rules', protect, getProctoringRules);
router.get('/academic-map', protect, getAcademicMap);
router.get('/academic/students', protect, getAcademicStudents);
router.get('/', protect, listQuizzes);
router.post('/', protect, requireAdmin, createQuiz);
router.get('/:id', protect, getQuiz);

router.get('/:id/session-status', protect, getSessionStatus);
router.post('/:id/record-violation', protect, recordViolation);
router.post('/:id/verify-access', protect, verifyAccessCode);
router.post('/:id/save-progress', protect, saveProgress);
router.post('/:id/submit', protect, submitQuiz);

module.exports = router;
