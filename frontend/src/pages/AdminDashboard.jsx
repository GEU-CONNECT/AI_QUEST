import { createPortal } from 'react-dom';
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  CheckSquare,
  Users,
  Award,
  BookOpen,
  Search,
  Clock,
  Trash2,
  Eye,
  Download,
  FileText,
  UserCheck,
  TrendingUp,
  Plus,
  X,
  Layers,
  GraduationCap,
  AlertTriangle,
  Loader2,
  Activity,
  RefreshCw,
  RotateCcw,
  Lock,
  Unlock,
  Sliders,
  CheckCircle2,
  Sparkles,
  BarChart2,
  BarChart3,
  PieChart,
  Target,
  Info,
  FileSpreadsheet,
  Printer,
  Shield,
  ShieldAlert,
  Building2,
  Calendar,
  Check,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  Copy,
  Filter
} from "lucide-react";
import api from "../api/client";
import CreateQuizView from "../components/CreateQuizView";
import QuestionVaultView from "../components/QuestionVaultView";

const isDepartmentMatch = (filterDept, studentDept) => {
  if (!filterDept || filterDept === "ALL") return true;
  if (!studentDept) return false;
  const f = String(filterDept).trim().toUpperCase();
  const s = String(studentDept).trim().toUpperCase();
  if (f === s) return true;
  if (f === "CSE" || f.includes("COMPUTER SCIENCE")) {
    return s === "CSE" || s.includes("COMPUTER SCIENCE") || s.includes("CSE");
  }
  if (f === "CA" || f.includes("COMPUTER APPLICATION") || f.includes("APPLICATION")) {
    return s === "CA" || s.includes("COMPUTER APPLICATION") || s.includes("APPLICATION") || s === "CA";
  }
  return f.includes(s) || s.includes(f);
};

const AdminDashboard = ({ user, activeTab = "quizzes", onTabChange }) => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [overviewStats, setOverviewStats] = useState(null);
  const [facultyBreakdown, setFacultyBreakdown] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [courses, setCourses] = useState([]);

  // Search & Filter state for Quizzes & Submissions
  const [quizSearch, setQuizSearch] = useState("");
  const [facultyFilter, setFacultyFilter] = useState("ALL");
  const [courseFilter, setCourseFilter] = useState("ALL");
  const [submissionSearch, setSubmissionSearch] = useState("");

  // Registered Candidates (AI Quest Questers) State
  const [studentsList, setStudentsList] = useState([]);
  const [studentsTotal, setStudentsTotal] = useState(0);
  const [studentsSchoolsCount, setStudentsSchoolsCount] = useState(35);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentClassFilter, setStudentClassFilter] = useState("ALL");
  const [studentPage, setStudentPage] = useState(1);
  const [studentTotalPages, setStudentTotalPages] = useState(1);
  const [selectedStudentDetail, setSelectedStudentDetail] = useState(null);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [copiedCandidateId, setCopiedCandidateId] = useState(null);

  const formatRegistrationDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (_) {
      return dateStr;
    }
  };

  // Semester & Course Management state (Admin Control Panel)
  const [courseSemesterFilter, setCourseSemesterFilter] = useState("ALL");
  const [courseSearch, setCourseSearch] = useState("");
  const [isAddCourseModalOpen, setIsAddCourseModalOpen] = useState(false);
  const [newCourse, setNewCourse] = useState({
    code: "",
    title: "",
    semester: 1,
    department: "CSE",
    universityId: "",
    description: ""
  });
  const [savingCourse, setSavingCourse] = useState(false);
  const [courseActionError, setCourseActionError] = useState("");
  const [courseActionSuccess, setCourseActionSuccess] = useState("");

  // Bulk Delete States for Subjects & Submissions
  const [isDeleteAllCoursesModalOpen, setIsDeleteAllCoursesModalOpen] = useState(false);
  const [isDeletingAllCourses, setIsDeletingAllCourses] = useState(false);
  const [isDeleteAllSubmissionsModalOpen, setIsDeleteAllSubmissionsModalOpen] = useState(false);
  const [isDeletingAllSubmissions, setIsDeletingAllSubmissions] = useState(false);
  const [isDeletingSubmissionId, setIsDeletingSubmissionId] = useState(null);

  // 1. Live Proctor Monitor State
  const [liveMonitorData, setLiveMonitorData] = useState({ activeQuizzesCount: 0, quizzes: [] });
  const [loadingLiveMonitor, setLoadingLiveMonitor] = useState(false);

  // 2. Student Attempt Reset State
  const [resetTargetSubmission, setResetTargetSubmission] = useState(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetActionType, setResetActionType] = useState("resume"); // "resume" or "retake"
  const [isResettingSubmission, setIsResettingSubmission] = useState(false);

  // 3. Emergency Freeze State
  const [freezeTargetQuiz, setFreezeTargetQuiz] = useState(null);
  const [isFreezeModalOpen, setIsFreezeModalOpen] = useState(false);
  const [isFreezingQuiz, setIsFreezingQuiz] = useState(false);

  // 4. Global Question Key Correction & Auto-Regrading State
  const [regradeTargetQuiz, setRegradeTargetQuiz] = useState(null);
  const [regradeQuestions, setRegradeQuestions] = useState([]);
  const [loadingRegradeQuestions, setLoadingRegradeQuestions] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [newCorrectOptionIndex, setNewCorrectOptionIndex] = useState(0);
  const [isRegradeModalOpen, setIsRegradeModalOpen] = useState(false);
  const [isRegrading, setIsRegrading] = useState(false);
  const [regradeMessage, setRegradeMessage] = useState("");

  // 5. Grace / Bonus Marks State
  const [bonusTargetQuiz, setBonusTargetQuiz] = useState(null);
  const [isBonusModalOpen, setIsBonusModalOpen] = useState(false);
  const [bonusMarksAmount, setBonusMarksAmount] = useState(2.0);
  const [bonusMarksReason, setBonusMarksReason] = useState("");
  const [isGrantingBonus, setIsGrantingBonus] = useState(false);
  const [bonusMessage, setBonusMessage] = useState("");

  // 6. Bulk Courses CSV Import State
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState("");
  const [isImportingBulk, setIsImportingBulk] = useState(false);
  const [bulkImportMessage, setBulkImportMessage] = useState("");

  // 7. NAAC / NBA Accreditation Report State
  const [accreditationReport, setAccreditationReport] = useState([]);
  const [loadingAccreditation, setLoadingAccreditation] = useState(false);
  const [selectedCourseAccreditation, setSelectedCourseAccreditation] = useState(null);
  const [isCourseAccreditationModalOpen, setIsCourseAccreditationModalOpen] = useState(false);
  const [loadingCourseAccreditation, setLoadingCourseAccreditation] = useState(false);
  const [courseStudentSearch, setCourseStudentSearch] = useState("");
  const [courseSectionFilter, setCourseSectionFilter] = useState("ALL");
  const [courseStatusFilter, setCourseStatusFilter] = useState("ALL");
  const [courseUniFilter, setCourseUniFilter] = useState("ALL");
  const [courseDeptFilter, setCourseDeptFilter] = useState("ALL");
  const [courseSemFilter, setCourseSemFilter] = useState("ALL");
  const [activeCourseModalTab, setActiveCourseModalTab] = useState("analytics"); // "analytics" | "roster" | "rubric"

  // 8. Audit Trail State
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);

  // 9. DYNAMIC ACADEMIC HIERARCHY & STRUCTURE STATE
  const [universities, setUniversities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [academicTerm, setAcademicTerm] = useState({
    academicYear: "2026-2027",
    termType: "ODD",
    termLabel: "Odd Semester Term (Autumn 2026-2027)",
    activeSemesters: [1, 3, 5, 7]
  });
  const [activeSemesters, setActiveSemesters] = useState([1, 3, 5, 7]);
  const [selectedUniFilter, setSelectedUniFilter] = useState("ALL");

  // University Modal
  const [isAddUniModalOpen, setIsAddUniModalOpen] = useState(false);
  const [newUni, setNewUni] = useState({ name: "", code: "" });
  const [isSavingUni, setIsSavingUni] = useState(false);
  const [uniError, setUniError] = useState("");

  // 10. PROCTORING RULES & RECOVERY CONSOLE STATE
  const [proctoringRules, setProctoringRules] = useState({
    maxTabSwitches: 3,
    violationAction: "AUTO_LOCK",
    enforceFullscreen: true,
    disableClipboard: true,
    showWarningModal: true,
    reconnectGraceMin: 10,
    ipRestrictionEnabled: false,
    allowedSubnets: "172.16.*, 10.0.*",
    preventScreenshots: true,
    detectExtensions: true
  });

  // Systematic Hierarchical Live Monitor Filters (University -> Dept -> Sem -> Section -> Student)
  const [liveUniFilter, setLiveUniFilter] = useState("ALL");
  const [liveDeptFilter, setLiveDeptFilter] = useState("ALL");
  const [liveSemFilter, setLiveSemFilter] = useState("ALL");
  const [liveSectionFilter, setLiveSectionFilter] = useState("ALL");
  const [liveStatusFilter, setLiveStatusFilter] = useState("ALL"); // ALL, IN_PROGRESS, LOCKED
  const [liveCandidateSearch, setLiveCandidateSearch] = useState("");
  const [loadingProctoringRules, setLoadingProctoringRules] = useState(false);
  const [savingProctoringRules, setSavingProctoringRules] = useState(false);
  const [proctoringSaveMsg, setProctoringSaveMsg] = useState("");
  const [proctoringSaveError, setProctoringSaveError] = useState("");
  const [processingCandidateId, setProcessingCandidateId] = useState(null);
  const [candidateActionMsg, setCandidateActionMsg] = useState("");

  // Department Modal
  const [isAddDeptModalOpen, setIsAddDeptModalOpen] = useState(false);
  const [newDept, setNewDept] = useState({ name: "", code: "", universityId: "" });
  const [isSavingDept, setIsSavingDept] = useState(false);
  const [deptError, setDeptError] = useState("");

  // Academic Term Form
  const [termForm, setTermForm] = useState({
    termType: "ODD",
    academicYear: "2026-2027",
    customSemesters: [1, 3, 5, 7]
  });
  const [isUpdatingTerm, setIsUpdatingTerm] = useState(false);
  const [termSuccessMessage, setTermSuccessMessage] = useState("");

  // Close modals on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (isAddCourseModalOpen) setIsAddCourseModalOpen(false);
        if (isDeleteAllCoursesModalOpen) setIsDeleteAllCoursesModalOpen(false);
        if (isDeleteAllSubmissionsModalOpen) setIsDeleteAllSubmissionsModalOpen(false);
        if (isResetModalOpen) setIsResetModalOpen(false);
        if (isFreezeModalOpen) setIsFreezeModalOpen(false);
        if (isRegradeModalOpen) setIsRegradeModalOpen(false);
        if (isBonusModalOpen) setIsBonusModalOpen(false);
        if (isBulkImportModalOpen) setIsBulkImportModalOpen(false);
        if (isAddUniModalOpen) setIsAddUniModalOpen(false);
        if (isAddDeptModalOpen) setIsAddDeptModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isAddCourseModalOpen,
    isDeleteAllCoursesModalOpen,
    isDeleteAllSubmissionsModalOpen,
    isResetModalOpen,
    isFreezeModalOpen,
    isRegradeModalOpen,
    isBonusModalOpen,
    isBulkImportModalOpen,
    isAddUniModalOpen,
    isAddDeptModalOpen
  ]);

  useEffect(() => {
    fetchAdminData();
    fetchAcademicConfig();
  }, []);

  // Registered Candidates (Questers) API Fetcher
  const fetchRegisteredStudents = async (page = 1, currentSearch = studentSearch, currentClass = studentClassFilter) => {
    try {
      setStudentsLoading(true);
      const params = new URLSearchParams();
      if (currentSearch && currentSearch.trim()) params.append('search', currentSearch.trim());
      if (currentClass && currentClass !== 'ALL') params.append('studentClass', currentClass);
      params.append('page', page);
      params.append('limit', 25);

      const res = await api.get(`/admin/students?${params.toString()}`);
      if (res.data && res.data.success) {
        setStudentsList(res.data.students || []);
        setStudentsTotal(res.data.total || 0);
        if (res.data.totalSchools) {
          setStudentsSchoolsCount(res.data.totalSchools);
        }
        setStudentPage(res.data.page || 1);
        setStudentTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch registered students', err);
    } finally {
      setStudentsLoading(false);
    }
  };

  // Export Registered Candidates to Excel Sheet
  const handleExportStudentsExcel = async () => {
    try {
      setIsExportingExcel(true);
      const token = localStorage.getItem('quizx_token');
      const response = await fetch('/api/admin/export/students', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AI_Quest_2026_Registered_Students_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export students excel', err);
      alert('Failed to export registered students to Excel.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Fetch contextual tab data when activeTab changes
  useEffect(() => {
    if (activeTab === "students") {
      fetchRegisteredStudents(1);
    } else if (activeTab === "live-monitor") {
      fetchLiveMonitorData();
      fetchAcademicConfig();
    } else if (activeTab === "proctoring-rules") {
      fetchProctoringRules();
      fetchLiveMonitorData();
    } else if (activeTab === "accreditation") {
      fetchAccreditationReport();
    } else if (activeTab === "audit-logs") {
      fetchAuditLogs();
    } else if (activeTab === "academic-structure") {
      fetchAcademicStructureData();
    }
  }, [activeTab]);

  // Debounced search & filter effect for registered students
  useEffect(() => {
    if (activeTab === "students") {
      const timer = setTimeout(() => {
        fetchRegisteredStudents(1, studentSearch, studentClassFilter);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [studentSearch, studentClassFilter]);

  const fetchAcademicConfig = async () => {
    try {
      const res = await api.get("/academic/config");
      if (res.data.success) {
        if (res.data.academicTerm) {
          setAcademicTerm(res.data.academicTerm);
          setTermForm({
            termType: res.data.academicTerm.termType || "ODD",
            academicYear: res.data.academicTerm.academicYear || "2026-2027",
            customSemesters: res.data.academicTerm.activeSemesters || [1, 3, 5, 7]
          });
        }
        if (Array.isArray(res.data.activeSemesters) && res.data.activeSemesters.length > 0) {
          setActiveSemesters(res.data.activeSemesters);
        }
        if (Array.isArray(res.data.universities)) {
          setUniversities(res.data.universities);
        }
        if (Array.isArray(res.data.departments)) {
          setDepartments(res.data.departments);
          if (res.data.departments.length > 0) {
            setNewCourse((prev) => ({
              ...prev,
              department: res.data.departments[0].code,
              universityId: res.data.universities?.[0]?.id || ""
            }));
          }
        }
      }
    } catch (err) {
      console.error("Failed to load academic config", err);
    }
  };

  const fetchAcademicStructureData = async () => {
    try {
      const [uniRes, deptRes, termRes] = await Promise.all([
        api.get("/admin/universities"),
        api.get("/admin/departments"),
        api.get("/admin/academic-term")
      ]);
      if (uniRes.data.success) setUniversities(uniRes.data.universities || []);
      if (deptRes.data.success) setDepartments(deptRes.data.departments || []);
      if (termRes.data.success && termRes.data.term) {
        setAcademicTerm(termRes.data.term);
        setActiveSemesters(termRes.data.term.activeSemesters || [1, 3, 5, 7]);
        setTermForm({
          termType: termRes.data.term.termType || "ODD",
          academicYear: termRes.data.term.academicYear || "2026-2027",
          customSemesters: termRes.data.term.activeSemesters || [1, 3, 5, 7]
        });
      }
    } catch (err) {
      console.error("Failed to load academic structure data", err);
    }
  };

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [overviewRes, quizzesRes, submissionsRes, coursesRes] = await Promise.all([
        api.get("/admin/overview"),
        api.get("/admin/quizzes"),
        api.get("/admin/submissions"),
        api.get("/courses")
      ]);

      if (overviewRes.data.success) {
        setOverviewStats(overviewRes.data.stats);
        setFacultyBreakdown(overviewRes.data.facultyBreakdown || []);
      }
      if (quizzesRes.data.success) {
        setQuizzes(quizzesRes.data.quizzes);
      }
      if (submissionsRes.data.success) {
        setSubmissions(submissionsRes.data.submissions);
      }
      if (coursesRes.data.success) {
        setCourses(coursesRes.data.courses || []);
      }
    } catch (err) {
      console.error("Failed to load admin data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveMonitorData = async () => {
    try {
      setLoadingLiveMonitor(true);
      const res = await api.get("/admin/live-monitor");
      if (res.data.success) {
        setLiveMonitorData({
          activeQuizzesCount: res.data.activeQuizzesCount,
          quizzes: res.data.quizzes || []
        });
      }
    } catch (err) {
      console.error("Failed to load live monitor", err);
    } finally {
      setLoadingLiveMonitor(false);
    }
  };

  const fetchProctoringRules = async () => {
    try {
      setLoadingProctoringRules(true);
      const res = await api.get("/admin/proctoring-rules");
      if (res.data.success && res.data.rules) {
        setProctoringRules(res.data.rules);
      }
    } catch (err) {
      console.error("Failed to load proctoring rules:", err);
    } finally {
      setLoadingProctoringRules(false);
    }
  };

  const handleSaveProctoringRules = async () => {
    try {
      setSavingProctoringRules(true);
      setProctoringSaveMsg("");
      setProctoringSaveError("");
      const res = await api.put("/admin/proctoring-rules", proctoringRules);
      if (res.data.success) {
        setProctoringSaveMsg("Proctoring policies successfully saved and applied to active exams.");
        setProctoringRules(res.data.rules);
        setTimeout(() => setProctoringSaveMsg(""), 4000);
      }
    } catch (err) {
      setProctoringSaveError(err.response?.data?.message || "Failed to save proctoring rules.");
    } finally {
      setSavingProctoringRules(false);
    }
  };

  const handleUnlockCandidate = async (submissionId, candidateName) => {
    try {
      setProcessingCandidateId(submissionId);
      setCandidateActionMsg("");
      const res = await api.post(`/admin/submissions/${submissionId}/unlock`);
      if (res.data.success) {
        setCandidateActionMsg(`Candidate ${candidateName || "student"} has been UNLOCKED. Assessment resumed.`);
        fetchLiveMonitorData();
        setTimeout(() => setCandidateActionMsg(""), 4000);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to unlock candidate.");
    } finally {
      setProcessingCandidateId(null);
    }
  };

  const handleLockCandidate = async (submissionId, candidateName, reason = "Integrity violation") => {
    if (!window.confirm(`Freeze and LOCK examination session for ${candidateName || "this candidate"}?`)) return;
    try {
      setProcessingCandidateId(submissionId);
      setCandidateActionMsg("");
      const res = await api.post(`/admin/submissions/${submissionId}/lock`, { reason });
      if (res.data.success) {
        setCandidateActionMsg(`Candidate ${candidateName || "student"} session is now LOCKED.`);
        fetchLiveMonitorData();
        setTimeout(() => setCandidateActionMsg(""), 4000);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to lock candidate.");
    } finally {
      setProcessingCandidateId(null);
    }
  };

  const fetchAccreditationReport = async () => {
    try {
      setLoadingAccreditation(true);
      const res = await api.get("/admin/accreditation-report");
      if (res.data.success) {
        setAccreditationReport(res.data.report || []);
      }
    } catch (err) {
      console.error("Failed to load accreditation report", err);
    } finally {
      setLoadingAccreditation(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setLoadingAuditLogs(true);
      const res = await api.get("/admin/audit-logs");
      if (res.data.success) {
        setAuditLogs(res.data.logs || []);
      }
    } catch (err) {
      console.error("Failed to load audit logs", err);
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  const handleDeleteQuiz = async (quizId, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"? This will delete all its questions and student submissions.`)) {
      return;
    }
    try {
      await api.delete(`/quizzes/${quizId}`);
      setQuizzes(quizzes.filter((q) => q.id !== quizId));
      fetchAdminData();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete quiz");
    }
  };

  // CSV Export for submissions ledger
  const handleExportLedgerCSV = () => {
    if (!filteredSubmissions.length) return;
    const headers = ["Student Roll No", "Student Name", "Quiz Title", "Course", "Faculty Author", "Score", "Total Marks", "Percentage", "Status", "Submitted At"];
    const rows = filteredSubmissions.map((s) => [
      s.studentRollNo,
      `"${s.studentName}"`,
      `"${s.quizTitle}"`,
      s.courseCode,
      `"${s.facultyName}"`,
      s.score,
      s.totalMarks,
      `${s.percentage}%`,
      s.isPassed ? "PASSED" : "FAILED",
      s.submittedAt ? new Date(s.submittedAt).toLocaleString() : ""
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `QuizX_University_Assessment_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Export for NAAC / NBA Ledger
  const handleExportAccreditationCSV = () => {
    if (!accreditationReport.length) return;
    const headers = ["Semester", "Department", "Course Code", "Course Title", "Total Assessments", "Total Evaluated", "Passed", "Failed", "Average Score", "Pass Percentage"];
    const rows = accreditationReport.map((r) => [
      r.semester,
      `"${r.department}"`,
      r.courseCode,
      `"${r.courseTitle}"`,
      r.totalAssessments,
      r.totalEvaluated,
      r.passedCount,
      r.failedCount,
      r.averageScore,
      `${r.passPercentage}%`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `GEU_NAAC_NBA_Assessment_Summary_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open Course Accreditation & Student Marks Dossier Modal
  const handleOpenCourseAccreditation = async (courseIdOrCode, requestedSem = null, requestedDept = null) => {
    if (!courseIdOrCode) return;
    setIsCourseAccreditationModalOpen(true);
    setLoadingCourseAccreditation(true);
    const isInitialOpen = (requestedSem === null && requestedDept === null);
    if (isInitialOpen) {
      setActiveCourseModalTab("analytics");
      setCourseStudentSearch("");
      setCourseSectionFilter("ALL");
      setCourseStatusFilter("ALL");
      setCourseUniFilter("ALL");
    }
    try {
      const url = requestedSem && requestedSem !== "ALL"
        ? `/admin/accreditation/courses/${courseIdOrCode}?semester=${requestedSem}`
        : (requestedSem === "ALL" ? `/admin/accreditation/courses/${courseIdOrCode}?semester=ALL` : `/admin/accreditation/courses/${courseIdOrCode}`);
      const res = await api.get(url);
      if (res.data.success) {
        setSelectedCourseAccreditation(res.data);
        const cDept = res.data.course?.department;
        const cSem = res.data.course?.semester;
        if (requestedDept) setCourseDeptFilter(requestedDept.toUpperCase());
        else if (cDept) setCourseDeptFilter(cDept.toUpperCase());
        if (requestedSem !== null) setCourseSemFilter(String(requestedSem));
        else if (cSem) setCourseSemFilter(String(cSem));
      }
    } catch (err) {
      console.error("Failed to load course accreditation dossier", err);
      alert(err.response?.data?.message || "Failed to load course accreditation details.");
      if (!selectedCourseAccreditation) setIsCourseAccreditationModalOpen(false);
    } finally {
      setLoadingCourseAccreditation(false);
    }
  };

  // Export Course-Specific NAAC / NBA Dossier with Student Marks Ledger
  const handleExportCourseDossierCSV = (data) => {
    if (!data || !data.course) return;
    const { course, accreditationKPIs: kpis, studentRoster = [] } = data;

    const lines = [
      "========================================================================================",
      "GRAPHIC ERA DEEMED TO BE UNIVERSITY - NAAC & NBA ACCREDITATION COURSE OUTCOME DOSSIER",
      "========================================================================================",
      `Course Code:,"${course.code}"`,
      `Course Title:,"${course.title}"`,
      `Department:,"${course.department}"`,
      `Semester:,${course.semester}`,
      `Instructor:,"${course.instructorName || "Department Faculty"}"`,
      `Cohort Enrolled Candidates:,${course.totalEnrolledInCohort || 0}`,
      `Assessments Conducted:,${course.totalAssessmentsConducted || 0}`,
      `Report Generated At:,"${new Date().toLocaleString()}"`,
      "",
      "--- OUTCOME-BASED EDUCATION (OBE) & CO ATTAINMENT EXECUTIVE SUMMARY ---",
      `Total Evaluated Candidates:,${kpis.totalEvaluated || 0}`,
      `Passed Candidates:,${kpis.passedCount || 0}`,
      `Failed Candidates:,${kpis.failedCount || 0}`,
      `Pass Rate (%):,${kpis.passPercentage || 0}%`,
      `Mean Score (%):,${kpis.meanScore || 0}%`,
      `Median Score (%):,${kpis.medianScore || 0}%`,
      `Highest Score (%):,${kpis.highestScore || 0}%`,
      `Lowest Score (%):,${kpis.lowestScore || 0}%`,
      `Standard Deviation:,${kpis.standardDeviation || 0}`,
      `CO Attainment Target Benchmark:,${kpis.targetBenchmark || 60}%`,
      `Candidates Scoring >= ${kpis.targetBenchmark || 60}%:,${kpis.targetAchievedCount || 0} (${kpis.targetAttainmentPercentage || 0}%)`,
      `Accreditation CO Attainment Band:,"${kpis.overallCourseAttainmentLevel || "Unattained"}"`,
      `Distinction (>=75%):,${kpis.distributionBands?.distinction || 0}`,
      `First Class (60-74%):,${kpis.distributionBands?.firstClass || 0}`,
      `Second Class (40-59%):,${kpis.distributionBands?.secondClass || 0}`,
      `Remedial / Slow Learners (<40%):,${kpis.distributionBands?.remedialAtRisk || 0}`,
      "",
      "--- SECTION-WISE COMPARATIVE BREAKDOWN ---",
      "Section,Assessed Count,Passed Count,Failed Count,Pass Rate (%),Average Score (%),Remedial Candidates"
    ];

    if (Array.isArray(data.sectionComparison)) {
      data.sectionComparison.forEach((sec) => {
        lines.push([
          `"${sec.section}"`,
          sec.totalAssessed,
          sec.passedCount,
          sec.failedCount,
          `${sec.passRate}%`,
          `${sec.avgPercentage}%`,
          sec.remedialCount
        ].join(","));
      });
    }

    lines.push("");
    lines.push("--- INDIVIDUAL CANDIDATE MARKS & ACCREDITATION ATTAINMENT ROSTER ---");
    lines.push("S.No,Roll No / ID,Candidate Name,Email,Section,Semester,Department,Assessments Attempted,Total Marks Obtained,Total Max Marks,Percentage (%),Evaluation Status,NAAC Attainment Band,Performance Classification,Remedial Coaching Required");

    studentRoster.forEach((s, idx) => {
      const isAbsent = s.status === "ABSENT / PENDING";
      lines.push([
        idx + 1,
        `"${s.rollNo}"`,
        `"${s.name}"`,
        `"${s.email || ""}"`,
        `"${s.section}"`,
        s.semester,
        `"${s.department}"`,
        s.assessmentsAttempted ? s.assessmentsAttempted.length : 0,
        isAbsent ? "N/A" : (s.totalMarksObtained || 0),
        isAbsent ? "N/A" : (s.totalPossibleMarks || 0),
        isAbsent ? "N/A" : `${s.overallPercentage || 0}%`,
        `"${s.status || "EVALUATED"}"`,
        `"${s.attainmentBand || (isAbsent ? "Pending Assessment" : "Unattained")}"`,
        `"${s.gradeClassification || (isAbsent ? "Not Attempted" : "N/A")}"`,
        isAbsent ? "N/A (Pending Exam)" : (s.remedialNeeded ? "YES (Remedial Coaching Required)" : "NO")
      ].join(","));
    });

    const csvContent = "data:text/csv;charset=utf-8," + lines.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `NAAC_NBA_Course_Dossier_${course.code}_Sem${course.semester}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- ACADEMIC STRUCTURE HANDLERS ---
  const handleSaveAcademicTerm = async (e) => {
    e.preventDefault();
    try {
      setIsUpdatingTerm(true);
      setTermSuccessMessage("");
      const res = await api.put("/admin/academic-term", {
        termType: termForm.termType,
        academicYear: termForm.academicYear,
        customSemesters: termForm.customSemesters
      });
      if (res.data.success) {
        setTermSuccessMessage(res.data.message);
        setAcademicTerm(res.data.term);
        setActiveSemesters(res.data.term.activeSemesters || [1, 3, 5, 7]);
        if (newCourse.semester && !res.data.term.activeSemesters.includes(newCourse.semester)) {
          setNewCourse((prev) => ({ ...prev, semester: res.data.term.activeSemesters[0] || 1 }));
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update academic term");
    } finally {
      setIsUpdatingTerm(false);
    }
  };

  const handleCreateUniversity = async (e) => {
    e.preventDefault();
    setUniError("");
    if (!newUni.name.trim() || !newUni.code.trim()) {
      setUniError("University name and code are required.");
      return;
    }
    try {
      setIsSavingUni(true);
      const res = await api.post("/admin/universities", {
        name: newUni.name.trim(),
        code: newUni.code.trim().toUpperCase()
      });
      if (res.data.success) {
        setIsAddUniModalOpen(false);
        setNewUni({ name: "", code: "" });
        fetchAcademicStructureData();
        fetchAcademicConfig();
      }
    } catch (err) {
      setUniError(err.response?.data?.message || "Failed to create university");
    } finally {
      setIsSavingUni(false);
    }
  };

  const handleDeleteUniversity = async (uniId, uniName) => {
    if (!window.confirm(`Are you sure you want to delete university "${uniName}" and all its linked departments?`)) {
      return;
    }
    try {
      const res = await api.delete(`/admin/universities/${uniId}`);
      if (res.data.success) {
        fetchAcademicStructureData();
        fetchAcademicConfig();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete university");
    }
  };

  const handleCreateDepartment = async (e) => {
    e.preventDefault();
    setDeptError("");
    if (!newDept.name.trim() || !newDept.code.trim()) {
      setDeptError("Department name and code are required.");
      return;
    }
    try {
      setIsSavingDept(true);
      const res = await api.post("/admin/departments", {
        name: newDept.name.trim(),
        code: newDept.code.trim().toUpperCase(),
        universityId: newDept.universityId || universities[0]?.id
      });
      if (res.data.success) {
        setIsAddDeptModalOpen(false);
        setNewDept({ name: "", code: "", universityId: "" });
        fetchAcademicStructureData();
        fetchAcademicConfig();
      }
    } catch (err) {
      setDeptError(err.response?.data?.message || "Failed to create department");
    } finally {
      setIsSavingDept(false);
    }
  };

  const handleDeleteDepartment = async (deptId, deptName) => {
    if (!window.confirm(`Are you sure you want to delete department "${deptName}"?`)) {
      return;
    }
    try {
      const res = await api.delete(`/admin/departments/${deptId}`);
      if (res.data.success) {
        fetchAcademicStructureData();
        fetchAcademicConfig();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete department");
    }
  };

  // --- SUPER ADMIN POWERS HANDLERS ---

  // 1. Reset / Unlock Student Attempt
  const handleConfirmResetSubmission = async () => {
    if (!resetTargetSubmission) return;
    try {
      setIsResettingSubmission(true);
      const res = await api.post(`/admin/submissions/${resetTargetSubmission.id}/reset`, {
        actionType: resetActionType
      });
      if (res.data.success) {
        setIsResetModalOpen(false);
        setResetTargetSubmission(null);
        fetchAdminData();
        if (activeTab === "live-monitor") fetchLiveMonitorData();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to reset submission");
    } finally {
      setIsResettingSubmission(false);
    }
  };

  // 2. Toggle Emergency Freeze Quiz
  const handleConfirmToggleFreeze = async () => {
    if (!freezeTargetQuiz) return;
    try {
      setIsFreezingQuiz(true);
      const res = await api.post(`/admin/quizzes/${freezeTargetQuiz.id}/toggle-freeze`);
      if (res.data.success) {
        setIsFreezeModalOpen(false);
        setFreezeTargetQuiz(null);
        fetchAdminData();
        if (activeTab === "live-monitor") fetchLiveMonitorData();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to toggle quiz freeze");
    } finally {
      setIsFreezingQuiz(false);
    }
  };

  // 3. Open Regrade Modal & Load Questions
  const handleOpenRegradeModal = async (quiz) => {
    setRegradeTargetQuiz(quiz);
    setIsRegradeModalOpen(true);
    setRegradeMessage("");
    try {
      setLoadingRegradeQuestions(true);
      const res = await api.get(`/quizzes/${quiz.id}`);
      if (res.data.success && res.data.quiz?.questions) {
        const qList = res.data.quiz.questions;
        setRegradeQuestions(qList);
        if (qList.length > 0) {
          setSelectedQuestionId(qList[0].id);
          setNewCorrectOptionIndex(qList[0].correctOptionIndex || 0);
        }
      }
    } catch (err) {
      console.error("Failed to load questions for regrade", err);
    } finally {
      setLoadingRegradeQuestions(false);
    }
  };

  const handleApplyRegrade = async () => {
    if (!regradeTargetQuiz || !selectedQuestionId) return;
    try {
      setIsRegrading(true);
      setRegradeMessage("");
      const res = await api.post(`/admin/quizzes/${regradeTargetQuiz.id}/regrade`, {
        questionId: selectedQuestionId,
        newCorrectIndex: newCorrectOptionIndex
      });
      if (res.data.success) {
        setRegradeMessage(res.data.message);
        fetchAdminData();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to auto-regrade submissions");
    } finally {
      setIsRegrading(false);
    }
  };

  // 4. Grant Bonus Marks
  const handleOpenBonusModal = (quiz) => {
    setBonusTargetQuiz(quiz);
    setBonusMarksAmount(2.0);
    setBonusMarksReason("");
    setBonusMessage("");
    setIsBonusModalOpen(true);
  };

  const handleApplyBonusMarks = async () => {
    if (!bonusTargetQuiz) return;
    try {
      setIsGrantingBonus(true);
      setBonusMessage("");
      const res = await api.post(`/admin/quizzes/${bonusTargetQuiz.id}/bonus-marks`, {
        bonusMarks: Number(bonusMarksAmount),
        reason: bonusMarksReason.trim()
      });
      if (res.data.success) {
        setBonusMessage(res.data.message);
        fetchAdminData();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to inject bonus marks");
    } finally {
      setIsGrantingBonus(false);
    }
  };

  // 5. Bulk Import Subjects via CSV
  const handleDownloadSampleCsv = () => {
    const csvSample = "code,title,semester,department\nTCS-501,Design and Analysis of Algorithms,5,CSE\nTCS-502,Operating Systems,5,CSE\nTCS-503,Database Management Systems,5,CSE\nTCS-504,Computer Networks,5,CSE\n";
    const blob = new Blob([csvSample], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "GEU_Subjects_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleApplyBulkImport = async () => {
    if (!bulkCsvText.trim()) {
      alert("Please enter or paste CSV subject records.");
      return;
    }

    try {
      setIsImportingBulk(true);
      setBulkImportMessage("");

      const lines = bulkCsvText.trim().split(/\r?\n/);
      const parsedCourses = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(",").map((p) => p.trim());
        if (i === 0 && (parts[0].toLowerCase() === "code" || parts[1]?.toLowerCase() === "title")) {
          continue;
        }

        if (parts.length >= 2 && parts[0] && parts[1]) {
          parsedCourses.push({
            code: parts[0].toUpperCase(),
            title: parts[1],
            semester: Number(parts[2]) || activeSemesters[0] || 1,
            department: parts[3] || (departments[0]?.code || "CSE")
          });
        }
      }

      if (parsedCourses.length === 0) {
        alert("No valid subject rows found in the provided CSV text.");
        setIsImportingBulk(false);
        return;
      }

      const res = await api.post("/admin/courses/bulk", { courses: parsedCourses });
      if (res.data.success) {
        setBulkImportMessage(res.data.message);
        fetchAdminData();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to bulk import subjects");
    } finally {
      setIsImportingBulk(false);
    }
  };

  // Unique faculty & course lists for quizzes tab
  const uniqueFaculties = Array.from(new Set(quizzes.map((q) => q.creator?.name).filter(Boolean)));
  const uniqueCourses = Array.from(new Set(quizzes.map((q) => q.course?.code).filter(Boolean)));

  // Filtered Quizzes
  const filteredQuizzes = quizzes.filter((q) => {
    const matchesSearch =
      q.title?.toLowerCase().includes(quizSearch.toLowerCase()) ||
      q.creator?.name?.toLowerCase().includes(quizSearch.toLowerCase()) ||
      q.creator?.universityId?.toLowerCase().includes(quizSearch.toLowerCase()) ||
      q.course?.code?.toLowerCase().includes(quizSearch.toLowerCase()) ||
      q.course?.title?.toLowerCase().includes(quizSearch.toLowerCase());

    const matchesFaculty = facultyFilter === "ALL" || q.creator?.name === facultyFilter;
    const matchesCourse = courseFilter === "ALL" || q.course?.code === courseFilter;

    return matchesSearch && matchesFaculty && matchesCourse;
  });

  // Filtered Submissions
  const filteredSubmissions = submissions.filter((s) => {
    const query = submissionSearch.toLowerCase();
    return (
      s.studentRollNo?.toLowerCase().includes(query) ||
      s.studentName?.toLowerCase().includes(query) ||
      s.quizTitle?.toLowerCase().includes(query) ||
      s.courseCode?.toLowerCase().includes(query) ||
      s.facultyName?.toLowerCase().includes(query)
    );
  });

  // Filtered Courses (Semester-Wise & Search)
  const filteredCourses = courses.filter((c) => {
    const matchesSemester =
      courseSemesterFilter === "ALL" || Number(c.semester) === Number(courseSemesterFilter);
    const q = courseSearch.toLowerCase();
    const matchesSearch =
      !q ||
      c.code?.toLowerCase().includes(q) ||
      c.title?.toLowerCase().includes(q) ||
      c.department?.toLowerCase().includes(q);
    return matchesSemester && matchesSearch;
  });

  // Count courses per semester
  const courseCountsBySemester = courses.reduce((acc, c) => {
    const sem = c.semester || 1;
    acc[sem] = (acc[sem] || 0) + 1;
    return acc;
  }, {});

  // Handle Add New Course
  const handleDeleteAllCourses = async () => {
    try {
      setIsDeletingAllCourses(true);
      setCourseActionError("");
      const res = await api.delete("/admin/courses/all");
      if (res.data.success) {
        setCourses([]);
        setCourseActionSuccess(res.data.message || "All subjects deleted successfully.");
        setIsDeleteAllCoursesModalOpen(false);
        const overviewRes = await api.get("/admin/overview");
        if (overviewRes.data.success) setOverviewStats(overviewRes.data.stats);
      }
    } catch (err) {
      console.error("Failed to delete all subjects", err);
      setCourseActionError(err.response?.data?.message || "Failed to delete subjects.");
    } finally {
      setIsDeletingAllCourses(false);
    }
  };

  const handleDeleteAllSubmissions = async () => {
    try {
      setIsDeletingAllSubmissions(true);
      const res = await api.delete("/admin/submissions/all");
      if (res.data.success) {
        setSubmissions([]);
        setIsDeleteAllSubmissionsModalOpen(false);
        const overviewRes = await api.get("/admin/overview");
        if (overviewRes.data.success) setOverviewStats(overviewRes.data.stats);
      }
    } catch (err) {
      console.error("Failed to delete all submissions", err);
    } finally {
      setIsDeletingAllSubmissions(false);
    }
  };

  const handleDeleteSingleSubmission = async (id) => {
    if (!window.confirm("Are you sure you want to delete this student submission evaluation?")) return;
    try {
      setIsDeletingSubmissionId(id);
      const res = await api.delete(`/admin/submissions/${id}`);
      if (res.data.success) {
        setSubmissions((prev) => prev.filter((s) => s.id !== id));
        const overviewRes = await api.get("/admin/overview");
        if (overviewRes.data.success) setOverviewStats(overviewRes.data.stats);
      }
    } catch (err) {
      console.error("Failed to delete submission", err);
    } finally {
      setIsDeletingSubmissionId(null);
    }
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    setCourseActionError("");

    if (!newCourse.code.trim() || !newCourse.title.trim()) {
      setCourseActionError("Subject code and title are required.");
      return;
    }

    try {
      setSavingCourse(true);
      const res = await api.post("/courses", {
        code: newCourse.code.trim().toUpperCase(),
        title: newCourse.title.trim(),
        semester: Number(newCourse.semester),
        department: newCourse.department?.trim() || "CSE",
        universityId: newCourse.universityId || (universities[0]?.id || null),
        description: newCourse.description?.trim() || null
      });

      if (res.data.success) {
        setCourses((prev) =>
          [...prev, res.data.course].sort(
            (a, b) => (a.semester || 1) - (b.semester || 1) || a.code.localeCompare(b.code)
          )
        );
        setCourseActionSuccess(`Subject "${res.data.course.code}" created successfully.`);
        setNewCourse({
          code: "",
          title: "",
          semester: activeSemesters[0] || 1,
          department: departments[0]?.code || "CSE",
          universityId: universities[0]?.id || "",
          description: ""
        });
        setIsAddCourseModalOpen(false);
        const overviewRes = await api.get("/admin/overview");
        if (overviewRes.data.success) setOverviewStats(overviewRes.data.stats);
      }
    } catch (err) {
      console.error("Failed to create subject", err);
      setCourseActionError(err.response?.data?.message || "Failed to create subject.");
    } finally {
      setSavingCourse(false);
    }
  };

  const handleDeleteCourse = async (courseId, code, title) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${code} - ${title}"?\n\nNotice: Any quizzes or submissions linked to this subject will also be deleted.`
      )
    ) {
      return;
    }

    try {
      const res = await api.delete(`/courses/${courseId}`);
      if (res.data.success) {
        setCourses((prev) => prev.filter((c) => c.id !== courseId));
        fetchAdminData();
      }
    } catch (err) {
      console.error("Failed to delete subject", err);
      alert(err.response?.data?.message || "Failed to delete subject.");
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center font-sans">
        <div className="w-10 h-10 border-3 border-[#1c1f58] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-black text-slate-500 uppercase tracking-wider">
          Loading Super Admin Suite...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Header Overview & Stats (Only shown for quizzes & management, hidden on Registered Candidates) */}
      {activeTab !== "students" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#1c1f58] tracking-tight">
                Super Admin Control Suite
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Graphic Era Deemed to be University - Assessment Governance & Analytics
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Admin Access Active
              </span>
            </div>
          </div>

          {/* Top Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Quizzes</div>
              <div className="text-xl font-black text-slate-900 mt-1">{overviewStats?.totalQuizzes || 0}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Submissions</div>
              <div className="text-xl font-black text-indigo-600 mt-1">{overviewStats?.totalSubmissions || 0}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pass Rate</div>
              <div className="text-xl font-black text-emerald-600 mt-1">{overviewStats?.overallPassRate || 0}%</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Score</div>
              <div className="text-xl font-black text-purple-600 mt-1">{overviewStats?.overallAvgScore || 0}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Universities</div>
              <div className="text-xl font-black text-slate-800 mt-1">{universities.length}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Departments</div>
              <div className="text-xl font-black text-blue-600 mt-1">{departments.length}</div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. TAB: REGISTERED CANDIDATES & QUESTERS DIRECTORY       */}
      {/* ======================================================== */}
      {activeTab === "students" && (
        <div className="space-y-6">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600">
                  <Users size={24} />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-[#1c1f58] tracking-tight">
                    Registered Candidates Directory
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Official participant roster for AI Quest 2026 &bull; Verified records of all student registrations
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleExportStudentsExcel}
                disabled={isExportingExcel}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 active:scale-95"
                title="Download full candidate list as Microsoft Excel sheet"
              >
                {isExportingExcel ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <FileSpreadsheet size={16} />
                )}
                <span>{isExportingExcel ? 'Exporting Sheet...' : 'Export Excel (.xlsx)'}</span>
              </button>

              <button
                type="button"
                onClick={() => fetchRegisteredStudents(studentPage)}
                disabled={studentsLoading}
                className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                title="Refresh candidate records"
              >
                <RefreshCw size={16} className={studentsLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Registration Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Total Registered</span>
                <span className="text-2xl sm:text-3xl font-black text-[#1c1f58]">{studentsTotal}</span>
                <span className="text-[11px] text-slate-500 font-medium block mt-0.5">Verified Student Registrations</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#1c1f58]">
                <Users size={22} />
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Participating Schools</span>
                <span className="text-2xl sm:text-3xl font-black text-purple-600">{studentsSchoolsCount || 35}+</span>
                <span className="text-[11px] text-slate-500 font-medium block mt-0.5">Institutions Across UK &amp; NCR</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                <GraduationCap size={22} />
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Candidate Cohort</span>
                <span className="text-xl sm:text-2xl font-black text-emerald-600">Class 11 &amp; 12</span>
                <span className="text-[11px] text-slate-500 font-medium block mt-0.5">Senior Secondary Questers</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
                <Sparkles size={22} />
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Academic Streams</span>
                <span className="text-xl sm:text-2xl font-black text-amber-600">Science &amp; Tech</span>
                <span className="text-[11px] text-slate-500 font-medium block mt-0.5">PCM, PCB, CS &amp; Others</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700">
                <Layers size={22} />
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full md:w-96">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search candidate name, mobile, email, school, city..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full pl-10 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1c1f58] focus:bg-white transition-all"
              />
              {studentSearch && (
                <button
                  type="button"
                  onClick={() => setStudentSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Dropdown & Status */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Class:</span>
                <select
                  value={studentClassFilter}
                  onChange={(e) => setStudentClassFilter(e.target.value)}
                  className="py-1.5 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
                >
                  <option value="ALL">All Classes</option>
                  <option value="Class 11th">Class 11th</option>
                  <option value="Class 12th">Class 12th</option>
                  <option value="12th Pass / Dropper">12th Pass / Dropper</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {(studentSearch || studentClassFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setStudentSearch('');
                    setStudentClassFilter('ALL');
                  }}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 px-2 py-1 cursor-pointer"
                >
                  Clear Filters
                </button>
              )}

              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">
                {studentsTotal} Total
              </span>
            </div>
          </div>

          {/* Candidates Stack / List View */}
          <div className="space-y-3">
            {studentsLoading ? (
              <div className="p-16 text-center space-y-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                <Loader2 size={32} className="animate-spin text-[#1c1f58] mx-auto" />
                <span className="text-xs font-bold text-slate-400 block">Loading registered student profiles...</span>
              </div>
            ) : studentsList.length === 0 ? (
              <div className="p-16 text-center space-y-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                <Users size={40} className="text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-700">No Candidates Found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {studentSearch || studentClassFilter !== 'ALL'
                    ? "No student records match the active search/filters. Try clearing filters."
                    : "No candidates have registered yet. New student registrations will automatically appear here."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {studentsList.map((student, idx) => {
                  const rowNum = (studentPage - 1) * 25 + idx + 1;
                  const isCopied = copiedCandidateId === student.registrationId;

                  return (
                    <div
                      key={student.id || idx}
                      onClick={() => setSelectedStudentDetail(student)}
                      className="group relative bg-white hover:bg-slate-50/80 rounded-2xl border border-slate-200/90 hover:border-indigo-400 p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all duration-150 cursor-pointer"
                    >
                      {/* Top Header Row of Stack Item */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-black text-slate-400 w-7 shrink-0">#{rowNum}</span>
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1c1f58] to-indigo-800 text-white font-black flex items-center justify-center shrink-0 text-sm shadow-xs">
                            {(student.name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-black text-slate-900 text-sm sm:text-base group-hover:text-indigo-700 transition-colors">
                                {student.name}
                              </h3>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                {student.studentClass || 'Class 12th'}
                              </span>
                              {student.stream && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  {student.stream}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <div className="flex items-center gap-1 font-mono text-[11px] font-bold text-indigo-800 bg-indigo-50/70 px-2 py-0.5 rounded-md border border-indigo-100/70">
                                <span>{student.registrationId || 'N/A'}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (student.registrationId) {
                                      navigator.clipboard.writeText(student.registrationId);
                                      setCopiedCandidateId(student.registrationId);
                                      setTimeout(() => setCopiedCandidateId(null), 1800);
                                    }
                                  }}
                                  className="text-slate-400 hover:text-indigo-600 ml-1 cursor-pointer"
                                  title="Copy Registration ID"
                                >
                                  {isCopied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                </button>
                              </div>
                              <span className="text-slate-300">•</span>
                              <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                                <Calendar size={12} className="text-slate-400 shrink-0" />
                                {formatRegistrationDate(student.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-xs font-bold text-indigo-600 group-hover:text-indigo-800 self-end sm:self-center shrink-0">
                          <span>View Full Details</span>
                          <ChevronRight size={15} className="group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>

                      {/* Main Details 3-Column Stack Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-3.5 text-xs">
                        {/* 1. Candidate Contact Information */}
                        <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100/80 space-y-1.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Candidate Contact</span>
                          <div className="flex items-center gap-2 font-bold text-slate-900">
                            <Phone size={13} className="text-indigo-600 shrink-0" />
                            <span className="font-mono">{student.mobileNo || 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-600 truncate font-medium" title={student.email}>
                            <Mail size={13} className="text-indigo-600 shrink-0" />
                            <span className="truncate">{student.email || 'N/A'}</span>
                          </div>
                        </div>

                        {/* 2. School & City Location */}
                        <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100/80 space-y-1.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">School &amp; City</span>
                          <div className="flex items-center gap-2 font-bold text-slate-900 truncate" title={student.schoolName}>
                            <Building2 size={13} className="text-purple-600 shrink-0" />
                            <span className="truncate">{student.schoolName || 'N/A'}</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-600 font-medium">
                            <span className="flex items-center gap-1.5">
                              <MapPin size={13} className="text-rose-500 shrink-0" />
                              <span>City: <strong className="text-slate-800">{student.city || 'Dehradun'}</strong></span>
                            </span>
                            <span className="text-[11px] text-purple-700 font-bold truncate max-w-[120px]" title={student.stream}>
                              {student.stream || 'Science'}
                            </span>
                          </div>
                        </div>

                        {/* 3. Parent / Guardian Information */}
                        <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-100/80 space-y-1.5 sm:col-span-2 lg:col-span-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Parent / Guardian Details</span>
                          <div className="flex items-center gap-2 font-bold text-slate-900 truncate" title={student.parentName}>
                            <Users size={13} className="text-emerald-600 shrink-0" />
                            <span className="truncate">Name: {student.parentName || 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-800 font-mono font-bold">
                            <Phone size={13} className="text-emerald-600 shrink-0" />
                            <span>Contact: {student.parentContact || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls */}
            {studentsTotal > 0 && (
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-semibold">
                <div>
                  Showing page <span className="font-bold text-slate-800">{studentPage}</span> of <span className="font-bold text-slate-800">{studentTotalPages}</span> ({studentsTotal} total registered candidates)
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (studentPage > 1) {
                        const newP = studentPage - 1;
                        setStudentPage(newP);
                        fetchRegisteredStudents(newP);
                      }
                    }}
                    disabled={studentPage <= 1 || studentsLoading}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (studentPage < studentTotalPages) {
                        const newP = studentPage + 1;
                        setStudentPage(newP);
                        fetchRegisteredStudents(newP);
                      }
                    }}
                    disabled={studentPage >= studentTotalPages || studentsLoading}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Candidate Detailed Profile Modal */}
          {selectedStudentDetail && createPortal(
            <div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
              onClick={() => setSelectedStudentDetail(null)}
            >
              <div
                className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150 my-6"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1c1f58] to-indigo-800 text-white font-black flex items-center justify-center text-lg shadow-sm">
                      {(selectedStudentDetail.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                        {selectedStudentDetail.name}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Official Registered Candidate Profile &bull; AI Quest 2026
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedStudentDetail(null)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Registration ID Banner */}
                <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 block">Registration ID</span>
                    <span className="font-mono font-black text-[#1c1f58] text-sm sm:text-base">{selectedStudentDetail.registrationId}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedStudentDetail.registrationId) {
                        navigator.clipboard.writeText(selectedStudentDetail.registrationId);
                        setCopiedCandidateId(selectedStudentDetail.registrationId);
                        setTimeout(() => setCopiedCandidateId(null), 1800);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedCandidateId === selectedStudentDetail.registrationId ? (
                      <>
                        <Check size={13} className="text-emerald-600" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copy ID</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Candidate Full Profile Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Candidate Name</span>
                    <span className="font-black text-slate-900 text-sm block mt-0.5">{selectedStudentDetail.name}</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Mobile Number</span>
                    <a
                      href={`tel:${selectedStudentDetail.mobileNo}`}
                      className="font-mono font-bold text-indigo-700 hover:underline flex items-center gap-1.5 mt-0.5 text-sm"
                    >
                      <Phone size={13} />
                      <span>{selectedStudentDetail.mobileNo}</span>
                    </a>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 sm:col-span-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Email Address</span>
                    <a
                      href={`mailto:${selectedStudentDetail.email}`}
                      className="font-semibold text-slate-900 hover:text-indigo-700 hover:underline flex items-center gap-1.5 mt-0.5 truncate"
                    >
                      <Mail size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate">{selectedStudentDetail.email}</span>
                    </a>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 sm:col-span-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">School / Institution</span>
                    <div className="flex items-start gap-1.5 mt-0.5">
                      <Building2 size={14} className="text-purple-600 shrink-0 mt-0.5" />
                      <span className="font-bold text-slate-900">{selectedStudentDetail.schoolName || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">City</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <MapPin size={13} className="text-rose-500 shrink-0" />
                      <span className="font-bold text-slate-900">{selectedStudentDetail.city || 'Dehradun'}</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Class &amp; Stream</span>
                    <div className="font-bold text-slate-900 mt-0.5">
                      <span>{selectedStudentDetail.studentClass || 'Class 12th'}</span>
                      {selectedStudentDetail.stream && (
                        <span className="text-slate-500 font-semibold block text-[11px] mt-0.5">
                          Stream: {selectedStudentDetail.stream}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Father's / Mother's Name</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Users size={13} className="text-emerald-600 shrink-0" />
                      <span className="font-bold text-slate-900">{selectedStudentDetail.parentName || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Mother's / Father's Mobile No</span>
                    <div className="flex items-center gap-1.5 mt-0.5 font-mono font-bold text-slate-900">
                      <Phone size={13} className="text-emerald-600 shrink-0" />
                      <span>{selectedStudentDetail.parentContact || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 sm:col-span-2 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Registration Timestamp</span>
                      <span className="font-medium text-slate-700 flex items-center gap-1.5 mt-0.5">
                        <Calendar size={13} className="text-slate-400" />
                        {formatRegistrationDate(selectedStudentDetail.createdAt)}
                      </span>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      <CheckCircle2 size={12} className="mr-1 text-emerald-600" />
                      Verified Record
                    </span>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      const detailsText = `AI QUEST 2026 CANDIDATE PROFILE:
Name: ${selectedStudentDetail.name}
Registration ID: ${selectedStudentDetail.registrationId}
Mobile: ${selectedStudentDetail.mobileNo}
Email: ${selectedStudentDetail.email}
City: ${selectedStudentDetail.city || 'Dehradun'}
School: ${selectedStudentDetail.schoolName || 'N/A'}
Class: ${selectedStudentDetail.studentClass || 'Class 12th'}
Stream: ${selectedStudentDetail.stream || 'Science'}
Parent Name: ${selectedStudentDetail.parentName || 'N/A'}
Parent Contact: ${selectedStudentDetail.parentContact || 'N/A'}`;
                      navigator.clipboard.writeText(detailsText);
                      alert('Candidate details copied to clipboard!');
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy size={13} />
                    <span>Copy Summary</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedStudentDetail(null)}
                    className="px-6 py-2 rounded-xl bg-[#1c1f58] hover:bg-[#252975] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>
      )}

      {/* 2. TAB: ACADEMIC STRUCTURE & HIERARCHY SETUP */}
      {activeTab === "academic-structure" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Building2 size={18} className="text-[#1c1f58]" />
                <span>Academic Hierarchy & Institutional Term Control</span>
              </h2>
              <p className="text-xs text-slate-500">Configure universities, departments, and active academic semesters (Odd / Even cycle)</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewUni({ name: "", code: "" });
                  setUniError("");
                  setIsAddUniModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
              >
                <Plus size={14} />
                <span>Add University</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewDept({ name: "", code: "", universityId: universities[0]?.id || "" });
                  setDeptError("");
                  setIsAddDeptModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#1c1f58] hover:bg-[#252975] text-white text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
              >
                <Plus size={14} />
                <span>Add Department</span>
              </button>
            </div>
          </div>

          {/* SECTION A: ACADEMIC TERM & SEMESTER CYCLE CONTROL */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-[#1c1f58]">
                  <Calendar size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Active Academic Examination Term</h3>
                  <p className="text-xs text-slate-500">Controls which semesters are currently active for subject catalogs and student test rooms</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{academicTerm.termLabel}</span>
                </span>
              </div>
            </div>

            {termSuccessMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold flex items-center justify-between">
                <span>{termSuccessMessage}</span>
                <button
                  type="button"
                  onClick={() => setTermSuccessMessage("")}
                  className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <form onSubmit={handleSaveAcademicTerm} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Academic Year <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={termForm.academicYear}
                    onChange={(e) => setTermForm({ ...termForm, academicYear: e.target.value })}
                    placeholder="e.g. 2026-2027"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Academic Cycle Preset <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setTermForm({ ...termForm, termType: "ODD", customSemesters: [1, 3, 5, 7] })}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        termForm.termType === "ODD"
                          ? "border-[#1c1f58] bg-[#1c1f58] text-white shadow-xs"
                          : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      Odd Sem (1, 3, 5, 7)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTermForm({ ...termForm, termType: "EVEN", customSemesters: [2, 4, 6, 8] })}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        termForm.termType === "EVEN"
                          ? "border-[#1c1f58] bg-[#1c1f58] text-white shadow-xs"
                          : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      Even Sem (2, 4, 6, 8)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTermForm({ ...termForm, termType: "ALL", customSemesters: [1, 2, 3, 4, 5, 6, 7, 8] })}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        termForm.termType === "ALL"
                          ? "border-[#1c1f58] bg-[#1c1f58] text-white shadow-xs"
                          : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      All Semesters (1 - 8)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTermForm({ ...termForm, termType: "CUSTOM" })}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        termForm.termType === "CUSTOM"
                          ? "border-[#1c1f58] bg-[#1c1f58] text-white shadow-xs"
                          : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      Custom Selection
                    </button>
                  </div>
                </div>
              </div>

              {/* Semester Toggles Grid */}
              <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Active Semesters in Selected Cycle:</span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {termForm.customSemesters.length} semesters active
                  </span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => {
                    const isActive = termForm.customSemesters.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          let next;
                          if (isActive) {
                            next = termForm.customSemesters.filter((x) => x !== s);
                          } else {
                            next = [...termForm.customSemesters, s].sort((a, b) => a - b);
                          }
                          setTermForm({
                            ...termForm,
                            termType: "CUSTOM",
                            customSemesters: next
                          });
                        }}
                        className={`py-2 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          isActive
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                            : "bg-white text-slate-400 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {isActive && <Check size={12} />}
                        <span>Sem {s}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={isUpdatingTerm || termForm.customSemesters.length === 0}
                  className="px-5 py-2 rounded-xl bg-[#1c1f58] hover:bg-[#252975] text-white text-xs font-bold transition-all shadow-2xs disabled:opacity-60 cursor-pointer flex items-center gap-1.5"
                >
                  {isUpdatingTerm ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Saving Academic Term...</span>
                    </>
                  ) : (
                    <span>Save & Apply Academic Term</span>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* SECTION B: UNIVERSITIES / INSTITUTES */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs space-y-4 p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Configured Universities & Campuses</h3>
                <p className="text-xs text-slate-500">Institution profiles and campus identifiers</p>
              </div>
              <span className="text-xs font-bold text-slate-400">{universities.length} Institutions</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">University Name</th>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Departments</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {universities.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-slate-400 font-semibold">
                        No universities configured. Click "Add University" to register one.
                      </td>
                    </tr>
                  ) : (
                    universities.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">{u.name}</td>
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-[#1c1f58] bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                            {u.code}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-700">{u.departmentCount || 0} Departments</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteUniversity(u.id, u.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete University"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION C: DEPARTMENTS */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs space-y-4 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Academic Departments</h3>
                <p className="text-xs text-slate-500">Departments dynamically populate subject creation and faculty rosters</p>
              </div>

              {universities.length > 1 && (
                <select
                  value={selectedUniFilter}
                  onChange={(e) => setSelectedUniFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
                >
                  <option value="ALL">All Universities</option>
                  {universities.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.code})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Department Name</th>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">University</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {departments
                    .filter((d) => selectedUniFilter === "ALL" || d.universityId === selectedUniFilter)
                    .map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">{d.name}</td>
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-[#1c1f58] bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                            {d.code}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-semibold">{d.universityName || d.universityCode}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteDepartment(d.id, d.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete Department"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. TAB: LIVE MONITOR (Systematic Hierarchical Surveillance) */}
      {activeTab === "live-monitor" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Activity size={18} className="text-emerald-600 animate-pulse" />
                <span>Systematic Live Assessment Proctor Monitor</span>
              </h2>
              <p className="text-xs text-slate-500">
                Hierarchical multi-campus surveillance: Filter ongoing examinations by University &rarr; Department &rarr; Semester &rarr; Section &rarr; Candidate.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchLiveMonitorData}
              disabled={loadingLiveMonitor}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            >
              <RefreshCw size={14} className={loadingLiveMonitor ? "animate-spin" : ""} />
              <span>Refresh Surveillance Pulse</span>
            </button>
          </div>

          {/* Stat Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Active Exams</div>
              <div className="text-2xl font-black text-[#1c1f58] mt-1">{liveMonitorData?.activeQuizzesCount || 0}</div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Active Test-Takers</div>
              <div className="text-2xl font-black text-emerald-600 mt-1">
                {liveMonitorData?.quizzes?.reduce((sum, q) => sum + (q.inProgressCount || 0), 0) || 0}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Locked Infractions</div>
              <div className="text-2xl font-black text-rose-600 mt-1">
                {liveMonitorData?.quizzes?.reduce((sum, q) => sum + (q.lockedCount || 0), 0) || 0}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Submissions Completed</div>
              <div className="text-2xl font-black text-indigo-600 mt-1">
                {liveMonitorData?.quizzes?.reduce((sum, q) => sum + (q.submittedCount || 0), 0) || 0}
              </div>
            </div>
          </div>

          {/* Systematic Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <div className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center justify-between">
              <span>Filter Hierarchy</span>
              {(liveUniFilter !== "ALL" || liveDeptFilter !== "ALL" || liveSemFilter !== "ALL" || liveSectionFilter !== "ALL" || liveStatusFilter !== "ALL" || liveCandidateSearch) && (
                <button
                  type="button"
                  onClick={() => {
                    setLiveUniFilter("ALL");
                    setLiveDeptFilter("ALL");
                    setLiveSemFilter("ALL");
                    setLiveSectionFilter("ALL");
                    setLiveStatusFilter("ALL");
                    setLiveCandidateSearch("");
                  }}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
                >
                  Clear All Filters
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
              {/* 1. University Filter */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">University</label>
                <select
                  value={liveUniFilter}
                  onChange={(e) => setLiveUniFilter(e.target.value)}
                  className="w-full text-xs font-semibold px-2 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1c1f58]"
                >
                  <option value="ALL">All Campuses</option>
                  {universities.map((u) => (
                    <option key={u.id} value={u.code || u.name}>{u.code || u.name}</option>
                  ))}
                </select>
              </div>

              {/* 2. Department Filter (Dynamic from DB) */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Department</label>
                <select
                  value={liveDeptFilter}
                  onChange={(e) => setLiveDeptFilter(e.target.value)}
                  className="w-full text-xs font-semibold px-2 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1c1f58]"
                >
                  <option value="ALL">All Depts</option>
                  {(() => {
                    const selectedUni = universities.find(
                      (u) => u.code === liveUniFilter || u.name === liveUniFilter
                    );
                    const filteredDepts = departments.filter((d) => {
                      if (liveUniFilter === "ALL" || !selectedUni) return true;
                      return d.universityId === selectedUni.id;
                    });

                    // If DB departments exist, show them dynamically
                    if (filteredDepts.length > 0) {
                      return filteredDepts.map((d) => (
                        <option key={d.id} value={d.code}>
                          {d.code} - {d.name}
                        </option>
                      ));
                    }

                    // Otherwise show unique departments extracted from active quizzes
                    const quizDepts = Array.from(
                      new Set((liveMonitorData?.quizzes || []).map((q) => q.department).filter(Boolean))
                    );
                    return quizDepts.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ));
                  })()}
                </select>
              </div>

              {/* 3. Semester Filter (Dynamic Odd / Even Active Cycle) */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Semester ({academicTerm?.termType === "ODD" ? "Odd Cycle" : academicTerm?.termType === "EVEN" ? "Even Cycle" : "Active"})
                </label>
                <select
                  value={liveSemFilter}
                  onChange={(e) => setLiveSemFilter(e.target.value)}
                  className="w-full text-xs font-semibold px-2 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1c1f58]"
                >
                  <option value="ALL">
                    All Active ({academicTerm?.termType || "Term"} Semesters)
                  </option>
                  {(Array.isArray(activeSemesters) && activeSemesters.length > 0
                    ? activeSemesters
                    : academicTerm?.termType === "EVEN"
                      ? [2, 4, 6, 8]
                      : [1, 3, 5, 7]
                  ).map((s) => (
                    <option key={s} value={s}>
                      Semester {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Section Filter (Dynamic from active test sessions & registered student cohorts) */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Section</label>
                <select
                  value={liveSectionFilter}
                  onChange={(e) => setLiveSectionFilter(e.target.value)}
                  className="w-full text-xs font-semibold px-2 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1c1f58]"
                >
                  <option value="ALL">All Sections</option>
                  {(() => {
                    const distinctSecs = Array.from(
                      new Set([
                        ...(liveMonitorData?.quizzes || []).flatMap((q) => [
                          ...(Array.isArray(q.targetSections) ? q.targetSections.filter((s) => s !== "ALL") : []),
                          ...(q.inProgressStudents || []).map((s) => s.section),
                          ...(q.lockedStudents || []).map((s) => s.section)
                        ])
                      ])
                    ).filter((s) => s && s !== "N/A" && s !== "ALL").sort();

                    const sectionsToShow = distinctSecs.length > 0
                      ? distinctSecs
                      : ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J1", "J2"];

                    return sectionsToShow.map((sec) => (
                      <option key={sec} value={sec}>
                        Section {sec}
                      </option>
                    ));
                  })()}
                </select>
              </div>

              {/* 5. Status Filter */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Status</label>
                <select
                  value={liveStatusFilter}
                  onChange={(e) => setLiveStatusFilter(e.target.value)}
                  className="w-full text-xs font-semibold px-2 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1c1f58]"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="IN_PROGRESS">In-Progress</option>
                  <option value="LOCKED">Frozen / Locked</option>
                </select>
              </div>

              {/* 6. Candidate Search */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Search Student</label>
                <div className="relative">
                  <input
                    type="text"
                    value={liveCandidateSearch}
                    onChange={(e) => setLiveCandidateSearch(e.target.value)}
                    placeholder="Name, Roll No..."
                    className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1c1f58]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Message Banner */}
          {candidateActionMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{candidateActionMsg}</span>
            </div>
          )}

          {/* Filtered Quizzes & Live Candidate Roster */}
          {liveMonitorData?.quizzes?.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Activity size={24} />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Assessments Currently Active</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No live exams are currently running or taking candidate responses. All exams are either completed or un-published.
              </p>
            </div>
          ) : (
            (() => {
              const filteredQuizzes = liveMonitorData.quizzes.filter((lq) => {
                if (liveUniFilter !== "ALL" && lq.universityCode !== liveUniFilter && lq.universityName !== liveUniFilter) return false;
                if (liveDeptFilter !== "ALL" && lq.department !== liveDeptFilter) return false;
                if (liveSemFilter !== "ALL" && String(lq.semester) !== String(liveSemFilter)) return false;
                return true;
              });

              if (filteredQuizzes.length === 0) {
                return (
                  <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
                    <h3 className="text-sm font-bold text-slate-800">No Active Exams Match Filters</h3>
                    <p className="text-xs text-slate-400">Try adjusting your University, Department, or Semester selection.</p>
                  </div>
                );
              }

              return filteredQuizzes.map((lq) => {
                const filterCandidate = (st) => {
                  if (liveSectionFilter !== "ALL" && st.section !== liveSectionFilter) return false;
                  if (liveStatusFilter !== "ALL" && st.status !== liveStatusFilter) return false;
                  if (liveCandidateSearch) {
                    const q = liveCandidateSearch.toLowerCase();
                    const nameMatch = st.name?.toLowerCase().includes(q);
                    const rollMatch = st.rollNo?.toLowerCase().includes(q);
                    if (!nameMatch && !rollMatch) return false;
                  }
                  return true;
                };

                const visibleInProgress = (lq.inProgressStudents || []).filter(filterCandidate);
                const visibleLocked = (lq.lockedStudents || []).filter(filterCandidate);

                return (
                  <div key={lq.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs space-y-4 p-5">
                    {/* Quiz Top Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            LIVE NOW
                          </span>
                          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {lq.courseCode}
                          </span>
                          <span className="text-xs font-bold text-slate-600">
                            {lq.department} &bull; Sem {lq.semester}
                          </span>
                          <span className="text-xs font-semibold text-slate-400">
                            {lq.universityCode || "GEU"} &bull; {lq.durationMinutes} mins
                          </span>
                        </div>
                        <h3 className="text-sm font-extrabold text-slate-900 mt-1">{lq.title}</h3>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFreezeTargetQuiz(lq);
                            setIsFreezeModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer"
                        >
                          <Lock size={13} />
                          <span>Emergency Freeze</span>
                        </button>
                      </div>
                    </div>

                    {/* Active Candidates */}
                    <div>
                      <div className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>Active Candidates ({visibleInProgress.length})</span>
                      </div>
                      {visibleInProgress.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No matching in-progress candidates.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {visibleInProgress.map((st) => (
                            <div key={st.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-bold text-slate-900 text-xs">{st.name}</div>
                                  <div className="text-[10px] text-slate-500 font-mono">{st.rollNo}</div>
                                  <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                    Sec {st.section} &bull; Sem {st.semester}
                                  </div>
                                </div>

                                {/* Dynamic Tab Violation Counter Badge */}
                                <div>
                                  {st.tabViolations > 0 ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                                      {st.tabViolations} {st.tabViolations === 1 ? 'Switch' : 'Switches'}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      0 Violations
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                                <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Session Active
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={processingCandidateId === st.id}
                                    onClick={() => handleLockCandidate(st.id, st.name)}
                                    className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-[11px] font-bold shadow-2xs cursor-pointer transition-colors flex items-center gap-1"
                                    title="Lock candidate session"
                                  >
                                    <Lock size={12} />
                                    <span>Lock</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setResetTargetSubmission({
                                        id: st.id,
                                        studentName: st.name,
                                        studentRollNo: st.rollNo,
                                        quizTitle: lq.title
                                      });
                                      setIsResetModalOpen(true);
                                    }}
                                    className="px-2 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-[11px] font-bold shadow-2xs cursor-pointer transition-colors"
                                  >
                                    Reset
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Locked Candidates in this Quiz */}
                    {visibleLocked.length > 0 && (
                      <div className="pt-2">
                        <div className="text-xs font-black text-rose-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Lock size={13} />
                          <span>Locked / Frozen Candidates ({visibleLocked.length})</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {visibleLocked.map((st) => (
                            <div key={st.id} className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/60 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-bold text-slate-900 text-xs">{st.name}</div>
                                  <div className="text-[10px] text-slate-500 font-mono">{st.rollNo}</div>
                                  <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                                    Sec {st.section} &bull; Sem {st.semester}
                                  </div>
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                  {st.tabViolations} Switches &bull; FROZEN
                                </span>
                              </div>

                              <div className="text-[10px] text-rose-700 font-semibold truncate" title={st.lockReason}>
                                {st.lockReason || 'Exceeded tab-switch threshold'}
                              </div>

                              <div className="pt-1 border-t border-rose-200 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-rose-700 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping" />
                                  Screen Frozen
                                </span>
                                <button
                                  type="button"
                                  disabled={processingCandidateId === st.id}
                                  onClick={() => handleUnlockCandidate(st.id, st.name)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-2xs cursor-pointer transition-colors flex items-center gap-1"
                                >
                                  <Unlock size={12} />
                                  <span>Unlock & Resume</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              });
            })()
          )}
        </div>
      )}

      {/* TAB: PROCTORING RULES & GOVERNANCE */}
      {activeTab === "proctoring-rules" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-50 text-[#1c1f58] border border-indigo-100">
                  <ShieldAlert size={18} />
                </span>
                <h2 className="text-base font-black text-slate-900">
                  Assessment Proctoring Rules & Security Governance
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Configure automated integrity enforcement, tab switch limits, lockdown protocols, and live candidate unlock authorization.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  fetchProctoringRules();
                  fetchLiveMonitorData();
                }}
                disabled={loadingProctoringRules}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
              >
                <RefreshCw size={13} className={loadingProctoringRules ? "animate-spin" : ""} />
                <span>Reload Policies</span>
              </button>

              <button
                type="button"
                onClick={handleSaveProctoringRules}
                disabled={savingProctoringRules}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1c1f58] hover:bg-[#131540] text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer"
              >
                {savingProctoringRules ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                <span>Save & Deploy Policies</span>
              </button>
            </div>
          </div>

          {/* Feedback Banners */}
          {proctoringSaveMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                {proctoringSaveMsg}
              </span>
              <button onClick={() => setProctoringSaveMsg("")} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
                <X size={14} />
              </button>
            </div>
          )}

          {proctoringSaveError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                {proctoringSaveError}
              </span>
              <button onClick={() => setProctoringSaveError("")} className="text-rose-700 hover:text-rose-900 cursor-pointer">
                <X size={14} />
              </button>
            </div>
          )}

          {candidateActionMsg && (
            <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-indigo-600 shrink-0" />
                {candidateActionMsg}
              </span>
              <button onClick={() => setCandidateActionMsg("")} className="text-indigo-700 hover:text-indigo-900 cursor-pointer">
                <X size={14} />
              </button>
            </div>
          )}

          {/* 4-Policy Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Card 1: Tab-Switch Violation & Focus Policy */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1c1f58] flex items-center justify-center font-bold text-xs">
                    01
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Focus Loss & Tab-Switch Policy
                    </h3>
                    <p className="text-[11px] text-slate-400">Enforcement threshold for backgrounding exam window</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-50 text-[#1c1f58] border border-blue-100">
                  Automated
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-extrabold text-slate-700 block mb-1.5">
                    Permitted Tab Switches Before Action:
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((num) => {
                      const isSelected = Number(proctoringRules.maxTabSwitches) === num;
                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setProctoringRules({ ...proctoringRules, maxTabSwitches: num })}
                          className={`py-2 px-1 text-center rounded-xl text-xs font-black transition-all cursor-pointer border ${
                            isSelected
                              ? "bg-[#1c1f58] text-white border-[#1c1f58] shadow-sm"
                              : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {num} {num === 1 ? "Switch" : "Switches"}
                        </button>
                      );
                    })}
                  </div>

                  {/* Dynamic Custom Numeric Input */}
                  <div className="mt-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-800">Or Custom Switch Threshold:</div>
                      <div className="text-[10px] text-slate-400">Enter any custom switch limit (e.g. 6, 8, 10 switches)</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={proctoringRules.maxTabSwitches || 3}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val >= 1) {
                            setProctoringRules({ ...proctoringRules, maxTabSwitches: val });
                          }
                        }}
                        className="w-20 px-2.5 py-1 text-xs font-black text-center rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1c1f58] shadow-2xs"
                      />
                      <span className="text-xs font-bold text-slate-500">Switches</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 mt-1">
                    Candidate receives warnings on earlier switches. Reaching this count triggers the penalty action below.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-700 block mb-1.5">
                    Violation Enforcement Action (Penalty):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setProctoringRules({ ...proctoringRules, violationAction: "AUTO_LOCK" })}
                      className={`p-3 text-left rounded-xl border transition-all cursor-pointer ${
                        proctoringRules.violationAction === "AUTO_LOCK"
                          ? "bg-amber-50/60 border-amber-300 ring-1 ring-amber-300"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Lock size={14} className="text-amber-800" />
                        <span className="text-xs font-black text-slate-900">Auto-Lock Session</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                        Recommended: Freezes screen. Invigilator must review & authorize unlock before candidate can continue.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setProctoringRules({ ...proctoringRules, violationAction: "AUTO_SUBMIT" })}
                      className={`p-3 text-left rounded-xl border transition-all cursor-pointer ${
                        proctoringRules.violationAction === "AUTO_SUBMIT"
                          ? "bg-rose-50/60 border-rose-300 ring-1 ring-rose-300"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-rose-700" />
                        <span className="text-xs font-black text-slate-900">Auto-Submit Test</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                        Immediate termination: Exam auto-submits current answers. Candidate cannot re-enter without manual retake grant.
                      </p>
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-800">Show Warning Dialog on Each Switch</div>
                    <div className="text-[10px] text-slate-400">Presents an acknowledgment modal to candidate on infraction</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(proctoringRules.showWarningModal)}
                    onChange={(e) => setProctoringRules({ ...proctoringRules, showWarningModal: e.target.checked })}
                    className="w-4 h-4 rounded text-[#1c1f58] focus:ring-[#1c1f58] cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Environment & Lockdown Protocols */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold text-xs">
                    02
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Browser Lockdown & Integrity
                    </h3>
                    <p className="text-[11px] text-slate-400">Prevent external resources, copy/paste, and inspecting</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Client Sandbox
                </span>
              </div>

              <div className="space-y-3.5">
                <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div>
                    <div className="text-xs font-bold text-slate-800">Enforce Fullscreen Examination</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Candidate must stay in fullscreen. Exiting fullscreen mode increments tab-switch violation counter.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(proctoringRules.enforceFullscreen)}
                    onChange={(e) => setProctoringRules({ ...proctoringRules, enforceFullscreen: e.target.checked })}
                    className="w-4 h-4 rounded text-[#1c1f58] focus:ring-[#1c1f58] cursor-pointer mt-0.5"
                  />
                </div>

                <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div>
                    <div className="text-xs font-bold text-slate-800">Disable Clipboard & Right-Click Context Menu</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Blocks Copy, Cut, Paste, Text Selection, and Right-Click to prevent copying questions or pasting AI outputs.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(proctoringRules.disableClipboard)}
                    onChange={(e) => setProctoringRules({ ...proctoringRules, disableClipboard: e.target.checked })}
                    className="w-4 h-4 rounded text-[#1c1f58] focus:ring-[#1c1f58] cursor-pointer mt-0.5"
                  />
                </div>

                <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div>
                    <div className="text-xs font-bold text-slate-800">Screenshot Prevention & Forensic Watermarking</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Intercepts PrintScreen and screen-grab shortcuts, blanks clipboard, suppresses printing via CSS, and renders candidate Roll No & timestamp watermark across the exam canvas.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(proctoringRules.preventScreenshots)}
                    onChange={(e) => setProctoringRules({ ...proctoringRules, preventScreenshots: e.target.checked })}
                    className="w-4 h-4 rounded text-[#1c1f58] focus:ring-[#1c1f58] cursor-pointer mt-0.5"
                  />
                </div>

                <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div>
                    <div className="text-xs font-bold text-slate-800">Anti-Bypass Extension & Triple-Vector Focus Guard</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Combines visibilitychange, OS-level window blur, and periodic focus heartbeats to defeat Chrome extensions (like 'Always Active') that spoof document.hidden.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(proctoringRules.detectExtensions)}
                    onChange={(e) => setProctoringRules({ ...proctoringRules, detectExtensions: e.target.checked })}
                    className="w-4 h-4 rounded text-[#1c1f58] focus:ring-[#1c1f58] cursor-pointer mt-0.5"
                  />
                </div>

                <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[#1c1f58]">Developer Tools & Keyboard Shortcuts</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      F12, Ctrl+Shift+I, Ctrl+U (View Source), Ctrl+P, Alt+Tab automatically intercepted & suppressed.
                    </div>
                  </div>
                  <span className="text-[10px] font-black bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full border border-indigo-200">
                    Always Active
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Session Interruption & Grace Period */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-800 flex items-center justify-center font-bold text-xs">
                    03
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Network Interruption & Grace Window
                    </h3>
                    <p className="text-[11px] text-slate-400">Wi-Fi disconnect & accidental reload fault tolerance</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-50 text-purple-700 border border-purple-200">
                  Resilience
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-extrabold text-slate-700 block mb-1.5">
                    Permitted Reconnect Grace Window:
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[5, 10, 15, 20].map((mins) => {
                      const isSelected = Number(proctoringRules.reconnectGraceMin) === mins;
                      return (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setProctoringRules({ ...proctoringRules, reconnectGraceMin: mins })}
                          className={`py-2 px-1 text-center rounded-xl text-xs font-black transition-all cursor-pointer border ${
                            isSelected
                              ? "bg-[#1c1f58] text-white border-[#1c1f58] shadow-sm"
                              : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {mins} Mins
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    If power or university Wi-Fi drops, candidate can reconnect within this grace window without timer loss or progress deletion.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 4: Campus Network & Subnet Security */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center font-bold text-xs">
                    04
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Campus Lab Network & Subnet Security
                    </h3>
                    <p className="text-[11px] text-slate-400">Confine assessment to official Graphic Era computer labs</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-50 text-amber-800 border border-amber-200">
                  Enterprise
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div>
                    <div className="text-xs font-bold text-slate-800">Enforce Campus Lab IP Whitelist</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Restricts examination attempts exclusively to requests originating from verified institutional subnets.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(proctoringRules.ipRestrictionEnabled)}
                    onChange={(e) => setProctoringRules({ ...proctoringRules, ipRestrictionEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-[#1c1f58] focus:ring-[#1c1f58] cursor-pointer mt-0.5"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Allowed Subnet IP Patterns (Comma separated):
                  </label>
                  <input
                    type="text"
                    disabled={!proctoringRules.ipRestrictionEnabled}
                    value={proctoringRules.allowedSubnets || ""}
                    onChange={(e) => setProctoringRules({ ...proctoringRules, allowedSubnets: e.target.value })}
                    placeholder="e.g. 172.16.*, 10.0.*"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1c1f58] disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Prefix patterns matching internal Graphic Era Computer Lab LANs and Wi-Fi gateways.
                  </p>
                </div>

                {/* Educational Explainer Note */}
                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-amber-900">
                    <ShieldAlert size={14} className="text-amber-700" />
                    <span>How Subnet Security Works & Best Practices</span>
                  </div>
                  <p className="text-[11px] text-amber-900/90 leading-relaxed">
                    <strong>Purpose:</strong> Ensures exams can ONLY be taken from official university computer labs. Candidates trying to open the exam from hostels, home Wi-Fi, or mobile 5G hotspots will be blocked with an IP Unauthorized error.
                  </p>
                  <p className="text-[11px] text-amber-900/90 leading-relaxed">
                    <strong>Guidelines:</strong> Keep this <em>Disabled</em> for home assignments or remote quizzes. Enable it <em>Only</em> during official computer lab exams once the lab subnet prefix (e.g. <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[10px]">172.16.*</code>) is confirmed with the network administrator.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Card: Live Candidate Lockout & Session Recovery Console */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Lock size={14} className="text-rose-700" />
                  <span>Live Locked Sessions & Candidate Recovery Console</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Candidates currently frozen due to automated integrity thresholds or manual proctor freeze.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchLiveMonitorData}
                  disabled={loadingLiveMonitor}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  <RefreshCw size={13} className={loadingLiveMonitor ? "animate-spin" : ""} />
                  <span>Scan Active Sessions</span>
                </button>
              </div>
            </div>

            {/* Locked Candidates Table */}
            {(() => {
              const allLocked = [];
              liveMonitorData?.quizzes?.forEach((q) => {
                q.lockedStudents?.forEach((ls) => {
                  allLocked.push({
                    id: ls.id,
                    studentName: ls.name,
                    studentRollNo: ls.rollNo,
                    quizId: q.id,
                    quizTitle: q.title,
                    courseCode: q.courseCode,
                    startedAt: ls.startedAt
                  });
                });
              });

              if (allLocked.length === 0) {
                return (
                  <div className="p-8 rounded-2xl bg-slate-50/70 border border-slate-200 text-center space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto">
                      <ShieldCheck size={20} />
                    </div>
                    <div className="text-xs font-bold text-slate-800">
                      No Active Candidate Lockouts
                    </div>
                    <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                      All candidates currently attempting active assessments are within authorized integrity thresholds. If a candidate triggers excessive tab switches or is manually frozen, they will appear here for one-click authorization.
                    </p>
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto border border-rose-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-rose-50/80 text-rose-950 font-black border-b border-rose-200 text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Candidate</th>
                        <th className="py-2.5 px-3">University ID / Roll No</th>
                        <th className="py-2.5 px-3">Assessment Title</th>
                        <th className="py-2.5 px-3">Course</th>
                        <th className="py-2.5 px-3">Integrity Status</th>
                        <th className="py-2.5 px-3 text-right">Recovery Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-100">
                      {allLocked.map((cand) => (
                        <tr key={cand.id} className="hover:bg-rose-50/40 transition-colors">
                          <td className="py-3 px-3 font-bold text-slate-900">{cand.studentName}</td>
                          <td className="py-3 px-3 font-mono text-slate-600">{cand.studentRollNo}</td>
                          <td className="py-3 px-3 font-medium text-slate-800">{cand.quizTitle}</td>
                          <td className="py-3 px-3 font-mono text-slate-600">{cand.courseCode}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                              SESSION FROZEN
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right space-x-1.5">
                            <button
                              type="button"
                              disabled={processingCandidateId === cand.id}
                              onClick={() => handleUnlockCandidate(cand.id, cand.studentName)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                            >
                              {processingCandidateId === cand.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Unlock size={12} />
                              )}
                              <span>Unlock & Resume</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setResetTargetSubmission({
                                  id: cand.id,
                                  studentName: cand.studentName,
                                  studentRollNo: cand.studentRollNo,
                                  quizTitle: cand.quizTitle
                                });
                                setIsResetModalOpen(true);
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                            >
                              Reset Attempt
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 4. TAB: SUBJECTS / COURSES */}
      {activeTab === "courses" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900">University Subject Catalog</h2>
              <p className="text-xs text-slate-500">
                Configure subjects for active semester cycle ({academicTerm.termLabel})
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  placeholder="Search code or title..."
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1c1f58] bg-white w-44 sm:w-52"
                />
              </div>

              {/* Dynamic Active Semesters Filter */}
              <select
                value={courseSemesterFilter}
                onChange={(e) => setCourseSemesterFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white"
              >
                <option value="ALL">All Active Semesters</option>
                {activeSemesters.map((s) => (
                  <option key={s} value={s}>
                    Semester {s} ({courseCountsBySemester[s] || 0})
                  </option>
                ))}
              </select>

              {courses.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsDeleteAllCoursesModalOpen(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                  title="Wipe all subject records"
                >
                  <Trash2 size={13} />
                  <span>Delete All</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setBulkCsvText("");
                  setBulkImportMessage("");
                  setIsBulkImportModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                <FileSpreadsheet size={14} />
                <span>Bulk CSV Import</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCourseActionError("");
                  setCourseActionSuccess("");
                  setIsAddCourseModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#1c1f58] hover:bg-[#252975] text-white text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
              >
                <Plus size={14} />
                <span>Add Subject</span>
              </button>
            </div>
          </div>

          {courseActionSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold flex items-center justify-between">
              <span>{courseActionSuccess}</span>
              <button
                type="button"
                onClick={() => setCourseActionSuccess("")}
                className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Subject Code</th>
                    <th className="py-3 px-4">Subject Title</th>
                    <th className="py-3 px-4">Semester</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredCourses.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-slate-400 font-semibold">
                        No subjects found matching current filter. Click "Add Subject" or "Bulk CSV Import" to add one.
                      </td>
                    </tr>
                  ) : (
                    filteredCourses.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-[#1c1f58] bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                            {c.code}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">{c.title}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            Semester {c.semester}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">{c.department || "CSE"}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteCourse(c.id, c.code, c.title)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete subject"
                          >
                            <Trash2 size={14} />
                          </button>
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

      {/* 5. TAB: SUBMISSIONS */}
      {activeTab === "submissions" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900">Student Submissions & Scorecards</h2>
              <p className="text-xs text-slate-500">View evaluations, student scores, and unlock candidate attempts</p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={submissionSearch}
                  onChange={(e) => setSubmissionSearch(e.target.value)}
                  placeholder="Search roll, name, or quiz..."
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1c1f58] bg-white w-48 sm:w-56"
                />
              </div>

              {submissions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsDeleteAllSubmissionsModalOpen(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                  title="Wipe all submission evaluations"
                >
                  <Trash2 size={13} />
                  <span>Delete All</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleExportLedgerCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
              >
                <Download size={14} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Assessment</th>
                    <th className="py-3 px-4">Faculty Author</th>
                    <th className="py-3 px-4">Score</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Submitted</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-8 text-center text-slate-400 font-semibold">
                        No submissions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    filteredSubmissions.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{s.studentName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{s.studentRollNo}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800">{s.quizTitle}</div>
                          <div className="text-[10px] text-indigo-600 font-mono">{s.courseCode}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{s.facultyName}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {s.score} / {s.totalMarks} ({s.percentage}%)
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              s.isPassed
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {s.isPassed ? "PASSED" : "FAILED"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : "-"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setResetTargetSubmission(s);
                                setIsResetModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                              title="Unlock / Reset attempt for student"
                            >
                              <RotateCcw size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSingleSubmission(s.id)}
                              disabled={isDeletingSubmissionId === s.id}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete submission record"
                            >
                              {isDeletingSubmissionId === s.id ? (
                                <Loader2 size={14} className="animate-spin text-rose-600" />
                              ) : (
                                <Trash2 size={14} />
                              )}
                            </button>
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

      {/* 6. TAB: FACULTIES */}
      {activeTab === "faculties" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900">Faculty Academic Creators</h2>
              <p className="text-xs text-slate-500">Summary of assessment creators across departments</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {facultyBreakdown.map((f) => (
              <div key={f.facultyId} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-extrabold text-sm text-slate-900">{f.facultyName}</div>
                  <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                    {f.facultyUniversityId}
                  </span>
                </div>
                <div className="text-xs text-slate-500">{f.facultyEmail}</div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600">
                  <span>Assessments Created</span>
                  <span className="text-[#1c1f58] font-black">{f.quizzesCount}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. TAB: NAAC / NBA ACCREDITATION AUDIT */}
      {activeTab === "accreditation" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Award size={18} className="text-[#1c1f58]" />
                <span>NAAC & NBA Institutional Accreditation Summary Ledger</span>
              </h2>
              <p className="text-xs text-slate-500">Official semester-wise outcome assessment ledger for departmental reviews and audits</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportAccreditationCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
              >
                <Download size={14} />
                <span>Export CSV Ledger</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1c1f58] hover:bg-[#252975] text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                <Printer size={14} />
                <span>Print / PDF Audit Report</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Sem</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Course Code & Title</th>
                    <th className="py-3 px-4 text-center">Assessments</th>
                    <th className="py-3 px-4 text-center">Evaluated</th>
                    <th className="py-3 px-4 text-center">Passed</th>
                    <th className="py-3 px-4 text-center">Failed</th>
                    <th className="py-3 px-4 text-center">Avg Marks</th>
                    <th className="py-3 px-4 text-center">Pass Rate</th>
                    <th className="py-3 px-4 text-center">NAAC Dossier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {accreditationReport.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="py-8 text-center text-slate-400 font-semibold">
                        No courses recorded for accreditation audit.
                      </td>
                    </tr>
                  ) : (
                    accreditationReport.map((row, idx) => (
                      <tr
                        key={idx}
                        onClick={() => handleOpenCourseAccreditation(row.courseId || row.courseCode)}
                        className="hover:bg-indigo-50/50 transition-colors cursor-pointer group"
                        title="Click to inspect in-depth NAAC course accreditation dossier & student marks ledger"
                      >
                        <td className="py-3 px-4 font-bold text-[#1c1f58]">Sem {row.semester}</td>
                        <td className="py-3 px-4 text-slate-600 font-semibold">{row.department}</td>
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {row.courseCode}
                          </span>{" "}
                          - {row.courseTitle}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-700">{row.totalAssessments}</td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800">{row.totalEvaluated}</td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-700">{row.passedCount}</td>
                        <td className="py-3 px-4 text-center font-bold text-rose-700">{row.failedCount}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">{row.averageScore}</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              row.passPercentage >= 60
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {row.passPercentage}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenCourseAccreditation(row.courseId || row.courseCode);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-[#1c1f58] bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors shadow-2xs group-hover:bg-[#1c1f58] group-hover:text-white"
                          >
                            <span>Inspect</span>
                            <ChevronRight size={13} />
                          </button>
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

      {/* 8. TAB: AUDIT TRAIL */}
      {activeTab === "audit-logs" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Shield size={18} className="text-[#1c1f58]" />
                <span>Institutional System Audit Trail</span>
              </h2>
              <p className="text-xs text-slate-500">Immutable timestamped audit log of administrative and evaluation actions</p>
            </div>
            <button
              type="button"
              onClick={fetchAuditLogs}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            >
              <RefreshCw size={14} className={loadingAuditLogs ? "animate-spin" : ""} />
              <span>Refresh Logs</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Admin</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Target</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-slate-400 font-semibold">
                        No administrative actions logged yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : "-"}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">{log.adminName}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 uppercase text-[10px] font-bold whitespace-nowrap">{log.targetType}</td>
                        <td className="py-3 px-4 text-slate-800 font-semibold max-w-md">{log.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 10. TAB: QUESTION VAULT (Super Control Panel Central Bank) */}
      {activeTab === "question-vault" && (
        <QuestionVaultView isSuperAdmin={true} user={user} />
      )}

      {/* 9. TAB: ALL QUIZZES (Default) */}
      {(activeTab === "quizzes" || (!["students", "courses", "submissions", "faculties", "live-monitor", "proctoring-rules", "accreditation", "audit-logs", "academic-structure", "question-vault"].includes(activeTab))) && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-black text-slate-900">All Created Quizzes</h2>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={quizSearch}
                  onChange={(e) => setQuizSearch(e.target.value)}
                  placeholder="Search quiz, faculty, or course..."
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1c1f58] bg-white w-48 sm:w-56"
                />
              </div>

              <select
                value={facultyFilter}
                onChange={(e) => setFacultyFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">All Faculties</option>
                {uniqueFaculties.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>

              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
              >
                <option value="ALL">All Courses</option>
                {uniqueCourses.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredQuizzes.map((q) => (
              <div
                key={q.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {q.course?.code || "CSE"}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                      <Clock size={13} />
                      {q.durationMinutes} mins
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 group-hover:text-[#1c1f58] transition-colors line-clamp-1">
                      {q.title}
                    </h3>
                    <div className="text-[11px] text-purple-700 font-bold mt-0.5">
                      Author: {q.creator?.name || "Faculty"}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2 text-[11px] font-semibold text-slate-500 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400">Questions: </span>
                      <span className="font-bold text-slate-800">{q.questionCount}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Total: </span>
                      <span className="font-bold text-slate-800">{q.totalMarks} Marks</span>
                    </div>
                  </div>

                  {/* Super Admin Action Strip */}
                  <div className="pt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleOpenRegradeModal(q)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold transition-colors cursor-pointer"
                      title="Key Correction & Auto-Regrade"
                    >
                      <Sliders size={11} />
                      <span>Key Regrade</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenBonusModal(q)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700 text-[10px] font-bold transition-colors cursor-pointer"
                      title="Inject Bonus Marks"
                    >
                      <Sparkles size={11} />
                      <span>Bonus Marks</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFreezeTargetQuiz(q);
                        setIsFreezeModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold transition-colors cursor-pointer"
                      title="Emergency Freeze / Force Submit"
                    >
                      <Lock size={11} />
                      <span>Freeze Exam</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => navigate(`/quiz/${q.id}/results`)}
                    className="flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 transition-colors cursor-pointer"
                  >
                    <span>Leaderboard ({q.submissionCount})</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => navigate(`/quiz/${q.id}/take`)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                      title="Inspect Assessment"
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
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: STUDENT SESSION UNLOCK / RESET                   */}
      {/* ========================================================= */}
      {isResetModalOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center cursor-pointer"
          onClick={() => setIsResetModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 max-w-md w-full my-auto p-6 shadow-2xl space-y-4 animate-scale-up cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                  <RotateCcw size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Unlock Student Session</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Session Recovery & Attempt Reset</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
              <div className="font-bold text-slate-900">{resetTargetSubmission?.studentName}</div>
              <div className="text-slate-500 font-mono text-[11px]">Roll: {resetTargetSubmission?.studentRollNo}</div>
              <div className="text-indigo-600 text-[11px] font-semibold">{resetTargetSubmission?.quizTitle}</div>
            </div>

            <div className="space-y-2 text-xs font-medium text-slate-700">
              <label
                className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-colors ${
                  resetActionType === "resume" ? "border-[#1c1f58] bg-indigo-50/50" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="resetActionType"
                  value="resume"
                  checked={resetActionType === "resume"}
                  onChange={() => setResetActionType("resume")}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-bold text-slate-900">Resume Session (Preserve Answers)</div>
                  <div className="text-slate-500 text-[11px] mt-0.5">
                    Recommended for PC crash / power outage. Sets status to In-Progress without wiping answered questions.
                  </div>
                </div>
              </label>

              <label
                className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-colors ${
                  resetActionType === "retake" ? "border-rose-600 bg-rose-50/50" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="resetActionType"
                  value="retake"
                  checked={resetActionType === "retake"}
                  onChange={() => setResetActionType("retake")}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-bold text-rose-900">Reset Answers (Preserve Active Timer)</div>
                  <div className="text-slate-500 text-[11px] mt-0.5">
                    Clears candidate selected answers so they can re-attempt questions. Active countdown timer is NOT reset.
                  </div>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                disabled={isResettingSubmission}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResetSubmission}
                disabled={isResettingSubmission}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1c1f58] hover:bg-[#252975] text-white text-xs font-black transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isResettingSubmission ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>Confirm Session Unlock</span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL 2: EMERGENCY GLOBAL FREEZE                          */}
      {/* ========================================================= */}
      {isFreezeModalOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center cursor-pointer"
          onClick={() => setIsFreezeModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 max-w-md w-full my-auto p-6 shadow-2xl space-y-4 animate-scale-up cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700">
                  <Lock size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-rose-950">Emergency Assessment Freeze</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Global Real-time Intervention</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFreezeModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3.5 bg-rose-50/70 border border-rose-200/60 rounded-xl text-rose-900 text-xs font-semibold leading-relaxed">
              Are you sure you want to trigger emergency freeze for <span className="font-black text-rose-950">{freezeTargetQuiz?.title}</span>?
              Active in-progress student sessions will be auto-submitted immediately and the exam will be closed.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsFreezeModalOpen(false)}
                disabled={isFreezingQuiz}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmToggleFreeze}
                disabled={isFreezingQuiz}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isFreezingQuiz ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Applying Freeze...</span>
                  </>
                ) : (
                  <span>Execute Emergency Freeze</span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL 3: KEY CORRECTION & AUTO-REGRADING                  */}
      {/* ========================================================= */}
      {isRegradeModalOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center cursor-pointer"
          onClick={() => setIsRegradeModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full my-auto p-6 shadow-2xl space-y-4 animate-scale-up cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                  <Sliders size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Key Correction & Auto-Regrading</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Automatic gradebook re-evaluation across all candidates</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRegradeModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {regradeMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold">
                {regradeMessage}
              </div>
            )}

            {loadingRegradeQuestions ? (
              <div className="py-8 text-center text-slate-400 font-bold text-xs">
                <Loader2 size={18} className="animate-spin mx-auto mb-2 text-indigo-600" />
                Loading assessment questions...
              </div>
            ) : regradeQuestions.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No questions found in this assessment.</p>
            ) : (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Select Question with Disputed Answer Key:</label>
                  <select
                    value={selectedQuestionId}
                    onChange={(e) => {
                      const qId = e.target.value;
                      setSelectedQuestionId(qId);
                      const q = regradeQuestions.find((item) => item.id === qId);
                      if (q) setNewCorrectOptionIndex(q.correctOptionIndex || 0);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
                  >
                    {regradeQuestions.map((q, idx) => (
                      <option key={q.id} value={q.id}>
                        Q{idx + 1}: {q.questionText?.slice(0, 50)}...
                      </option>
                    ))}
                  </select>
                </div>

                {(() => {
                  const currentQ = regradeQuestions.find((q) => q.id === selectedQuestionId);
                  if (!currentQ) return null;
                  return (
                    <div className="space-y-2">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-900 leading-relaxed">
                        {currentQ.questionText}
                      </div>

                      <label className="block font-bold text-slate-700 mt-2">Select Correct Option Key:</label>
                      <div className="space-y-1.5">
                        {currentQ.options?.map((opt, optIdx) => (
                          <label
                            key={optIdx}
                            className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-colors ${
                              newCorrectOptionIndex === optIdx
                                ? "border-emerald-600 bg-emerald-50 text-emerald-950 font-bold"
                                : "border-slate-200 hover:bg-slate-50 text-slate-700"
                            }`}
                          >
                            <input
                              type="radio"
                              name="newCorrectIndex"
                              value={optIdx}
                              checked={newCorrectOptionIndex === optIdx}
                              onChange={() => setNewCorrectOptionIndex(optIdx)}
                            />
                            <span>Option {String.fromCharCode(65 + optIdx)}: {opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsRegradeModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleApplyRegrade}
                disabled={isRegrading || loadingRegradeQuestions || regradeQuestions.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1c1f58] hover:bg-[#252975] text-white text-xs font-black transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isRegrading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Recalculating...</span>
                  </>
                ) : (
                  <span>Re-Evaluate & Update All Scores</span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL 4: GRACE / BONUS MARKS INJECTOR                     */}
      {/* ========================================================= */}
      {isBonusModalOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center cursor-pointer"
          onClick={() => setIsBonusModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 max-w-md w-full my-auto p-6 shadow-2xl space-y-4 animate-scale-up cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Grant Bonus / Grace Marks</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Platform-level grade adjustment</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBonusModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {bonusMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold">
                {bonusMessage}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Bonus Marks to Grant (+Marks):</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={bonusMarksAmount}
                  onChange={(e) => setBonusMarksAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold text-[#1c1f58] focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Administrative Justification / Reason:</label>
                <input
                  type="text"
                  placeholder="e.g. Ambiguous question 3 resolved by academic dean"
                  value={bonusMarksReason}
                  onChange={(e) => setBonusMarksReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsBonusModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleApplyBonusMarks}
                disabled={isGrantingBonus}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-black transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isGrantingBonus ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Injecting Marks...</span>
                  </>
                ) : (
                  <span>Apply Bonus Marks</span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL 5: BULK CSV SUBJECTS IMPORTER                       */}
      {/* ========================================================= */}
      {isBulkImportModalOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center cursor-pointer"
          onClick={() => setIsBulkImportModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full my-auto p-6 shadow-2xl space-y-4 animate-scale-up cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
                  <FileSpreadsheet size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Bulk Subject CSV Importer</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Batch upload semester courses</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkImportModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {bulkImportMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold">
                {bulkImportMessage}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">Format: code, title, semester, department</span>
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="text-xs font-bold text-indigo-700 hover:underline cursor-pointer"
                >
                  Download Sample CSV
                </button>
              </div>

              <textarea
                rows={6}
                value={bulkCsvText}
                onChange={(e) => setBulkCsvText(e.target.value)}
                placeholder={"TCS-501,Design and Analysis of Algorithms,5,CSE\nTCS-502,Operating Systems,5,CSE"}
                className="w-full p-3 rounded-xl border border-slate-300 font-mono text-xs text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsBulkImportModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleApplyBulkImport}
                disabled={isImportingBulk}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1c1f58] hover:bg-[#252975] text-white text-xs font-black transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isImportingBulk ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <span>Import Records</span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL 6: DELETE ALL SUBJECTS CONFIRMATION                 */}
      {/* ========================================================= */}
      {isDeleteAllCoursesModalOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center cursor-pointer"
          onClick={() => setIsDeleteAllCoursesModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 max-w-md w-full my-auto p-6 shadow-2xl space-y-4 animate-scale-up cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-rose-950">Delete All Subjects</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Permanent Bulk Action</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteAllCoursesModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3.5 bg-rose-50/70 border border-rose-200/60 rounded-xl text-rose-900 text-xs font-semibold leading-relaxed">
              Are you sure you want to delete all <span className="font-black text-rose-950">{courses.length} subjects</span>? Any associated quizzes and student submissions will also be cascaded. This action cannot be undone.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsDeleteAllCoursesModalOpen(false)}
                disabled={isDeletingAllCourses}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAllCourses}
                disabled={isDeletingAllCourses}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isDeletingAllCourses ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={13} />
                    <span>Yes, Delete All Subjects</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL 7: DELETE ALL SUBMISSIONS CONFIRMATION              */}
      {/* ========================================================= */}
      {isDeleteAllSubmissionsModalOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center cursor-pointer"
          onClick={() => setIsDeleteAllSubmissionsModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 max-w-md w-full my-auto p-6 shadow-2xl space-y-4 animate-scale-up cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-rose-950">Delete All Submissions</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Clear Student Evaluations</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteAllSubmissionsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3.5 bg-rose-50/70 border border-rose-200/60 rounded-xl text-rose-900 text-xs font-semibold leading-relaxed">
              Are you sure you want to clear all <span className="font-black text-rose-950">{submissions.length} student submissions</span>? All test evaluation scores and history records will be permanently wiped. This action cannot be undone.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsDeleteAllSubmissionsModalOpen(false)}
                disabled={isDeletingAllSubmissions}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAllSubmissions}
                disabled={isDeletingAllSubmissions}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isDeletingAllSubmissions ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Clearing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={13} />
                    <span>Yes, Clear All Submissions</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL 8: DYNAMIC ADD NEW SUBJECT                          */}
      {/* ========================================================= */}
      {isAddCourseModalOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center cursor-pointer"
          onClick={() => setIsAddCourseModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full my-auto p-6 shadow-2xl space-y-4 animate-scale-up cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-[#1c1f58]">
                  <BookOpen size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#1c1f58]">Add Subject</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Add subject details for quiz assessments</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCourseModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {courseActionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold">
                {courseActionError}
              </div>
            )}

            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* DYNAMIC SEMESTER SELECTOR FROM ACTIVE SEMESTERS */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      Semester <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                      {academicTerm.termType === "ODD" ? "Odd Term" : academicTerm.termType === "EVEN" ? "Even Term" : "Active"}
                    </span>
                  </div>
                  <select
                    value={newCourse.semester}
                    onChange={(e) => setNewCourse({ ...newCourse, semester: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-[#1c1f58] bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
                  >
                    {activeSemesters.map((s) => (
                      <option key={s} value={s}>
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* DYNAMIC DEPARTMENT SELECTOR FROM DB */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Department <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newCourse.department}
                    onChange={(e) => setNewCourse({ ...newCourse, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
                  >
                    {departments.length === 0 ? (
                      <option value="CSE">Computer Science & Engineering</option>
                    ) : (
                      departments.map((d) => (
                        <option key={d.id} value={d.code}>
                          {d.name} ({d.code})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* UNIVERSITY SELECTOR (DYNAMIC) */}
              {universities.length > 1 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    University / Campus <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newCourse.universityId || universities[0]?.id}
                    onChange={(e) => setNewCourse({ ...newCourse, universityId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
                  >
                    {universities.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Subject Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TCS-501 or TMA-101"
                  value={newCourse.code}
                  onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold text-[#1c1f58] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Subject Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Design & Analysis of Algorithms"
                  value={newCourse.title}
                  onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional summary of topics or syllabus"
                  value={newCourse.description}
                  onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddCourseModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCourse}
                  className="px-5 py-2 rounded-xl bg-[#1c1f58] hover:bg-[#252975] text-white text-xs font-bold transition-all shadow-2xs disabled:opacity-60 cursor-pointer flex items-center gap-1.5"
                >
                  {savingCourse ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Subject</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL 9: ADD UNIVERSITY                                   */}
      {/* ========================================================= */}
      {isAddUniModalOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center cursor-pointer"
          onClick={() => setIsAddUniModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 max-w-md w-full my-auto p-6 shadow-2xl space-y-4 animate-scale-up cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-[#1c1f58]">
                  <Building2 size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#1c1f58]">Add University / Campus</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Register a new institution profile</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddUniModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {uniError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold">
                {uniError}
              </div>
            )}

            <form onSubmit={handleCreateUniversity} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  University Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Graphic Era Hill University"
                  value={newUni.name}
                  onChange={(e) => setNewUni({ ...newUni, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  University Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GEHU or GEHU-BHT"
                  value={newUni.code}
                  onChange={(e) => setNewUni({ ...newUni, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold text-[#1c1f58] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddUniModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingUni}
                  className="px-5 py-2 rounded-xl bg-[#1c1f58] hover:bg-[#252975] text-white text-xs font-bold transition-all shadow-2xs disabled:opacity-60 cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingUni ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save University</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* MODAL 10: ADD DEPARTMENT                                  */}
      {/* ========================================================= */}
      {isAddDeptModalOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-4 flex items-center justify-center cursor-pointer"
          onClick={() => setIsAddDeptModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 max-w-md w-full my-auto p-6 shadow-2xl space-y-4 animate-scale-up cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-[#1c1f58]">
                  <GraduationCap size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#1c1f58]">Add Academic Department</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Register a department under an institution</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddDeptModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {deptError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold">
                {deptError}
              </div>
            )}

            <form onSubmit={handleCreateDepartment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  University / Campus <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newDept.universityId || universities[0]?.id}
                  onChange={(e) => setNewDept({ ...newDept, universityId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
                >
                  {universities.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Department Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Artificial Intelligence & Data Science"
                  value={newDept.name}
                  onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Department Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AIDS or IT or ECE"
                  value={newDept.code}
                  onChange={(e) => setNewDept({ ...newDept, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold text-[#1c1f58] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddDeptModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingDept}
                  className="px-5 py-2 rounded-xl bg-[#1c1f58] hover:bg-[#252975] text-white text-xs font-bold transition-all shadow-2xs disabled:opacity-60 cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingDept ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Department</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* COURSE OUTCOME & STUDENT MARKS DOSSIER MODAL (MATCHING REFERENCE MOCKUP) */}
      {/* ========================================================================= */}
      {isCourseAccreditationModalOpen && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-xs flex items-start justify-center pt-8 sm:pt-12 md:pt-16 pb-8 sm:pb-12 px-4 sm:px-6 md:px-8 overflow-y-auto cursor-pointer"
          onClick={() => setIsCourseAccreditationModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200/90 max-w-5xl w-full max-h-[calc(100vh-5rem)] sm:max-h-[calc(100vh-6.5rem)] md:max-h-[calc(100vh-7.5rem)] flex flex-col shadow-2xl overflow-hidden cursor-default text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header & Navigation Bar (Unified Header matching Image 1 & 2) */}
            <div className="px-6 sm:px-8 pt-6 sm:pt-7 bg-white shrink-0 border-b border-slate-200/80">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-[#1c1f58] tracking-tight uppercase">
                      {selectedCourseAccreditation?.course?.title?.replace("STRUCUTRES", "STRUCTURES") || "Course Outcome"}
                    </h3>
                    {selectedCourseAccreditation?.course?.code && (
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        {selectedCourseAccreditation.course.code}
                      </span>
                    )}
                  </div>

                  {/* Subtitle Details */}
                  {selectedCourseAccreditation?.course && (
                    <p className="text-xs text-slate-500 font-medium mt-1.5 flex items-center gap-2 flex-wrap">
                      <span>Graphic Era University</span>
                      <span className="text-slate-300">&bull;</span>
                      <span>{selectedCourseAccreditation.course.department} Dept</span>
                      <span className="text-slate-300">&bull;</span>
                      <span>Semester {selectedCourseAccreditation.course.semester}</span>
                      <span className="text-slate-300">&bull;</span>
                      <span>{selectedCourseAccreditation.course.totalEnrolledInCohort || 0} Students</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  {selectedCourseAccreditation && (
                    <button
                      type="button"
                      onClick={() => handleExportCourseDossierCSV(selectedCourseAccreditation)}
                      className="px-3.5 py-1.5 rounded-xl border border-amber-300/80 bg-white hover:bg-amber-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                      title="Export CSV"
                    >
                      <Download size={13} className="text-amber-500" />
                      <span>Export CSV</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsCourseAccreditationModalOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Close"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Navigation Tabs (Directly underneath subtitle, amber line on bottom border) */}
              <div className="flex items-center gap-6 sm:gap-8 text-xs sm:text-sm mt-5 -mb-px">
                <button
                  type="button"
                  onClick={() => setActiveCourseModalTab("analytics")}
                  className={`pb-3 border-b-2 transition-colors cursor-pointer ${
                    activeCourseModalTab === "analytics"
                      ? "border-amber-500 text-slate-900 font-bold"
                      : "border-transparent text-slate-500 hover:text-slate-700 font-medium"
                  }`}
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCourseModalTab("roster")}
                  className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                    activeCourseModalTab === "roster"
                      ? "border-amber-500 text-slate-900 font-bold"
                      : "border-transparent text-slate-500 hover:text-slate-700 font-medium"
                  }`}
                >
                  <span>Students</span>
                  {(selectedCourseAccreditation?.course?.totalEnrolledInCohort || selectedCourseAccreditation?.studentRoster) && (
                    <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600 font-medium">
                      {selectedCourseAccreditation?.course?.totalEnrolledInCohort || selectedCourseAccreditation?.studentRoster?.length || 0}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-5 sm:p-6 space-y-6 flex-1 text-slate-800">
              {loadingCourseAccreditation ? (
                <div className="py-20 flex flex-col items-center justify-center space-y-2 text-slate-400">
                  <Loader2 size={24} className="animate-spin text-slate-500" />
                  <span className="text-xs text-slate-500">Loading course details...</span>
                </div>
              ) : !selectedCourseAccreditation ? (
                <div className="py-16 text-center text-slate-400 text-xs font-medium">
                  Course details could not be retrieved.
                </div>
              ) : (
                (() => {
                  const kpis = selectedCourseAccreditation.accreditationKPIs || {};
                  const course = selectedCourseAccreditation.course || {};
                  const totalEnrolled = course.totalEnrolledInCohort || 0;
                  const totalEvaluated = kpis.totalEvaluated || 0;
                  const participationRate = totalEnrolled > 0 ? Math.round((totalEvaluated / totalEnrolled) * 100) : 0;
                  const passPercentage = kpis.passPercentage || 0;
                  const targetAttainmentPercentage = kpis.targetAttainmentPercentage || 0;
                  const bands = kpis.distributionBands || { distinction: 0, firstClass: 0, secondClass: 0, remedialAtRisk: 0 };
                  const allRoster = selectedCourseAccreditation.studentRoster || [];

                  {/* TAB 1: OVERVIEW */}
                  if (activeCourseModalTab === "analytics") {
                    return (
                      <div className="space-y-6">
                        {/* 4 Clean Metric Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          {/* 1. Evaluated */}
                          <div className="p-4 sm:p-5 rounded-2xl border border-slate-100 bg-white flex items-center justify-between shadow-2xs">
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-slate-500">Evaluated</div>
                              <div className="flex items-baseline">
                                <span className="text-2xl font-black text-slate-900">{totalEvaluated}</span>
                                <span className="text-sm font-semibold text-slate-400 font-mono ml-1.5">/ {totalEnrolled}</span>
                              </div>
                              <div className="text-xs text-slate-400 font-medium">{participationRate}% participation</div>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                              <Users size={18} />
                            </div>
                          </div>

                          {/* 2. Pass Rate */}
                          <div className="p-4 sm:p-5 rounded-2xl border border-slate-100 bg-white flex items-center justify-between shadow-2xs">
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-slate-500">Pass Rate</div>
                              <div className="text-2xl font-black text-emerald-600">{passPercentage}%</div>
                              <div className="text-xs text-slate-400 font-medium">
                                {kpis.passedCount || 0} passed, {kpis.failedCount || 0} failed
                              </div>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                              <BarChart2 size={18} />
                            </div>
                          </div>

                          {/* 3. Attainment (>=60%) */}
                          <div className="p-4 sm:p-5 rounded-2xl border border-slate-100 bg-white flex items-center justify-between shadow-2xs">
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-slate-500">Attainment (≥60%)</div>
                              <div className="text-2xl font-black text-[#1c1f58]">{targetAttainmentPercentage}%</div>
                              <div className="text-xs text-slate-400 font-medium truncate max-w-[130px]" title={kpis.overallCourseAttainmentLevel}>
                                {kpis.overallCourseAttainmentLevel?.split("-")[0] || "Level 0"}
                              </div>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                              <Target size={18} />
                            </div>
                          </div>

                          {/* 4. Remedial Flag (<40%) */}
                          <div className="p-4 sm:p-5 rounded-2xl border border-slate-100 bg-white flex items-center justify-between shadow-2xs">
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-slate-500">Remedial Flag (&lt;40%)</div>
                              <div className="text-2xl font-black text-slate-900">{bands.remedialAtRisk || 0}</div>
                              <div className="text-xs text-slate-400 font-medium">Scoring under 40%</div>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                              <AlertTriangle size={18} />
                            </div>
                          </div>
                        </div>

                        {/* Middle Row: Outcome Distribution & Section Performance */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                          {/* Left: Outcome Distribution (col-span-5) */}
                          <div className="lg:col-span-5 p-5 rounded-2xl border border-slate-100 bg-white space-y-3 shadow-2xs">
                            <div className="text-sm font-bold text-[#1c1f58]">Outcome Distribution</div>
                            <div className="space-y-2 text-xs">
                              <div className="flex items-center justify-between py-2.5 px-3.5 rounded-lg bg-slate-50/80 text-slate-700">
                                <span className="font-medium text-slate-600">Distinction (&ge;75%)</span>
                                <span className="font-bold text-slate-900">{bands.distinction || 0}</span>
                              </div>
                              <div className="flex items-center justify-between py-2.5 px-3.5 rounded-lg bg-slate-50/80 text-slate-700">
                                <span className="font-medium text-slate-600">First Class (60–74%)</span>
                                <span className="font-bold text-slate-900">{bands.firstClass || 0}</span>
                              </div>
                              <div className="flex items-center justify-between py-2.5 px-3.5 rounded-lg bg-slate-50/80 text-slate-700">
                                <span className="font-medium text-slate-600">Pass Class (40–59%)</span>
                                <span className="font-bold text-slate-900">{bands.secondClass || 0}</span>
                              </div>
                              <div className="flex items-center justify-between py-2.5 px-3.5 rounded-lg bg-slate-50/80 text-slate-700">
                                <span className="font-medium text-slate-600">Remedial (&lt;40%)</span>
                                <span className="font-bold text-slate-900">{bands.remedialAtRisk || 0}</span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Section Performance (col-span-7) */}
                          <div className="lg:col-span-7 p-5 rounded-2xl border border-slate-100 bg-white space-y-3 shadow-2xs flex flex-col justify-between">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-bold text-[#1c1f58]">Section Performance</div>
                              <span className="text-xs text-slate-400 font-normal">
                                {selectedCourseAccreditation.sectionComparison?.length || 0} Sections
                              </span>
                            </div>

                            <div className="overflow-x-auto flex-1 flex flex-col">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="bg-slate-50/90 text-slate-500 text-[10px] font-bold uppercase tracking-wider rounded-lg">
                                    <th className="py-2.5 px-3 rounded-l-lg">SECTION</th>
                                    <th className="py-2.5 px-3 text-center">ASSESSED</th>
                                    <th className="py-2.5 px-3 text-center">PASSED</th>
                                    <th className="py-2.5 px-3 text-center">FAILED</th>
                                    <th className="py-2.5 px-3 text-center">PASS %</th>
                                    <th className="py-2.5 px-3 text-center">AVG %</th>
                                    <th className="py-2.5 px-3 text-center rounded-r-lg">REMEDIAL</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                  {(!selectedCourseAccreditation.sectionComparison || selectedCourseAccreditation.sectionComparison.length === 0) ? (
                                    <tr>
                                      <td colSpan="7" className="py-12 text-center text-xs text-slate-400">
                                        <div className="inline-flex items-center justify-center gap-2">
                                          <FileText size={18} className="text-slate-300" />
                                          <span>No section submissions recorded yet.</span>
                                        </div>
                                      </td>
                                    </tr>
                                  ) : (
                                    selectedCourseAccreditation.sectionComparison.map((sec, sIdx) => (
                                      <tr key={sIdx} className="hover:bg-slate-50/70">
                                        <td className="py-2 px-3 font-semibold text-slate-900">{sec.section}</td>
                                        <td className="py-2 px-3 text-center">{sec.totalAssessed}</td>
                                        <td className="py-2 px-3 text-center text-emerald-600 font-semibold">{sec.passedCount}</td>
                                        <td className="py-2 px-3 text-center text-rose-600 font-semibold">{sec.failedCount}</td>
                                        <td className="py-2 px-3 text-center font-semibold text-slate-900">{sec.passRate}%</td>
                                        <td className="py-2 px-3 text-center">{sec.avgPercentage}%</td>
                                        <td className="py-2 px-3 text-center">{sec.remedialCount}</td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>

                        {/* Bottom Row: Summary Statistics */}
                        <div className="px-5 py-3.5 rounded-2xl border border-slate-100 bg-white flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
                          <span className="font-bold text-[#1c1f58]">Summary Statistics</span>
                          <div className="flex items-center gap-4 sm:gap-6 flex-wrap text-slate-500">
                            <span>Mean: <strong className="font-bold text-slate-900">{kpis.meanScore || 0}%</strong></span>
                            <span>Median: <strong className="font-bold text-slate-900">{kpis.medianScore || 0}%</strong></span>
                            <span>Std Dev: <strong className="font-bold text-slate-900">{kpis.standardDeviation || 0}%</strong></span>
                            <span>Highest: <strong className="font-bold text-slate-900">{kpis.highestScore || 0}%</strong></span>
                            <span>Lowest: <strong className="font-bold text-slate-900">{kpis.lowestScore || 0}%</strong></span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  {/* TAB 2: STUDENTS (DYNAMIC DATABASE-DRIVEN HIERARCHY) */}
                  if (activeCourseModalTab === "roster") {
                    // 1. Dynamic Departments from portal-configured departments ONLY (no ghost departments)
                    const portalDepts = departments && departments.length > 0
                      ? departments
                      : [{ id: 'cse', code: 'CSE', name: 'COMPUTER SCIENCE AND ENGINEERING' }];

                    // 2. Dynamic Available Sections based on selected Department & Semester from roster
                    const availableSections = Array.from(
                      new Set(
                        allRoster
                          .filter((s) => {
                            if (!isDepartmentMatch(courseDeptFilter, s.department) && !isDepartmentMatch(courseDeptFilter, s.departmentName)) {
                              return false;
                            }
                            if (courseSemFilter !== "ALL" && String(s.semester) !== String(courseSemFilter)) {
                              return false;
                            }
                            return true;
                          })
                          .map((s) => s.section)
                          .filter(Boolean)
                      )
                    ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

                    // 3. Filtered students by all hierarchy filters
                    const filtered = allRoster.filter((s) => {
                      // Department Filter
                      if (!isDepartmentMatch(courseDeptFilter, s.department) && !isDepartmentMatch(courseDeptFilter, s.departmentName)) {
                        return false;
                      }

                      // Semester Filter
                      if (courseSemFilter !== "ALL" && String(s.semester) !== String(courseSemFilter)) {
                        return false;
                      }

                      // Section Filter
                      if (courseSectionFilter !== "ALL" && s.section?.toUpperCase() !== courseSectionFilter.toUpperCase()) {
                        return false;
                      }

                      // Status Filter
                      if (courseStatusFilter === "EVALUATED" && s.status === "ABSENT / PENDING") return false;
                      if (courseStatusFilter === "PASSED" && (!s.isPassedOverall || s.status === "ABSENT / PENDING")) return false;
                      if (courseStatusFilter === "REMEDIAL" && (!s.remedialNeeded || s.status === "ABSENT / PENDING")) return false;
                      if (courseStatusFilter === "ABSENT" && s.status !== "ABSENT / PENDING") return false;

                      // Student Search
                      if (courseStudentSearch.trim()) {
                        const q = courseStudentSearch.toLowerCase().trim();
                        const matchName = s.name?.toLowerCase().includes(q);
                        const matchRoll = s.rollNo?.toLowerCase().includes(q);
                        const matchSec = s.section?.toLowerCase().includes(q);
                        if (!matchName && !matchRoll && !matchSec) return false;
                      }

                      return true;
                    });

                    const evaluatedCount = filtered.filter(s => s.status !== "ABSENT / PENDING").length;
                    const passedCount = filtered.filter(s => s.isPassedOverall && s.status !== "ABSENT / PENDING").length;
                    const remedialCount = filtered.filter(s => s.remedialNeeded && s.status !== "ABSENT / PENDING").length;
                    const absentCount = filtered.filter(s => s.status === "ABSENT / PENDING").length;

                    // Dynamic Semesters from activeSemesters in DB or students
                    const dynamicSemesters = Array.from(
                      new Set([
                        ...(activeSemesters || [1, 3, 5, 7]),
                        ...allRoster.map((s) => Number(s.semester)).filter(Boolean)
                      ])
                    ).sort((a, b) => a - b);

                    return (
                      <div className="space-y-4">
                        {/* HIERARCHY FILTER BAR (DYNAMIC DB DRIVEN) */}
                        <div className="p-4 sm:p-5 rounded-2xl border border-slate-100 bg-slate-50/70 space-y-3 shadow-2xs">
                          {/* Row 1: University, Department, Semester, Section */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {/* University */}
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                                University
                              </label>
                              <select
                                value={courseUniFilter}
                                onChange={(e) => setCourseUniFilter(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
                              >
                                <option value="ALL">All Universities</option>
                                {universities && universities.length > 0 ? (
                                  universities.map((u) => (
                                    <option key={u.id} value={u.code || u.id}>
                                      {u.name} ({u.code})
                                    </option>
                                  ))
                                ) : (
                                  <option value="GEU">Graphic Era University (GEU)</option>
                                )}
                              </select>
                            </div>

                            {/* Department */}
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                                Department
                              </label>
                              <select
                                value={courseDeptFilter}
                                onChange={(e) => {
                                  const newDept = e.target.value;
                                  setCourseDeptFilter(newDept);
                                  setCourseSectionFilter("ALL");
                                  if (selectedCourseAccreditation?.course?.id) {
                                    handleOpenCourseAccreditation(selectedCourseAccreditation.course.id, courseSemFilter, newDept);
                                  }
                                }}
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
                              >
                                <option value="ALL">All Departments</option>
                                {portalDepts.map((d) => (
                                  <option key={d.id || d.code} value={d.code.toUpperCase()}>
                                    {d.name} ({d.code.toUpperCase()})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Semester */}
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                                Semester
                              </label>
                              <select
                                value={courseSemFilter}
                                onChange={(e) => {
                                  const newSem = e.target.value;
                                  setCourseSemFilter(newSem);
                                  setCourseSectionFilter("ALL");
                                  if (selectedCourseAccreditation?.course?.id) {
                                    handleOpenCourseAccreditation(selectedCourseAccreditation.course.id, newSem, courseDeptFilter);
                                  }
                                }}
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
                              >
                                <option value="ALL">All Semesters</option>
                                {dynamicSemesters.map((s) => (
                                  <option key={s} value={String(s)}>
                                    Semester {s}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Section */}
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                                Section ({availableSections.length})
                              </label>
                              <select
                                value={courseSectionFilter}
                                onChange={(e) => setCourseSectionFilter(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
                              >
                                <option value="ALL">All Sections ({availableSections.length})</option>
                                {availableSections.map((sec) => (
                                  <option key={sec} value={sec}>
                                    {sec}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Row 2: Status Pills & Search Bar */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200/80">
                            {/* Status Pills */}
                            <div className="flex items-center gap-1.5 flex-wrap text-xs">
                              <button
                                type="button"
                                onClick={() => setCourseStatusFilter("ALL")}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                  courseStatusFilter === "ALL"
                                    ? "bg-slate-900 text-white"
                                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                                }`}
                              >
                                All ({filtered.length})
                              </button>
                              <button
                                type="button"
                                onClick={() => setCourseStatusFilter("EVALUATED")}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                  courseStatusFilter === "EVALUATED"
                                    ? "bg-slate-900 text-white"
                                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                                }`}
                              >
                                Evaluated ({evaluatedCount})
                              </button>
                              <button
                                type="button"
                                onClick={() => setCourseStatusFilter("PASSED")}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                  courseStatusFilter === "PASSED"
                                    ? "bg-emerald-600 text-white"
                                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                                }`}
                              >
                                Passed ({passedCount})
                              </button>
                              <button
                                type="button"
                                onClick={() => setCourseStatusFilter("REMEDIAL")}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                  courseStatusFilter === "REMEDIAL"
                                    ? "bg-rose-600 text-white"
                                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                                }`}
                              >
                                Remedial ({remedialCount})
                              </button>
                              <button
                                type="button"
                                onClick={() => setCourseStatusFilter("ABSENT")}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                  courseStatusFilter === "ABSENT"
                                    ? "bg-slate-700 text-white"
                                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                                }`}
                              >
                                Absent ({absentCount})
                              </button>
                            </div>

                            {/* Search Input */}
                            <div className="relative">
                              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input
                                type="text"
                                value={courseStudentSearch}
                                onChange={(e) => setCourseStudentSearch(e.target.value)}
                                placeholder="Search student..."
                                className="pl-7 pr-3 py-1 rounded-xl border border-slate-200 text-xs w-44 sm:w-56 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Students Table */}
                        <div className="overflow-x-auto max-h-[46vh] overflow-y-auto border border-slate-100 rounded-2xl bg-white shadow-2xs">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="sticky top-0 bg-slate-50/90 border-b border-slate-100 text-slate-500 z-10">
                              <tr className="text-[10px] font-bold uppercase tracking-wider">
                                <th className="py-2.5 px-3">#</th>
                                <th className="py-2.5 px-3">Roll No</th>
                                <th className="py-2.5 px-3">Student Name</th>
                                <th className="py-2.5 px-3">Section</th>
                                <th className="py-2.5 px-3 text-center">Marks</th>
                                <th className="py-2.5 px-3 text-center">Percentage</th>
                                <th className="py-2.5 px-3 text-center">CO Band</th>
                                <th className="py-2.5 px-3 text-center">Status</th>
                                <th className="py-2.5 px-3 text-center">Remedial</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                              {filtered.length === 0 ? (
                                <tr>
                                  <td colSpan="9" className="py-10 text-center text-xs text-slate-400">
                                    No students matching the selected criteria.
                                  </td>
                                </tr>
                              ) : (
                                filtered.map((st, idx) => {
                                  const isAbsent = st.status === "ABSENT / PENDING";
                                  const isRemedial = !isAbsent && st.remedialNeeded;

                                  return (
                                    <tr key={idx} className="hover:bg-slate-50/60">
                                      <td className="py-2 px-3 text-slate-400 text-[11px] font-mono">{idx + 1}</td>
                                      <td className="py-2 px-3 font-mono font-medium text-slate-900">{st.rollNo}</td>
                                      <td className="py-2 px-3">
                                        <div className="font-semibold text-slate-900 line-clamp-1">{st.name}</div>
                                        {st.email && <div className="text-[10px] text-slate-400 font-normal">{st.email}</div>}
                                      </td>
                                      <td className="py-2 px-3">
                                        <span className="font-mono text-[11px] text-slate-700">
                                          {st.section}
                                        </span>
                                      </td>
                                      <td className="py-2 px-3 text-center font-mono">
                                        {isAbsent ? "—" : `${st.totalMarksObtained} / ${st.totalPossibleMarks}`}
                                      </td>
                                      <td className="py-2 px-3 text-center font-mono font-medium">
                                        {isAbsent ? (
                                          "—"
                                        ) : (
                                          <span className={st.overallPercentage >= 60 ? "text-emerald-600 font-bold" : st.overallPercentage >= 40 ? "text-amber-600 font-bold" : "text-rose-600 font-bold"}>
                                            {st.overallPercentage}%
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-2 px-3 text-center">
                                        {isAbsent ? (
                                          <span className="text-slate-400 font-normal">Pending</span>
                                        ) : (
                                          <span className="text-slate-700 font-medium">
                                            {st.attainmentBand?.split(" ")[0] || "Level 0"}
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-2 px-3 text-center">
                                        {isAbsent ? (
                                          <span className="text-slate-400 font-normal">Absent</span>
                                        ) : st.isPassedOverall ? (
                                          <span className="text-emerald-600 font-bold">Passed</span>
                                        ) : (
                                          <span className="text-rose-600 font-bold">Failed</span>
                                        )}
                                      </td>
                                      <td className="py-2 px-3 text-center">
                                        {isRemedial ? (
                                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                                            Yes
                                          </span>
                                        ) : (
                                          <span className="text-slate-300">—</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  }

                  return null;
                })()
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default AdminDashboard;
