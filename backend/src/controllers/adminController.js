const ExcelJS = require('exceljs');
const bcrypt = require('bcryptjs');
const prisma = require('../config/db');

// @desc    Get paginated, searchable list of all registered students
// @route   GET /api/admin/students
const getStudents = async (req, res, next) => {
  try {
    const {
      search = '',
      labNumber = '',
      studentClass = '',
      page = 1,
      limit = 50
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const whereClause = {
      role: 'STUDENT',
      ...(labNumber ? { labNumber } : {}),
      ...(studentClass ? { studentClass } : {}),
      ...(search ? {
        OR: [
          { name: { contains: search } },
          { mobileNo: { contains: search } },
          { email: { contains: search } },
          { registrationId: { contains: search } },
          { schoolName: { contains: search } },
          { city: { contains: search } }
        ]
      } : {})
    };

    const [students, total, schoolGroups] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.user.count({ where: whereClause }),
      prisma.user.groupBy({
        by: ['schoolName'],
        where: { role: 'STUDENT', schoolName: { not: null } }
      })
    ]);

    const formatted = students.map((s) => {
      return {
        id: s.id,
        registrationId: s.registrationId,
        name: s.name,
        mobileNo: s.mobileNo,
        email: s.email,
        studentClass: s.studentClass,
        stream: s.stream,
        schoolName: s.schoolName,
        parentName: s.parentName,
        parentContact: s.parentContact,
        city: s.city,
        labNumber: s.labNumber,
        createdAt: s.createdAt
      };
    });

    res.json({
      success: true,
      total,
      totalSchools: schoolGroups.length || 35,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      students: formatted
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export Authoritative Registered Students & Results to Excel (.xlsx)
// @route   GET /api/admin/export/students
const exportStudentsExcel = async (req, res, next) => {
  try {
    const { labNumber, search } = req.query;

    const whereClause = {
      role: 'STUDENT',
      ...(labNumber ? { labNumber } : {}),
      ...(search ? {
        OR: [
          { name: { contains: search } },
          { mobileNo: { contains: search } },
          { registrationId: { contains: search } },
          { schoolName: { contains: search } }
        ]
      } : {})
    };

    const students = await prisma.user.findMany({
      where: whereClause,
      include: {
        submissions: {
          include: { quiz: { select: { title: true, totalMarks: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Create Excel Workbook with ExcelJS
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Graphic Era University - AI Quest 2026';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('AI Quest 2026 Roster', {
      pageSetup: { orientation: 'landscape' }
    });

    // Columns Definition
    worksheet.columns = [
      { header: 'Registration ID', key: 'regId', width: 22 },
      { header: 'Candidate Full Name', key: 'name', width: 26 },
      { header: 'Mobile Number', key: 'mobile', width: 16 },
      { header: 'Email Address', key: 'email', width: 28 },
      { header: 'Class', key: 'class', width: 14 },
      { header: 'Stream', key: 'stream', width: 24 },
      { header: 'School Name', key: 'school', width: 32 },
      { header: 'City', key: 'city', width: 18 },
      { header: 'Parent Name', key: 'parentName', width: 22 },
      { header: 'Parent Contact', key: 'parentContact', width: 16 },
      { header: 'Assigned Lab', key: 'lab', width: 14 },
      { header: 'Registration Timestamp', key: 'regTime', width: 22 },
      { header: 'Exam Status', key: 'status', width: 16 },
      { header: 'Score Obtained', key: 'score', width: 16 },
      { header: 'Total Marks', key: 'totalMarks', width: 14 },
      { header: 'Percentage', key: 'percentage', width: 14 },
      { header: 'Result', key: 'result', width: 14 },
      { header: 'Tab Violations', key: 'violations', width: 14 },
      { header: 'Submission Time', key: 'subTime', width: 22 }
    ];

    // Style Header Row (Navy Blue #1c1f58 with Bold Gold/White text)
    const headerRow = worksheet.getRow(1);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1C1F58' }
      };
      cell.font = {
        color: { argb: 'FFFFFFFF' },
        bold: true,
        size: 11
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' }
      };
    });

    // Populate Student Rows
    students.forEach((s) => {
      const sub = s.submissions && s.submissions.length > 0 ? s.submissions[0] : null;

      worksheet.addRow({
        regId: s.registrationId,
        name: s.name,
        mobile: s.mobileNo,
        email: s.email,
        class: s.studentClass || 'N/A',
        stream: s.stream || 'N/A',
        school: s.schoolName || 'N/A',
        city: s.city || 'N/A',
        parentName: s.parentName || 'N/A',
        parentContact: s.parentContact || 'N/A',
        lab: s.labNumber || 'N/A',
        regTime: s.createdAt ? new Date(s.createdAt).toLocaleString('en-IN') : 'N/A',
        status: sub ? sub.status : 'NOT_STARTED',
        score: sub ? sub.score : 0,
        totalMarks: sub && sub.quiz ? sub.quiz.totalMarks : 30,
        percentage: sub ? `${sub.percentage}%` : '0%',
        result: sub ? (sub.isPassed ? 'PASSED' : 'FAILED') : 'PENDING',
        violations: sub ? sub.tabViolations : 0,
        subTime: sub && sub.submittedAt ? new Date(sub.submittedAt).toLocaleString('en-IN') : 'N/A'
      });
    });

    // Set Response Headers for Download
    const fileName = `AI_Quest_2026_Registered_Students_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
};

// @desc    Get List of all Sub-Admin Accounts (20 Labs)
// @route   GET /api/admin/subadmins
const getSubAdmins = async (req, res, next) => {
  try {
    const subAdmins = await prisma.user.findMany({
      where: { role: 'SUBADMIN' },
      select: {
        id: true,
        registrationId: true,
        name: true,
        mobileNo: true,
        email: true,
        labNumber: true,
        createdAt: true
      },
      orderBy: { labNumber: 'asc' }
    });

    res.json({
      success: true,
      count: subAdmins.length,
      subAdmins
    });
  } catch (error) {
    next(error);
  }
};

// @desc    High-level Event KPIs and Statistics
// @route   GET /api/admin/overview
const getEventOverview = async (req, res, next) => {
  try {
    const [
      totalRegistered,
      totalSubmissions,
      inProgressCount,
      lockedCount,
      submittedCount,
      quizzesCount
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'STUDENT' } }),
      prisma.quizSubmission.count(),
      prisma.quizSubmission.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.quizSubmission.count({ where: { status: 'LOCKED' } }),
      prisma.quizSubmission.count({ where: { status: 'SUBMITTED' } }),
      prisma.quiz.count()
    ]);

    res.json({
      success: true,
      stats: {
        totalRegistered,
        totalSubmissions,
        inProgressCount,
        lockedCount,
        submittedCount,
        notStartedCount: Math.max(0, totalRegistered - (inProgressCount + lockedCount + submittedCount)),
        quizzesCount
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Live Leaderboard (Global or filtered by Lab for classroom projection)
// @route   GET /api/admin/leaderboard
const getLeaderboard = async (req, res, next) => {
  try {
    const isSubAdmin = req.user.role === 'SUBADMIN';
    const labNumber = isSubAdmin ? req.user.labNumber : req.query.labNumber;
    const { limit = 50 } = req.query;

    const whereClause = {
      ...(labNumber ? { student: { labNumber } } : {})
    };

    const submissions = await prisma.quizSubmission.findMany({
      where: whereClause,
      include: {
        student: {
          select: {
            id: true,
            registrationId: true,
            name: true,
            schoolName: true,
            studentClass: true,
            stream: true,
            city: true,
            labNumber: true
          }
        }
      },
      orderBy: [
        { score: 'desc' },
        { submittedAt: 'asc' }
      ],
      take: Math.min(100, parseInt(limit, 10) || 50)
    });

    const leaderboard = submissions.map((sub, idx) => ({
      rank: idx + 1,
      id: sub.id,
      name: sub.student.name,
      registrationId: sub.student.registrationId,
      schoolName: sub.student.schoolName,
      labNumber: sub.student.labNumber,
      score: sub.score,
      totalMarks: sub.totalMarks,
      percentage: sub.percentage,
      isPassed: sub.isPassed,
      status: sub.status,
      submittedAt: sub.submittedAt
    }));

    res.json({
      success: true,
      labNumber: labNumber || 'ALL LABS',
      count: leaderboard.length,
      leaderboard
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Live Proctoring & Assessment Monitoring
// @route   GET /api/admin/live-monitor
const getLiveMonitor = async (req, res, next) => {
  try {
    const activeQuizzes = await prisma.quiz.findMany({
      where: { isPublished: true, isLive: true },
      include: {
        submissions: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                registrationId: true,
                mobileNo: true,
                schoolName: true,
                city: true,
                labNumber: true,
                studentClass: true
              }
            }
          }
        }
      }
    });

    const quizzes = activeQuizzes.map((q) => {
      const inProgress = q.submissions.filter((s) => s.status === 'IN_PROGRESS');
      const locked = q.submissions.filter((s) => s.status === 'LOCKED');
      const submitted = q.submissions.filter((s) => s.status === 'SUBMITTED' || s.status === 'EVALUATED');

      return {
        id: q.id,
        title: q.title,
        durationMinutes: q.durationMinutes,
        totalMarks: q.totalMarks,
        inProgressCount: inProgress.length,
        lockedCount: locked.length,
        submittedCount: submitted.length,
        inProgressStudents: inProgress.map((s) => ({
          id: s.id,
          studentId: s.studentId,
          name: s.studentName || s.student?.name,
          rollNo: s.studentRollNo || s.student?.registrationId,
          labNumber: s.student?.labNumber || 'LAB-01',
          schoolName: s.student?.schoolName,
          status: s.status,
          tabViolations: s.tabViolations,
          startedAt: s.startedAt
        })),
        lockedStudents: locked.map((s) => ({
          id: s.id,
          studentId: s.studentId,
          name: s.studentName || s.student?.name,
          rollNo: s.studentRollNo || s.student?.registrationId,
          labNumber: s.student?.labNumber || 'LAB-01',
          schoolName: s.student?.schoolName,
          status: s.status,
          tabViolations: s.tabViolations,
          lockReason: s.lockReason,
          startedAt: s.startedAt
        }))
      };
    });

    res.json({
      success: true,
      activeQuizzesCount: activeQuizzes.length,
      quizzes
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get candidate recovery status report
// @route   GET /api/admin/recovery-report
const getRecoveryReport = async (req, res, next) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const reportPath = '/var/www/aiquest/current/recovery-report.json';
    const localReportPath = path.join(__dirname, '../../recovery-report.json');

    let report = null;
    if (fs.existsSync(reportPath)) {
      report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    } else if (fs.existsSync(localReportPath)) {
      report = JSON.parse(fs.readFileSync(localReportPath, 'utf8'));
    }

    const currentStudentsCount = await prisma.user.count({ where: { role: 'STUDENT' } });

    res.json({
      success: true,
      currentStudentsCount,
      report
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Trigger candidate recovery manually
// @route   POST /api/admin/trigger-recovery
const triggerRecovery = async (req, res, next) => {
  try {
    const recoveryScript = require('../../scripts/recover-students');
    const result = await recoveryScript.main();
    res.json({
      success: true,
      result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStudents,
  exportStudentsExcel,
  getSubAdmins,
  getEventOverview,
  getLeaderboard,
  getLiveMonitor,
  getRecoveryReport,
  triggerRecovery
};

