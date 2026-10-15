const express = require('express');
const router = express.Router();
const {
  getCourses,
  createCourse,
  deleteCourse
} = require('../controllers/courseController');
const { protect, requireAdmin } = require('../middleware/auth');

router.get('/', getCourses);
router.post('/', protect, requireAdmin, createCourse);
router.delete('/:id', protect, requireAdmin, deleteCourse);

module.exports = router;
