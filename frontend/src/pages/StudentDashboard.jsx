import { createPortal } from "react-dom";
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckSquare,
  Clock,
  ArrowRight,
  CheckCircle2,
  FileText,
  Lock,
  Key,
  X,
  Award,
  Search,
  Eye,
  XCircle,
  Calendar
} from "lucide-react";
import api from "../api/client";

const StudentDashboard = ({ user, activeTab = "active" }) => {
  const navigate = useNavigate();

  const [quizzes, setQuizzes] = useState([]);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Scorecard Detail Modal State
  const [selectedScorecard, setSelectedScorecard] = useState(null);

  // Password Unlock Modal State
  const [unlockModalQuiz, setUnlockModalQuiz] = useState(null);
  const [enteredCode, setEnteredCode] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);

  // Search in Results tab
  const [resultsSearch, setResultsSearch] = useState("");

  // Close modals on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (unlockModalQuiz) setUnlockModalQuiz(null);
        if (selectedScorecard) setSelectedScorecard(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [unlockModalQuiz, selectedScorecard]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [quizRes, subRes] = await Promise.all([
        api.get("/quizzes").catch(() => ({ data: { success: false } })),
        api.get("/submissions/my").catch(() => ({ data: { success: false } }))
      ]);

      if (quizRes.data?.success) {
        setQuizzes(quizRes.data.quizzes || []);
      }
      if (subRes.data?.success) {
        setMySubmissions(subRes.data.submissions || []);
      }
    } catch (err) {
      console.error("Failed to load student dashboard data", err);
    } finally {
      setLoading(false);
    }
  };

  // Build a lookup map of submissions by quizId
  const submissionByQuizId = useMemo(() => {
    const map = {};
    mySubmissions.forEach((sub) => {
      if (sub.quizId) map[sub.quizId] = sub;
    });
    return map;
  }, [mySubmissions]);

  const handleStartQuizClick = (quiz) => {
    // Check if scheduled in the future
    if (quiz.startTime && new Date(quiz.startTime) > new Date()) {
      alert(`This assessment is scheduled to open on ${new Date(quiz.startTime).toLocaleString()}. Please return at the scheduled start time.`);
      return;
    }

    // Check if strict exam window has already concluded
    if (quiz.timingMode === 'STRICT' && quiz.endTime && new Date(quiz.endTime) < new Date()) {
      alert(`This assessment concluded at ${new Date(quiz.endTime).toLocaleString()}.`);
      return;
    }

    // Ensure stale cached passwords from previous sessions do not bypass the modal
    try {
      sessionStorage.removeItem(`quizx_access_${quiz.id}`);
    } catch (e) { }

    if (quiz.isPasswordProtected) {
      setUnlockModalQuiz(quiz);
      setEnteredCode("");
      setUnlockError("");
    } else {
      navigate(`/quiz/${quiz.id}/take`);
    }
  };

  const handleVerifyAccessCode = async (e) => {
    if (e) e.preventDefault();
    if (!enteredCode.trim()) {
      setUnlockError("Please enter the exam access password.");
      return;
    }

    try {
      setIsVerifyingCode(true);
      setUnlockError("");

      const res = await api.post(`/quizzes/${unlockModalQuiz.id}/verify-access`, {
        accessCode: enteredCode.trim()
      });

      if (res.data.success && res.data.verified) {
        sessionStorage.setItem(`quizx_access_${unlockModalQuiz.id}`, enteredCode.trim());
        const targetId = unlockModalQuiz.id;
        setUnlockModalQuiz(null);
        navigate(`/quiz/${targetId}/take`);
      }
    } catch (err) {
      setUnlockError(err.response?.data?.message || "Invalid exam access password. Please confirm with your instructor.");
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const activeQuizzes = quizzes.filter((q) => !q.hasAttempted);
  const completedQuizzes = quizzes.filter((q) => q.hasAttempted);

  // For the results tab, build combined list of attempted submissions
  const attemptedSubmissionsList = useMemo(() => {
    if (mySubmissions.length > 0) {
      return mySubmissions;
    }
    return completedQuizzes.map((q) => ({
      id: q.mySubmission?.id || q.id,
      quizId: q.id,
      quizTitle: q.title,
      courseCode: q.course?.code || "CSE",
      courseTitle: q.course?.title || "",
      creatorName: q.creatorName,
      submittedAt: q.mySubmission?.submittedAt || q.createdAt,
      totalMarks: q.mySubmission?.totalMarks || q.totalMarks,
      score: q.mySubmission?.score,
      percentage: q.mySubmission?.percentage,
      isPassed: q.mySubmission?.isPassed,
      passingMarks: q.passingMarks,
      resultsReleased: Boolean(q.showResultsAfterSubmit && q.mySubmission?.resultsReleased),
      totalQuestions: q.questionCount,
      quiz: q
    }));
  }, [mySubmissions, completedQuizzes]);

  const releasedResultsCount = attemptedSubmissionsList.filter((s) => s.resultsReleased).length;

  const filteredCompletedQuizzes = useMemo(() => {
    if (!resultsSearch.trim()) return completedQuizzes;
    const term = resultsSearch.toLowerCase();
    return completedQuizzes.filter((q) => {
      const titleMatch = q.title && q.title.toLowerCase().includes(term);
      const codeMatch = q.course?.code && q.course.code.toLowerCase().includes(term);
      const descMatch = q.description && q.description.toLowerCase().includes(term);
      return Boolean(titleMatch || codeMatch || descMatch);
    });
  }, [completedQuizzes, resultsSearch]);

  const studentRollNo = user?.registrationId || user?.universityId || user?.mobileNo || "CANDIDATE";
  const candidateClass = user?.studentClass || "Class 12th";
  const candidateStream = user?.stream || "Science";
  const candidateSchool = user?.schoolName || "Graphic Era University";
  const candidateLab = user?.labNumber || "LAB-01";

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-sans">
      {/* 1. Header Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-[#1c1f58] tracking-tight">
              Student Assessment Portal
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-200 uppercase">
              Candidate
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Complete scheduled examinations and review verified scorecards with instant results.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-right shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned Lab</div>
            <div className="text-xs font-black text-amber-600">
              {candidateLab}
            </div>
          </div>

          <div className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-right shadow-2xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Registration ID</div>
            <div className="text-xs font-black text-[#1c1f58]">{studentRollNo}</div>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Available Tests</span>
            <CheckSquare size={18} className="text-blue-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{activeQuizzes.length}</div>
          <div className="text-[11px] text-slate-500 font-medium">Official Championship Assessment</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Completed Tests</span>
            <CheckCircle2 size={18} className="text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900">{completedQuizzes.length}</div>
          <div className="text-[11px] text-slate-500 font-medium">
            {releasedResultsCount} results verified
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Candidate Profile</span>
            <FileText size={18} className="text-purple-600" />
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 truncate" title={candidateSchool}>
            {candidateSchool}
          </div>
          <div className="text-[11px] text-emerald-600 font-bold truncate">
            &bull; {candidateClass} &bull; {candidateStream}
          </div>
        </div>
      </div>

      {/* 3. Main Body Tabs */}
      {loading ? (
        <div className="p-12 text-center text-xs font-bold text-slate-400 bg-white rounded-2xl border border-slate-200">
          Loading assessments...
        </div>
      ) : activeTab === "completed" || activeTab === "results" ? (
        /* Completed Examinations (Overhauled: Never shows ugly FAILED or blank / % when unreleased!) */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900">Completed Examinations</h2>
              <p className="text-xs text-slate-500">
                Verified record of submitted examinations and official scorecards released by faculty.
              </p>
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={resultsSearch}
                onChange={(e) => setResultsSearch(e.target.value)}
                placeholder="Search completed tests..."
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1c1f58] bg-white w-56 sm:w-64"
              />
            </div>
          </div>

          {filteredCompletedQuizzes.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
              <CheckSquare size={36} className="text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700">No Tests Completed Yet</h3>
              <p className="text-xs text-slate-500">Take an available assessment to view your results here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCompletedQuizzes.map((q) => {
                const subFromMap = submissionByQuizId[q.id];
                const sub = subFromMap || q.mySubmission;
                const isReleased = Boolean(q.showResultsAfterSubmit && (sub?.resultsReleased || (sub?.score !== null && sub?.score !== undefined)));

                return (
                  <div
                    key={q.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {q.course?.code || "CSE"}
                        </span>
                        {isReleased ? (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${sub?.isPassed
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                              }`}
                          >
                            {sub?.isPassed ? "PASSED" : "FAILED"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                            <Clock size={11} />
                            <span>Under Evaluation</span>
                          </span>
                        )}
                      </div>

                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900 line-clamp-1">{q.title}</h3>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                          {q.description || "Standard university multiple-choice question assessment."}
                        </p>
                      </div>

                      {/* Display Marks ONLY IF Released, Otherwise Show Clean Submission Verification */}
                      {isReleased ? (
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                          <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Score Secured</div>
                            <div className="text-base font-black text-slate-900">
                              {sub?.score} <span className="text-xs text-slate-400 font-semibold">/ {sub?.totalMarks || q.totalMarks}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Percentage</div>
                            <div
                              className={`text-base font-black ${sub?.isPassed ? "text-emerald-600" : "text-rose-600"
                                }`}
                            >
                              {sub?.percentage}%
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400 font-bold text-[10px] uppercase">Submission Status</span>
                            <span className="font-extrabold text-emerald-700 inline-flex items-center gap-1">
                              <CheckCircle2 size={12} />
                              <span>Paper Submitted</span>
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                            <span className="text-slate-400 font-bold text-[10px] uppercase">Evaluation</span>
                            <span className="font-bold text-indigo-800 text-[11px]">
                              Awaiting Faculty Release
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-3 pt-1 text-[11px] font-medium text-slate-400">
                        <span>Questions: {q.questionCount || "20"}</span>
                        <span>&bull;</span>
                        <span>Passing: {q.passingMarks || "8"} Marks</span>
                      </div>
                    </div>

                    {isReleased ? (
                      <button
                        type="button"
                        onClick={() => {
                          const scorecardData = {
                            ...(sub || {}),
                            ...q,
                            score: sub?.score !== undefined ? sub.score : q.mySubmission?.score,
                            totalMarks: sub?.totalMarks || q.totalMarks || 50,
                            percentage: sub?.percentage !== undefined ? sub.percentage : q.mySubmission?.percentage,
                            isPassed: sub?.isPassed !== undefined ? sub.isPassed : q.mySubmission?.isPassed,
                            passingMarks: q.passingMarks || sub?.passingMarks || 10,
                            courseCode: q.course?.code || sub?.courseCode || "CSE",
                            quizTitle: q.title || sub?.quizTitle || "Assessment",
                            detailedAnalysis: sub?.detailedAnalysis || q.mySubmission?.detailedAnalysis
                          };
                          setSelectedScorecard(scorecardData);
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#1c1f58] hover:bg-[#252975] text-white font-extrabold text-xs transition-all shadow-2xs cursor-pointer active:scale-98"
                      >
                        <Eye size={14} />
                        <span>View Detailed Scorecard</span>
                      </button>
                    ) : (
                      <div className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 text-slate-500 font-bold text-xs cursor-default">
                        <Lock size={12} className="text-slate-400" />
                        <span>Results Pending Faculty Release</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Active Quizzes Available to Take */
        <div className="space-y-4">
          <h2 className="text-base font-black text-slate-900">Scheduled Examinations Ready to Take</h2>
          {activeQuizzes.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
              <CheckSquare size={36} className="text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700">No Scheduled Tests Available</h3>
              <p className="text-xs text-slate-500">
                You do not have any pending assessments at this time.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {activeQuizzes.map((q) => {
                const targetSecLabel =
                  Array.isArray(q.targetSections) && !q.targetSections.includes("ALL")
                    ? q.targetSections.join(", ")
                    : "All Sections";

                const isUpcoming = q.startTime && new Date(q.startTime) > new Date();
                const isStrictEnded = q.timingMode === 'STRICT' && q.endTime && new Date(q.endTime) < new Date();
                const isStrictLive = q.timingMode === 'STRICT' && !isUpcoming && !isStrictEnded;

                return (
                  <div
                    key={q.id}
                    className={`bg-white rounded-2xl border p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 group ${isUpcoming ? "border-indigo-200/80 bg-indigo-50/10" : isStrictEnded ? "border-slate-200 opacity-70" : "border-slate-200 hover:border-slate-300"
                      }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {q.course?.code || "CSE"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {q.timingMode === 'STRICT' ? (
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200" title="Synchronized test window: exam concludes strictly at end time">
                              Strict Window
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                              Flexible
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                            <Clock size={12} />
                            <span>{q.durationMinutes} mins</span>
                          </span>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900 group-hover:text-[#1c1f58] transition-colors line-clamp-1">
                          {q.title}
                        </h3>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                          {q.description || "Standard university multiple-choice question assessment."}
                        </p>
                      </div>

                      {/* Schedule Timings Notice Banner if scheduled */}
                      {isUpcoming && q.startTime && (
                        <div className="p-2.5 rounded-xl bg-indigo-50/80 border border-indigo-100 text-[11px] font-semibold text-indigo-900 flex items-center gap-2">
                          <Calendar size={13} className="text-indigo-600 shrink-0" />
                          <span>Starts {new Date(q.startTime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                        </div>
                      )}

                      {isStrictLive && q.endTime && (
                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-900 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                          <span>Strict Window: Closes {new Date(q.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      )}

                      {/* Target Section & Password Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                          AI Quest 2026
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          Championship Round
                        </span>
                        {q.isPasswordProtected && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Lock size={10} />
                            <span>Password Protected</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 pt-2 text-[11px] font-semibold text-slate-500 border-t border-slate-100">
                        <div>
                          <span className="text-slate-400">Questions: </span>
                          <span className="font-bold text-slate-800">
                            {q.questionsPerStudent && q.poolQuestionsCount && q.questionsPerStudent < q.poolQuestionsCount
                              ? `${q.questionsPerStudent}`
                              : q.questionCount}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Total: </span>
                          <span className="font-bold text-slate-800">{q.totalMarks} Marks</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Pass: </span>
                          <span className="font-bold text-slate-800">{q.passingMarks}</span>
                        </div>
                      </div>
                    </div>

                    {isUpcoming ? (
                      <button
                        type="button"
                        onClick={() => handleStartQuizClick(q)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-indigo-100/80 hover:bg-indigo-200 text-indigo-900 font-extrabold text-xs transition-all cursor-pointer"
                      >
                        <Calendar size={14} />
                        <span>Scheduled: Opens at {new Date(q.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </button>
                    ) : isStrictEnded ? (
                      <div className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-100 text-slate-500 font-extrabold text-xs cursor-not-allowed">
                        <Clock size={14} />
                        <span>Exam Window Concluded</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStartQuizClick(q)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#1c1f58] hover:bg-[#252975] text-white font-extrabold text-xs shadow-xs transition-all cursor-pointer active:scale-98"
                      >
                        {q.isPasswordProtected ? (
                          <>
                            <Key size={14} />
                            <span>Unlock & Start Assessment</span>
                          </>
                        ) : (
                          <>
                            <span>Start Assessment</span>
                            <ArrowRight size={14} />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Password Unlock Modal (PORTAL-RENDERED AT ROOT) */}
      {unlockModalQuiz && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center cursor-pointer"
          onClick={() => setUnlockModalQuiz(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 max-w-md w-full my-auto p-6 shadow-2xl space-y-4 animate-scale-up cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800">
                  <Key size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#1c1f58]">Enter Quiz Password</h3>
                  <p className="text-xs text-slate-500 font-medium">Password required to start quiz</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUnlockModalQuiz(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
              <div className="text-xs font-black text-slate-900 line-clamp-1">{unlockModalQuiz.title}</div>
              <div className="text-[11px] text-slate-500 font-medium">
                {unlockModalQuiz.course?.code} &bull; Instructor: {unlockModalQuiz.creatorName}
              </div>
              <div className="text-[11px] text-indigo-700 font-bold pt-0.5">
                AI Quest 2026 Official Online Examination
              </div>
            </div>

            <form onSubmit={handleVerifyAccessCode} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Enter the password given by your teacher:
                </label>
                <input
                  type="text"
                  autoFocus
                  value={enteredCode}
                  onChange={(e) => {
                    setEnteredCode(e.target.value.toUpperCase());
                    if (unlockError) setUnlockError("");
                  }}
                  placeholder="e.g. GEU-8421"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-mono font-black text-sm text-[#1c1f58] tracking-widest text-center uppercase bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
                />
              </div>

              {unlockError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold text-center">
                  {unlockError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setUnlockModalQuiz(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingCode || !enteredCode.trim()}
                  className="px-5 py-2 rounded-xl bg-[#1c1f58] hover:bg-[#252975] text-white text-xs font-bold transition-all shadow-2xs disabled:opacity-60 cursor-pointer flex items-center gap-1.5"
                >
                  {isVerifyingCode ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Checking...</span>
                    </>
                  ) : (
                    <span>Start Quiz</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Verified Scorecard & Answer Key Modal (PORTAL-RENDERED AT ROOT) */}
      {selectedScorecard && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center cursor-pointer"
          onClick={() => setSelectedScorecard(null)}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full my-auto p-6 sm:p-8 shadow-2xl space-y-6 animate-scale-up cursor-default max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">

                <div>
                  <h3 className="text-lg font-black text-[#1c1f58]">Verified Candidate Scorecard</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {selectedScorecard.courseCode || selectedScorecard.quiz?.course?.code || "COURSE"} &bull; {selectedScorecard.quizTitle || selectedScorecard.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedScorecard(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scorecard Hero Banner — AUTHENTIC GEU ROYAL NAVY THEME (#1c1f58) */}
            <div className="p-5 sm:p-6 rounded-2xl bg-[#1c1f58] border border-[#2a2e76] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
              <div className="space-y-1">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#fbc02d]">Official Result</div>
                <div className="text-3xl font-black tracking-tight flex items-center gap-2">
                  <span>{selectedScorecard.score}</span>
                  <span className="text-base font-semibold text-indigo-200">
                    / {selectedScorecard.totalMarks || selectedScorecard.quiz?.totalMarks || 50} Marks
                  </span>
                </div>
                <div className="text-xs text-indigo-100 font-medium">
                  Percentage: <span className="font-bold text-white">{selectedScorecard.percentage}%</span>
                </div>
              </div>

              <div className="sm:text-right space-y-1.5">
                <span
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${selectedScorecard.isPassed
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                    : "bg-rose-500/20 text-rose-300 border border-rose-400/40"
                    }`}
                >
                  {selectedScorecard.isPassed ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  <span>{selectedScorecard.isPassed ? "PASSED" : "FAILED"}</span>
                </span>
                <div className="text-[11px] text-indigo-200 font-medium">
                  Passing Bar: {selectedScorecard.passingMarks || selectedScorecard.quiz?.passingMarks || 10} Marks
                </div>
              </div>
            </div>

            {/* Candidate Info Block */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Candidate</span>
                <span className="font-black text-slate-900">{user?.name || "Candidate"}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Registration ID</span>
                <span className="font-black text-[#1c1f58]">{studentRollNo}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Class & Stream</span>
                <span className="font-black text-slate-900">{candidateClass} &bull; {candidateStream}</span>
              </div>
            </div>

            {/* Detailed Questions Breakdown (if available) */}
            {Array.isArray(selectedScorecard.detailedAnalysis) && selectedScorecard.detailedAnalysis.length > 0 && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Question-by-Question Response Analysis
                </h4>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {selectedScorecard.detailedAnalysis.map((item, idx) => (
                    <div
                      key={item.questionId || idx}
                      className={`p-4 rounded-xl border text-xs space-y-2 ${item.isCorrect
                        ? "bg-emerald-50/40 border-emerald-200"
                        : item.isAttempted
                          ? "bg-rose-50/40 border-rose-200"
                          : "bg-slate-50 border-slate-200"
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-extrabold text-slate-900">
                          Q{idx + 1}. {item.questionText}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black shrink-0 ${item.isCorrect
                            ? "bg-emerald-100 text-emerald-800"
                            : item.isAttempted
                              ? "bg-rose-100 text-rose-800"
                              : "bg-slate-200 text-slate-700"
                            }`}
                        >
                          {item.isCorrect ? "Correct (+1)" : item.isAttempted ? "Incorrect" : "Unattempted"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                        <div className="p-2 rounded-lg bg-white border border-slate-200">
                          <span className="text-slate-400 block font-bold text-[10px]">Your Answer:</span>
                          <span
                            className={`font-bold ${item.isCorrect
                              ? "text-emerald-700"
                              : item.isAttempted
                                ? "text-rose-700"
                                : "text-slate-500 italic"
                              }`}
                          >
                            {item.isAttempted
                              ? item.options?.[item.studentSelected] || `Option ${item.studentSelected + 1}`
                              : "Not Attempted"}
                          </span>
                        </div>

                        <div className="p-2 rounded-lg bg-white border border-slate-200">
                          <span className="text-slate-400 block font-bold text-[10px]">Correct Answer:</span>
                          <span className="font-bold text-emerald-700">
                            {item.options?.[item.correctOptionIndex] || `Option ${item.correctOptionIndex + 1}`}
                          </span>
                        </div>
                      </div>

                      {item.explanation && (
                        <div className="text-[11px] text-slate-600 bg-white/80 p-2 rounded-lg border border-slate-100">
                          <span className="font-bold text-indigo-900">Explanation: </span>
                          {item.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-400 font-medium">
                Graphic Era University &bull; Examination Division
              </span>
              <button
                type="button"
                onClick={() => setSelectedScorecard(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                Close Scorecard
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default StudentDashboard;
