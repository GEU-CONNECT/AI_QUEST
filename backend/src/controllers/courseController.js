const prisma = require('../config/db');

// @desc    Get all subjects / courses
// @route   GET /api/courses
const getCourses = async (req, res, next) => {
  try {
    const courses = await prisma.course.findMany({
      orderBy: [
        { semester: 'asc' },
        { code: 'asc' }
      ]
    });
    res.json({
      success: true,
      courses
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new subject / course
// @route   POST /api/courses
const createCourse = async (req, res, next) => {
  try {
    const { code, title, semester, department, universityId, description } = req.body;

    if (!code || !code.trim() || !title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Subject code and title are required.'
      });
    }

    const cleanCode = code.trim().toUpperCase();
    const cleanTitle = title.trim();

    const existing = await prisma.course.findUnique({
      where: { code: cleanCode }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Subject code "${cleanCode}" already exists (${existing.title}).`
      });
    }

    const newCourse = await prisma.course.create({
      data: {
        code: cleanCode,
        title: cleanTitle,
        semester: Number(semester) || 1,
        department: department?.trim() || 'CSE',
        universityId: universityId || null,
        description: description?.trim() || null
      }
    });

    res.status(201).json({
      success: true,
      message: `Subject "${newCourse.code}" created successfully.`,
      course: newCourse
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a subject / course
// @route   DELETE /api/courses/:id
const deleteCourse = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await prisma.course.deleteMany({
      where: {
        OR: [
          { id },
          { code: id.toUpperCase() }
        ]
      }
    });

    if (result.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found or already deleted.'
      });
    }

    res.json({
      success: true,
      message: 'Subject deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk import subjects via CSV
// @route   POST /api/admin/courses/bulk
const bulkCreateCourses = async (req, res, next) => {
  try {
    const { courses } = req.body;

    if (!Array.isArray(courses) || courses.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No courses provided for import.'
      });
    }

    let importedCount = 0;
    for (const c of courses) {
      if (!c.code || !c.title) continue;
      const cleanCode = c.code.trim().toUpperCase();
      await prisma.course.upsert({
        where: { code: cleanCode },
        create: {
          code: cleanCode,
          title: c.title.trim(),
          semester: Number(c.semester) || 1,
          department: c.department?.trim() || 'CSE',
          description: c.description?.trim() || null
        },
        update: {
          title: c.title.trim(),
          semester: Number(c.semester) || 1,
          department: c.department?.trim() || 'CSE',
          description: c.description?.trim() || null
        }
      });
      importedCount++;
    }

    res.json({
      success: true,
      message: `Successfully imported ${importedCount} subjects.`
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete all subjects
// @route   DELETE /api/admin/courses/all
const deleteAllCourses = async (req, res, next) => {
  try {
    await prisma.course.deleteMany();
    res.json({
      success: true,
      message: 'All subjects deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get course accreditation dossier
// @route   GET /api/admin/accreditation/courses/:id
const getCourseAccreditation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const course = await prisma.course.findFirst({
      where: {
        OR: [
          { id },
          { code: id.toUpperCase() }
        ]
      }
    });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    res.json({
      success: true,
      course: {
        ...course,
        instructorName: 'Department Faculty',
        totalEnrolledInCohort: 0,
        totalAssessmentsConducted: 0
      },
      accreditationKPIs: {
        totalEvaluated: 0,
        avgAttainmentPct: 0,
        directAttainmentLevel: 3,
        directTargetPct: 60,
        targetAttainmentPct: 70,
        thresholdAttainmentPct: 60,
        attainmentAttained: true,
        bloomDistribution: []
      },
      studentRoster: [],
      assessments: []
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCourses,
  createCourse,
  deleteCourse,
  bulkCreateCourses,
  deleteAllCourses,
  getCourseAccreditation
};

