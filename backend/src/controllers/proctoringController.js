const prisma = require('../config/db');

// @desc    Record candidate tab switch or window focus violation
// @route   POST /api/proctoring/:quizId/violation
const recordViolation = async (req, res, next) => {
  try {
    const quizId = req.params.quizId || req.params.id;
    const { violationCount, reason } = req.body;

    const count = Number(violationCount) || 1;
    const maxThreshold = 3;
    const shouldLock = count >= maxThreshold;
    const lockMsg = reason || `Exceeded allowed focus switches (${count}/${maxThreshold})`;

    const updated = await prisma.quizSubmission.upsert({
      where: {
        quizId_studentId: {
          quizId,
          studentId: req.user.id
        }
      },
      update: {
        tabViolations: count,
        ...(shouldLock ? { status: 'LOCKED', lockReason: lockMsg } : {})
      },
      create: {
        quizId,
        studentId: req.user.id,
        studentRollNo: req.user.registrationId || req.user.mobileNo,
        studentName: req.user.name,
        answers: "{}",
        score: 0,
        totalMarks: 30,
        percentage: 0,
        isPassed: false,
        tabViolations: count,
        status: shouldLock ? 'LOCKED' : 'IN_PROGRESS',
        lockReason: shouldLock ? lockMsg : null
      }
    });

    res.json({
      success: true,
      tabViolations: updated.tabViolations,
      isLocked: updated.status === 'LOCKED',
      lockReason: updated.lockReason
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Student poll endpoint to check for real-time unlock/reset from invigilator
// @route   GET /api/proctoring/:quizId/session-status
const getSessionStatus = async (req, res, next) => {
  try {
    const quizId = req.params.quizId || req.params.id;

    const sub = await prisma.quizSubmission.findUnique({
      where: {
        quizId_studentId: {
          quizId,
          studentId: req.user.id
        }
      },
      select: {
        id: true,
        status: true,
        tabViolations: true,
        lockReason: true,
        score: true,
        percentage: true,
        isPassed: true,
        startedAt: true,
        submittedAt: true
      }
    });

    if (!sub) {
      return res.json({
        success: true,
        exists: false,
        status: 'NOT_STARTED',
        isLocked: false,
        tabViolations: 0
      });
    }

    res.json({
      success: true,
      exists: true,
      status: sub.status,
      isLocked: sub.status === 'LOCKED',
      tabViolations: sub.tabViolations || 0,
      lockReason: sub.lockReason || null,
      isSubmitted: sub.status === 'SUBMITTED' || sub.status === 'EVALUATED'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get live test candidates (Sub-admin sees own lab; Admin sees all labs)
// @route   GET /api/proctoring/candidates
const getCandidates = async (req, res, next) => {
  try {
    const isSubAdmin = req.user.role === 'SUBADMIN';
    const filterLab = isSubAdmin ? req.user.labNumber : req.query.labNumber;
    const { status, search } = req.query;

    const whereClause = {
      ...(filterLab ? { student: { labNumber: filterLab } } : {}),
      ...(status ? { status } : {}),
      ...(search ? {
        OR: [
          { studentName: { contains: search } },
          { studentRollNo: { contains: search } },
          { student: { mobileNo: { contains: search } } }
        ]
      } : {})
    };

    const submissions = await prisma.quizSubmission.findMany({
      where: whereClause,
      include: {
        student: {
          select: {
            id: true,
            registrationId: true,
            name: true,
            mobileNo: true,
            email: true,
            schoolName: true,
            studentClass: true,
            stream: true,
            labNumber: true
          }
        },
        quiz: {
          select: { id: true, title: true, totalMarks: true }
        }
      },
      orderBy: { startedAt: 'desc' }
    });

    const candidates = submissions.map((s) => ({
      submissionId: s.id,
      studentId: s.student.id,
      registrationId: s.student.registrationId,
      name: s.student.name,
      mobileNo: s.student.mobileNo,
      email: s.student.email,
      schoolName: s.student.schoolName,
      studentClass: s.student.studentClass,
      stream: s.student.stream,
      labNumber: s.student.labNumber,
      quizTitle: s.quiz.title,
      status: s.status,
      tabViolations: s.tabViolations,
      lockReason: s.lockReason,
      score: s.score,
      totalMarks: s.totalMarks,
      percentage: s.percentage,
      isPassed: s.isPassed,
      startedAt: s.startedAt,
      submittedAt: s.submittedAt
    }));

    res.json({
      success: true,
      count: candidates.length,
      candidates
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Unlock a locked student attempt
// @route   POST /api/proctoring/submissions/:id/unlock
const unlockCandidate = async (req, res, next) => {
  try {
    const { id } = req.params;

    const sub = await prisma.quizSubmission.findUnique({
      where: { id },
      include: { student: true, quiz: true }
    });

    if (!sub) {
      return res.status(404).json({ success: false, message: 'Submission not found.' });
    }

    // Lab isolation check for Sub-admins
    if (req.user.role === 'SUBADMIN' && sub.student.labNumber !== req.user.labNumber) {
      return res.status(403).json({
        success: false,
        message: `Unauthorized: You can only unlock students assigned to ${req.user.labNumber}.`
      });
    }

    const updated = await prisma.quizSubmission.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        lockReason: null,
        tabViolations: 0 // Reset violation counter on authorized unlock
      }
    });

    // Create audit log
    await prisma.adminAuditLog.create({
      data: {
        adminId: req.user.id,
        adminName: `${req.user.name} (${req.user.role})`,
        action: 'UNLOCK_STUDENT',
        targetType: 'SUBMISSION',
        targetId: id,
        details: `Unlocked student ${sub.student.name} (${sub.student.registrationId}) in ${sub.student.labNumber}.`
      }
    });

    res.json({
      success: true,
      message: `Candidate ${sub.student.name} is now UNLOCKED and authorized to resume.`,
      submission: updated
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset candidate answers (fresh start while preserving elapsed exam timer)
// @route   POST /api/proctoring/submissions/:id/reset
const resetCandidate = async (req, res, next) => {
  try {
    const { id } = req.params;

    const sub = await prisma.quizSubmission.findUnique({
      where: { id },
      include: { student: true }
    });

    if (!sub) {
      return res.status(404).json({ success: false, message: 'Submission not found.' });
    }

    if (req.user.role === 'SUBADMIN' && sub.student.labNumber !== req.user.labNumber) {
      return res.status(403).json({
        success: false,
        message: `Unauthorized: You can only reset students in ${req.user.labNumber}.`
      });
    }

    const resetToken = `RESET_BY_INSTRUCTOR:${Date.now()}`;
    const updated = await prisma.quizSubmission.update({
      where: { id },
      data: {
        answers: "{}",
        score: 0,
        percentage: 0,
        isPassed: false,
        status: 'IN_PROGRESS',
        lockReason: resetToken,
        tabViolations: 0,
        submittedAt: null
      }
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId: req.user.id,
        adminName: `${req.user.name} (${req.user.role})`,
        action: 'RESET_STUDENT_ANSWERS',
        targetType: 'SUBMISSION',
        targetId: id,
        details: `Reset answers for ${sub.student.name} in ${sub.student.labNumber}. Exam timer preserved.`
      }
    });

    res.json({
      success: true,
      message: `Answers cleared for ${sub.student.name}. Exam timer remains unchanged.`,
      submission: updated
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  recordViolation,
  getSessionStatus,
  getCandidates,
  unlockCandidate,
  resetCandidate
};
