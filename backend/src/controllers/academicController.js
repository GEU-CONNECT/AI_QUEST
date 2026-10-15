const prisma = require('../config/db');

// State for active academic term
let currentAcademicTerm = {
  termType: 'ODD',
  academicYear: '2026-2027',
  activeSemesters: [1, 3, 5, 7]
};

// Seed defaults if empty
const seedAcademicDefaultsIfNeeded = async () => {
  try {
    const uniCount = await prisma.university.count();
    if (uniCount === 0) {
      const geu = await prisma.university.create({
        data: {
          name: 'Graphic Era (Deemed to be University)',
          code: 'GEU'
        }
      });
      await prisma.university.create({
        data: {
          name: 'Graphic Era Hill University',
          code: 'GEHU'
        }
      });

      const deptCount = await prisma.department.count();
      if (deptCount === 0) {
        await prisma.department.create({
          data: {
            name: 'Computer Science & Engineering',
            code: 'CSE',
            universityId: geu.id
          }
        });
      }
    }
  } catch (err) {
    // Non-fatal fallback
  }
};

// @desc    Get Academic Term
// @route   GET /api/admin/academic-term
const getAcademicTerm = async (req, res, next) => {
  try {
    res.json({
      success: true,
      term: currentAcademicTerm
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Academic Term
// @route   PUT /api/admin/academic-term
const updateAcademicTerm = async (req, res, next) => {
  try {
    const { termType, academicYear, customSemesters } = req.body;
    if (termType) currentAcademicTerm.termType = termType;
    if (academicYear) currentAcademicTerm.academicYear = academicYear;
    if (Array.isArray(customSemesters) && customSemesters.length > 0) {
      currentAcademicTerm.activeSemesters = customSemesters.map(Number);
    }

    res.json({
      success: true,
      message: 'Academic term updated successfully',
      term: currentAcademicTerm
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all Universities
// @route   GET /api/admin/universities
const getUniversities = async (req, res, next) => {
  try {
    await seedAcademicDefaultsIfNeeded();
    const universities = await prisma.university.findMany({
      include: {
        departments: true
      },
      orderBy: { name: 'asc' }
    });

    const formatted = universities.map((u) => ({
      id: u.id,
      name: u.name,
      code: u.code,
      departmentCount: u.departments ? u.departments.length : 0,
      createdAt: u.createdAt
    }));

    res.json({
      success: true,
      universities: formatted
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create University
// @route   POST /api/admin/universities
const createUniversity = async (req, res, next) => {
  try {
    const { name, code } = req.body;
    if (!name || !name.trim() || !code || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'University name and code are required.'
      });
    }

    const cleanCode = code.trim().toUpperCase();
    const existing = await prisma.university.findUnique({
      where: { code: cleanCode }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `University with code "${cleanCode}" already exists.`
      });
    }

    const newUni = await prisma.university.create({
      data: {
        name: name.trim(),
        code: cleanCode
      }
    });

    res.status(201).json({
      success: true,
      message: `University "${newUni.name}" created successfully.`,
      university: {
        ...newUni,
        departmentCount: 0
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete University
// @route   DELETE /api/admin/universities/:id
const deleteUniversity = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.university.deleteMany({
      where: {
        OR: [{ id }, { code: id.toUpperCase() }]
      }
    });

    res.json({
      success: true,
      message: 'University deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all Departments
// @route   GET /api/admin/departments
const getDepartments = async (req, res, next) => {
  try {
    await seedAcademicDefaultsIfNeeded();
    const departments = await prisma.department.findMany({
      include: {
        university: true
      },
      orderBy: { name: 'asc' }
    });

    res.json({
      success: true,
      departments
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create Department
// @route   POST /api/admin/departments
const createDepartment = async (req, res, next) => {
  try {
    const { name, code, universityId } = req.body;
    if (!name || !name.trim() || !code || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Department name and code are required.'
      });
    }

    let validUniId = universityId;
    if (!validUniId) {
      const defaultUni = await prisma.university.findFirst();
      validUniId = defaultUni?.id || null;
    }

    const newDept = await prisma.department.create({
      data: {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        universityId: validUniId
      },
      include: {
        university: true
      }
    });

    res.status(201).json({
      success: true,
      message: `Department "${newDept.name}" created successfully.`,
      department: newDept
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete Department
// @route   DELETE /api/admin/departments/:id
const deleteDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.department.deleteMany({
      where: {
        OR: [{ id }, { code: id.toUpperCase() }]
      }
    });

    res.json({
      success: true,
      message: 'Department deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Academic Config (Composite)
// @route   GET /api/academic/config
const getAcademicConfig = async (req, res, next) => {
  try {
    await seedAcademicDefaultsIfNeeded();
    const [universities, departments] = await Promise.all([
      prisma.university.findMany({ orderBy: { name: 'asc' } }),
      prisma.department.findMany({ include: { university: true }, orderBy: { name: 'asc' } })
    ]);

    res.json({
      success: true,
      academicTerm: currentAcademicTerm,
      activeSemesters: currentAcademicTerm.activeSemesters,
      universities,
      departments
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Academic Map for Quizzes
// @route   GET /api/quizzes/academic-map
const getAcademicMap = async (req, res, next) => {
  try {
    res.json({
      success: true,
      semesterSections: {
        1: ['A', 'B', 'C', 'D', 'E'],
        2: ['A', 'B', 'C', 'D'],
        3: ['A', 'B', 'C', 'D'],
        4: ['A', 'B', 'C'],
        5: ['A', 'B', 'C'],
        6: ['A', 'B'],
        7: ['A', 'B'],
        8: ['A']
      },
      department: 'CSE',
      departmentName: 'Computer Science & Engineering'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Students Roster for Quizzes
// @route   GET /api/quizzes/academic/students
const getAcademicStudents = async (req, res, next) => {
  try {
    const students = await prisma.user.findMany({
      where: { role: 'STUDENT' },
      select: {
        id: true,
        name: true,
        registrationId: true,
        email: true,
        studentClass: true,
        stream: true,
        schoolName: true,
        city: true
      },
      orderBy: { name: 'asc' }
    });

    const formatted = students.map((s, idx) => ({
      id: s.id,
      name: s.name,
      rollNo: s.registrationId,
      registrationId: s.registrationId,
      email: s.email,
      section: ['A', 'B', 'C', 'D'][idx % 4],
      studentClass: s.studentClass,
      stream: s.stream,
      schoolName: s.schoolName,
      city: s.city
    }));

    const sectionCounts = {
      A: formatted.filter((s) => s.section === 'A').length,
      B: formatted.filter((s) => s.section === 'B').length,
      C: formatted.filter((s) => s.section === 'C').length,
      D: formatted.filter((s) => s.section === 'D').length
    };

    res.json({
      success: true,
      totalCount: formatted.length,
      sectionCounts,
      department: 'CSE',
      departmentName: 'Computer Science & Engineering',
      students: formatted
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAcademicTerm,
  updateAcademicTerm,
  getUniversities,
  createUniversity,
  deleteUniversity,
  getDepartments,
  createDepartment,
  deleteDepartment,
  getAcademicConfig,
  getAcademicMap,
  getAcademicStudents
};
