const prisma = require('../config/db');

// @desc    List all active published quizzes
// @route   GET /api/quizzes
const listQuizzes = async (req, res, next) => {
  try {
    const isStudent = req.user.role === 'STUDENT';
    const whereClause = isStudent ? { isPublished: true, isLive: true } : {};

    const quizzes = await prisma.quiz.findMany({
      where: whereClause,
      include: {
        _count: { select: { questions: true, submissions: true } },
        submissions: isStudent ? {
          where: { studentId: req.user.id },
          select: {
            id: true,
            status: true,
            score: true,
            totalMarks: true,
            percentage: true,
            isPassed: true,
            submittedAt: true,
            tabViolations: true
          }
        } : false
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = quizzes.map((q) => {
      const mySub = isStudent && q.submissions && q.submissions.length > 0 ? q.submissions[0] : null;
      return {
        id: q.id,
        title: q.title,
        description: q.description,
        durationMinutes: q.durationMinutes,
        totalMarks: q.totalMarks,
        passingMarks: q.passingMarks,
        negativeMarking: q.negativeMarking,
        negativeMarksPerWrong: q.negativeMarksPerWrong,
        isPublished: q.isPublished,
        isLive: q.isLive,
        isPasswordProtected: q.isPasswordProtected,
        questionCount: q._count?.questions || 0,
        submissionsCount: q._count?.submissions || 0,
        hasAttempted: Boolean(mySub && (mySub.status === 'SUBMITTED' || mySub.status === 'EVALUATED')),
        mySubmission: mySub
      };
    });

    res.json({
      success: true,
      quizzes: formatted
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single quiz details and questions for taking the assessment
// @route   GET /api/quizzes/:id
const getQuiz = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isStudent = req.user.role === 'STUDENT';
    const isAdmin = req.user.role === 'ADMIN';

    const quiz = await prisma.quiz.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: 'asc' }
        },
        submissions: {
          where: { studentId: req.user.id }
        }
      }
    });

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz assessment not found.' });
    }

    if (isStudent && !quiz.isLive) {
      return res.status(403).json({
        success: false,
        message: 'This assessment is currently closed by the examination authority.'
      });
    }

    // Password verification check
    const existingSub = quiz.submissions && quiz.submissions.length > 0 ? quiz.submissions[0] : null;
    if (isStudent && quiz.isPasswordProtected && (!existingSub || existingSub.status !== 'SUBMITTED')) {
      const accessCode = req.headers['x-quiz-access-code'] || req.query.accessCode;
      if (!accessCode || String(accessCode).trim().toLowerCase() !== String(quiz.accessCode).trim().toLowerCase()) {
        return res.status(403).json({
          success: false,
          requiresPassword: true,
          message: 'Access password required to attempt this assessment.'
        });
      }
    }

    // Attempt Lifecycle: Retrieve or initialize QuizSubmission atomically
    let currentSubmission = existingSub;
    if (isStudent && !currentSubmission && quiz.isLive) {
      currentSubmission = await prisma.quizSubmission.upsert({
        where: {
          quizId_studentId: {
            quizId: quiz.id,
            studentId: req.user.id
          }
        },
        create: {
          quizId: quiz.id,
          studentId: req.user.id,
          studentRollNo: req.user.registrationId || req.user.mobileNo,
          studentName: req.user.name,
          answers: "{}",
          score: 0,
          totalMarks: quiz.totalMarks,
          percentage: 0,
          isPassed: false,
          status: "IN_PROGRESS",
          startedAt: new Date()
        },
        update: {} // Keep existing state if already initialized concurrently
      });
    }

    // Calculate server-anchored time remaining
    const totalDurationSeconds = (quiz.durationMinutes || 30) * 60;
    let timeRemainingSeconds = totalDurationSeconds;

    if (currentSubmission && currentSubmission.startedAt) {
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(currentSubmission.startedAt).getTime()) / 1000));
      timeRemainingSeconds = Math.max(0, totalDurationSeconds - elapsedSeconds);
    }

    // Parse options for questions and sanitize correct answers for students during exam
    const isSubmitted = currentSubmission && (currentSubmission.status === 'SUBMITTED' || currentSubmission.status === 'EVALUATED');
    const allowAnswersReveal = isAdmin || (isStudent && quiz.showResultsAfterSubmit && isSubmitted);

    const sanitizedQuestions = quiz.questions.map((q) => {
      let parsedOptions = [];
      try {
        parsedOptions = JSON.parse(q.options);
      } catch (e) {
        parsedOptions = [q.options];
      }

      if (allowAnswersReveal) {
        return {
          id: q.id,
          order: q.order,
          questionText: q.questionText,
          codeSnippet: q.codeSnippet,
          imageUrl: q.imageUrl,
          options: parsedOptions,
          correctOptionIndex: q.correctOptionIndex,
          marks: q.marks,
          explanation: q.explanation
        };
      }

      // Safe for candidate during exam
      return {
        id: q.id,
        order: q.order,
        questionText: q.questionText,
        codeSnippet: q.codeSnippet,
        imageUrl: q.imageUrl,
        options: parsedOptions,
        marks: q.marks
      };
    });

    let parsedSavedAnswers = {};
    if (currentSubmission && currentSubmission.answers) {
      try {
        parsedSavedAnswers = JSON.parse(currentSubmission.answers);
      } catch (e) {
        parsedSavedAnswers = {};
      }
    }

    res.json({
      success: true,
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        durationMinutes: quiz.durationMinutes,
        totalMarks: quiz.totalMarks,
        passingMarks: quiz.passingMarks,
        negativeMarking: quiz.negativeMarking,
        negativeMarksPerWrong: quiz.negativeMarksPerWrong,
        showResultsAfterSubmit: quiz.showResultsAfterSubmit,
        isPasswordProtected: quiz.isPasswordProtected,
        questions: sanitizedQuestions,
        timeRemainingSeconds,
        serverTime: Date.now(),
        mySubmission: currentSubmission ? {
          id: currentSubmission.id,
          status: currentSubmission.status,
          score: currentSubmission.score,
          totalMarks: currentSubmission.totalMarks,
          percentage: currentSubmission.percentage,
          isPassed: currentSubmission.isPassed,
          tabViolations: currentSubmission.tabViolations,
          lockReason: currentSubmission.lockReason,
          answers: parsedSavedAnswers,
          startedAt: currentSubmission.startedAt,
          submittedAt: currentSubmission.submittedAt
        } : null,
        isLocked: currentSubmission?.status === 'LOCKED'
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify exam access password before candidate enters exam
// @route   POST /api/quizzes/:id/verify-access
const verifyAccessCode = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { accessCode } = req.body;

    const quiz = await prisma.quiz.findUnique({
      where: { id },
      select: { id: true, accessCode: true, isPasswordProtected: true }
    });

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found.' });
    }

    if (!quiz.isPasswordProtected) {
      return res.json({ success: true, verified: true });
    }

    const cleanEntered = String(accessCode || '').trim().toLowerCase();
    const cleanReal = String(quiz.accessCode || '').trim().toLowerCase();

    if (cleanEntered && cleanEntered === cleanReal) {
      return res.json({ success: true, verified: true });
    }

    return res.status(401).json({
      success: false,
      verified: false,
      message: 'Invalid exam access password. Please verify with your lab invigilator.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Auto-save candidate answers during active exam (debounced)
// @route   POST /api/quizzes/:id/save-progress
const saveProgress = async (req, res, next) => {
  try {
    const { id: quizId } = req.params;
    const { answers } = req.body;

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ success: false, message: 'Valid answers map is required.' });
    }

    const sub = await prisma.quizSubmission.findUnique({
      where: {
        quizId_studentId: {
          quizId,
          studentId: req.user.id
        }
      }
    });

    if (!sub) {
      return res.status(404).json({ success: false, message: 'Active attempt not found.' });
    }

    if (sub.status === 'SUBMITTED' || sub.status === 'EVALUATED') {
      return res.json({ success: true, message: 'Assessment already submitted.', isSubmitted: true });
    }

    if (sub.status === 'LOCKED') {
      return res.status(403).json({ success: false, isLocked: true, message: 'Session locked by invigilator.' });
    }

    await prisma.quizSubmission.update({
      where: { id: sub.id },
      data: {
        answers: JSON.stringify(answers),
        ...(sub.lockReason?.startsWith('RESET_BY_INSTRUCTOR:') ? { lockReason: null } : {})
      }
    });

    res.json({
      success: true,
      message: 'Progress auto-saved successfully.',
      answersCount: Object.keys(answers).length
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get session status for live proctoring heartbeat
// @route   GET /api/quizzes/:id/session-status
const getSessionStatus = async (req, res, next) => {
  try {
    const { id: quizId } = req.params;
    const sub = await prisma.quizSubmission.findUnique({
      where: {
        quizId_studentId: {
          quizId,
          studentId: req.user.id
        }
      }
    });

    if (!sub) {
      return res.json({
        success: true,
        exists: false,
        status: 'NOT_STARTED',
        isLocked: false,
        tabViolations: 0,
        serverTime: Date.now()
      });
    }

    const isLocked = sub.status === 'LOCKED';
    res.json({
      success: true,
      exists: true,
      serverTime: Date.now(),
      status: sub.status,
      isLocked,
      tabViolations: sub.tabViolations || 0,
      resetToken: sub.lockReason?.startsWith('RESET_BY_INSTRUCTOR:') ? sub.lockReason : null,
      lockReason: sub.lockReason || null,
      isSubmitted: sub.status === 'SUBMITTED' || sub.status === 'EVALUATED'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Final submit and instant evaluation of assessment
// @route   POST /api/quizzes/:id/submit
const submitQuiz = async (req, res, next) => {
  try {
    const { id: quizId } = req.params;
    const { answers } = req.body;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found.' });
    }

    const existingSub = await prisma.quizSubmission.findUnique({
      where: {
        quizId_studentId: {
          quizId,
          studentId: req.user.id
        }
      }
    });

    // Evaluate answers
    const studentAnswers = answers && typeof answers === 'object' ? answers : (
      existingSub && existingSub.answers ? JSON.parse(existingSub.answers) : {}
    );

    let calculatedScore = 0;
    let totalMarks = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;

    const detailedAnalysis = quiz.questions.map((q) => {
      totalMarks += q.marks;
      const ans = studentAnswers[q.id];

      const isAttempted = ans !== undefined && ans !== null && ans !== -1;
      const isCorrect = isAttempted && Number(ans) === Number(q.correctOptionIndex);

      if (isAttempted) {
        if (isCorrect) {
          calculatedScore += q.marks;
          correctCount++;
        } else {
          incorrectCount++;
          if (quiz.negativeMarking) {
            calculatedScore -= (quiz.negativeMarksPerWrong || 0.25);
          }
        }
      } else {
        unattemptedCount++;
      }

      let parsedOpts = [];
      try {
        parsedOpts = JSON.parse(q.options);
      } catch (e) {
        parsedOpts = [q.options];
      }

      const marksAwarded = isCorrect ? q.marks : (isAttempted && quiz.negativeMarking ? -(quiz.negativeMarksPerWrong || 0.25) : 0);

      return {
        questionId: q.id,
        order: q.order,
        questionText: q.questionText,
        options: Array.isArray(parsedOpts) ? parsedOpts : [],
        selectedOptionIndex: isAttempted ? Number(ans) : null,
        studentSelected: isAttempted ? Number(ans) : null,
        correctOptionIndex: Number(q.correctOptionIndex),
        isAttempted,
        isCorrect,
        marks: q.marks,
        marksAwarded,
        explanation: q.explanation
      };
    });

    // If assessment already submitted, gracefully return existing evaluated results
    if (existingSub && (existingSub.status === 'SUBMITTED' || existingSub.status === 'EVALUATED')) {
      const existingResult = {
        id: existingSub.id,
        submissionId: existingSub.id,
        score: existingSub.score,
        totalMarks: existingSub.totalMarks,
        percentage: existingSub.percentage,
        isPassed: existingSub.isPassed,
        passingMarks: quiz.passingMarks,
        status: existingSub.status,
        submittedAt: existingSub.submittedAt,
        showResultsAfterSubmit: Boolean(quiz.showResultsAfterSubmit),
        alreadySubmitted: true,
        detailedAnalysis
      };
      return res.json({
        success: true,
        alreadySubmitted: true,
        message: 'This assessment has already been submitted.',
        result: existingResult,
        submission: existingResult
      });
    }

    const finalScore = Math.max(0, Math.round(calculatedScore * 100) / 100);
    const percentage = totalMarks > 0 ? Math.round((finalScore / totalMarks) * 100 * 10) / 10 : 0;
    const isPassed = finalScore >= quiz.passingMarks;

    const studentRollNo = req.user.registrationId || req.user.mobileNo || req.user.email || 'STUDENT';
    const studentName = req.user.name || 'Candidate';

    const submission = await prisma.quizSubmission.upsert({
      where: {
        quizId_studentId: {
          quizId,
          studentId: req.user.id
        }
      },
      update: {
        answers: JSON.stringify(studentAnswers),
        score: finalScore,
        totalMarks,
        percentage,
        isPassed,
        status: 'SUBMITTED',
        submittedAt: new Date()
      },
      create: {
        quizId,
        studentId: req.user.id,
        studentRollNo,
        studentName,
        answers: JSON.stringify(studentAnswers),
        score: finalScore,
        totalMarks,
        percentage,
        isPassed,
        status: 'SUBMITTED',
        startedAt: new Date(),
        submittedAt: new Date()
      }
    });

    const resultPayload = {
      id: submission.id,
      submissionId: submission.id,
      score: submission.score,
      totalMarks: submission.totalMarks,
      percentage: submission.percentage,
      isPassed: submission.isPassed,
      passingMarks: quiz.passingMarks,
      status: submission.status,
      submittedAt: submission.submittedAt,
      correctCount,
      incorrectCount,
      unattemptedCount,
      showResultsAfterSubmit: Boolean(quiz.showResultsAfterSubmit),
      detailedAnalysis
    };

    res.json({
      success: true,
      message: 'Assessment submitted successfully! Evaluation complete.',
      result: resultPayload,
      submission: resultPayload
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin Create Assessment
// @route   POST /api/quizzes
const createQuiz = async (req, res, next) => {
  try {
    const {
      title,
      description,
      durationMinutes,
      totalMarks,
      passingMarks,
      negativeMarking,
      negativeMarksPerWrong,
      accessCode,
      isPasswordProtected,
      questions
    } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Quiz title is required.' });
    }

    const quiz = await prisma.quiz.create({
      data: {
        title,
        description,
        durationMinutes: Number(durationMinutes) || 30,
        totalMarks: Number(totalMarks) || 30,
        passingMarks: Number(passingMarks) || 12,
        negativeMarking: Boolean(negativeMarking),
        negativeMarksPerWrong: Number(negativeMarksPerWrong) || 0.25,
        accessCode: accessCode || 'QUEST2026',
        isPasswordProtected: Boolean(isPasswordProtected),
        isPublished: true,
        isLive: true,
        questions: {
          create: Array.isArray(questions) ? questions.map((q, idx) => ({
            order: idx + 1,
            questionText: q.questionText,
            codeSnippet: q.codeSnippet || null,
            imageUrl: q.imageUrl || null,
            options: JSON.stringify(q.options || ['A', 'B', 'C', 'D']),
            correctOptionIndex: Number(q.correctOptionIndex) || 0,
            marks: Number(q.marks) || 1.0,
            explanation: q.explanation || null
          })) : []
        }
      },
      include: { questions: true }
    });

    res.status(201).json({
      success: true,
      message: 'Assessment created successfully.',
      quiz
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all currently locked candidates for invigilator portal
// @route   GET /api/quizzes/instructor/locked-candidates
const getInstructorLockedCandidates = async (req, res, next) => {
  try {
    const lockedSubmissions = await prisma.quizSubmission.findMany({
      where: { status: 'LOCKED' },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            registrationId: true,
            mobileNo: true,
            schoolName: true,
            studentClass: true,
            stream: true,
            city: true
          }
        },
        quiz: {
          select: {
            id: true,
            title: true,
            totalMarks: true
          }
        }
      },
      orderBy: { startedAt: 'desc' }
    });


    const candidates = lockedSubmissions.map((s, idx) => ({
      id: s.id,
      studentName: s.studentName || s.student?.name || 'Candidate',
      studentRollNo: s.studentRollNo || s.student?.registrationId || 'N/A',
      quizId: s.quizId,
      quizTitle: s.quiz?.title || 'Assessment',
      courseCode: 'AIQ-2026',
      section: ['A', 'B', 'C', 'D'][idx % 4],
      semester: 1,
      tabViolations: s.tabViolations,
      lockReason: s.lockReason || 'Focus threshold exceeded',
      startedAt: s.startedAt,
      student: s.student
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

// @desc    Get all active test-takers for invigilator portal
// @route   GET /api/quizzes/instructor/live-candidates
const getInstructorLiveCandidates = async (req, res, next) => {
  try {
    const liveSubmissions = await prisma.quizSubmission.findMany({
      where: { status: 'IN_PROGRESS' },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            registrationId: true,
            mobileNo: true,
            schoolName: true,
            studentClass: true,
            stream: true,
            city: true
          }
        },
        quiz: {
          select: {
            id: true,
            title: true,
            totalMarks: true
          }
        }
      },
      orderBy: { startedAt: 'desc' }
    });

    const candidates = liveSubmissions.map((s, idx) => ({
      id: s.id,
      studentName: s.studentName || s.student?.name || 'Candidate',
      studentRollNo: s.studentRollNo || s.student?.registrationId || 'N/A',
      quizId: s.quizId,
      quizTitle: s.quiz?.title || 'Assessment',
      courseCode: 'AIQ-2026',
      section: ['A', 'B', 'C', 'D'][idx % 4],
      semester: 1,
      tabViolations: s.tabViolations,
      status: s.status,
      startedAt: s.startedAt,
      student: s.student
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

// @desc    Authorize and unlock candidate session from invigilator portal
// @route   POST /api/quizzes/submissions/:id/unlock
const unlockSubmissionAttempt = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { actionType } = req.body;

    const submission = await prisma.quizSubmission.findUnique({
      where: { id }
    });

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission record not found.' });
    }

    const updateData = {
      status: 'IN_PROGRESS',
      tabViolations: 0,
      lockReason: null
    };

    if (actionType === 'retake' || actionType === 'reset_answers') {
      updateData.answers = '{}';
    }

    const updated = await prisma.quizSubmission.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      message: actionType === 'reset_answers'
        ? 'Candidate answers have been reset. Countdown timer preserved.'
        : 'Candidate unlocked successfully.',
      submission: updated
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Manually freeze / lock candidate session from invigilator portal
// @route   POST /api/quizzes/submissions/:id/lock
const lockSubmissionAttempt = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const submission = await prisma.quizSubmission.findUnique({
      where: { id }
    });

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission record not found.' });
    }

    const updated = await prisma.quizSubmission.update({
      where: { id },
      data: {
        status: 'LOCKED',
        lockReason: reason || 'Invigilator manual intervention'
      }
    });

    res.json({
      success: true,
      message: 'Candidate session frozen successfully.',
      submission: updated
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update an existing quiz
// @route   PUT /api/quizzes/:id
const updateQuiz = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      durationMinutes,
      totalMarks,
      passingMarks,
      negativeMarking,
      negativeMarksPerWrong,
      accessCode,
      isPasswordProtected,
      isLive,
      questions
    } = req.body;

    const quiz = await prisma.quiz.findUnique({ where: { id } });
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    const updateData = {};
    if (title) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description;
    if (durationMinutes) updateData.durationMinutes = Number(durationMinutes);
    if (totalMarks) updateData.totalMarks = Number(totalMarks);
    if (passingMarks) updateData.passingMarks = Number(passingMarks);
    if (negativeMarking !== undefined) updateData.negativeMarking = Boolean(negativeMarking);
    if (negativeMarksPerWrong !== undefined) updateData.negativeMarksPerWrong = Number(negativeMarksPerWrong);
    if (accessCode !== undefined) updateData.accessCode = accessCode;
    if (isPasswordProtected !== undefined) updateData.isPasswordProtected = Boolean(isPasswordProtected);
    if (isLive !== undefined) updateData.isLive = Boolean(isLive);

    if (Array.isArray(questions) && questions.length > 0) {
      await prisma.question.deleteMany({ where: { quizId: id } });
      updateData.questions = {
        create: questions.map((q, idx) => ({
          order: idx + 1,
          questionText: q.questionText,
          codeSnippet: q.codeSnippet || null,
          imageUrl: q.imageUrl || null,
          options: JSON.stringify(q.options || ['A', 'B', 'C', 'D']),
          correctOptionIndex: Number(q.correctOptionIndex) || 0,
          marks: Number(q.marks) || 1.0,
          explanation: q.explanation || null
        }))
      };
    }

    const updated = await prisma.quiz.update({
      where: { id },
      data: updateData,
      include: { questions: true }
    });

    res.json({
      success: true,
      message: 'Assessment updated successfully.',
      quiz: updated
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle quiz live status
// @route   PATCH /api/quizzes/:id/toggle-live
const toggleQuizLive = async (req, res, next) => {
  try {
    const { id } = req.params;
    const quiz = await prisma.quiz.findUnique({ where: { id } });
    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found.' });
    }
    const updated = await prisma.quiz.update({
      where: { id },
      data: { isLive: !quiz.isLive }
    });
    res.json({
      success: true,
      message: `Quiz is now ${updated.isLive ? 'LIVE' : 'OFFLINE'}.`,
      isLive: updated.isLive
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a quiz
// @route   DELETE /api/quizzes/:id
const deleteQuiz = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.quiz.deleteMany({ where: { id } });
    res.json({
      success: true,
      message: 'Quiz deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listQuizzes,
  getQuiz,
  verifyAccessCode,
  saveProgress,
  getSessionStatus,
  submitQuiz,
  createQuiz,
  updateQuiz,
  toggleQuizLive,
  deleteQuiz,
  getInstructorLockedCandidates,
  getInstructorLiveCandidates,
  unlockSubmissionAttempt,
  lockSubmissionAttempt
};


