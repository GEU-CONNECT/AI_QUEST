import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Plus,
  BookOpen,
  CheckSquare,
  Clock,
  BarChart3,
  Trash2,
  Eye,
  Edit3,
  FileQuestion,
  Search,
  Users,
  Key,
  Copy,
  Check,
  Power,
  Unlock,
  RotateCcw,
  Lock,
  RefreshCw,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  Building2
} from 'lucide-react';
import api from '../api/client';
import CreateQuizView from '../components/CreateQuizView';
import QuestionVaultView from '../components/QuestionVaultView';

const FacultyDashboard = ({ user, activeTab = 'quizzes', onTabChange }) => {
  const navigate = useNavigate();

  const [quizzes, setQuizzes] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingQuizId, setEditingQuizId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [courseSemesterFilter, setCourseSemesterFilter] = useState("ALL");
  const [activeSemesters, setActiveSemesters] = useState([1, 3, 5, 7]);

  // Locked Candidate Session Authorization State
  const [lockedCandidates, setLockedCandidates] = useState([]);
  const [loadingLocked, setLoadingLocked] = useState(false);
  const [unlockingCandidateId, setUnlockingCandidateId] = useState(null);
  const [unlockMsg, setUnlockMsg] = useState('');
  const [lockedCandidateSearch, setLockedCandidateSearch] = useState("");

  // Sub-Tab Monitor State: "locked" vs "live"
  const [monitorSubTab, setMonitorSubTab] = useState("locked");
  const [liveCandidates, setLiveCandidates] = useState([]);
  const [loadingLive, setLoadingLive] = useState(false);
  const [liveSearchQuery, setLiveSearchQuery] = useState("");
  const [monitorQuizFilter, setMonitorQuizFilter] = useState("ALL");

  const fetchLiveCandidates = async () => {
    try {
      setLoadingLive(true);
      const res = await api.get("/quizzes/instructor/live-candidates");
      if (res.data?.success) {
        setLiveCandidates(res.data.candidates || []);
      }
    } catch (err) {
      console.error("Failed to load live candidates", err);
    } finally {
      setLoadingLive(false);
    }
  };

  const handleManualFreezeCandidate = async (candidateId, studentName) => {
    if (!window.confirm(`Freeze and LOCK examination session for ${studentName}?\n\nTheir exam window will be immediately frozen on their screen.`)) {
      return;
    }
    try {
      setUnlockingCandidateId(`${candidateId}-freeze`);
      const res = await api.post(`/quizzes/submissions/${candidateId}/lock`, { reason: "Invigilator manual intervention" });
      if (res.data?.success) {
        setUnlockMsg(`Candidate ${studentName}'s session has been FROZEN.`);
        fetchLockedCandidates();
        fetchLiveCandidates();
        setTimeout(() => setUnlockMsg(""), 4500);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to freeze candidate session");
    } finally {
      setUnlockingCandidateId(null);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchLockedCandidates();
  }, []);

  useEffect(() => {
    if (activeTab === "candidate-lockouts" || activeTab === "live-monitor") {
      if (activeTab === "live-monitor") {
        setMonitorSubTab("live");
      }
      fetchLockedCandidates();
      fetchLiveCandidates();
    }
  }, [activeTab]);

  const fetchLockedCandidates = async () => {
    try {
      setLoadingLocked(true);
      const res = await api.get('/quizzes/instructor/locked-candidates');
      if (res.data?.success) {
        setLockedCandidates(res.data.candidates || []);
      }
    } catch (err) {
      console.error('Failed to load locked candidates', err);
    } finally {
      setLoadingLocked(false);
    }
  };

  const handleAuthorizeCandidate = async (candidateId, studentName, actionType = "resume") => {
    try {
      setUnlockingCandidateId(`${candidateId}-${actionType}`);
      setUnlockMsg("");
      const res = await api.post(`/quizzes/submissions/${candidateId}/unlock`, { actionType });
      if (res.data?.success) {
        setUnlockMsg(
          actionType === "retake" || actionType === "reset_answers"
            ? `Answers reset for ${studentName}. Active exam countdown timer is preserved.`
            : `Candidate ${studentName} has been authorized and unlocked. Assessment can now resume.`
        );
        fetchLockedCandidates();
        fetchLiveCandidates();
        setTimeout(() => setUnlockMsg(""), 4500);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update candidate session");
    } finally {
      setUnlockingCandidateId(null);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [quizzesRes, coursesRes, cfgRes] = await Promise.allSettled([
        api.get('/quizzes'),
        api.get('/courses'),
        api.get('/academic/config')
      ]);

      if (quizzesRes.status === 'fulfilled' && quizzesRes.value.data.success) {
        setQuizzes(quizzesRes.value.data.quizzes);
      }
      if (coursesRes.status === 'fulfilled' && coursesRes.value.data.success) {
        setCourses(coursesRes.value.data.courses);
      }
      if (cfgRes.status === 'fulfilled' && cfgRes.value.data.success && Array.isArray(cfgRes.value.data.activeSemesters)) {
        setActiveSemesters(cfgRes.value.data.activeSemesters);
      }
    } catch (err) {
      console.error('Failed to load faculty dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLive = async (quizId) => {
    try {
      const res = await api.patch(`/quizzes/${quizId}/toggle-live`);
      if (res.data.success) {
        setQuizzes((prev) =>
          prev.map((q) => (q.id === quizId ? { ...q, isLive: res.data.isLive } : q))
        );
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to toggle assessment live status');
    }
  };

  const handleDeleteQuiz = async (quizId, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      await api.delete(`/quizzes/${quizId}`);
      setQuizzes(quizzes.filter((q) => q.id !== quizId));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete quiz');
    }
  };

  const handleCopyCode = (quizId, code) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedId(quizId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredQuizzes = quizzes.filter((q) =>
    q.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.course?.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.course?.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalQuestions = quizzes.reduce((sum, q) => sum + (q.questionCount || 0), 0);
  const totalSubmissions = quizzes.reduce((sum, q) => sum + (q.submissionCount || 0), 0);

    // If editing an assessment, render dedicated full-page editor with quizId
  if (editingQuizId) {
    return (
      <CreateQuizView
        quizId={editingQuizId}
        onBack={() => setEditingQuizId(null)}
        onCreated={() => {
          setEditingQuizId(null);
          fetchDashboardData();
        }}
      />
    );
  }

  // If active tab is create-quiz, render the dedicated full-page editor (NO MODAL)
  if (activeTab === 'create-quiz') {
    return (
      <CreateQuizView
        onBack={() => onTabChange && onTabChange('quizzes')}
        onCreated={() => {
          fetchDashboardData();
          if (onTabChange) onTabChange('quizzes');
        }}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-sans">
      {/* 1. Page Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#1c1f58] tracking-tight">
            {user?.role === 'SUBADMIN'
              ? `AI Quest Lab Invigilator Portal - ${user?.labNumber || "LAB-01"}`
              : "Manage Course Assessments"}
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {user?.role === 'SUBADMIN'
              ? "Authorized to monitor live examination candidates and unlock or reset student attempts in your assigned lab."
              : "Configure section targets, assign exam access passwords, and monitor live candidate tests."}
          </p>
        </div>
      </div>

      {/* 2. Key Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {user?.role === 'SUBADMIN' ? (
          <>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Assigned Lab</span>
                <Building2 size={18} className="text-[#1c1f58]" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900">{user?.labNumber || "LAB-01"}</div>
              <div className="text-[11px] text-slate-500 font-medium">Physical exam station</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Locked Candidates</span>
                <Lock size={18} className="text-rose-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-rose-600">{lockedCandidates.length}</div>
              <div className="text-[11px] text-slate-500 font-medium">Requires invigilator unlock</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Test-Takers</span>
                <Activity size={18} className="text-emerald-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600">{liveCandidates.length}</div>
              <div className="text-[11px] text-slate-500 font-medium">Currently taking quiz</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Authorized Rights</span>
                <ShieldCheck size={18} className="text-indigo-600" />
              </div>
              <div className="text-sm font-black text-slate-900 mt-2">Unlock & Reset Only</div>
              <div className="text-[11px] text-slate-500 font-medium">Super Admin creates quizzes</div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Assigned Courses</span>
                <BookOpen size={18} className="text-blue-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900">{courses.length}</div>
              <div className="text-[11px] text-slate-500 font-medium">B.Tech CSE Core Modules</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">My Author Quizzes</span>
                <CheckSquare size={18} className="text-purple-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900">{quizzes.length}</div>
              <div className="text-[11px] text-slate-500 font-medium">Faculty authored assessments</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Question Bank</span>
                <FileQuestion size={18} className="text-amber-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900">{totalQuestions}</div>
              <div className="text-[11px] text-slate-500 font-medium">Verified MCQ items</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Submissions</span>
                <CheckSquare size={18} className="text-indigo-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900">{totalSubmissions}</div>
              <div className="text-[11px] text-slate-500 font-medium">Evaluated student tests</div>
            </div>
          </>
        )}
      </div>

      {/* 3. Section Content based on activeTab */}
      {(user?.role === 'SUBADMIN' || activeTab === "candidate-lockouts" || activeTab === "live-monitor") ? (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Top Title & Quick Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Unlock size={18} className="text-[#1c1f58]" />
                <span>Assessment Proctoring & Session Monitor</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Monitor real-time live test-takers and their tab switches, or authorize and reset frozen student sessions.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  fetchLockedCandidates();
                  fetchLiveCandidates();
                }}
                disabled={loadingLocked || loadingLive}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer active:scale-95"
              >
                <RefreshCw size={13} className={(loadingLocked || loadingLive) ? "animate-spin text-[#1c1f58]" : "text-slate-500"} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Sub-Tab Navigation Switcher */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setMonitorSubTab("locked");
                fetchLockedCandidates();
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                monitorSubTab === "locked"
                  ? "bg-[#1c1f58] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Lock size={13} />
              <span>Locked Candidates</span>
              {lockedCandidates.length > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[11px] font-semibold leading-none ${
                    monitorSubTab === "locked"
                      ? "bg-white/20 text-white"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {lockedCandidates.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setMonitorSubTab("live");
                fetchLiveCandidates();
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                monitorSubTab === "live"
                  ? "bg-[#1c1f58] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Users size={13} />
              <span>Live Test Monitor</span>
              {liveCandidates.length > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[11px] font-semibold leading-none ${
                    monitorSubTab === "live"
                      ? "bg-white/20 text-white"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {liveCandidates.length}
                </span>
              )}
            </button>
          </div>

          {/* Status Feedback Message */}
          {unlockMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-150">
              <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
              <span>{unlockMsg}</span>
            </div>
          )}

          {/* SUB-TAB 1: LOCKED CANDIDATES VIEW */}
          {monitorSubTab === "locked" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={lockedCandidateSearch}
                    onChange={(e) => setLockedCandidateSearch(e.target.value)}
                    placeholder="Search locked candidate by name, roll no, or assessment..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1c1f58] bg-white shadow-2xs"
                  />
                </div>
                <select
                  value={monitorQuizFilter}
                  onChange={(e) => setMonitorQuizFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1c1f58] bg-white shadow-2xs text-slate-700"
                >
                  <option value="ALL">All Assessments</option>
                  {quizzes.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title} ({q.course?.code || 'PLC'})
                    </option>
                  ))}
                </select>
                <span className="text-xs font-bold text-slate-500">
                  {lockedCandidates.filter((c) => monitorQuizFilter === "ALL" || c.quizId === monitorQuizFilter).length} Frozen
                </span>
              </div>

              {loadingLocked && lockedCandidates.length === 0 ? (
                <div className="p-12 text-center text-xs font-bold text-slate-400 bg-white rounded-2xl border border-slate-200">
                  Scanning locked candidate sessions...
                </div>
              ) : lockedCandidates.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3 shadow-2xs">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto">
                    <ShieldCheck size={24} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">No Candidates Currently Locked</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    All candidates taking your assessments are currently within authorized integrity limits. If a student exceeds the tab-switch threshold, their screen freezes and they will immediately appear here for your review.
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-700">
                        <tr>
                          <th className="py-3 px-4 whitespace-nowrap">Candidate</th>
                          <th className="py-3 px-4 whitespace-nowrap">University Roll No</th>
                          <th className="py-3 px-4 whitespace-nowrap">Assessment</th>
                          <th className="py-3 px-4 whitespace-nowrap">Section / Sem</th>
                          <th className="py-3 px-4 whitespace-nowrap text-center">Infractions</th>
                          <th className="py-3 px-4 whitespace-nowrap min-w-[200px]">Lock Reason</th>
                          <th className="py-3 px-4 text-right whitespace-nowrap min-w-[240px]">Instructor Authorization</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {lockedCandidates
                          .filter((c) => {
                            if (monitorQuizFilter !== "ALL" && c.quizId !== monitorQuizFilter) return false;
                            if (!lockedCandidateSearch) return true;
                            const q = lockedCandidateSearch.toLowerCase();
                            return (
                              c.studentName?.toLowerCase().includes(q) ||
                              c.studentRollNo?.toLowerCase().includes(q) ||
                              c.quizTitle?.toLowerCase().includes(q)
                            );
                          })
                          .map((c) => (
                            <tr key={c.id} className="hover:bg-rose-50/30 transition-colors">
                              <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">{c.studentName}</td>
                              <td className="py-3.5 px-4 font-mono font-bold text-slate-600 whitespace-nowrap">{c.studentRollNo}</td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="font-semibold text-slate-800">{c.quizTitle}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{c.courseCode}</div>
                              </td>
                              <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                                Sec {c.section} &bull; Sem {c.semester || "N/A"}
                              </td>
                              <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs whitespace-nowrap">
                                  {c.tabViolations} Infractions
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-slate-600 text-xs" title={c.lockReason}>
                                <div className="max-w-[240px] truncate" title={c.lockReason}>
                                  {c.lockReason || "Focus threshold exceeded"}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    disabled={unlockingCandidateId !== null}
                                    onClick={() => handleAuthorizeCandidate(c.id, c.studentName, "resume")}
                                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5 active:scale-95"
                                    title="Preserve candidate answers and allow test to resume"
                                  >
                                    {unlockingCandidateId === `${c.id}-resume` ? (
                                      <Loader2 size={13} className="animate-spin" />
                                    ) : (
                                      <Unlock size={13} />
                                    )}
                                    <span>Authorize & Resume</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={unlockingCandidateId !== null}
                                    onClick={() => {
                                      if (window.confirm(`Are you sure you want to RESET answers for ${c.studentName} (${c.studentRollNo})?\n\nThis will clear their chosen answers so they can re-attempt questions. Their active countdown timer will NOT be reset.`)) {
                                        handleAuthorizeCandidate(c.id, c.studentName, "reset_answers");
                                      }
                                    }}
                                    className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black transition-all cursor-pointer shadow-2xs inline-flex items-center gap-1.5 active:scale-95"
                                    title="Permanently wipe attempt and let candidate retake fresh"
                                  >
                                    {unlockingCandidateId === `${c.id}-retake` ? (
                                      <Loader2 size={13} className="animate-spin" />
                                    ) : (
                                      <RotateCcw size={13} />
                                    )}
                                    <span>Reset Attempt</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* SUB-TAB 2: LIVE TEST MONITOR VIEW */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={liveSearchQuery}
                    onChange={(e) => setLiveSearchQuery(e.target.value)}
                    placeholder="Search live test-taker by name, roll no, or assessment..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1c1f58] bg-white shadow-2xs"
                  />
                </div>
                <select
                  value={monitorQuizFilter}
                  onChange={(e) => setMonitorQuizFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1c1f58] bg-white shadow-2xs text-slate-700"
                >
                  <option value="ALL">All Assessments</option>
                  {quizzes.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title} ({q.course?.code || 'PLC'})
                    </option>
                  ))}
                </select>
                <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                  <span>{liveCandidates.filter((c) => monitorQuizFilter === "ALL" || c.quizId === monitorQuizFilter).length} Active {liveCandidates.length === 1 ? "Candidate" : "Candidates"}</span>
                </span>
              </div>

              {loadingLive && liveCandidates.length === 0 ? (
                <div className="p-12 text-center text-xs font-bold text-slate-400 bg-white rounded-2xl border border-slate-200">
                  Scanning live test-takers...
                </div>
              ) : liveCandidates.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3 shadow-2xs">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-[#1c1f58] flex items-center justify-center mx-auto">
                    <Activity size={24} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">No Active Test-Takers At This Moment</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    No students are currently taking your active assessments. Once a student starts an exam, their live tab switch counts, section, and session status will update here automatically.
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-700">
                        <tr>
                          <th className="py-3 px-4">Candidate</th>
                          <th className="py-3 px-4">University Roll No</th>
                          <th className="py-3 px-4">Assessment</th>
                          <th className="py-3 px-4">Section / Sem</th>
                          <th className="py-3 px-4 text-center">Tab Switches (Live)</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Invigilator Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {liveCandidates
                          .filter((c) => {
                            if (monitorQuizFilter !== "ALL" && c.quizId !== monitorQuizFilter) return false;
                            if (!liveSearchQuery) return true;
                            const q = liveSearchQuery.toLowerCase();
                            return (
                              c.studentName?.toLowerCase().includes(q) ||
                              c.studentRollNo?.toLowerCase().includes(q) ||
                              c.quizTitle?.toLowerCase().includes(q) ||
                              c.section?.toLowerCase().includes(q)
                            );
                          })
                          .map((c) => (
                            <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3.5 px-4 font-bold text-slate-900">{c.studentName}</td>
                              <td className="py-3.5 px-4 font-mono font-bold text-slate-700">{c.studentRollNo}</td>
                              <td className="py-3.5 px-4">
                                <div className="font-semibold text-slate-800">{c.quizTitle}</div>
                                <div className="text-[10px] text-indigo-600 font-mono font-bold">{c.courseCode}</div>
                              </td>
                              <td className="py-3.5 px-4 text-slate-600">
                                Sec {c.section} &bull; Sem {c.semester || "N/A"}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                {c.tabViolations === 0 ? (
                                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 inline-flex items-center gap-1">
                                    <Check size={11} className="text-emerald-600" /> 0 Switches (Clean)
                                  </span>
                                ) : c.tabViolations <= 2 ? (
                                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                                    <AlertTriangle size={11} className="text-amber-600" /> {c.tabViolations} Switches (Warning)
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200 inline-flex items-center gap-1">
                                    <AlertTriangle size={11} className="text-rose-600" /> {c.tabViolations} Switches (High Risk)
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  <span>Writing Test</span>
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    disabled={unlockingCandidateId !== null}
                                    onClick={() => handleManualFreezeCandidate(c.id, c.studentName)}
                                    className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs active:scale-95"
                                    title="Manually freeze student test immediately"
                                  >
                                    {unlockingCandidateId === `${c.id}-freeze` ? (
                                      <Loader2 size={12} className="animate-spin" />
                                    ) : (
                                      <Lock size={12} />
                                    )}
                                    <span>Freeze</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={unlockingCandidateId !== null}
                                    onClick={() => {
                                      if (window.confirm(`Are you sure you want to RESET answers for ${c.studentName} (${c.studentRollNo})?\n\nThis will clear their chosen answers so they can re-attempt questions. Their active countdown timer will NOT be reset.`)) {
                                        handleAuthorizeCandidate(c.id, c.studentName, "reset_answers");
                                      }
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs active:scale-95"
                                    title="Reset attempt for fresh retake"
                                  >
                                    {unlockingCandidateId === `${c.id}-retake` ? (
                                      <Loader2 size={12} className="animate-spin" />
                                    ) : (
                                      <RotateCcw size={12} />
                                    )}
                                    <span>Reset</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : activeTab === 'courses' ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900">Semester-Wise Subjects</h2>
              <p className="text-xs text-slate-500 font-medium">Subjects registered for Semesters 1 to 8</p>
            </div>
            <button
              type="button"
              onClick={() => onTabChange && onTabChange('create-quiz')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1c1f58] hover:bg-[#252975] text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Plus size={14} />
              <span>Create Assessment</span>
            </button>
          </div>

          {/* Semester Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <button
              type="button"
              onClick={() => setCourseSemesterFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                courseSemesterFilter === 'ALL'
                  ? 'bg-[#1c1f58] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Semesters ({courses.length})
            </button>
            {activeSemesters.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setCourseSemesterFilter(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  Number(courseSemesterFilter) === s
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Sem {s} ({courses.filter((c) => Number(c.semester) === s).length})
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses
              .filter((c) => courseSemesterFilter === 'ALL' || Number(c.semester) === Number(courseSemesterFilter))
              .map((c) => (
                <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                      {c.code}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">Semester {c.semester || '5'}</span>
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-900">{c.title}</h3>
                  <p className="text-xs text-slate-500 font-medium">{c.department || 'Computer Science & Engineering'}</p>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600">
                    <span>Linked Quizzes</span>
                    <span className="text-blue-600">{quizzes.filter((q) => q.courseId === c.id).length} assessments</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : activeTab === 'gradebook' ? (
        <div className="space-y-4">
          <h2 className="text-base font-black text-slate-900">Quiz Results</h2>
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-2xs">
            {quizzes.map((q) => (
              <div key={q.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-700">{q.course?.code}</span>
                    <h3 className="text-sm font-bold text-slate-900">{q.title}</h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Target: Sem {q.semester || 5} &bull; Total Marks: {q.totalMarks} &bull; Passing: {q.passingMarks} &bull; Questions: {q.questionCount}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    q.showResultsAfterSubmit
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {q.showResultsAfterSubmit ? '● Marks Released' : 'Marks Confidential'}
                  </span>
                  <span className="text-xs font-bold text-slate-600">
                    {q.submissionCount || 0} Submissions
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate(`/quiz/${q.id}/results`)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <BarChart3 size={14} />
                    <span>View Gradebook</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'question-vault' ? (
        <QuestionVaultView isSuperAdmin={false} user={user} />
      ) : (
        /* Default Quizzes Grid View */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-black text-slate-900">Author Assessments</h2>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search assessment or code..."
                  className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1c1f58] bg-white w-56 sm:w-64"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs font-bold text-slate-400 bg-white rounded-2xl border border-slate-200">
              Loading assessment quizzes...
            </div>
          ) : filteredQuizzes.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
              <CheckSquare size={36} className="text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700">No Assessments Created Yet</h3>
              <p className="text-xs text-slate-500">
                Author your first section-targeted assessment to conduct evaluations.
              </p>
              <button
                type="button"
                onClick={() => onTabChange && onTabChange('create-quiz')}
                className="inline-flex items-center px-4 py-2 rounded-xl bg-[#1c1f58] text-white text-xs font-bold hover:bg-[#252975] cursor-pointer"
              >
                <span>Create Assessment</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredQuizzes.map((q) => {
                const targetSecLabel = Array.isArray(q.targetSections) && !q.targetSections.includes('ALL')
                  ? q.targetSections.join(', ')
                  : 'All Sections';

                return (
                  <div
                    key={q.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
                  >
                    <div className="space-y-3">
                      {/* Course badge, Live toggle, and Duration */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {q.course?.code || 'CSE'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleLive(q.id)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black transition-all cursor-pointer ${
                              q.isLive !== false
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                            }`}
                            title="Click to toggle live accepting status"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${q.isLive !== false ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                            <span>{q.isLive !== false ? 'LIVE' : 'CLOSED'}</span>
                          </button>
                        </div>

                        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                          <Clock size={13} />
                          {q.durationMinutes} mins
                        </span>
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900 group-hover:text-[#1c1f58] transition-colors line-clamp-1">
                          {q.title}
                        </h3>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                          {q.description || 'Standard university multiple-choice question test.'}
                        </p>
                      </div>

                      {/* Target Audience & Access Code Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          Sem {q.semester || q.course?.semester || 5}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {targetSecLabel}
                        </span>

                        {q.startTime && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            <Calendar size={10} />
                            <span>{new Date(q.startTime).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                          </span>
                        )}

                        {q.timingMode === 'STRICT' && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200" title="Synchronized exam: closes strictly at end time for all students">
                            Strict Window
                          </span>
                        )}

                        {q.isPasswordProtected && q.accessCode && (
                          <button
                            type="button"
                            onClick={() => handleCopyCode(q.id, q.accessCode)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-black bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                            title="Click to copy password"
                          >
                            <Key size={11} />
                            <span>{q.accessCode}</span>
                            {copiedId === q.id ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                          </button>
                        )}
                      </div>

                      {/* Marks & Question breakdown */}
                      <div className="flex items-center gap-3 pt-2 text-[11px] font-semibold text-slate-500 border-t border-slate-100">
                        <div>
                          <span className="text-slate-400">Questions: </span>
                          <span className="font-bold text-slate-800">{q.questionCount}</span>
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

                    {/* Bottom action buttons */}
                    <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => navigate(`/quiz/${q.id}/results`)}
                        className="flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 transition-colors cursor-pointer"
                      >
                        <BarChart3 size={15} />
                        <span>Gradebook ({q.submissionCount})</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingQuizId(q.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                          title="Edit Assessment"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/quiz/${q.id}/take`)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          title="Preview Assessment"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuiz(q.id, q.title)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete Assessment"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FacultyDashboard;
