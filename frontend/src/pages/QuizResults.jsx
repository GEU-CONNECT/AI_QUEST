import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Award,
  Users,
  CheckCircle2,
  XCircle,
  Download,
  BarChart3,
  Search,
  BookOpen,
  RotateCcw,
  Loader2,
  Eye,
  EyeOff,
  Check,
  X,
  FileText,
  Clock,
  Send,
  Image as ImageIcon
} from "lucide-react";
import api from "../api/client";
import { getSafeImageUrl } from "../utils/imageUrl";

const QuizResults = ({ user }) => {
  const { id: quizId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [resettingId, setResettingId] = useState(null);

  // Toggle Release Marks State
  const [isTogglingRelease, setIsTogglingRelease] = useState(false);

  // Candidate Drilldown Modal State
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [zoomedImage, setZoomedImage] = useState(null);

  // Close candidate modal on ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && selectedCandidate) {
        setSelectedCandidate(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedCandidate]);

  useEffect(() => {
    fetchResults();
  }, [quizId]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/quizzes/${quizId}/results`);
      if (res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error("Failed to load gradebook", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleReleaseMarks = async () => {
    if (!data?.quiz) return;
    const currentStatus = Boolean(data.quiz.showResultsAfterSubmit);
    const confirmMsg = currentStatus
      ? "Are you sure you want to HIDE marks from students?\n\nStudents will no longer be able to see their scores, percentages, or evaluations."
      : "Are you sure you want to RELEASE marks to students?\n\nStudents will immediately be able to see their verified scores, percentages, and scorecards in their Results tab.";

    if (!window.confirm(confirmMsg)) return;

    try {
      setIsTogglingRelease(true);
      const res = await api.patch(`/quizzes/${quizId}/toggle-results`);
      if (res.data?.success) {
        setData((prev) => ({
          ...prev,
          quiz: {
            ...prev.quiz,
            showResultsAfterSubmit: res.data.showResultsAfterSubmit
          }
        }));
        alert(res.data.message || (res.data.showResultsAfterSubmit ? "Marks released to students!" : "Marks hidden from students."));
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update marks release status.");
    } finally {
      setIsTogglingRelease(false);
    }
  };

  const handleExportCSV = () => {
    if (!data || !data.leaderboard.length) return;
    const headers = [
      "Rank",
      "Roll Number",
      "Student Name",
      "Score",
      "Total Marks",
      "Percentage",
      "Status",
      "Attempted Questions",
      "Correct",
      "Incorrect",
      "Submitted At"
    ];
    const rows = data.leaderboard.map((item) => [
      item.rank,
      item.studentRollNo,
      `"${item.studentName}"`,
      item.score,
      item.totalMarks,
      `${item.percentage}%`,
      item.isPassed ? "PASSED" : "FAILED",
      item.attemptedCount ?? "N/A",
      item.correctCount ?? "N/A",
      item.incorrectCount ?? "N/A",
      item.submittedAt ? new Date(item.submittedAt).toLocaleString() : ""
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Gradebook_${data.quiz.courseCode}_${data.quiz.title.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs font-bold text-slate-400 bg-white rounded-2xl border border-slate-200">
        Loading gradebook results...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
        <p className="text-sm font-bold text-slate-700">Quiz results could not be loaded.</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 rounded-xl bg-purple-50 text-purple-700 text-xs font-bold hover:bg-purple-100 transition-colors cursor-pointer"
        >
          Return to Quizzes
        </button>
      </div>
    );
  }

  const isMarksReleased = Boolean(data.quiz.showResultsAfterSubmit);

  const filteredStudents = data.leaderboard.filter(
    (s) =>
      s.studentRollNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.studentName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-sans">
      {/* 1. Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
            title="Go Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
                {data.quiz.courseCode}
              </span>
              <h1 className="text-lg font-black text-slate-900">{data.quiz.title}</h1>
            </div>
            <p className="text-xs text-slate-500">
              {data.quiz.courseTitle} &bull; Created by{" "}
              <span className="font-bold text-[#1c1f58]">{data.quiz.creatorName || "Faculty"}</span>{" "}
              {data.quiz.creatorUniversityId ? `(${data.quiz.creatorUniversityId})` : ""}
            </p>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Release / Hide Marks Button */}
          {isMarksReleased ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Marks Released to Students</span>
              </span>
              <button
                type="button"
                onClick={handleToggleReleaseMarks}
                disabled={isTogglingRelease}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                title="Hide marks from student view"
              >
                {isTogglingRelease ? <Loader2 size={13} className="animate-spin" /> : <EyeOff size={13} />}
                <span>Hide Marks</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleToggleReleaseMarks}
              disabled={isTogglingRelease}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all cursor-pointer shadow-xs active:scale-95"
              title="Publish scores and evaluations to students"
            >
              {isTogglingRelease ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              <span>Show Marks to Students</span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Key Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Attempts</div>
          <div className="text-2xl font-black text-[#1c1f58]">{data.stats.totalSubmissions}</div>
          <div className="text-[11px] text-slate-500">Evaluated candidates</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Average Score</div>
          <div className="text-2xl font-black text-[#1c1f58]">
            {data.stats.averageScore}{" "}
            <span className="text-xs text-slate-400 font-semibold">/ {data.quiz.totalMarks}</span>
          </div>
          <div className="text-[11px] text-slate-500">Class mean score</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Passing Bar</div>
          <div className="text-2xl font-black text-slate-800">{data.quiz.passingMarks} Marks</div>
          <div className="text-[11px] text-slate-500">Minimum passing threshold</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pass Percentage</div>
          <div className="text-2xl font-black text-emerald-600">{data.stats.passPercentage}%</div>
          <div className="text-[11px] text-slate-500">{data.stats.passedCount} candidates passed</div>
        </div>
      </div>

      {/* 3. Table Section */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">Student Examination Leaderboard</h2>
            <p className="text-[11px] text-slate-400 font-medium">
              Click on any student row to view their complete response sheet & question-by-question breakdown.
            </p>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Roll No or Name..."
              className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1c1f58] bg-slate-50/50"
            />
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="py-12 text-center text-xs font-bold text-slate-400">
            No submissions recorded yet for this quiz.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Roll Number</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4 text-center">Score</th>
                  <th className="py-3 px-4 text-center">Percentage</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Attempts</th>
                  <th className="py-3 px-4 text-center">Submitted At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((sub) => (
                  <tr
                    key={sub.id}
                    onClick={() => setSelectedCandidate(sub)}
                    className="hover:bg-indigo-50/50 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4 font-black text-slate-700">#{sub.rank}</td>
                    <td className="py-3 px-4 font-bold text-[#1c1f58] group-hover:underline">
                      {sub.studentRollNo}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      <div>{sub.studentName}</div>
                      {sub.studentSection && (
                        <div className="text-[10px] text-slate-400 font-medium">Sec: {sub.studentSection}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-black text-[#1c1f58]">
                      {sub.score} / {sub.totalMarks}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700">{sub.percentage}%</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${sub.isPassed
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                      >
                        {sub.isPassed ? "Passed" : "Failed"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-600 text-[11px] font-medium">
                      <span className="font-bold text-emerald-700">{sub.correctCount ?? "-"}</span> /{" "}
                      <span className="font-bold text-rose-700">{sub.incorrectCount ?? "-"}</span>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-400 text-[11px]">
                      {sub.submittedAt ? new Date(sub.submittedAt).toLocaleTimeString() : "N/A"}
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedCandidate(sub)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                          title="View question-by-question response sheet"
                        >
                          <Eye size={12} />
                          <span>View Sheet</span>
                        </button>

                        <button
                          type="button"
                          disabled={resettingId === sub.id}
                          onClick={async () => {
                            if (
                              window.confirm(
                                `Are you sure you want to RESET the assessment attempt for ${sub.studentName} (${sub.studentRollNo})?\n\nThis will permanently delete this submission and allow the student to retake the assessment.`
                              )
                            ) {
                              try {
                                setResettingId(sub.id);
                                const res = await api.post(`/quizzes/submissions/${sub.id}/unlock`, {
                                  actionType: "retake"
                                });
                                if (res.data?.success) {
                                  alert(`Attempt reset successfully for ${sub.studentName}. Student can now retake.`);
                                  fetchResults();
                                }
                              } catch (err) {
                                alert(err.response?.data?.message || "Failed to reset attempt");
                              } finally {
                                setResettingId(null);
                              }
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs active:scale-95"
                          title="Reset attempt for fresh retake"
                        >
                          {resettingId === sub.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                          <span>Reset</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Candidate Question-by-Question Response Sheet Modal */}
      {selectedCandidate &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center cursor-pointer"
            onClick={() => setSelectedCandidate(null)}
          >
            <div
              className="bg-white rounded-3xl border border-slate-200 max-w-3xl w-full my-auto p-6 sm:p-8 shadow-2xl space-y-6 animate-scale-up cursor-default max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Top Bar */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">

                  <div>
                    <h3 className="text-lg font-black text-[#1c1f58]">Candidate Response Sheet</h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {selectedCandidate.studentName} &bull; Roll: {selectedCandidate.studentRollNo}{" "}
                      {selectedCandidate.studentSection ? `(${selectedCandidate.studentSection})` : ""}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCandidate(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Candidate Performance Summary Banner — AUTHENTIC GEU ROYAL NAVY (#1c1f58) */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[#1c1f58] border border-[#2a2e76] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
                <div className="space-y-1">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#fbc02d]">Total Marks Secured</div>
                  <div className="text-3xl font-black tracking-tight flex items-center gap-2">
                    <span>{selectedCandidate.score}</span>
                    <span className="text-base font-semibold text-indigo-200">/ {selectedCandidate.totalMarks} Marks</span>
                  </div>
                  <div className="text-xs text-indigo-100 font-medium">
                    Percentage: <span className="font-bold text-white">{selectedCandidate.percentage}%</span>
                  </div>
                </div>

                <div className="sm:text-right space-y-1.5">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${selectedCandidate.isPassed
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/40"
                        : "bg-rose-500/20 text-rose-300 border border-rose-400/40"
                      }`}
                  >
                    {selectedCandidate.isPassed ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    <span>{selectedCandidate.isPassed ? "PASSED" : "FAILED"}</span>
                  </span>
                  <div className="text-[11px] text-indigo-200 font-medium">
                    Threshold: {data.quiz.passingMarks} Marks
                  </div>
                </div>
              </div>

              {/* Breakdown Metric Tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Attempted</div>
                  <div className="text-lg font-black text-slate-900">
                    {selectedCandidate.attemptedCount ?? "-"} / {selectedCandidate.totalQuestions ?? "-"}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100 text-center">
                  <div className="text-[10px] font-bold text-emerald-700 uppercase">Correct</div>
                  <div className="text-lg font-black text-emerald-700">{selectedCandidate.correctCount ?? "-"}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-100 text-center">
                  <div className="text-[10px] font-bold text-rose-700 uppercase">Incorrect</div>
                  <div className="text-lg font-black text-rose-700">{selectedCandidate.incorrectCount ?? "-"}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-100 text-center">
                  <div className="text-[10px] font-bold text-amber-700 uppercase">Unattempted</div>
                  <div className="text-lg font-black text-amber-700">{selectedCandidate.unattemptedCount ?? "-"}</div>
                </div>
              </div>

              {/* Question-by-Question Response Breakdown List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    Full Question Breakdown & Candidate Choices
                  </h4>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {selectedCandidate.detailedAnalysis?.length || 0} Questions Evaluated
                  </span>
                </div>

                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                  {Array.isArray(selectedCandidate.detailedAnalysis) &&
                    selectedCandidate.detailedAnalysis.length > 0 ? (
                    selectedCandidate.detailedAnalysis.map((item, idx) => {
                      const options = Array.isArray(item.options) ? item.options : [];
                      return (
                        <div
                          key={item.questionId || idx}
                          className={`p-4 sm:p-5 rounded-2xl border text-xs space-y-3 ${item.isCorrect
                              ? "bg-emerald-50/30 border-emerald-200"
                              : item.isAttempted
                                ? "bg-rose-50/30 border-rose-200"
                                : "bg-slate-50 border-slate-200"
                            }`}
                        >
                          {/* Question Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 flex-1">
                              {item.passage && (
                                <div className="mb-2 p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-slate-800">
                                  <div className="flex items-center gap-1.5 font-extrabold text-[#1c1f58] mb-1">
                                    <BookOpen size={13} className="text-indigo-600 shrink-0" />
                                    <span>Passage: {item.passage.title || 'Reading Comprehension'}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-600 max-h-24 overflow-y-auto whitespace-pre-wrap leading-relaxed font-sans">
                                    {item.passage.content}
                                  </div>
                                  {item.passage.imageUrl && (
                                    <div className="mt-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setZoomedImage(item.passage.imageUrl)}
                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-white border border-indigo-200 px-2 py-0.5 rounded shadow-2xs hover:bg-indigo-50 cursor-pointer"
                                      >
                                        <Maximize2 size={10} /> View Passage Diagram
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                              <span className="font-extrabold text-slate-900 text-sm block">
                                Q{idx + 1}. {item.questionText}
                              </span>
                              {item.codeSnippet && (
                                <pre className="p-3 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto mt-1">
                                  <code>{item.codeSnippet}</code>
                                </pre>
                              )}
                              {item.imageUrl && (
                                <div className="mt-2 inline-block">
                                  <div
                                    onClick={() => setZoomedImage(item.imageUrl)}
                                    className="relative inline-block bg-white border border-slate-200 rounded-xl p-1.5 shadow-2xs cursor-pointer group/img"
                                    title="Click to enlarge"
                                  >
                                    <img
                                      src={getSafeImageUrl(item.imageUrl)}
                                      alt="Reference diagram"
                                      className="max-h-48 max-w-sm w-auto object-contain rounded-lg"
                                      loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover/img:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                      <span className="bg-white/90 text-slate-800 text-[10px] font-bold px-2 py-1 rounded shadow-xs flex items-center gap-1">
                                        <Maximize2 size={11} /> Zoom
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                            <span
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black shrink-0 ${item.isCorrect
                                  ? "bg-emerald-100 text-emerald-800"
                                  : item.isAttempted
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-slate-200 text-slate-700"
                                }`}
                            >
                              {item.isCorrect
                                ? `Correct (+${item.marksAwarded || 1})`
                                : item.isAttempted
                                  ? `Incorrect (${item.marksAwarded || 0})`
                                  : "Unattempted (0)"}
                            </span>
                          </div>

                          {/* Options Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {options.map((opt, optIdx) => {
                              const isCandidateChoice = item.studentSelected === optIdx;
                              const isCorrectAnswer = item.correctOptionIndex === optIdx;

                              let optBorder = "border-slate-200 bg-white";
                              let optBadge = null;

                              if (isCandidateChoice && isCorrectAnswer) {
                                optBorder = "border-emerald-500 bg-emerald-50 text-emerald-900 font-bold ring-1 ring-emerald-500";
                                optBadge = (
                                  <span className="text-[10px] font-black text-emerald-700 inline-flex items-center gap-1">
                                    <Check size={11} strokeWidth={3} />
                                    <span>Candidate Answer (Correct)</span>
                                  </span>
                                );
                              } else if (isCandidateChoice && !isCorrectAnswer) {
                                optBorder = "border-rose-400 bg-rose-50 text-rose-900 font-bold ring-1 ring-rose-400";
                                optBadge = (
                                  <span className="text-[10px] font-black text-rose-700 inline-flex items-center gap-1">
                                    <X size={11} strokeWidth={3} />
                                    <span>Candidate Answer (Wrong)</span>
                                  </span>
                                );
                              } else if (isCorrectAnswer) {
                                optBorder = "border-emerald-400 bg-emerald-50/40 text-emerald-800 font-bold border-dashed";
                                optBadge = (
                                  <span className="text-[10px] font-bold text-emerald-700 inline-flex items-center gap-1">
                                    <Check size={11} />
                                    <span>Correct Option</span>
                                  </span>
                                );
                              }

                              return (
                                <div
                                  key={optIdx}
                                  className={`p-2.5 rounded-xl border text-xs flex flex-col justify-between gap-1 ${optBorder}`}
                                >
                                  <div className="flex items-start gap-2">
                                    <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[10px] shrink-0">
                                      {String.fromCharCode(65 + optIdx)}
                                    </span>
                                    <span className="flex-1">{opt}</span>
                                  </div>
                                  {optBadge && <div className="pl-7">{optBadge}</div>}
                                </div>
                              );
                            })}
                          </div>

                          {/* Unattempted Alert */}
                          {!item.isAttempted && (
                            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
                              Candidate skipped / did not attempt this question.
                            </div>
                          )}

                          {/* Explanation */}
                          {item.explanation && (
                            <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-[11px] text-slate-700">
                              <span className="font-bold text-[#1c1f58]">Answer Explanation: </span>
                              {item.explanation}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-8 text-center text-xs font-bold text-slate-400">
                      No question breakdown data available for this attempt.
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="text-[11px] text-slate-400 font-medium">
                  Candidate ID: {selectedCandidate.studentRollNo} &bull; Attempt ID: {selectedCandidate.id}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCandidate(null)}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition-all cursor-pointer shadow-2xs"
                >
                  Close Response Sheet
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Zoom Image Lightbox Modal */}
      {zoomedImage && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-150"
          onClick={() => setZoomedImage(null)}
        >
          <div
            className="relative max-w-5xl max-h-[92vh] bg-white rounded-3xl p-3 shadow-2xl flex flex-col items-center overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-2 px-2 border-b border-slate-100">
              <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <ImageIcon size={14} className="text-indigo-600" />
                <span>Question Reference Diagram</span>
              </span>
              <button
                type="button"
                onClick={() => setZoomedImage(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-2 overflow-auto max-h-[82vh] flex items-center justify-center">
              <img
                src={getSafeImageUrl(zoomedImage)}
                alt="Full diagram"
                className="max-h-[78vh] max-w-[85vw] w-auto h-auto object-contain rounded-2xl"
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default QuizResults;
