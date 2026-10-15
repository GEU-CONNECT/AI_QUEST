import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Unlock,
  RotateCcw,
  RefreshCw,
  LogOut,
  Search,
  CheckCircle2,
  Lock,
  Clock,
  Sparkles,
  Trophy,
  UserPlus,
  Maximize2,
  Monitor,
  AlertTriangle,
  GraduationCap
} from 'lucide-react';
import api from '../api/client';
import { sound } from '../utils/audio';
import { GraphicEraLogo, AIQuestLogo } from '../components/BrandingAssets';

export default function SubAdminDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState('monitor'); // 'monitor' | 'leaderboard' | 'register'

  // Leaderboard State
  const [leaderboard, setLeaderboard] = useState([]);
  const [isProjectorMode, setIsProjectorMode] = useState(false);

  // Walk-in Registration Form State
  const [walkinForm, setWalkinForm] = useState({
    candidateName: '',
    mobileNo: '',
    emailId: '',
    studentClass: 'Class 12th',
    stream: 'Science (PCM)',
    schoolName: '',
    parentName: '',
    parentContact: '',
    city: 'Dehradun'
  });
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState('');
  const [registerError, setRegisterError] = useState('');

  useEffect(() => {
    fetchProfile();
    fetchCandidates();
  }, []);

  // Auto-refresh candidates every 5 seconds for live monitor & leaderboard
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === 'monitor') {
        fetchCandidates(false);
      } else if (activeTab === 'leaderboard') {
        fetchLeaderboard(false);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [activeTab]);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data?.success) {
        setUser(res.data.user);
        localStorage.setItem('quizx_user', JSON.stringify(res.data.user));
      }
    } catch (_) {}
  };

  const fetchCandidates = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const res = await api.get('/proctoring/candidates');
      if (res.data?.success) {
        setCandidates(res.data.candidates || []);
      }
    } catch (err) {
      console.error('Failed to load lab candidates', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchLeaderboard = async (showLoading = true) => {
    try {
      const res = await api.get('/admin/leaderboard');
      if (res.data?.success) {
        setLeaderboard(res.data.leaderboard || []);
      }
    } catch (err) {
      console.error('Failed to load lab leaderboard', err);
    }
  };

  const handleUnlock = async (submissionId, studentName) => {
    if (!window.confirm(`Unlock assessment session for candidate ${studentName}? This will reset their violation counter and allow them to resume immediately.`)) return;
    sound.playPop();

    try {
      const res = await api.post(`/proctoring/submissions/${submissionId}/unlock`);
      if (res.data?.success) {
        sound.playSuccess();
        alert(`Candidate ${studentName} has been UNLOCKED successfully!`);
        fetchCandidates(false);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to unlock candidate.');
    }
  };

  const handleResetAnswers = async (submissionId, studentName) => {
    if (!window.confirm(`CAUTION: Reset answers for ${studentName}? Their active examination timer will be PRESERVED, but their answers will be cleared. Proceed only if authorized.`)) return;
    sound.playPop();

    try {
      const res = await api.post(`/proctoring/submissions/${submissionId}/reset`);
      if (res.data?.success) {
        alert(`Answers cleared for ${studentName}.`);
        fetchCandidates(false);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reset answers.');
    }
  };

  const handleWalkinSubmit = async (e) => {
    e.preventDefault();
    sound.playPop();
    setIsRegistering(true);
    setRegisterSuccess('');
    setRegisterError('');

    try {
      const res = await api.post('/auth/register', {
        ...walkinForm,
        labNumber: storedUser.labNumber || 'LAB-01'
      });

      if (res.data?.success) {
        sound.playSuccess();
        setRegisterSuccess(`Student registered successfully! Registration ID: ${res.data.regId}`);
        setWalkinForm({
          candidateName: '',
          mobileNo: '',
          emailId: '',
          studentClass: 'Class 12th',
          stream: 'Science (PCM)',
          schoolName: '',
          parentName: '',
          parentContact: '',
          city: 'Dehradun'
        });
        fetchCandidates(false);
      }
    } catch (err) {
      setRegisterError(err.response?.data?.message || 'Registration failed.');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('quizx_token');
    localStorage.removeItem('quizx_user');
    navigate('/login');
  };

  const storedUser = user || JSON.parse(localStorage.getItem('quizx_user') || '{}');

  // Filter candidates
  const filteredCandidates = candidates.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.mobileNo.includes(search) ||
      c.registrationId.toLowerCase().includes(search.toLowerCase()) ||
      (c.schoolName && c.schoolName.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'LOCKED' && c.status === 'LOCKED') ||
      (statusFilter === 'IN_PROGRESS' && c.status === 'IN_PROGRESS') ||
      (statusFilter === 'SUBMITTED' && (c.status === 'SUBMITTED' || c.status === 'EVALUATED'));

    return matchesSearch && matchesStatus;
  });

  const lockedCount = candidates.filter((c) => c.status === 'LOCKED').length;
  const inProgressCount = candidates.filter((c) => c.status === 'IN_PROGRESS').length;
  const submittedCount = candidates.filter((c) => c.status === 'SUBMITTED' || c.status === 'EVALUATED').length;

  return (
    <div className={`min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans ${isProjectorMode ? 'p-6' : ''}`}>
      {/* Top Header */}
      {!isProjectorMode && (
        <header className="border-b border-slate-800 bg-[#0c1222] px-4 sm:px-8 py-3 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <GraphicEraLogo className="scale-75 origin-left" />
            <div className="h-6 w-px bg-slate-700/60 hidden sm:block"></div>
            <div className="hidden sm:block">
              <span className="text-xs font-black text-amber-400 font-mono tracking-wider">
                {storedUser.labNumber || 'LAB-01'} INVIGILATION PORTAL
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-slate-200">{storedUser.name}</div>
              <div className="text-[11px] font-mono text-cyan-400">Sub-Admin • {storedUser.labNumber}</div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700/50"
              title="Sign Out"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Lab KPI Strip */}
        {!isProjectorMode && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase">Assigned Lab</div>
                <div className="text-2xl font-black text-amber-400 font-mono">{storedUser.labNumber || 'LAB-01'}</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center text-amber-400">
                <Monitor size={20} />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase">Testing Live</div>
                <div className="text-2xl font-black text-cyan-400 font-mono">{inProgressCount}</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-cyan-400/10 flex items-center justify-center text-cyan-400">
                <Clock size={20} />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase">Locked Out</div>
                <div className="text-2xl font-black text-rose-400 font-mono">{lockedCount}</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-400/10 flex items-center justify-center text-rose-400">
                <Lock size={20} />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase">Submitted</div>
                <div className="text-2xl font-black text-emerald-400 font-mono">{submittedCount}</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-400/10 flex items-center justify-center text-emerald-400">
                <CheckCircle2 size={20} />
              </div>
            </div>
          </div>
        )}

        {/* Tab Switcher Toolbar */}
        {!isProjectorMode && (
          <div className="flex flex-wrap items-center justify-between gap-4 p-2 rounded-2xl bg-[#0c1222] border border-slate-800">
            <div className="flex items-center gap-2">
              <button
                onClick={() => { sound.playPop(); setActiveTab('monitor'); }}
                className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'monitor'
                    ? 'bg-amber-400 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users size={14} />
                <span>Live Lab Candidates ({candidates.length})</span>
              </button>

              <button
                onClick={() => { sound.playPop(); setActiveTab('leaderboard'); fetchLeaderboard(); }}
                className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'leaderboard'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Trophy size={14} />
                <span>Lab Leaderboard Screen</span>
              </button>

              <button
                onClick={() => { sound.playPop(); setActiveTab('register'); }}
                className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'register'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserPlus size={14} />
                <span>Walk-in Registration</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchCandidates(true)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Refresh Candidates"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>

              {activeTab === 'leaderboard' && (
                <button
                  onClick={() => setIsProjectorMode(true)}
                  className="py-1.5 px-3 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer hover:bg-amber-300"
                >
                  <Maximize2 size={13} />
                  <span>Projector Fullscreen</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* TAB 1: Live Lab Candidates Monitor */}
        {activeTab === 'monitor' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search candidate name, mobile, registration ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full py-2.5 pl-9 pr-4 rounded-xl bg-[#0f172a] border border-slate-800 text-xs text-white placeholder-slate-500 focus:border-amber-400 outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                {['ALL', 'LOCKED', 'IN_PROGRESS', 'SUBMITTED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      statusFilter === st
                        ? 'bg-slate-800 text-amber-400 border border-amber-400/40'
                        : 'text-slate-400 hover:text-white bg-slate-900/60'
                    }`}
                  >
                    {st === 'ALL' ? 'All' : st === 'LOCKED' ? `Locked (${lockedCount})` : st}
                  </button>
                ))}
              </div>
            </div>

            {/* Candidates Table */}
            <div className="rounded-3xl bg-[#0f172a] border border-slate-800 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#0c1222]/80 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3.5 px-4">Candidate Details</th>
                      <th className="py-3.5 px-4">School & Class</th>
                      <th className="py-3.5 px-4">Attempt Status</th>
                      <th className="py-3.5 px-4">Violations</th>
                      <th className="py-3.5 px-4">Score</th>
                      <th className="py-3.5 px-4 text-right">Invigilator Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredCandidates.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500">
                          No candidates found matching the selected filter in {storedUser.labNumber || 'this lab'}.
                        </td>
                      </tr>
                    ) : (
                      filteredCandidates.map((c) => (
                        <tr
                          key={c.submissionId}
                          className={`hover:bg-slate-800/30 transition-colors ${
                            c.status === 'LOCKED' ? 'bg-rose-500/5' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white text-sm">{c.name}</div>
                            <div className="text-[11px] font-mono text-amber-400">
                              {c.registrationId} • +91 {c.mobileNo}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="text-slate-300 font-medium truncate max-w-xs">{c.schoolName || 'Graphic Era'}</div>
                            <div className="text-slate-500 text-[11px]">{c.studentClass} • {c.stream}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            {c.status === 'LOCKED' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold text-[11px] animate-pulse">
                                <Lock size={12} />
                                <span>LOCKED OUT</span>
                              </span>
                            ) : c.status === 'IN_PROGRESS' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-bold text-[11px]">
                                <Clock size={12} />
                                <span>Testing Live</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[11px]">
                                <CheckCircle2 size={12} />
                                <span>Submitted</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 font-mono font-bold">
                            <span className={c.tabViolations >= 3 ? 'text-rose-400' : c.tabViolations > 0 ? 'text-amber-400' : 'text-slate-400'}>
                              {c.tabViolations} / 3
                            </span>
                          </td>

                          <td className="py-3.5 px-4 font-mono font-black text-sm text-slate-200">
                            {c.status === 'SUBMITTED' || c.status === 'EVALUATED' ? (
                              <span className="text-amber-400">{c.score} <span className="text-xs text-slate-500">/ {c.totalMarks}</span></span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {c.status === 'LOCKED' && (
                                <button
                                  onClick={() => handleUnlock(c.submissionId, c.name)}
                                  className="py-1.5 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
                                  title="Clear violations and unlock student attempt"
                                >
                                  <Unlock size={13} />
                                  <span>Authorize & Unlock</span>
                                </button>
                              )}

                              {c.status === 'IN_PROGRESS' && (
                                <button
                                  onClick={() => handleResetAnswers(c.submissionId, c.name)}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                                  title="Reset answers (Emergency)"
                                >
                                  <RotateCcw size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Lab Leaderboard Screen (Projector Mode) */}
        {activeTab === 'leaderboard' && (
          <div className={`space-y-4 ${isProjectorMode ? 'max-w-5xl mx-auto' : ''}`}>
            {isProjectorMode && (
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <GraphicEraLogo className="scale-75 origin-left" />
                  <div className="h-6 w-px bg-slate-700"></div>
                  <span className="text-sm font-black text-amber-400 tracking-wider">
                    {storedUser.labNumber || 'LAB-01'} LIVE SCOREBOARD
                  </span>
                </div>
                <button
                  onClick={() => setIsProjectorMode(false)}
                  className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
                >
                  Exit Projector Mode
                </button>
              </div>
            )}

            <div className="rounded-3xl bg-[#0f172a] border border-amber-500/20 shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-white flex items-center gap-2">
                    <Trophy size={22} className="text-amber-400" />
                    <span>{storedUser.labNumber || 'LAB-01'} Top Quester Ranklist</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Live candidate standings in this lab (Auto-refreshes every 5s).
                  </p>
                </div>
                <div className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/30">
                  LIVE STREAM
                </div>
              </div>

              <div className="divide-y divide-slate-800/80">
                {leaderboard.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-sm">
                    No evaluated submissions yet. Scores will appear as candidates complete their assessments.
                  </div>
                ) : (
                  leaderboard.map((item, idx) => (
                    <div
                      key={item.id}
                      className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-800/20 px-3 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs font-mono ${
                          idx === 0
                            ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20'
                            : idx === 1
                            ? 'bg-slate-300 text-slate-950'
                            : idx === 2
                            ? 'bg-amber-700 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {idx + 1}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">{item.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {item.registrationId} • {item.schoolName}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xl font-black text-amber-400 font-mono">
                          {item.score} <span className="text-xs text-slate-500">/ {item.totalMarks}</span>
                        </div>
                        <div className="text-[11px] font-semibold text-emerald-400">
                          {item.percentage}% Score
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Walk-in Registration */}
        {activeTab === 'register' && (
          <div className="max-w-2xl mx-auto rounded-3xl bg-[#0f172a] border border-slate-800 p-8 shadow-2xl space-y-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold mb-2">
                <UserPlus size={13} />
                <span>WALK-IN CANDIDATE ADMISSION</span>
              </div>
              <h3 className="text-xl font-black text-white">Register Walk-in Candidate</h3>
              <p className="text-xs text-slate-400">
                Instantly create a student account and admit pass assigned to <strong>{storedUser.labNumber || 'LAB-01'}</strong>.
              </p>
            </div>

            {registerSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2.5 font-semibold">
                <CheckCircle2 size={16} />
                <span>{registerSuccess}</span>
              </div>
            )}

            {registerError && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2.5 font-semibold">
                <AlertTriangle size={16} />
                <span>{registerError}</span>
              </div>
            )}

            <form onSubmit={handleWalkinSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Candidate Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={walkinForm.candidateName}
                    onChange={(e) => setWalkinForm({ ...walkinForm, candidateName: e.target.value })}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    10-digit Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="e.g. 9812345678"
                    value={walkinForm.mobileNo}
                    onChange={(e) => setWalkinForm({ ...walkinForm, mobileNo: e.target.value.replace(/\D/g, '') })}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. rahul@gmail.com"
                    value={walkinForm.emailId}
                    onChange={(e) => setWalkinForm({ ...walkinForm, emailId: e.target.value })}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    School Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Doon International School"
                    value={walkinForm.schoolName}
                    onChange={(e) => setWalkinForm({ ...walkinForm, schoolName: e.target.value })}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Class
                  </label>
                  <select
                    value={walkinForm.studentClass}
                    onChange={(e) => setWalkinForm({ ...walkinForm, studentClass: e.target.value })}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none focus:border-amber-400"
                  >
                    <option>Class 9th</option>
                    <option>Class 10th</option>
                    <option>Class 11th</option>
                    <option>Class 12th</option>
                    <option>Dropper / Competitive Prep</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Stream
                  </label>
                  <select
                    value={walkinForm.stream}
                    onChange={(e) => setWalkinForm({ ...walkinForm, stream: e.target.value })}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none focus:border-amber-400"
                  >
                    <option>Science (PCM)</option>
                    <option>Science (PCB)</option>
                    <option>Commerce</option>
                    <option>Humanities</option>
                    <option>Computer Science & AI Tech</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isRegistering}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg disabled:opacity-50"
              >
                {isRegistering ? 'Registering Candidate...' : `Complete Walk-in Registration for ${storedUser.labNumber || 'LAB-01'}`}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
