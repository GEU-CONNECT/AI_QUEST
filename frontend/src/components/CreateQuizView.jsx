import { createPortal } from 'react-dom';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Bold,
  Italic,
  Code,
  List,
  Eye,
  EyeOff,
  Check,
  Key,
  Lock,
  Unlock,
  Layers,
  Users,
  RefreshCw,
  Search,
  X,
  BookOpen,
  Loader2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  FileSpreadsheet,
  UserPlus,
  FileText,
  Calendar,
  Clock,
  Archive,
  Sparkles,
  Filter,
  CheckSquare,
  Square,
  Dices,
  Image as ImageIcon,
  Maximize2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../api/client';
import { getSafeImageUrl } from '../utils/imageUrl';

const DRAFT_STORAGE_KEY = 'geu_quizx_create_quiz_draft_v1';

/**
 * Fair Stratified Question Allocation Utility
 * Computes deterministic allocation of questions across mark tiers so every candidate
 * is evaluated out of the EXACT SAME TOTAL MARKS when pool sampling is enabled.
 */
function getFairQuestionBankAllocation(questions, k) {
  const totalQuestions = Array.isArray(questions) ? questions.length : 0;
  if (!totalQuestions || !k || k <= 0) {
    return { allocation: {}, candidateTotalMarks: 0, summary: '' };
  }

  const sampleCount = Math.min(Number(k), totalQuestions);
  if (sampleCount >= totalQuestions) {
    const totalMarks = Math.round(questions.reduce((sum, q) => sum + (Number(q.marks) || 1), 0) * 100) / 100;
    const allocation = {};
    for (const q of questions) {
      const m = Number(q.marks) || 1;
      allocation[m] = (allocation[m] || 0) + 1;
    }
    const summaryParts = Object.entries(allocation)
      .map(([m, cnt]) => `${cnt} q (${m} mark${m > 1 ? 's' : ''})`);
    return { allocation, candidateTotalMarks: totalMarks, summary: summaryParts.join(' + ') };
  }

  // Group pool questions by mark weight
  const groups = {};
  for (const q of questions) {
    const m = Number(q.marks) || 1;
    if (!groups[m]) groups[m] = 0;
    groups[m]++;
  }

  const markValues = Object.keys(groups).map(Number).sort((a, b) => b - a);

  // Largest Remainder Method (Hare-Niemeyer / Hamilton) for fair apportionment
  const allocation = {};
  const remainders = [];
  let allocatedCount = 0;

  for (const m of markValues) {
    const countInGroup = groups[m];
    const exactQuota = (sampleCount * countInGroup) / totalQuestions;
    const floored = Math.floor(exactQuota);
    allocation[m] = floored;
    allocatedCount += floored;
    remainders.push({
      mark: m,
      rem: exactQuota - floored,
      max: countInGroup
    });
  }

  let remainingSlots = sampleCount - allocatedCount;
  remainders.sort((a, b) => b.rem - a.rem || b.mark - a.mark);

  for (const item of remainders) {
    if (remainingSlots <= 0) break;
    if (allocation[item.mark] < item.max) {
      allocation[item.mark]++;
      remainingSlots--;
    }
  }

  if (remainingSlots > 0) {
    for (const m of markValues) {
      while (remainingSlots > 0 && allocation[m] < groups[m]) {
        allocation[m]++;
        remainingSlots--;
      }
    }
  }

  let candidateTotalMarks = 0;
  for (const m of markValues) {
    candidateTotalMarks += (allocation[m] || 0) * m;
  }
  candidateTotalMarks = Math.round(candidateTotalMarks * 100) / 100;

  const summaryParts = markValues
    .filter((m) => allocation[m] > 0)
    .sort((a, b) => a - b)
    .map((m) => `${allocation[m]} q (${m} mark${m > 1 ? 's' : ''})`);

  return {
    allocation,
    candidateTotalMarks,
    summary: summaryParts.join(' + ')
  };
}

const CreateQuizView = ({ onBack, onCreated, quizId = null }) => {
  const fileInputRef = useRef(null);

  const [allCourses, setAllCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingInitialQuiz, setLoadingInitialQuiz] = useState(Boolean(quizId));
  const [error, setError] = useState('');
  const [successBanner, setSuccessBanner] = useState('');

  // Target Semester (Primary Filter for Courses and Sections)
  const [semester, setSemester] = useState(1);
  const [activeSemesters, setActiveSemesters] = useState([1, 3, 5, 7]);

  // Assessment Core Settings
  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [passingMarks, setPassingMarks] = useState(8);
  const [negativeMarking, setNegativeMarking] = useState(false);
  const [negativeMarksPerWrong, setNegativeMarksPerWrong] = useState(0.25);

  // Scheduling & Timing Modes: "NOW" | "SCHEDULED", "INDIVIDUAL" | "STRICT"
  const [scheduleType, setScheduleType] = useState('NOW');
  const [scheduledStartTime, setScheduledStartTime] = useState('');
  const [timingMode, setTimingMode] = useState('INDIVIDUAL');

  // Marks Allocation Mode: "overall" (Fixed Overall Assessment Marks) | "individual" (Custom marks per question)
  const [marksMode, setMarksMode] = useState("overall");
  const [overallQuizMarks, setOverallQuizMarks] = useState(50);

  // Question Bank Pool Sampling
  const [enableQuestionBank, setEnableQuestionBank] = useState(false);
  const [questionsPerStudent, setQuestionsPerStudent] = useState(50);

  // Target Sections & Elective Student Roster
  const [targetSections, setTargetSections] = useState(['ALL']);
  // Target Audience Mode: "SECTIONS" (Class Sections) | "CUSTOM" (Elective Multi-Section Roster)
  const [targetMode, setTargetMode] = useState('SECTIONS');
  const [targetStudents, setTargetStudents] = useState([]); // [{ rollNo, name, section }]
  const [manualStudent, setManualStudent] = useState({ rollNo: '', name: '', section: '' });
  const [bulkRollInput, setBulkRollInput] = useState('');
  const [studentRosterTab, setStudentRosterTab] = useState('excel'); // 'excel' | 'manual' | 'paste'
  const [rosterSearch, setRosterSearch] = useState('');
  const electiveFileInputRef = useRef(null);

  // Question Authoring Pagination State
  const [questionsPerPage, setQuestionsPerPage] = useState(10); // 10 | 20 | 50 | 0 (0 = All)
  const [currentQuestionPage, setCurrentQuestionPage] = useState(1);
  const [isPasswordProtected, setIsPasswordProtected] = useState(true);
  const [accessCode, setAccessCode] = useState('');
  const [showPassword, setShowPassword] = useState(true);
  const [isLive, setIsLive] = useState(true);
  const [showResultsAfterSubmit, setShowResultsAfterSubmit] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Students Modal State
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [studentsRoster, setStudentsRoster] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentModalSectionFilter, setStudentModalSectionFilter] = useState('ALL');
  const [rosterSectionCounts, setRosterSectionCounts] = useState({});
  const [academicMapSections, setAcademicMapSections] = useState({});
  const [facultyDepartment, setFacultyDepartment] = useState('');
  const [facultyDeptCode, setFacultyDeptCode] = useState('');
  const [totalStudentsCount, setTotalStudentsCount] = useState(null);

  // Active preview state for questions { [qIndex]: boolean }
  const [previewModes, setPreviewModes] = useState({});

  // Close student modal on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isStudentModalOpen) {
        setIsStudentModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStudentModalOpen]);

  // Auto-Save Draft State
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState(null);

  // Questions State
  const [questions, setQuestions] = useState([
    {
      questionText: '',
      codeSnippet: '',
      imageUrl: '',
      options: ['', '', '', ''],
      correctOptionIndex: 0,
      marks: 1,
      explanation: ''
    }
  ]);
  const [uploadingImageIndex, setUploadingImageIndex] = useState(null);
  const [zoomedImageUrl, setZoomedImageUrl] = useState(null);

  // Reading Comprehension (RC) State
  const [enableReadingComprehension, setEnableReadingComprehension] = useState(false);
  const [rcPassagesPerStudent, setRcPassagesPerStudent] = useState(1);
  const [passages, setPassages] = useState([
    {
      id: 'rc-1',
      title: 'Passage 1',
      content: '',
      imageUrl: '',
      questions: [
        {
          id: 'rc-1-q-1',
          questionText: '',
          codeSnippet: '',
          imageUrl: '',
          options: ['', '', '', ''],
          correctOptionIndex: 0,
          marks: 2,
          explanation: ''
        }
      ]
    }
  ]);
  const [uploadingPassageImageIdx, setUploadingPassageImageIdx] = useState(null);
  const [uploadingRcQuestionIdx, setUploadingRcQuestionIdx] = useState(null);


  // Generate random memorable access code
  const generateAccessCode = () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = 'GEU-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setAccessCode(code);
  };

  // Question Vault Import State
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultQuestions, setVaultQuestions] = useState([]);
  const [vaultFilterOptions, setVaultFilterOptions] = useState({ courses: [], quizzes: [], semesters: [] });
  const [vaultError, setVaultError] = useState('');
  const [vaultSearchQuery, setVaultSearchQuery] = useState('');
  const [vaultSelectedSemester, setVaultSelectedSemester] = useState('ALL');
  const [vaultSelectedCourse, setVaultSelectedCourse] = useState('ALL');
  const [vaultSelectedQuiz, setVaultSelectedQuiz] = useState('ALL');
  const [vaultSelectedIds, setVaultSelectedIds] = useState(new Set());
  const [vaultChunkCount, setVaultChunkCount] = useState(5);
  const [vaultMarksOption, setVaultMarksOption] = useState('keep'); // 'keep' or 'apply'
  const [vaultModalPage, setVaultModalPage] = useState(1);
  const VAULT_PAGE_SIZE = 6;

  // Fetch Vault Questions for Import Modal
  const fetchVaultQuestions = async () => {
    try {
      setVaultLoading(true);
      setVaultError('');
      const res = await api.get('/quizzes/vault/questions');
      if (res.data?.success) {
        setVaultQuestions(res.data.questions || []);
        setVaultFilterOptions(res.data.filterOptions || { courses: [], quizzes: [], semesters: [] });
      }
    } catch (err) {
      console.error('Failed to load vault questions', err);
      setVaultError(err.response?.data?.message || 'Failed to load question vault.');
    } finally {
      setVaultLoading(false);
    }
  };

  const handleOpenVaultModal = () => {
    setIsVaultModalOpen(true);
    setVaultSelectedSemester(semester ? String(semester) : 'ALL');
    setVaultSelectedCourse('ALL');
    setVaultSelectedQuiz('ALL');
    setVaultSearchQuery('');
    setVaultModalPage(1);
    setVaultSelectedIds(new Set());
    if (vaultQuestions.length === 0) {
      fetchVaultQuestions();
    }
  };

  // Filtered Vault Questions for Import Modal
  const filteredVaultQuestions = useMemo(() => {
    return vaultQuestions.filter((q) => {
      if (vaultSelectedSemester !== 'ALL') {
        const qSem = q.quiz?.semester || q.course?.semester || q.quiz?.course?.semester;
        if (Number(qSem) !== Number(vaultSelectedSemester)) return false;
      }
      if (vaultSelectedCourse !== 'ALL') {
        const cId = q.quiz?.courseId || q.courseId || q.quiz?.course?.id;
        if (cId !== vaultSelectedCourse) return false;
      }
      if (vaultSelectedQuiz !== 'ALL') {
        const qzId = q.quizId || q.quiz?.id;
        if (qzId !== vaultSelectedQuiz) return false;
      }
      if (vaultSearchQuery.trim()) {
        const sq = vaultSearchQuery.toLowerCase().trim();
        const matchesText = q.questionText?.toLowerCase().includes(sq);
        const matchesCode = q.codeSnippet?.toLowerCase().includes(sq);
        const matchesExp = q.explanation?.toLowerCase().includes(sq);
        const matchesQuiz = q.quiz?.title?.toLowerCase().includes(sq);
        const matchesCourse =
          q.quiz?.course?.title?.toLowerCase().includes(sq) ||
          q.quiz?.course?.code?.toLowerCase().includes(sq);
        if (!matchesText && !matchesCode && !matchesExp && !matchesQuiz && !matchesCourse) return false;
      }
      return true;
    });
  }, [vaultQuestions, vaultSelectedSemester, vaultSelectedCourse, vaultSelectedQuiz, vaultSearchQuery]);

  // Cascading Vault Filter Options based on selected Semester and Course
  const availableVaultCourses = useMemo(() => {
    const allCourses = vaultFilterOptions.courses || [];
    if (vaultSelectedSemester === 'ALL') {
      return allCourses;
    }
    return allCourses.filter((c) => Number(c.semester) === Number(vaultSelectedSemester));
  }, [vaultFilterOptions.courses, vaultSelectedSemester]);

  const availableVaultQuizzes = useMemo(() => {
    let allQuizzes = vaultFilterOptions.quizzes || [];
    if (vaultSelectedSemester !== 'ALL') {
      allQuizzes = allQuizzes.filter((qz) => Number(qz.semester) === Number(vaultSelectedSemester));
    }
    if (vaultSelectedCourse !== 'ALL') {
      allQuizzes = allQuizzes.filter((qz) => qz.courseId === vaultSelectedCourse);
    }
    return allQuizzes;
  }, [vaultFilterOptions.quizzes, vaultSelectedSemester, vaultSelectedCourse]);

  // Handle Semester Change with Cascading Reset
  const handleVaultSemesterChange = (newSem) => {
    setVaultSelectedSemester(newSem);
    if (newSem !== 'ALL') {
      const validCourses = (vaultFilterOptions.courses || []).filter(
        (c) => Number(c.semester) === Number(newSem)
      );
      if (!validCourses.some((c) => c.id === vaultSelectedCourse)) {
        setVaultSelectedCourse('ALL');
        setVaultSelectedQuiz('ALL');
      } else if (vaultSelectedCourse !== 'ALL') {
        const validQuizzes = (vaultFilterOptions.quizzes || []).filter(
          (qz) => Number(qz.semester) === Number(newSem) && qz.courseId === vaultSelectedCourse
        );
        if (!validQuizzes.some((qz) => qz.id === vaultSelectedQuiz)) {
          setVaultSelectedQuiz('ALL');
        }
      }
    }
    setVaultModalPage(1);
  };

  // Handle Course Change with Cascading Reset
  const handleVaultCourseChange = (newCourse) => {
    setVaultSelectedCourse(newCourse);
    if (newCourse !== 'ALL') {
      const validQuizzes = (vaultFilterOptions.quizzes || []).filter(
        (qz) => qz.courseId === newCourse && (vaultSelectedSemester === 'ALL' || Number(qz.semester) === Number(vaultSelectedSemester))
      );
      if (!validQuizzes.some((qz) => qz.id === vaultSelectedQuiz)) {
        setVaultSelectedQuiz('ALL');
      }
    }
    setVaultModalPage(1);
  };

  // Modal Pagination
  const totalVaultModalPages = Math.max(1, Math.ceil(filteredVaultQuestions.length / VAULT_PAGE_SIZE));
  const clampedVaultModalPage = Math.min(Math.max(1, vaultModalPage), totalVaultModalPages);
  const paginatedVaultQuestions = useMemo(() => {
    const start = (clampedVaultModalPage - 1) * VAULT_PAGE_SIZE;
    return filteredVaultQuestions.slice(start, start + VAULT_PAGE_SIZE);
  }, [filteredVaultQuestions, clampedVaultModalPage]);

  // Detect which question texts are already in the current quiz draft
  const existingQuestionTexts = useMemo(() => {
    const set = new Set();
    questions.forEach((q) => {
      if (q.questionText?.trim()) {
        set.add(q.questionText.trim().toLowerCase());
      }
    });
    return set;
  }, [questions]);

  // Selection handlers
  const handleToggleVaultQuestion = (id) => {
    setVaultSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllFilteredVault = () => {
    setVaultSelectedIds((prev) => {
      const next = new Set(prev);
      filteredVaultQuestions.forEach((q) => next.add(q.id));
      return next;
    });
  };

  const handleClearVaultSelection = () => {
    setVaultSelectedIds(new Set());
  };

  const handlePickVaultChunk = (count, mode = 'first') => {
    const available = filteredVaultQuestions;
    if (!available.length) return;
    const targetCount = Math.min(Number(count) || 1, available.length);

    let chosen = [];
    if (mode === 'random') {
      const shuffled = [...available].sort(() => 0.5 - Math.random());
      chosen = shuffled.slice(0, targetCount);
    } else {
      chosen = available.slice(0, targetCount);
    }

    setVaultSelectedIds((prev) => {
      const next = new Set(prev);
      chosen.forEach((q) => next.add(q.id));
      return next;
    });
  };

  // Add selected questions from Vault to current Quiz Draft
  const handleAddSelectedQuestionsFromVault = () => {
    if (vaultSelectedIds.size === 0) return;

    const selectedList = vaultQuestions.filter((q) => vaultSelectedIds.has(q.id));
    if (!selectedList.length) return;

    const formattedNewQuestions = selectedList.map((q) => {
      const opts = Array.isArray(q.options) && q.options.length >= 4
        ? q.options.slice(0, 4)
        : Array.isArray(q.options)
          ? [...q.options, '', '', ''].slice(0, 4)
          : ['', '', '', ''];

      const m = vaultMarksOption === 'apply' && marksMode === 'overall'
        ? autoMarksPerQuestion
        : (Number(q.marks) || 1);

      return {
        questionText: q.questionText || '',
        codeSnippet: q.codeSnippet || '',
        imageUrl: q.imageUrl || '',
        options: opts,
        correctOptionIndex: typeof q.correctOptionIndex === 'number' && q.correctOptionIndex >= 0 && q.correctOptionIndex <= 3
          ? q.correctOptionIndex
          : 0,
        marks: m,
        explanation: q.explanation || ''
      };
    });

    const hasAnyNonStandardMarks = formattedNewQuestions.some((q) => q.marks !== 1);
    if (hasAnyNonStandardMarks && marksMode === 'overall' && vaultMarksOption === 'keep') {
      setMarksMode('individual');
    }

    if (questions.length === 1 && !questions[0].questionText.trim()) {
      setQuestions(formattedNewQuestions);
    } else {
      setQuestions((prev) => [...prev, ...formattedNewQuestions]);
    }

    setSuccessBanner(`Successfully imported ${formattedNewQuestions.length} question${formattedNewQuestions.length > 1 ? 's' : ''} from Question Vault into your assessment draft.`);
    setIsVaultModalOpen(false);
    setVaultSelectedIds(new Set());
    setTimeout(() => setSuccessBanner(''), 5000);
  };

  // Fetch existing quiz details if quizId prop is provided (Edit Mode)
  useEffect(() => {
    if (!quizId) return;

    const fetchQuizDetails = async () => {
      try {
        setLoadingInitialQuiz(true);
        const res = await api.get(`/quizzes/${quizId}`);
        if (res.data?.success && res.data.quiz) {
          const q = res.data.quiz;
          setTitle(q.title || "");
          setDescription(q.description || "");
          if (q.courseId) setCourseId(q.courseId);
          else if (q.course?.id) setCourseId(q.course.id);
          if (q.semester || q.course?.semester) setSemester(Number(q.semester || q.course?.semester));
          if (q.durationMinutes) setDurationMinutes(q.durationMinutes);
          if (q.passingMarks) setPassingMarks(q.passingMarks);
          if (q.totalMarks) {
            setOverallQuizMarks(q.totalMarks);
            const uniqueMarks = new Set((q.questions || []).map((x) => Number(x.marks)));
            if (uniqueMarks.size > 1) setMarksMode("individual");
            else setMarksMode("overall");
          }
          if (q.negativeMarking !== undefined) setNegativeMarking(Boolean(q.negativeMarking));
          if (q.negativeMarksPerWrong) setNegativeMarksPerWrong(q.negativeMarksPerWrong);
          if (q.targetSections && Array.isArray(q.targetSections)) setTargetSections(q.targetSections);
          if (q.targetMode) setTargetMode(q.targetMode);
          if (Array.isArray(q.targetStudents)) setTargetStudents(q.targetStudents);
          if (q.accessCode) setAccessCode(q.accessCode);
          if (q.isPasswordProtected !== undefined) setIsPasswordProtected(Boolean(q.isPasswordProtected));
          if (q.isLive !== undefined) setIsLive(Boolean(q.isLive));
          if (q.startTime) {
            setScheduleType('SCHEDULED');
            const d = new Date(q.startTime);
            const pad = (n) => String(n).padStart(2, '0');
            const localIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            setScheduledStartTime(localIso);
          } else {
            setScheduleType('NOW');
          }
          if (q.timingMode) setTimingMode(q.timingMode);
          if (q.showResultsAfterSubmit !== undefined) setShowResultsAfterSubmit(Boolean(q.showResultsAfterSubmit));
          if (q.questionsPerStudent) {
            setEnableQuestionBank(true);
            setQuestionsPerStudent(Number(q.questionsPerStudent));
          } else {
            setEnableQuestionBank(false);
          }
          if (q.enableReadingComprehension !== undefined) {
            setEnableReadingComprehension(Boolean(q.enableReadingComprehension));
          }
          if (q.rcPassagesPerStudent) {
            setRcPassagesPerStudent(Number(q.rcPassagesPerStudent));
          }
          if (Array.isArray(q.passages) && q.passages.length > 0) {
            setPassages(
              q.passages.map((p, pIdx) => ({
                id: p.id || `rc-${pIdx + 1}`,
                title: p.title || `Passage ${pIdx + 1}`,
                content: p.content || '',
                imageUrl: p.imageUrl || '',
                questions: Array.isArray(p.questions) && p.questions.length > 0
                  ? p.questions.map((item) => ({
                    id: item.id,
                    questionText: item.questionText || '',
                    codeSnippet: item.codeSnippet || '',
                    imageUrl: item.imageUrl || '',
                    options: Array.isArray(item.options) ? item.options : ['', '', '', ''],
                    correctOptionIndex: Number(item.correctOptionIndex) || 0,
                    marks: Number(item.marks) || 2,
                    explanation: item.explanation || ''
                  }))
                  : [
                    {
                      id: `rc-${pIdx + 1}-q-1`,
                      questionText: '',
                      codeSnippet: '',
                      imageUrl: '',
                      options: ['', '', '', ''],
                      correctOptionIndex: 0,
                      marks: 2,
                      explanation: ''
                    }
                  ]
              }))
            );
          }
          if (Array.isArray(q.questions) && q.questions.length > 0) {
            const regularQs = q.questions.filter((item) => !item.passageId);
            if (regularQs.length > 0) {
              setQuestions(
                regularQs.map((item) => ({
                  id: item.id,
                  questionText: item.questionText || "",
                  codeSnippet: item.codeSnippet || "",
                  imageUrl: item.imageUrl || "",
                  options: Array.isArray(item.options) ? item.options : ["", "", "", ""],
                  correctOptionIndex: Number(item.correctOptionIndex) || 0,
                  marks: Number(item.marks) || 1,
                  explanation: item.explanation || ""
                }))
              );
            }
          }
        }
      } catch (err) {
        console.error("Failed to load assessment for editing", err);
        setError("Could not load assessment details for editing. Please try again.");
      } finally {
        setLoadingInitialQuiz(false);
        setHasLoadedDraft(true);
      }
    };

    fetchQuizDetails();
  }, [quizId]);

  // Restore saved draft on mount (only when creating new quiz)
  useEffect(() => {
    if (quizId) return;
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.semester) setSemester(Number(parsed.semester));
        if (parsed.courseId) setCourseId(parsed.courseId);
        if (parsed.title) setTitle(parsed.title);
        if (parsed.description) setDescription(parsed.description);
        if (parsed.durationMinutes) setDurationMinutes(parsed.durationMinutes);
        if (parsed.passingMarks) setPassingMarks(parsed.passingMarks);
        if (parsed.negativeMarking !== undefined) setNegativeMarking(parsed.negativeMarking);
        if (parsed.negativeMarksPerWrong) setNegativeMarksPerWrong(parsed.negativeMarksPerWrong);
        if (parsed.enableQuestionBank !== undefined) setEnableQuestionBank(parsed.enableQuestionBank);
        if (parsed.questionsPerStudent) setQuestionsPerStudent(Number(parsed.questionsPerStudent));
        if (parsed.marksMode) setMarksMode(parsed.marksMode);
        if (parsed.overallQuizMarks) setOverallQuizMarks(Number(parsed.overallQuizMarks));
        if (Array.isArray(parsed.targetSections) && parsed.targetSections.length > 0) {
          setTargetSections(parsed.targetSections);
        }
        if (parsed.targetMode) setTargetMode(parsed.targetMode);
        if (Array.isArray(parsed.targetStudents)) setTargetStudents(parsed.targetStudents);
        if (parsed.questionsPerPage !== undefined) setQuestionsPerPage(parsed.questionsPerPage);
        if (parsed.accessCode) setAccessCode(parsed.accessCode);
        if (parsed.isPasswordProtected !== undefined) setIsPasswordProtected(parsed.isPasswordProtected);
        if (parsed.isLive !== undefined) setIsLive(parsed.isLive);
        if (parsed.scheduleType) setScheduleType(parsed.scheduleType);
        if (parsed.scheduledStartTime) setScheduledStartTime(parsed.scheduledStartTime);
        if (parsed.timingMode) setTimingMode(parsed.timingMode);
        if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          setQuestions(parsed.questions);
        }
        if (parsed.enableReadingComprehension !== undefined) {
          setEnableReadingComprehension(Boolean(parsed.enableReadingComprehension));
        }
        if (parsed.rcPassagesPerStudent) {
          setRcPassagesPerStudent(Number(parsed.rcPassagesPerStudent));
        }
        if (Array.isArray(parsed.passages) && parsed.passages.length > 0) {
          setPassages(parsed.passages);
        }
        if (parsed.savedAt) setLastSavedTime(new Date(parsed.savedAt));
      } else {
        generateAccessCode();
      }
    } catch (e) {
      console.warn('Could not restore draft from localStorage', e);
      generateAccessCode();
    } finally {
      setHasLoadedDraft(true);
    }
  }, []);

  // Fetch all courses on load
  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoadingCourses(true);
      const [res, cfgRes, mapRes] = await Promise.allSettled([
        api.get('/courses'),
        api.get('/academic/config'),
        api.get('/quizzes/academic-map')
      ]);

      if (res.status === 'fulfilled' && res.value.data.success && res.value.data.courses.length > 0) {
        setAllCourses(res.value.data.courses);
      }
      if (cfgRes.status === 'fulfilled' && cfgRes.value.data.success && Array.isArray(cfgRes.value.data.activeSemesters)) {
        const sems = cfgRes.value.data.activeSemesters;
        if (sems.length > 0) {
          setActiveSemesters(sems);
          setSemester((prev) => sems.includes(prev) ? prev : sems[0]);
        }
      }
      if (mapRes.status === 'fulfilled' && mapRes.value.data.success) {
        if (mapRes.value.data.semesterSections) {
          setAcademicMapSections(mapRes.value.data.semesterSections);
        }
        if (mapRes.value.data.department) {
          setFacultyDeptCode(mapRes.value.data.department);
        }
        if (mapRes.value.data.departmentName) {
          setFacultyDepartment(mapRes.value.data.departmentName);
        }
      }
    } catch (err) {
      console.error('Failed to load courses', err);
      setError('Unable to load assigned courses catalog.');
    } finally {
      setLoadingCourses(false);
    }
  };

  // Filter courses strictly for the selected semester
  const semesterCourses = allCourses.filter((c) => Number(c.semester) === Number(semester));

  // Sync selected courseId when semester changes or courses load
  useEffect(() => {
    if (semesterCourses.length > 0) {
      const currentValid = semesterCourses.find((c) => c.id === courseId);
      if (!currentValid) {
        setCourseId(semesterCourses[0].id);
      }
    } else {
      setCourseId('');
    }
  }, [semester, allCourses]);

  // Fetch candidate roster count in background when semester or sections change
  useEffect(() => {
    fetchRosterSummary();
  }, [semester, targetSections]);

  const fetchRosterSummary = async () => {
    try {
      const secParam = targetSections.includes('ALL') ? 'ALL' : targetSections.join(',');
      const res = await api.get('/quizzes/academic/students', {
        params: { semester, sections: secParam }
      });
      if (res.data.success) {
        setTotalStudentsCount(res.data.totalCount);
        setRosterSectionCounts(res.data.sectionCounts || {});
        if (res.data.department) setFacultyDeptCode(res.data.department);
        if (res.data.departmentName) setFacultyDepartment(res.data.departmentName);
      }
    } catch (err) {
      // Non-fatal background fetch
    }
  };

  // Open full students modal and load detailed student list
  const handleOpenStudentsModal = async () => {
    setIsStudentModalOpen(true);
    setStudentSearch('');
    setLoadingStudents(true);
    try {
      const secParam = targetSections.includes('ALL') ? 'ALL' : targetSections.join(',');
      const res = await api.get('/quizzes/academic/students', {
        params: { semester, sections: secParam }
      });
      if (res.data.success) {
        const rawList = res.data.students || [];
        const normalizedList = rawList.map((s) => ({
          ...s,
          section: (s.section || 'UNASSIGNED').trim().toUpperCase()
        }));

        const counts = {};
        normalizedList.forEach((s) => {
          counts[s.section] = (counts[s.section] || 0) + 1;
        });

        const uniqueSecs = Object.keys(counts);
        if (uniqueSecs.length === 1) {
          setStudentModalSectionFilter(uniqueSecs[0]);
        } else {
          setStudentModalSectionFilter('ALL');
        }

        setStudentsRoster(normalizedList);
        setTotalStudentsCount(res.data.totalCount || normalizedList.length);
        setRosterSectionCounts(counts);
      }
    } catch (err) {
      alert('Failed to load enrolled student list.');
    } finally {
      setLoadingStudents(false);
    }
  };

  // Section toggle logic
  const handleToggleSection = (secName) => {
    if (secName === 'ALL') {
      setTargetSections(['ALL']);
      return;
    }

    let updated = targetSections.filter((s) => s !== 'ALL');
    if (updated.includes(secName)) {
      updated = updated.filter((s) => s !== secName);
    } else {
      updated.push(secName);
    }

    if (updated.length === 0) {
      setTargetSections(['ALL']);
    } else {
      setTargetSections(updated);
    }
  };

  const handleSelectAllInSemester = () => {
    setTargetSections(['ALL']);
  };

  // Auto-save draft on any change (with 300ms debounce)
  const hasDraftContent = Boolean(
    title.trim() ||
    description.trim() ||
    accessCode.trim() ||
    (targetMode === 'CUSTOM' && targetStudents.length > 0) ||
    questions.some((q) => q.questionText.trim() || q.options.some((o) => o.trim()) || (q.codeSnippet && q.codeSnippet.trim()) || (q.imageUrl && q.imageUrl.trim())) ||
    (enableReadingComprehension && passages.some((p) => p.content.trim() || p.title.trim() || (p.questions || []).some((q) => q.questionText.trim())))
  );

  useEffect(() => {
    if (quizId) return; // Do not overwrite drafts when editing existing quiz
    if (!hasLoadedDraft) return;

    if (!hasDraftContent) {
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch (e) { }
      setLastSavedTime(null);
      return;
    }

    const timer = setTimeout(() => {
      const draftData = {
        semester,
        courseId,
        title,
        description,
        durationMinutes,
        passingMarks,
        negativeMarking,
        negativeMarksPerWrong,
        targetSections,
        targetMode,
        targetStudents,
        accessCode,
        isPasswordProtected,
        isLive,
        scheduleType,
        scheduledStartTime,
        timingMode,
        questions,
        enableQuestionBank,
        questionsPerStudent,
        marksMode,
        overallQuizMarks,
        questionsPerPage,
        enableReadingComprehension,
        rcPassagesPerStudent,
        passages,
        savedAt: Date.now()
      };
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
        setLastSavedTime(new Date());
      } catch (e) {
        console.warn('Auto-save to localStorage failed', e);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [
    hasLoadedDraft,
    hasDraftContent,
    semester,
    courseId,
    title,
    description,
    durationMinutes,
    passingMarks,
    negativeMarking,
    negativeMarksPerWrong,
    targetSections,
    targetMode,
    targetStudents,
    accessCode,
    isPasswordProtected,
    isLive,
    scheduleType,
    scheduledStartTime,
    timingMode,
    questions,
    enableQuestionBank,
    questionsPerStudent,
    marksMode,
    overallQuizMarks,
    questionsPerPage,
    enableReadingComprehension,
    rcPassagesPerStudent,
    passages
  ]);

  // ==========================================
  // ELECTIVE / CUSTOM ROSTER MANAGEMENT
  // ==========================================

  // Unique sections detected in custom elective student roster
  const uniqueRosterSections = useMemo(() => {
    const secs = new Set();
    targetStudents.forEach((s) => {
      if (s.section && String(s.section).trim()) {
        secs.add(String(s.section).trim().toUpperCase());
      }
    });
    return Array.from(secs);
  }, [targetStudents]);

  // Filtered target students list based on search query
  const filteredTargetStudents = useMemo(() => {
    if (!rosterSearch.trim()) return targetStudents;
    const q = rosterSearch.trim().toLowerCase();
    return targetStudents.filter(
      (s) =>
        String(s.rollNo || '').toLowerCase().includes(q) ||
        String(s.name || '').toLowerCase().includes(q) ||
        String(s.section || '').toLowerCase().includes(q)
    );
  }, [targetStudents, rosterSearch]);

  // Download Sample Excel Template for Elective Roster
  const handleDownloadStudentTemplate = () => {
    const sampleRows = [
      { 'Roll Number': '21011001', 'Student Name': 'Aarav Sharma', Section: 'SEC-A' },
      { 'Roll Number': '21011002', 'Student Name': 'Ananya Verma', Section: 'SEC-B' },
      { 'Roll Number': '21011003', 'Student Name': 'Rohan Mehta', Section: 'AI' },
      { 'Roll Number': '21011004', 'Student Name': 'Sneha Rawat', Section: 'CYBER' },
      { 'Roll Number': '21011005', 'Student Name': 'Vikram Singh', Section: 'ML1' }
    ];
    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Elective_Candidates');
    XLSX.writeFile(wb, 'QuizX_Elective_Student_Template.xlsx');
  };

  // Upload and parse Excel / CSV student roster
  const handleStudentFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (!rawRows || rawRows.length === 0) {
          setError('The uploaded spreadsheet contains no student data rows.');
          return;
        }

        const existingRolls = new Set(targetStudents.map((s) => String(s.rollNo).trim().toUpperCase()));
        const newStudents = [];
        let duplicateCount = 0;

        rawRows.forEach((row) => {
          let rollNo = '';
          let name = '';
          let section = '';

          for (const [key, val] of Object.entries(row)) {
            const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            const valStr = String(val || '').trim();
            if (!rollNo && (cleanKey.includes('roll') || cleanKey.includes('univ') || cleanKey.includes('id') || cleanKey === 'student_id')) {
              rollNo = valStr;
            } else if (!name && (cleanKey.includes('name') || cleanKey.includes('student'))) {
              name = valStr;
            } else if (!section && (cleanKey.includes('sec') || cleanKey.includes('branch') || cleanKey.includes('class'))) {
              section = valStr;
            }
          }

          if (!rollNo) {
            const firstVal = Object.values(row).find((v) => String(v).trim().length > 0);
            if (firstVal) rollNo = String(firstVal).trim();
          }

          if (rollNo) {
            const normRoll = rollNo.toUpperCase();
            if (existingRolls.has(normRoll)) {
              duplicateCount++;
            } else {
              existingRolls.add(normRoll);
              newStudents.push({
                rollNo: normRoll,
                name: name || '',
                section: section ? section.toUpperCase() : ''
              });
            }
          }
        });

        if (newStudents.length === 0) {
          if (duplicateCount > 0) {
            setError(`All ${duplicateCount} students found in the file are already enrolled.`);
          } else {
            setError('Could not detect any valid student roll numbers from the uploaded file.');
          }
          return;
        }

        setTargetStudents((prev) => [...prev, ...newStudents]);
        setSuccessBanner(
          `Successfully enrolled ${newStudents.length} students from spreadsheet!${duplicateCount > 0 ? ` (${duplicateCount} duplicate roll numbers skipped)` : ''
          }`
        );
        setTimeout(() => setSuccessBanner(''), 5000);
      } catch (err) {
        console.error('Failed to parse student roster file', err);
        setError('Failed to parse spreadsheet. Please upload a valid .xlsx or .csv file.');
      } finally {
        if (electiveFileInputRef.current) electiveFileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Add single manual student
  const handleAddManualStudent = (e) => {
    if (e) e.preventDefault();
    const cleanRoll = manualStudent.rollNo.trim().toUpperCase();
    if (!cleanRoll) {
      setError('Please provide a student Roll / University ID.');
      return;
    }

    if (targetStudents.some((s) => s.rollNo.toUpperCase() === cleanRoll)) {
      setError(`Student with Roll No "${cleanRoll}" is already added.`);
      return;
    }

    setTargetStudents((prev) => [
      ...prev,
      {
        rollNo: cleanRoll,
        name: manualStudent.name.trim(),
        section: manualStudent.section.trim().toUpperCase()
      }
    ]);
    setManualStudent({ rollNo: '', name: '', section: '' });
    setError('');
  };

  // Import bulk pasted roll numbers
  const handleImportBulkRolls = () => {
    if (!bulkRollInput.trim()) {
      setError('Please paste at least one roll number.');
      return;
    }

    const rawTokens = bulkRollInput.split(/[\r\n,\s\t]+/).map((t) => t.trim().toUpperCase()).filter(Boolean);
    const existingRolls = new Set(targetStudents.map((s) => s.rollNo.toUpperCase()));
    const newStudents = [];
    let duplicates = 0;

    for (const token of rawTokens) {
      if (existingRolls.has(token)) {
        duplicates++;
      } else {
        existingRolls.add(token);
        newStudents.push({ rollNo: token, name: '', section: '' });
      }
    }

    if (newStudents.length === 0) {
      setError(`No new students added. ${duplicates > 0 ? `${duplicates} roll numbers were already added.` : ''}`);
      return;
    }

    setTargetStudents((prev) => [...prev, ...newStudents]);
    setBulkRollInput('');
    setSuccessBanner(`Added ${newStudents.length} candidate roll numbers!${duplicates > 0 ? ` (${duplicates} duplicates skipped)` : ''}`);
    setTimeout(() => setSuccessBanner(''), 5000);
  };

  const handleRemoveStudent = (rollNo) => {
    setTargetStudents((prev) => prev.filter((s) => s.rollNo !== rollNo));
  };

  const handleClearRoster = () => {
    if (window.confirm('Are you sure you want to remove all added students?')) {
      setTargetStudents([]);
    }
  };

  // ==========================================
  // QUESTION AUTHORING PAGINATION
  // ==========================================

  const effectiveQuestionsPerPage = questionsPerPage === 0 ? questions.length || 1 : questionsPerPage;
  const totalQuestionPages = Math.max(1, Math.ceil(questions.length / effectiveQuestionsPerPage));

  useEffect(() => {
    if (currentQuestionPage > totalQuestionPages) {
      setCurrentQuestionPage(totalQuestionPages);
    }
  }, [totalQuestionPages, currentQuestionPage]);

  const startQuestionIndex = (currentQuestionPage - 1) * effectiveQuestionsPerPage;
  const endQuestionIndex = Math.min(questions.length, startQuestionIndex + effectiveQuestionsPerPage);
  const visibleQuestions = questions.slice(startQuestionIndex, endQuestionIndex);

  // Is random question pool sampling active?
  const isPoolSamplingActive = Boolean(
    enableQuestionBank &&
    Number(questionsPerStudent) > 0 &&
    Number(questionsPerStudent) < questions.length
  );

  // Effective candidate questions count (respects random pool sampling limit)
  const effectiveQuestionsCount = (enableQuestionBank && Number(questionsPerStudent) > 0)
    ? Math.min(questions.length, Math.max(1, Number(questionsPerStudent)))
    : Math.max(1, questions.length);
  const candidateQuestionsCount = effectiveQuestionsCount;

  const autoMarksPerQuestion = useMemo(() => {
    const total = Number(overallQuizMarks) || 50;
    const count = effectiveQuestionsCount || 1;
    return Math.round((total / count) * 100) / 100 || 1.0;
  }, [overallQuizMarks, effectiveQuestionsCount]);

  // Pool total marks (sum of all questions in bank)
  const poolTotalMarks = useMemo(() => {
    return Math.round(questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0) * 100) / 100;
  }, [questions]);

  // Fair Allocation when question bank sampling is active
  const fairAllocation = useMemo(() => {
    if (!isPoolSamplingActive) {
      return { allocation: {}, candidateTotalMarks: poolTotalMarks, summary: '' };
    }
    return getFairQuestionBankAllocation(questions, effectiveQuestionsCount);
  }, [isPoolSamplingActive, questions, effectiveQuestionsCount, poolTotalMarks]);

  // Automatically synchronize questions marks when in overall quiz marks mode
  useEffect(() => {
    if (marksMode === "overall") {
      setQuestions((prevQuestions) => {
        let changed = false;
        const updated = prevQuestions.map((q) => {
          if (q.marks !== autoMarksPerQuestion) {
            changed = true;
            return { ...q, marks: autoMarksPerQuestion };
          }
          return q;
        });
        return changed ? updated : prevQuestions;
      });
    }
  }, [marksMode, autoMarksPerQuestion]);

  const handleOverallMarksChange = (val) => {
    const num = Math.max(1, Number(val) || 1);
    setOverallQuizMarks(num);
    setPassingMarks(Math.round(num * 0.4));
  };

  const handleSwitchMarksMode = (newMode) => {
    setMarksMode(newMode);
    if (newMode === "overall") {
      setQuestions((prev) => prev.map((q) => ({ ...q, marks: autoMarksPerQuestion })));
      setPassingMarks(Math.round((Number(overallQuizMarks) || 50) * 0.4));
    }
  };

  // Calculate live marks (candidate exam total marks, NOT pool total)
  const totalCalculatedMarks = useMemo(() => {
    if (marksMode === "overall") {
      return Number(overallQuizMarks) || 50;
    }
    if (isPoolSamplingActive) {
      return fairAllocation.candidateTotalMarks;
    }
    return poolTotalMarks;
  }, [marksMode, overallQuizMarks, isPoolSamplingActive, fairAllocation, poolTotalMarks]);

  // Calculate Reading Comprehension marks for candidate
  const candidateRcTotalMarks = useMemo(() => {
    if (!enableReadingComprehension || !Array.isArray(passages) || passages.length === 0) {
      return 0;
    }
    const k = rcPassagesPerStudent ? Math.min(Number(rcPassagesPerStudent), passages.length) : passages.length;
    let totalAllPassagesMarks = 0;
    passages.forEach((p) => {
      (p.questions || []).forEach((q) => {
        totalAllPassagesMarks += Number(q.marks || 1);
      });
    });
    return Math.round((totalAllPassagesMarks / passages.length) * k * 10) / 10;
  }, [enableReadingComprehension, passages, rcPassagesPerStudent]);

  // Combined overall marks of Assessment (Section 2 + Section 3)
  const combinedOverallMarks = useMemo(() => {
    return Math.round((totalCalculatedMarks + candidateRcTotalMarks) * 10) / 10;
  }, [totalCalculatedMarks, candidateRcTotalMarks]);

  // Keep passing marks synced with combinedOverallMarks
  useEffect(() => {
    if (combinedOverallMarks > 0) {
      setPassingMarks((prev) => {
        if (!prev || prev > combinedOverallMarks) {
          return Math.max(1, Math.round(combinedOverallMarks * 0.4));
        }
        return prev;
      });
    }
  }, [combinedOverallMarks]);

  // Copy access code
  const handleCopyCode = () => {
    if (!accessCode) return;
    navigator.clipboard.writeText(accessCode.trim());
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // ==========================================
  // EXCEL BULK IMPORT / EXPORT TEMPLATE
  // ==========================================

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Question Text': 'What is the worst-case time complexity of QuickSort?',
        'Option A': 'O(n log n)',
        'Option B': 'O(n^2)',
        'Option C': 'O(n)',
        'Option D': 'O(log n)',
        'Correct Option (A/B/C/D)': 'B',
        'Marks': 2,
        'Explanation': 'Occurs when the partition process always picks the greatest or smallest element.',
        'Code Snippet (Optional)': ''
      },
      {
        'Question Text': 'Which synchronization mechanism prevents priority inversion in real-time operating systems?',
        'Option A': 'Peterson Algorithm',
        'Option B': 'Counting Semaphore',
        'Option C': 'Priority Ceiling Protocol',
        'Option D': 'Bakery Algorithm',
        'Correct Option (A/B/C/D)': 'C',
        'Marks': 2,
        'Explanation': 'Priority Ceiling Protocol guarantees high priority tasks are never blocked indefinitely.',
        'Code Snippet (Optional)': ''
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 45 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
      { wch: 24 },
      { wch: 8 },
      { wch: 35 },
      { wch: 30 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Questions_Template');
    XLSX.writeFile(wb, 'QuizX_Questions_Template.xlsx');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (!rows || rows.length < 2) {
          setError('The uploaded Excel file does not contain question rows.');
          return;
        }

        const headerRow = rows[0].map((h) => String(h || '').trim().toLowerCase());

        const getColIdx = (names, fallback) => {
          for (let name of names) {
            const idx = headerRow.findIndex((h) => h.includes(name));
            if (idx !== -1) return idx;
          }
          return fallback;
        };

        const qIdx = getColIdx(['question', 'problem', 'statement', 'title'], 0);
        const optAIdx = getColIdx(['option a', 'opt a', 'option 1', 'opt 1'], 1);
        const optBIdx = getColIdx(['option b', 'opt b', 'option 2', 'opt 2'], 2);
        const optCIdx = getColIdx(['option c', 'opt c', 'option 3', 'opt 3'], 3);
        const optDIdx = getColIdx(['option d', 'opt d', 'option 4', 'opt 4'], 4);
        const correctIdx = getColIdx(['correct', 'answer', 'ans', 'key'], 5);
        const marksIdx = getColIdx(['mark', 'point', 'score', 'weight'], -1);
        const expIdx = getColIdx(['explain', 'explanation', 'rationale', 'reason'], 7);
        const codeIdx = getColIdx(['code', 'snippet', 'program'], 8);
        const imgIdx = getColIdx(['image', 'imageurl', 'img', 'diagram', 'photo'], -1);

        const parsedQuestions = [];

        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row || !row[qIdx] || !String(row[qIdx]).trim()) continue;

          const questionText = String(row[qIdx]).trim();
          const optA = row[optAIdx] !== undefined ? String(row[optAIdx]).trim() : '';
          const optB = row[optBIdx] !== undefined ? String(row[optBIdx]).trim() : '';
          const optC = row[optCIdx] !== undefined ? String(row[optCIdx]).trim() : '';
          const optD = row[optDIdx] !== undefined ? String(row[optDIdx]).trim() : '';

          const options = [optA, optB, optC, optD];

          const rawCorrect = row[correctIdx] !== undefined ? String(row[correctIdx]).trim().toUpperCase() : 'A';
          let correctOptionIndex = 0;

          if (rawCorrect === 'A' || rawCorrect === '1' || rawCorrect.includes('OPTION A')) {
            correctOptionIndex = 0;
          } else if (rawCorrect === 'B' || rawCorrect === '2' || rawCorrect.includes('OPTION B')) {
            correctOptionIndex = 1;
          } else if (rawCorrect === 'C' || rawCorrect === '3' || rawCorrect.includes('OPTION C')) {
            correctOptionIndex = 2;
          } else if (rawCorrect === 'D' || rawCorrect === '4' || rawCorrect.includes('OPTION D')) {
            correctOptionIndex = 3;
          } else {
            const matchedIdx = options.findIndex((o) => o.toLowerCase() === rawCorrect.toLowerCase());
            if (matchedIdx !== -1) correctOptionIndex = matchedIdx;
          }

          let marks = 1;
          let hasExplicitMarkInRow = false;
          if (marksIdx !== -1 && row[marksIdx] !== undefined && row[marksIdx] !== null && String(row[marksIdx]).trim() !== '') {
            const parsedMarks = parseFloat(String(row[marksIdx]).trim());
            if (!isNaN(parsedMarks) && parsedMarks > 0) {
              marks = parsedMarks;
              hasExplicitMarkInRow = true;
            }
          }

          const explanation = row[expIdx] !== undefined ? String(row[expIdx]).trim() : '';
          const codeSnippet = row[codeIdx] !== undefined ? String(row[codeIdx]).trim() : '';
          const imageUrl = (imgIdx !== -1 && row[imgIdx] !== undefined && row[imgIdx] !== null) ? String(row[imgIdx]).trim() : '';

          parsedQuestions.push({
            questionText,
            codeSnippet,
            imageUrl,
            options,
            correctOptionIndex,
            marks,
            explanation,
            _hasExplicitMark: hasExplicitMarkInRow
          });
        }

        if (parsedQuestions.length === 0) {
          setError('No valid questions could be extracted from the uploaded file.');
          return;
        }

        const hasAnyExplicitMarks = parsedQuestions.some((q) => q._hasExplicitMark);
        const cleanedQuestions = parsedQuestions.map(({ _hasExplicitMark, ...q }) => q);

        if (hasAnyExplicitMarks || marksIdx !== -1) {
          // Excel contains specific question marks: preserve them and switch to individual marks mode!
          setMarksMode("individual");
          if (questions.length === 1 && !questions[0].questionText.trim()) {
            setQuestions(cleanedQuestions);
          } else {
            setQuestions([...questions, ...cleanedQuestions]);
          }
          setSuccessBanner(`Imported ${cleanedQuestions.length} questions from Excel with individual question marks preserved.`);
        } else {
          // No marks column found: apply current mode
          const readyQuestions = marksMode === "overall" ? cleanedQuestions.map(q => ({ ...q, marks: autoMarksPerQuestion })) : cleanedQuestions;
          if (questions.length === 1 && !questions[0].questionText.trim()) {
            setQuestions(readyQuestions);
          } else {
            setQuestions([...questions, ...readyQuestions]);
          }
          setSuccessBanner(`Imported ${readyQuestions.length} questions from Excel spreadsheet.`);
        }

        setCurrentQuestionPage(1);
        setTimeout(() => setSuccessBanner(''), 5000);
      } catch (err) {
        console.error('File parsing error', err);
        setError('Failed to parse Excel file. Please use the official QuizX template.');
      }
    };

    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ==========================================
  // QUESTION ITEM EDITING
  // ==========================================

  const handleAddQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        questionText: '',
        codeSnippet: '',
        imageUrl: '',
        options: ['', '', '', ''],
        correctOptionIndex: 0,
        marks: marksMode === 'overall' ? autoMarksPerQuestion : 2,
        explanation: ''
      }
    ]);
    if (questionsPerPage > 0) {
      const nextTotalPages = Math.ceil((questions.length + 1) / questionsPerPage);
      setCurrentQuestionPage(nextTotalPages);
      setTimeout(() => {
        const newIdx = questions.length;
        document.getElementById(`question-card-${newIdx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  };

  const handleDuplicateQuestion = (idx) => {
    const target = questions[idx];
    const duplicated = {
      ...target,
      options: [...target.options]
    };
    const updated = [...questions];
    updated.splice(idx + 1, 0, duplicated);
    setQuestions(updated);
  };

  const handleRemoveQuestion = (idx) => {
    if (questions.length === 1) {
      alert('Assessment must contain at least one question.');
      return;
    }
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
    if (questionsPerPage > 0) {
      const nextTotalPages = Math.max(1, Math.ceil((questions.length - 1) / questionsPerPage));
      if (currentQuestionPage > nextTotalPages) {
        setCurrentQuestionPage(nextTotalPages);
      }
    }
  };

  const handleQuestionFieldChange = (idx, field, value) => {
    const updated = [...questions];
    updated[idx][field] = value;
    setQuestions(updated);
  };

  const handleOptionChange = (qIdx, optIdx, value) => {
    const updated = [...questions];
    updated[qIdx].options[optIdx] = value;
    setQuestions(updated);
  };

  const handleCorrectOptionChange = (qIdx, optIdx) => {
    const updated = [...questions];
    updated[qIdx].correctOptionIndex = optIdx;
    setQuestions(updated);
  };

  const handleImageUpload = async (qIdx, file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, WEBP, GIF, SVG).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image file size must be less than 10MB.');
      return;
    }

    try {
      setUploadingImageIndex(qIdx);
      setError('');
      const formData = new FormData();
      formData.append('image', file);

      const res = await api.post('/quizzes/upload-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (res.data?.success && (res.data?.imageUrl || res.data?.proxyUrl)) {
        const finalUrl = res.data.imageUrl || res.data.proxyUrl;
        handleQuestionFieldChange(qIdx, 'imageUrl', finalUrl);
      } else {
        setError(res.data?.message || 'Failed to upload question image to S3');
      }
    } catch (err) {
      console.error('Failed to upload question image to S3', err);
      setError(err.response?.data?.message || 'Failed to upload question image to S3');
    } finally {
      setUploadingImageIndex(null);
    }
  };

  const handleRemoveImage = (qIdx) => {
    handleQuestionFieldChange(qIdx, 'imageUrl', '');
  };

  const insertFormatting = (qIdx, syntaxType) => {
    const target = questions[qIdx];
    let currentText = target.questionText || '';
    let inserted = '';

    switch (syntaxType) {
      case 'bold':
        inserted = '**bold text**';
        break;
      case 'italic':
        inserted = '*italic text*';
        break;
      case 'code':
        inserted = '`code`';
        break;
      case 'list':
        inserted = '\n• List item';
        break;
      default:
        break;
    }

    handleQuestionFieldChange(qIdx, 'questionText', currentText + (currentText ? ' ' : '') + inserted);
  };

  const togglePreview = (qIdx) => {
    setPreviewModes((prev) => ({
      ...prev,
      [qIdx]: !prev[qIdx]
    }));
  };

  // ==========================================
  // READING COMPREHENSION (RC) HANDLERS
  // ==========================================

  const handleAddPassage = () => {
    const newPassage = {
      id: `rc-${Date.now()}`,
      title: `Passage ${passages.length + 1}`,
      content: '',
      imageUrl: '',
      questions: [
        {
          id: `rc-q-${Date.now()}-1`,
          questionText: '',
          codeSnippet: '',
          imageUrl: '',
          options: ['', '', '', ''],
          correctOptionIndex: 0,
          marks: 2,
          explanation: ''
        }
      ]
    };
    setPassages((prev) => [...prev, newPassage]);
  };

  const handleRemovePassage = (pIdx) => {
    if (passages.length === 1) {
      if (window.confirm("Do you want to turn off Reading Comprehension instead of deleting the only passage?")) {
        setEnableReadingComprehension(false);
      }
      return;
    }
    if (window.confirm(`Delete Reading Passage #${pIdx + 1}? All questions inside this passage will be removed.`)) {
      setPassages((prev) => prev.filter((_, idx) => idx !== pIdx));
    }
  };

  const handlePassageFieldChange = (pIdx, field, value) => {
    setPassages((prev) => {
      const copy = [...prev];
      copy[pIdx] = { ...copy[pIdx], [field]: value };
      return copy;
    });
  };

  const handlePassageImageUpload = async (pIdx, file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, WEBP, GIF, SVG).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Passage image file size must be less than 10MB.');
      return;
    }
    try {
      setUploadingPassageImageIdx(pIdx);
      setError('');
      const formData = new FormData();
      formData.append('image', file);
      const res = await api.post('/quizzes/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.success && (res.data?.imageUrl || res.data?.proxyUrl)) {
        const finalUrl = res.data.imageUrl || res.data.proxyUrl;
        handlePassageFieldChange(pIdx, 'imageUrl', finalUrl);
      } else {
        setError(res.data?.message || 'Failed to upload passage diagram to S3');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload passage diagram to S3');
    } finally {
      setUploadingPassageImageIdx(null);
    }
  };

  const handleAddRcQuestion = (pIdx) => {
    setPassages((prev) => {
      const copy = [...prev];
      const targetP = { ...copy[pIdx] };
      const newQ = {
        id: `rc-q-${Date.now()}`,
        questionText: '',
        codeSnippet: '',
        imageUrl: '',
        options: ['', '', '', ''],
        correctOptionIndex: 0,
        marks: 2,
        explanation: ''
      };
      targetP.questions = [...(targetP.questions || []), newQ];
      copy[pIdx] = targetP;
      return copy;
    });
  };

  const handleDuplicateRcQuestion = (pIdx, qIdx) => {
    setPassages((prev) => {
      const copy = [...prev];
      const targetP = { ...copy[pIdx] };
      const qList = [...(targetP.questions || [])];
      const targetQ = qList[qIdx];
      const dup = {
        ...targetQ,
        id: `rc-q-${Date.now()}`,
        options: [...targetQ.options]
      };
      qList.splice(qIdx + 1, 0, dup);
      targetP.questions = qList;
      copy[pIdx] = targetP;
      return copy;
    });
  };

  const handleRemoveRcQuestion = (pIdx, qIdx) => {
    setPassages((prev) => {
      const copy = [...prev];
      const targetP = { ...copy[pIdx] };
      if ((targetP.questions || []).length <= 1) {
        alert("Each reading passage must have at least one question.");
        return prev;
      }
      targetP.questions = targetP.questions.filter((_, idx) => idx !== qIdx);
      copy[pIdx] = targetP;
      return copy;
    });
  };

  const handleRcQuestionFieldChange = (pIdx, qIdx, field, value) => {
    setPassages((prev) => {
      const copy = [...prev];
      const targetP = { ...copy[pIdx] };
      const qList = [...(targetP.questions || [])];
      qList[qIdx] = { ...qList[qIdx], [field]: value };
      targetP.questions = qList;
      copy[pIdx] = targetP;
      return copy;
    });
  };

  const handleRcOptionChange = (pIdx, qIdx, optIdx, value) => {
    setPassages((prev) => {
      const copy = [...prev];
      const targetP = { ...copy[pIdx] };
      const qList = [...(targetP.questions || [])];
      const opts = [...qList[qIdx].options];
      opts[optIdx] = value;
      qList[qIdx] = { ...qList[qIdx], options: opts };
      targetP.questions = qList;
      copy[pIdx] = targetP;
      return copy;
    });
  };

  const handleRcCorrectOptionChange = (pIdx, qIdx, optIdx) => {
    setPassages((prev) => {
      const copy = [...prev];
      const targetP = { ...copy[pIdx] };
      const qList = [...(targetP.questions || [])];
      qList[qIdx] = { ...qList[qIdx], correctOptionIndex: optIdx };
      targetP.questions = qList;
      copy[pIdx] = targetP;
      return copy;
    });
  };

  const handleRcQuestionImageUpload = async (pIdx, qIdx, file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, WEBP, GIF, SVG).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image file size must be less than 10MB.');
      return;
    }
    try {
      setUploadingRcQuestionIdx({ pIdx, qIdx });
      setError('');
      const formData = new FormData();
      formData.append('image', file);
      const res = await api.post('/quizzes/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.success && (res.data?.imageUrl || res.data?.proxyUrl)) {
        const finalUrl = res.data.imageUrl || res.data.proxyUrl;
        handleRcQuestionFieldChange(pIdx, qIdx, 'imageUrl', finalUrl);
      } else {
        setError(res.data?.message || 'Failed to upload question image to S3');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload question image to S3');
    } finally {
      setUploadingRcQuestionIdx(null);
    }
  };

  // ==========================================
  // VALIDATION & SUBMISSION
  // ==========================================

  const handleSubmitQuiz = async () => {
    setError('');

    if (targetMode === 'CUSTOM' && targetStudents.length === 0) {
      setError('Please enroll at least one student in the Elective Custom Add, or switch to Class Sections mode.');
      return;
    }

    if (!title.trim()) {
      setError('Please provide a title for the assessment.');
      return;
    }


    if (isPasswordProtected && !accessCode.trim()) {
      setError('Please provide an Exam Access Password, or toggle password requirement off.');
      return;
    }

    if (questions.length === 0) {
      setError('Assessment must contain at least 1 question.');
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim()) {
        setError(`Question #${i + 1} has empty question text. Please provide question content.`);
        return;
      }
      for (let o = 0; o < q.options.length; o++) {
        if (!q.options[o].trim()) {
          setError(`Question #${i + 1} has an empty option (Option ${String.fromCharCode(65 + o)}). Please fill all options.`);
          return;
        }
      }
    }

    // Validate Reading Comprehension if enabled
    if (enableReadingComprehension) {
      if (!Array.isArray(passages) || passages.length === 0) {
        setError('Reading Comprehension is enabled. Please add at least 1 reading passage, or toggle it OFF.');
        return;
      }
      for (let pIdx = 0; pIdx < passages.length; pIdx++) {
        const p = passages[pIdx];
        if (!p.content || !p.content.trim()) {
          setError(`Reading Passage #${pIdx + 1} has empty passage text. Please enter the comprehension content.`);
          return;
        }
        if (!Array.isArray(p.questions) || p.questions.length === 0) {
          setError(`Reading Passage #${pIdx + 1} has no questions. Please add at least 1 question for this passage.`);
          return;
        }
        for (let qIdx = 0; qIdx < p.questions.length; qIdx++) {
          const q = p.questions[qIdx];
          if (!q.questionText || !q.questionText.trim()) {
            setError(`Reading Passage #${pIdx + 1}, Question #${qIdx + 1} has empty question statement.`);
            return;
          }
          for (let oIdx = 0; oIdx < (q.options || []).length; oIdx++) {
            if (!q.options[oIdx] || !q.options[oIdx].trim()) {
              setError(`Reading Passage #${pIdx + 1}, Question #${qIdx + 1} has an empty Option ${String.fromCharCode(65 + oIdx)}.`);
              return;
            }
          }
        }
      }
    }

    try {
      setIsSubmitting(true);
      let finalStartTime = null;
      let finalEndTime = null;

      const dur = Number(durationMinutes) || 25;

      if (scheduleType === 'SCHEDULED' && scheduledStartTime) {
        const startMs = new Date(scheduledStartTime).getTime();
        finalStartTime = new Date(startMs).toISOString();
        if (timingMode === 'STRICT') {
          finalEndTime = new Date(startMs + dur * 60000).toISOString();
        }
      } else if (scheduleType === 'NOW' && timingMode === 'STRICT') {
        const nowMs = Date.now();
        finalStartTime = new Date(nowMs).toISOString();
        finalEndTime = new Date(nowMs + dur * 60000).toISOString();
      }

      const payload = {
        courseId,
        title: title.trim(),
        totalMarks: Number(combinedOverallMarks),
        description: description.trim(),
        durationMinutes: Number(durationMinutes) || 25,
        passingMarks: Number(passingMarks) || Math.round(combinedOverallMarks * 0.4),
        negativeMarking,
        negativeMarksPerWrong: Number(negativeMarksPerWrong) || 0.25,
        semester: Number(semester) || 5,
        targetSections,
        targetMode,
        targetStudents: targetMode === 'CUSTOM' ? targetStudents : null,
        accessCode: isPasswordProtected ? accessCode.trim() : null,
        isPasswordProtected,
        isLive,
        startTime: finalStartTime,
        endTime: finalEndTime,
        timingMode: timingMode === 'STRICT' ? 'STRICT' : 'INDIVIDUAL',
        showResultsAfterSubmit: Boolean(showResultsAfterSubmit),
        questionsPerStudent: enableQuestionBank && Number(questionsPerStudent) > 0 ? Number(questionsPerStudent) : null,
        questions,
        enableReadingComprehension: Boolean(enableReadingComprehension),
        rcPassagesPerStudent: enableReadingComprehension && Number(rcPassagesPerStudent) > 0 ? Number(rcPassagesPerStudent) : null,
        passages: enableReadingComprehension ? passages : []
      };

      let res;
      if (quizId) {
        res = await api.put(`/quizzes/${quizId}`, payload);
      } else {
        res = await api.post('/quizzes', payload);
      }

      if (res.data?.success) {
        if (!quizId) {
          try {
            localStorage.removeItem(DRAFT_STORAGE_KEY);
          } catch (e) { }
        }
        if (onCreated) onCreated();
        if (onBack) onBack();
      }
    } catch (err) {
      console.error('Quiz creation error', err);
      const serverMsg = err.response?.data?.message || err.response?.data?.error || err.message;
      if (err.response?.status === 413 || (typeof serverMsg === 'string' && serverMsg.toLowerCase().includes('entity too large'))) {
        setError('Assessment payload is too large. Please reduce any large embedded images or question count.');
      } else {
        setError(serverMsg || 'Failed to publish assessment. Please review fields and retry.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearDraft = () => {
    if (window.confirm('Discard all entered parameters and clear this draft?')) {
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch (e) { }
      setTitle('');
      setDescription('');
      setTargetSections(['ALL']);
      setTargetMode('SECTIONS');
      setTargetStudents([]);
      setCurrentQuestionPage(1);
      generateAccessCode();
      setQuestions([
        {
          questionText: '',
          codeSnippet: '',
          imageUrl: '',
          options: ['', '', '', ''],
          correctOptionIndex: 0,
          marks: 2,
          explanation: ''
        }
      ]);
      setEnableReadingComprehension(false);
      setRcPassagesPerStudent(1);
      setPassages([
        {
          id: 'rc-1',
          title: 'Passage 1',
          content: '',
          imageUrl: '',
          questions: [
            {
              id: 'rc-1-q-1',
              questionText: '',
              codeSnippet: '',
              imageUrl: '',
              options: ['', '', '', ''],
              correctOptionIndex: 0,
              marks: 2,
              explanation: ''
            }
          ]
        }
      ]);
      setLastSavedTime(null);
    }
  };

  const handleCancel = () => {
    if (onBack) onBack();
  };

  const currentAvailableSections = useMemo(() => {
    // 1. First priority: sections dynamically mapped for this faculty's department
    if (academicMapSections && academicMapSections[semester] && academicMapSections[semester].length > 0) {
      return academicMapSections[semester];
    }
    // 2. Second priority: sections discovered directly in active enrolled roster
    const rosterSecs = Object.keys(rosterSectionCounts);
    if (rosterSecs.length > 0) {
      return rosterSecs.sort((a, b) => {
        const aIsSec = a.startsWith('SEC-');
        const bIsSec = b.startsWith('SEC-');
        if (aIsSec && !bIsSec) return -1;
        if (!aIsSec && bIsSec) return 1;
        return a.localeCompare(b);
      });
    }
    // 3. Fallback
    return ['SEC-A', 'SEC-B', 'SEC-C', 'SEC-D', 'SEC-E', 'SEC-F', 'SEC-G', 'SEC-H'];
  }, [academicMapSections, semester, rosterSectionCounts]);

  const isAllSectionsSelected = targetSections.includes('ALL') || targetSections.length === 0;

  // Filter students in modal by section tab and search query
  const filteredModalStudents = studentsRoster.filter((s) => {
    const matchesSection =
      studentModalSectionFilter === 'ALL' ||
      s.section?.toUpperCase() === studentModalSectionFilter.toUpperCase();

    const q = studentSearch.toLowerCase().trim();
    const matchesSearch =
      !q ||
      s.name?.toLowerCase().includes(q) ||
      s.rollNo?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q);

    return matchesSection && matchesSearch;
  });

  if (loadingInitialQuiz) {
    return (
      <div className="max-w-5xl mx-auto py-24 flex flex-col items-center justify-center text-center space-y-3 font-sans">
        <Loader2 size={36} className="animate-spin text-[#1c1f58]" />
        <h3 className="text-sm font-bold text-slate-800">Loading Assessment Parameters...</h3>
        <p className="text-xs text-slate-400 font-medium">Fetching author configurations and questions bank.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 font-sans">
      {/* 1. Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black text-[#1c1f58] tracking-tight">
              {quizId ? "Edit Assessment" : "Create New Assessment"}
            </h1>
            {facultyDeptCode && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-indigo-50 border border-indigo-200 text-[#1c1f58]">
                {facultyDeptCode} Department
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Select target semester, choose semester-wise subjects, inspect enrolled candidates, and author questions.
          </p>
        </div>

        {lastSavedTime && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold self-start sm:self-auto">
            <span>Draft Auto-Saved</span>
            <span className="text-emerald-600 font-normal hidden sm:inline">
              ({lastSavedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
            </span>
          </div>
        )}
      </div>

      {/* Error / Success Banners */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2.5 animate-fade-in">
          <AlertCircle size={18} className="shrink-0 text-rose-600 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successBanner && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-start gap-2.5 animate-fade-in">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-600 mt-0.5" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* 2. Assessment Meta & Configuration Card */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-black text-[#1c1f58] uppercase tracking-wider">
            1. Assessment Parameters
          </h2>
          <span className="text-[11px] font-bold text-slate-400">Step 1 of 2</span>
        </div>

        {/* Step A: Semester Selection & Semester-Wise Course Selection */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Target Semester Selector */}
          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Target Semester <span className="text-slate-400 font-normal text-[10px]">(Optional)</span>
            </label>
            <select
              value={semester}
              onChange={(e) => {
                const newSem = Number(e.target.value);
                setSemester(newSem);
                setTargetSections(['ALL']);
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-[#1c1f58] bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
            >
              {activeSemesters.map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">
              Filters courses & sections below
            </span>
          </div>

          {/* Semester-Wise Assigned Course Dropdown */}
          <div className="md:col-span-4">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Select Subject <span className="text-slate-400 font-normal text-[10px]">(Optional)</span>
            </label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              disabled={loadingCourses}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
            >
              <option value="">General Assessment (All Registered Students)</option>
              {semesterCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.title}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 block">
              {courseId ? "Subject linked" : "✓ Open to all registered students"}
            </span>
          </div>

          {/* Assessment Title */}
          <div className="md:col-span-5">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Assessment Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. AI Quest 2026: General Screening Assessment"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
            />
          </div>
        </div>

        {/* Instructions */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Instructions & Syllabus
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="e.g. Assessment open for all registered candidates. Tab switching or minimizing window will trigger security proctor lock."
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
          />
        </div>

        {/* Step B: Target Students (By Sections vs Add Students Directly) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-4">
          {/* Target Audience Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
            <div>
              <span className="text-xs font-black text-[#1c1f58] uppercase tracking-wider flex items-center gap-1.5">
                <Users size={15} />
                Target Students (All Registered Candidates)
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                All registered candidates will automatically receive access to this assessment upon login.
              </p>
            </div>

            <div className="inline-flex p-1 rounded-xl bg-slate-200/80 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setTargetMode('SECTIONS')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${targetMode === 'SECTIONS'
                  ? 'bg-white text-[#1c1f58] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <Users size={13} />
                <span>All Registered / Sections</span>
              </button>
              <button
                type="button"
                onClick={() => setTargetMode('CUSTOM')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${targetMode === 'CUSTOM'
                  ? 'bg-[#1c1f58] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <UserPlus size={13} />
                <span>Add Students (Elective)</span>
                {targetStudents.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400 text-[#1c1f58] font-black">
                    {targetStudents.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* MODE 1: Standard Class Sections */}
          {targetMode === 'SECTIONS' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-black text-[#1c1f58] uppercase tracking-wider flex items-center gap-1.5">
                    Candidate Scope (Open Access)
                  </span>
                  <p className="text-[11px] text-emerald-700 font-bold mt-0.5 flex items-center gap-1">
                    <span>✓</span> All registered students who log in will see and be able to attempt this assessment in full.
                  </p>
                </div>


                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllInSemester}
                    className="text-[11px] font-bold text-[#1c1f58] hover:underline cursor-pointer"
                  >
                    Select All Sections
                  </button>
                </div>
              </div>

              {/* Section Pills */}
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 rounded-xl bg-white border border-slate-200">
                  {/* All Sections Button */}
                  <button
                    type="button"
                    onClick={() => handleToggleSection('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${isAllSectionsSelected
                      ? 'bg-[#1c1f58] text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    All Sections
                  </button>

                  {/* Individual Section Chips */}
                  {currentAvailableSections.map((sec) => {
                    const isSelected = !isAllSectionsSelected && targetSections.includes(sec);
                    return (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => handleToggleSection(sec)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${isSelected
                          ? 'bg-indigo-600 text-white shadow-2xs ring-1 ring-indigo-700'
                          : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                          }`}
                      >
                        {sec}
                      </button>
                    );
                  })}
                </div>

                {/* Active Selection & Student Details Action Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200/80">
                  <div className="text-[11px] text-slate-600 font-medium">
                    Selected:{' '}
                    <span className="font-bold text-[#1c1f58]">
                      {isAllSectionsSelected ? `All Semester ${semester} Sections` : targetSections.join(', ')}
                    </span>
                    {totalStudentsCount !== null && (
                      <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {totalStudentsCount} {facultyDeptCode ? `${facultyDeptCode} Students` : 'Students'}
                      </span>
                    )}
                  </div>

                  {/* Section Student Details Button */}
                  <button
                    type="button"
                    onClick={handleOpenStudentsModal}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1c1f58] hover:bg-[#252975] text-white text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95 shrink-0"
                  >
                    <Users size={14} />
                    <span>View Students</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODE 2: Add Students (Elective / Multiple Sections) */}
          {targetMode === 'CUSTOM' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-black text-[#1c1f58] uppercase tracking-wider flex items-center gap-1.5">
                    <UserPlus size={15} />
                    Add Students (Elective / Multiple Sections)
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Upload an Excel file or add student roll numbers directly. Only added students can take this quiz.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadStudentTemplate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-white text-slate-700 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                    title="Download sample Excel file with Roll Number, Name, Section"
                  >
                    <Download size={13} />
                    <span>Download Sample Excel</span>
                  </button>
                </div>
              </div>

              {/* Sub-tabs for adding students: Upload Excel, Add Manually, Paste Roll Numbers */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-4 shadow-2xs">
                <div className="flex border-b border-slate-100 gap-2 pb-2">
                  <button
                    type="button"
                    onClick={() => setStudentRosterTab('excel')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${studentRosterTab === 'excel'
                      ? 'bg-indigo-50 text-[#1c1f58] font-black'
                      : 'text-slate-500 hover:text-slate-800'
                      }`}
                  >
                    <FileSpreadsheet size={14} />
                    <span>Upload Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStudentRosterTab('manual')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${studentRosterTab === 'manual'
                      ? 'bg-indigo-50 text-[#1c1f58] font-black'
                      : 'text-slate-500 hover:text-slate-800'
                      }`}
                  >
                    <Plus size={14} />
                    <span>Add Manually</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStudentRosterTab('paste')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${studentRosterTab === 'paste'
                      ? 'bg-indigo-50 text-[#1c1f58] font-black'
                      : 'text-slate-500 hover:text-slate-800'
                      }`}
                  >
                    <FileText size={14} />
                    <span>Paste Roll Numbers</span>
                  </button>
                </div>

                {/* TAB 1: Upload Excel */}
                {studentRosterTab === 'excel' && (
                  <div className="space-y-3">
                    <div
                      onClick={() => electiveFileInputRef.current?.click()}
                      className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/20 hover:bg-indigo-50/40 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
                    >
                      <div className="w-10 h-10 rounded-full bg-indigo-100 text-[#1c1f58] flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-[#1c1f58]">
                          Click to select or drop student Excel (.xlsx, .xls, .csv) file
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Columns: Roll Number, Name (optional), Section (optional)
                        </p>
                      </div>
                      <input
                        ref={electiveFileInputRef}
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        onChange={handleStudentFileUpload}
                        className="hidden"
                      />
                    </div>
                  </div>
                )}

                {/* TAB 2: Add Manually */}
                {studentRosterTab === 'manual' && (
                  <form onSubmit={handleAddManualStudent} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-black text-slate-700 mb-1">
                          Roll Number <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={manualStudent.rollNo}
                          onChange={(e) => setManualStudent((prev) => ({ ...prev, rollNo: e.target.value }))}
                          placeholder="e.g. 21011045"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-slate-700 mb-1">
                          Student Name (Optional)
                        </label>
                        <input
                          type="text"
                          value={manualStudent.name}
                          onChange={(e) => setManualStudent((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g. Aarav Sharma"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-slate-700 mb-1">
                          Section (Optional)
                        </label>
                        <input
                          type="text"
                          value={manualStudent.section}
                          onChange={(e) => setManualStudent((prev) => ({ ...prev, section: e.target.value }))}
                          placeholder="e.g. SEC-A or AI"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleAddManualStudent}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1c1f58] hover:bg-[#252975] text-white text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                      >
                        <Plus size={14} />
                        <span>Add Student</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* TAB 3: Paste Roll Numbers */}
                {studentRosterTab === 'paste' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-black text-slate-700 mb-1">
                        Paste Roll Numbers (one per line, or separated by commas or spaces)
                      </label>
                      <textarea
                        rows={3}
                        value={bulkRollInput}
                        onChange={(e) => setBulkRollInput(e.target.value)}
                        placeholder="21011001&#10;21011002&#10;21011003, 21011004"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleImportBulkRolls}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1c1f58] hover:bg-[#252975] text-white text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                      >
                        <Upload size={14} />
                        <span>Import Roll Numbers</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Added Students List Display */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[#1c1f58] uppercase tracking-wider">
                      Added Students ({targetStudents.length})
                    </span>
                    {uniqueRosterSections.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-[#1c1f58] border border-indigo-200">
                        {uniqueRosterSections.length} Sections ({uniqueRosterSections.slice(0, 4).join(', ')}{uniqueRosterSections.length > 4 ? '...' : ''})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={rosterSearch}
                        onChange={(e) => setRosterSearch(e.target.value)}
                        placeholder="Search student..."
                        className="pl-8 pr-3 py-1 rounded-lg border border-slate-200 text-[11px] font-medium text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1c1f58] w-36 sm:w-44"
                      />
                    </div>
                    {targetStudents.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearRoster}
                        className="text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                      >
                        Remove All
                      </button>
                    )}
                  </div>
                </div>

                {targetStudents.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs font-medium">
                    No students added yet. Upload an Excel file or enter roll numbers above.
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-100">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 sticky top-0 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3 w-12">#</th>
                          <th className="py-2 px-3">Roll Number</th>
                          <th className="py-2 px-3">Student Name</th>
                          <th className="py-2 px-3">Section</th>
                          <th className="py-2 px-3 text-right w-16">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {filteredTargetStudents.map((s, idx) => (
                          <tr key={s.rollNo || idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2 px-3 text-slate-400 font-bold text-[11px]">{idx + 1}</td>
                            <td className="py-2 px-3 font-extrabold text-[#1c1f58]">{s.rollNo}</td>
                            <td className="py-2 px-3 font-medium text-slate-700">
                              {s.name || <span className="text-slate-400 italic">—</span>}
                            </td>
                            <td className="py-2 px-3">
                              {s.section ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                                  {s.section}
                                </span>
                              ) : (
                                <span className="text-slate-400">&mdash;</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveStudent(s.rollNo)}
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Remove student"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Step C: Security (Exam Access Password) & Live Status */}
        <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/40 border border-indigo-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Key size={16} className="text-[#1c1f58]" />
              <span className="text-xs font-black text-[#1c1f58] uppercase tracking-wider">
                Exam Access Password Protection
              </span>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isPasswordProtected}
                  onChange={(e) => setIsPasswordProtected(e.target.checked)}
                  className="w-4 h-4 rounded text-[#1c1f58] focus:ring-[#1c1f58] border-slate-300"
                />
                <span className="text-xs font-bold text-slate-700">Require Password to Attempt</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none border-l border-slate-200 pl-4">
                <input
                  type="checkbox"
                  checked={isLive}
                  onChange={(e) => setIsLive(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                />
                <span className="text-xs font-bold text-slate-700">Set Live Immediately</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none border-l border-slate-200 pl-4" title="If unchecked, students will only see submission confirmation without scores or answers">
                <input
                  type="checkbox"
                  checked={showResultsAfterSubmit}
                  onChange={(e) => setShowResultsAfterSubmit(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <span className="text-xs font-bold text-slate-700">Show Answers & Score to Students After Submit</span>
              </label>
            </div>
          </div>

          {isPasswordProtected && (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center pt-2 border-t border-indigo-100">
              <div className="sm:col-span-8 relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  placeholder="e.g. GEU-8421"
                  className="w-full pl-3.5 pr-20 py-2.5 rounded-xl border border-indigo-200 text-xs font-mono font-black text-[#1c1f58] bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    title={showPassword ? 'Hide Password' : 'Show Password'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="p-1 rounded text-slate-400 hover:text-[#1c1f58] transition-colors cursor-pointer"
                    title="Copy Password"
                  >
                    {copiedCode ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                  </button>
                </div>
              </div>

              <div className="sm:col-span-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={generateAccessCode}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white border border-indigo-200 text-[#1c1f58] text-xs font-extrabold hover:bg-indigo-50 transition-colors cursor-pointer shadow-2xs"
                >
                  <RefreshCw size={13} />
                  <span>Auto-Generate Key</span>
                </button>
              </div>
            </div>
          )}

          <p className="text-[11px] text-slate-500 font-medium">
            Students will need this password to start the quiz.
          </p>
        </div>

        {/* Marks Allocation Method (Overall Assessment Marks vs Custom per Question) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-black text-[#1c1f58] uppercase tracking-wider flex items-center gap-1.5">
                Marks Allocation Method
              </span>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Choose whether assessment total marks are distributed evenly across questions or set per question.
              </p>
            </div>

            {/* Mode Switcher */}
            <div className="inline-flex p-1 rounded-xl bg-white border border-slate-200 shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => handleSwitchMarksMode("overall")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${marksMode === "overall"
                  ? "bg-[#1c1f58] text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                Overall Quiz Marks
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMarksMode("individual")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${marksMode === "individual"
                  ? "bg-[#1c1f58] text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                Particular Marks per Question
              </button>
            </div>
          </div>

          {marksMode === "overall" ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-100">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                    Total Assessment Marks
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={overallQuizMarks}
                    onChange={(e) => handleOverallMarksChange(Number(e.target.value))}
                    className="w-24 px-3 py-1.5 rounded-xl border border-indigo-200 bg-white text-xs font-black text-center text-[#1c1f58] shadow-2xs focus:ring-2 focus:ring-[#1c1f58]"
                  />
                </div>
                <div className="border-l border-indigo-200/80 pl-3">
                  <span className="text-[11px] font-semibold text-slate-500 block">
                    Calculated Marks per Question:
                  </span>
                  <span className="text-xs font-extrabold text-[#1c1f58]">
                    {autoMarksPerQuestion} Marks / question ({overallQuizMarks} Total ÷ {effectiveQuestionsCount} {enableQuestionBank ? "candidate sampled questions" : "questions"})
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/70 text-[11px] text-amber-900 font-medium">
              You can set custom marks for each question individually in Section 2 below. The total assessment marks will be calculated as the sum of all individual question marks.
            </div>
          )}
        </div>

        {/* Timers & Scoring Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Duration (Minutes)
            </label>
            <input
              type="number"
              min={5}
              max={180}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Passing Marks
            </label>
            <input
              type="number"
              min={1}
              value={passingMarks}
              onChange={(e) => setPassingMarks(Number(e.target.value))}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
            />
            <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">
              Default: 40% of total marks
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Negative Marking
            </label>
            <div className="flex items-center gap-3 pt-1.5">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={negativeMarking}
                  onChange={(e) => setNegativeMarking(e.target.checked)}
                  className="rounded text-[#1c1f58] focus:ring-[#1c1f58]"
                />
                <span>Enable Penalty</span>
              </label>

              {negativeMarking && (
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-slate-500 font-medium">-</span>
                  <input
                    type="number"
                    step={0.25}
                    min={0.1}
                    max={1.0}
                    value={negativeMarksPerWrong}
                    onChange={(e) => setNegativeMarksPerWrong(Number(e.target.value))}
                    className="w-16 px-2 py-1 rounded-lg border border-slate-300 text-xs font-bold text-center"
                  />
                  <span className="text-slate-400">per wrong</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Assessment Schedule & Timing Mode Policy */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={14} className="text-[#1c1f58]" />
                <span>Assessment Live Schedule & Timing Policy</span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Set when this assessment goes live for students and how exam time is enforced.
              </p>
            </div>

            {/* Schedule Type Segmented Toggle */}
            <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setScheduleType('NOW')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${scheduleType === 'NOW'
                  ? 'bg-white text-[#1c1f58] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Go Live Immediately
              </button>
              <button
                type="button"
                onClick={() => {
                  setScheduleType('SCHEDULED');
                  if (!scheduledStartTime) {
                    const nextHour = new Date();
                    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
                    const pad = (n) => String(n).padStart(2, '0');
                    const localIso = `${nextHour.getFullYear()}-${pad(nextHour.getMonth() + 1)}-${pad(nextHour.getDate())}T${pad(nextHour.getHours())}:${pad(nextHour.getMinutes())}`;
                    setScheduledStartTime(localIso);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${scheduleType === 'SCHEDULED'
                  ? 'bg-[#1c1f58] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <Calendar size={12} />
                <span>Schedule Date & Time</span>
              </button>
            </div>
          </div>

          {scheduleType === 'SCHEDULED' && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Scheduled Start Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledStartTime}
                    onChange={(e) => setScheduledStartTime(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
                  />
                  <span className="text-[10px] text-slate-400 font-medium mt-1 block">
                    Assessment will remain locked for students until this exact date and time.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Assessment Timing Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTimingMode('INDIVIDUAL')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${timingMode === 'INDIVIDUAL'
                        ? 'border-[#1c1f58] bg-indigo-50/50 ring-1 ring-[#1c1f58]'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                    >
                      <div className="text-xs font-black text-slate-900">Flexible Individual Time</div>
                      <div className="text-[10px] text-slate-500 font-medium mt-0.5 leading-tight">
                        Every student gets their full {durationMinutes} mins from whenever they start.
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTimingMode('STRICT')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${timingMode === 'STRICT'
                        ? 'border-[#1c1f58] bg-amber-50/50 ring-1 ring-[#1c1f58]'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                    >
                      <div className="text-xs font-black text-amber-950 flex items-center gap-1">
                        <span>Strict Global Window</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium mt-0.5 leading-tight">
                        Closes synchronously for all candidates. Late joiners lose elapsed time.
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Informative timing summary banner */}
              {scheduledStartTime && (
                <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={15} className={timingMode === 'STRICT' ? 'text-amber-600 shrink-0' : 'text-indigo-600 shrink-0'} />
                    <span className="font-semibold text-slate-700">
                      {timingMode === 'STRICT' ? (
                        <>
                          <strong className="text-slate-900">Synchronized Window:</strong> Starts at{' '}
                          <span className="text-[#1c1f58] font-bold">
                            {new Date(scheduledStartTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>{' '}
                          and strictly auto-locks for all students at{' '}
                          <span className="text-rose-700 font-bold">
                            {new Date(new Date(scheduledStartTime).getTime() + (Number(durationMinutes) || 25) * 60000).toLocaleTimeString([], { timeStyle: 'short' })}
                          </span>{' '}
                          ({durationMinutes} mins total duration).
                        </>
                      ) : (
                        <>
                          <strong className="text-slate-900">Individual Duration:</strong> Opens on{' '}
                          <span className="text-[#1c1f58] font-bold">
                            {new Date(scheduledStartTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                          . Each student receives full {durationMinutes} mins from their own start time.
                        </>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. Question Authoring Bank */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-black text-[#1c1f58] uppercase tracking-wider">
              {isPoolSamplingActive ? (
                <>
                  2. Question Bank ({questions.length} Pool Items &bull; {candidateQuestionsCount} per Candidate &bull; {totalCalculatedMarks} Total Marks)
                </>
              ) : (
                <>
                  2. Question Bank ({questions.length} Items &bull; {totalCalculatedMarks} Total Marks)
                </>
              )}
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Draft questions below with 4 multiple choice options.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleOpenVaultModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1c1f58] hover:bg-[#282d80] text-white text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
              title="Import previously authored questions from Question Vault"
            >
              <Archive size={14} className="text-amber-400" />
              <span>Add from Vault</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              title="Download Excel question template"
            >
              <Download size={14} />
              <span>Excel Template</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-[#1c1f58] text-xs font-bold transition-colors cursor-pointer"
              title="Bulk import questions from spreadsheet"
            >
              <Upload size={14} />
              <span>Import Questions</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Question Bank Pool Sampling Setting */}
        <div className="p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="enableQuestionBank"
                checked={enableQuestionBank}
                onChange={(e) => setEnableQuestionBank(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded text-[#1c1f58] border-slate-300 focus:ring-[#1c1f58] cursor-pointer"
              />
              <div>
                <label htmlFor="enableQuestionBank" className="text-xs font-black text-[#1c1f58] cursor-pointer">
                  Random Question Pool Sampling (Different Questions per Student)
                </label>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Each candidate will receive a distinct, randomly chosen subset of questions from this bank.
                </p>
              </div>
            </div>

            {enableQuestionBank && (
              <div className="flex items-center gap-2 sm:self-center shrink-0">
                <span className="text-xs font-bold text-slate-700">Questions per Candidate:</span>
                <input
                  type="number"
                  min={1}
                  max={questions.length}
                  value={questionsPerStudent}
                  onChange={(e) => setQuestionsPerStudent(Math.max(1, Math.min(questions.length, Number(e.target.value) || 1)))}
                  className="w-20 px-2 py-1.5 rounded-xl border border-indigo-200 bg-white text-xs font-black text-center text-[#1c1f58] shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
                />
                <span className="text-xs font-bold text-slate-400">/ {questions.length}</span>
              </div>
            )}
          </div>

          {enableQuestionBank && isPoolSamplingActive && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2.5 border-t border-indigo-100/70 text-xs">
              <div className="flex flex-wrap items-center gap-2 text-indigo-900 font-semibold">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-200/70 text-indigo-900 text-[11px]">⚖️</span>
                <span>Candidate Exam Weightage:</span>
                <span className="px-2.5 py-0.5 rounded-lg bg-white border border-indigo-200 font-black text-[#1c1f58] shadow-2xs">
                  {totalCalculatedMarks} Total Marks
                </span>
                <span className="text-slate-500 font-medium text-[11px]">
                  (Bank has {questions.length} items &bull; {poolTotalMarks} pool marks)
                </span>
              </div>
              {fairAllocation.summary && (
                <div className="text-[11px] font-bold text-indigo-700 bg-indigo-100/60 px-2.5 py-1 rounded-lg">
                  Fair Split: {fairAllocation.summary}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Questions Loop */}
        {/* Question Quick-Jump Palette & Page Size Toolbar */}
        {questions.length > 0 && (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-[#1c1f58] uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={14} />
                  Question Quick-Jump Palette ({questions.length} Items)
                </span>
                <span className="text-[11px] text-slate-500 font-medium hidden md:inline">
                  &bull; Jump directly to any question
                </span>
              </div>

              {/* Page Size Selector */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-[11px] font-bold text-slate-500">Show Per Page:</span>
                <div className="inline-flex rounded-lg bg-slate-200/70 p-0.5">
                  {[10, 20, 50, 0].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        setQuestionsPerPage(size);
                        setCurrentQuestionPage(1);
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${questionsPerPage === size
                        ? 'bg-white text-[#1c1f58] shadow-2xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      {size === 0 ? 'All' : `${size}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Compact Question Jump Pills (1 - N) */}
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 rounded-xl bg-white border border-slate-200">
              {questions.map((q, idx) => {
                const itemPage = questionsPerPage === 0 ? 1 : Math.floor(idx / questionsPerPage) + 1;
                const isCurrentPage = itemPage === currentQuestionPage;
                const isComplete = Boolean(q.questionText?.trim() && q.options?.every((o) => o?.trim()));

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (questionsPerPage > 0 && itemPage !== currentQuestionPage) {
                        setCurrentQuestionPage(itemPage);
                      }
                      setTimeout(() => {
                        document.getElementById(`question-card-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 50);
                    }}
                    title={`Question ${idx + 1} (Page ${itemPage}) &bull; ${isComplete ? 'Complete' : 'Incomplete'}`}
                    className={`h-7 min-w-7 px-1.5 rounded-lg text-[11px] font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${isCurrentPage
                      ? 'bg-[#1c1f58] text-white shadow-2xs ring-1 ring-[#1c1f58]'
                      : isComplete
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                  >
                    <span>{idx + 1}</span>
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${isCurrentPage ? 'bg-amber-400' : isComplete ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Top Pagination Bar */}
        {questionsPerPage > 0 && totalQuestionPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-bold text-slate-600">
              Showing Questions <span className="font-black text-[#1c1f58]">{startQuestionIndex + 1}</span> &ndash;{' '}
              <span className="font-black text-[#1c1f58]">{endQuestionIndex}</span> of{' '}
              <span className="font-black text-[#1c1f58]">{questions.length}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentQuestionPage <= 1}
                onClick={() => {
                  setCurrentQuestionPage((p) => Math.max(1, p - 1));
                  window.scrollTo({ top: 400, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-xs font-bold text-slate-700 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft size={15} />
                <span>Previous</span>
              </button>

              <span className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-extrabold text-[#1c1f58] shadow-2xs">
                Page {currentQuestionPage} of {totalQuestionPages}
              </span>

              <button
                type="button"
                disabled={currentQuestionPage >= totalQuestionPages}
                onClick={() => {
                  setCurrentQuestionPage((p) => Math.min(totalQuestionPages, p + 1));
                  window.scrollTo({ top: 400, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-xs font-bold text-slate-700 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <span>Next</span>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}

        {visibleQuestions.map((q, localIdx) => {
          const qIdx = startQuestionIndex + localIdx;
          const isPreview = previewModes[qIdx] || false;

          return (
            <div
              key={qIdx}
              id={`question-card-${qIdx}`}
              className="p-5 rounded-2xl border border-slate-200 bg-slate-50/20 space-y-4 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-extrabold text-[#1c1f58] tracking-tight">
                    Question {qIdx + 1}
                  </span>
                  <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                    <span className="text-[11px] font-bold text-slate-400">Marks:</span>
                    {marksMode === "overall" ? (
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-[#1c1f58] text-[11px] font-black" title="Auto-calculated from overall quiz total">
                        {q.marks} (Auto)
                      </span>
                    ) : (
                      <input
                        type="number"
                        min={0.5}
                        step={0.5}
                        value={q.marks}
                        onChange={(e) => handleQuestionFieldChange(qIdx, "marks", Number(e.target.value))}
                        className="w-12 px-1.5 py-0.5 rounded-md border border-slate-200 bg-white text-xs font-bold text-center text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1c1f58]"
                      />
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => togglePreview(qIdx)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    title={isPreview ? 'Edit Question' : 'Preview Student View'}
                  >
                    <Eye size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDuplicateQuestion(qIdx)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Duplicate Question"
                  >
                    <Copy size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRemoveQuestion(qIdx)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Delete Question"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {!isPreview && (
                <div className="flex items-center gap-1 text-slate-500">
                  <span className="text-[11px] font-bold text-slate-400 mr-1 uppercase">Format:</span>
                  <button
                    type="button"
                    onClick={() => insertFormatting(qIdx, 'bold')}
                    className="p-1 rounded hover:bg-slate-200 hover:text-slate-800 transition-colors text-xs font-bold"
                    title="Bold"
                  >
                    <Bold size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormatting(qIdx, 'italic')}
                    className="p-1 rounded hover:bg-slate-200 hover:text-slate-800 transition-colors text-xs font-bold"
                    title="Italic"
                  >
                    <Italic size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormatting(qIdx, 'code')}
                    className="p-1 rounded hover:bg-slate-200 hover:text-slate-800 transition-colors text-xs font-bold"
                    title="Inline Code"
                  >
                    <Code size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormatting(qIdx, 'list')}
                    className="p-1 rounded hover:bg-slate-200 hover:text-slate-800 transition-colors text-xs font-bold"
                    title="List Item"
                  >
                    <List size={13} />
                  </button>
                </div>
              )}

              {isPreview ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-900 whitespace-pre-wrap">
                    {q.questionText || <span className="text-slate-400 italic">No question statement provided.</span>}
                  </div>
                  {q.codeSnippet && (
                    <div className="p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto shadow-inner">
                      <pre><code>{q.codeSnippet}</code></pre>
                    </div>
                  )}
                  {q.imageUrl && (
                    <div className="flex justify-center bg-slate-50 border border-slate-200 rounded-xl p-2 cursor-pointer group" onClick={() => setZoomedImageUrl(q.imageUrl)}>
                      <img
                        src={getSafeImageUrl(q.imageUrl)}
                        alt="Question reference diagram"
                        className="max-h-60 max-w-full w-auto object-contain rounded-lg transition-transform group-hover:scale-[1.01]"
                        loading="lazy"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <textarea
                  value={q.questionText}
                  onChange={(e) => handleQuestionFieldChange(qIdx, 'questionText', e.target.value)}
                  rows={3}
                  placeholder={`Write question statement #${qIdx + 1}...`}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
                />
              )}

              {!isPreview && (
                <div className="space-y-2.5 pt-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <details className="group">
                      <summary className="text-[11px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer select-none">
                        + Attach programming snippet / ASCII diagram (Optional)
                      </summary>
                      <div className="pt-2">
                        <textarea
                          value={q.codeSnippet || ''}
                          onChange={(e) => handleQuestionFieldChange(qIdx, 'codeSnippet', e.target.value)}
                          rows={3}
                          placeholder="// Enter C/C++, Java, Python, or SQL code block..."
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono text-xs text-slate-800 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
                        />
                      </div>
                    </details>

                    {/* Image Upload Button */}
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        id={`question-img-upload-${qIdx}`}
                        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleImageUpload(qIdx, e.target.files[0]);
                            e.target.value = '';
                          }
                        }}
                      />
                      <label
                        htmlFor={`question-img-upload-${qIdx}`}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer select-none ${
                          uploadingImageIndex === qIdx
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 pointer-events-none'
                            : 'bg-slate-50 hover:bg-indigo-50/70 border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-800 shadow-2xs'
                        }`}
                        title="Upload reference diagram, flowchart, or formula image to AWS S3"
                      >
                        {uploadingImageIndex === qIdx ? (
                          <>
                            <Loader2 size={13} className="animate-spin text-indigo-600" />
                            <span>Uploading to S3...</span>
                          </>
                        ) : (
                          <>
                            <ImageIcon size={14} className="text-indigo-600" />
                            <span>{q.imageUrl ? 'Change Image' : '+ Add Reference Image'}</span>
                          </>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Attached Image Preview Card */}
                  {q.imageUrl && (
                    <div className="p-3 rounded-2xl border border-indigo-100 bg-indigo-50/30 relative transition-all">
                      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-indigo-100/80">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 text-[11px] font-extrabold text-indigo-900 bg-indigo-100/80 px-2 py-0.5 rounded-md">
                            <ImageIcon size={12} className="text-indigo-700" />
                            Reference Image
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                            AWS S3 &bull; mcq-images
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setZoomedImageUrl(q.imageUrl)}
                            className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-indigo-700 hover:border-indigo-200 text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                            title="Zoom In"
                          >
                            <Maximize2 size={12} />
                            <span>Zoom</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(qIdx)}
                            className="px-2 py-1 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                            title="Remove image"
                          >
                            <Trash2 size={12} />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>

                      <div 
                        className="flex items-center justify-center bg-white rounded-xl border border-slate-200/90 p-2 overflow-hidden max-h-64 cursor-pointer group/img"
                        onClick={() => setZoomedImageUrl(q.imageUrl)}
                        title="Click to zoom image"
                      >
                        <img
                          src={getSafeImageUrl(q.imageUrl)}
                          alt={`Question ${qIdx + 1} reference`}
                          className="max-h-60 max-w-full w-auto object-contain rounded-lg transition-transform group-hover/img:scale-[1.01]"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2 pt-2">
                <label className="block text-xs font-bold text-slate-700">
                  Multiple Choice Options & Correct Answer
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {q.options.map((opt, optIdx) => {
                    const isCorrect = q.correctOptionIndex === optIdx;
                    const letter = String.fromCharCode(65 + optIdx);

                    return (
                      <div
                        key={optIdx}
                        className={`flex items-center gap-2.5 p-2.5 rounded-2xl border transition-all ${isCorrect
                          ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500/30'
                          : 'border-slate-200 bg-slate-50/30 hover:border-slate-300'
                          }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleCorrectOptionChange(qIdx, optIdx)}
                          className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-all cursor-pointer ${isCorrect
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                            }`}
                          title={`Mark Option ${letter} as correct answer`}
                        >
                          {isCorrect ? <Check size={14} /> : letter}
                        </button>

                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => handleOptionChange(qIdx, optIdx, e.target.value)}
                          placeholder={`Option ${letter} value...`}
                          className="flex-1 bg-transparent text-xs font-semibold text-slate-900 focus:outline-none px-1"
                        />

                        {isCorrect && (
                          <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md shrink-0">
                            Correct
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Answer Explanation (Shown after submission)
                </label>
                <input
                  type="text"
                  value={q.explanation || ''}
                  onChange={(e) => handleQuestionFieldChange(qIdx, 'explanation', e.target.value)}
                  placeholder="e.g. Due to Dijkstra's greedy invariant, edge weights must be non-negative."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-slate-50/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
                />
              </div>
            </div>
          );
        })}

        {/* Bottom Pagination Bar */}
        {questionsPerPage > 0 && totalQuestionPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-bold text-slate-600">
              Showing Questions <span className="font-black text-[#1c1f58]">{startQuestionIndex + 1}</span> &ndash;{' '}
              <span className="font-black text-[#1c1f58]">{endQuestionIndex}</span> of{' '}
              <span className="font-black text-[#1c1f58]">{questions.length}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentQuestionPage <= 1}
                onClick={() => {
                  setCurrentQuestionPage((p) => Math.max(1, p - 1));
                  window.scrollTo({ top: 400, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-xs font-bold text-slate-700 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft size={15} />
                <span>Previous</span>
              </button>

              <span className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-extrabold text-[#1c1f58] shadow-2xs">
                Page {currentQuestionPage} of {totalQuestionPages}
              </span>

              <button
                type="button"
                disabled={currentQuestionPage >= totalQuestionPages}
                onClick={() => {
                  setCurrentQuestionPage((p) => Math.min(totalQuestionPages, p + 1));
                  window.scrollTo({ top: 400, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-xs font-bold text-slate-700 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <span>Next</span>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Bottom Actions inside Question Bank */}
        <div className="pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={handleAddQuestion}
            className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-white border-2 border-dashed border-slate-300 hover:border-[#1c1f58] hover:text-[#1c1f58] text-slate-600 font-extrabold text-xs transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Another Question to Bank Manually</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. READING COMPREHENSION (RC)                             */}
      {/* ========================================================= */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-6">
        {/* Header with ON/OFF Toggle Switch */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold transition-all ${
              enableReadingComprehension
                ? 'bg-[#1c1f58] text-white shadow-xs'
                : 'bg-slate-100 text-slate-400'
            }`}>
              <BookOpen size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-black text-[#1c1f58] uppercase tracking-wider">
                  3. Reading Comprehension
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-colors ${
                  enableReadingComprehension
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                }`}>
                  {enableReadingComprehension ? 'Active • Compulsory with Bank' : 'Disabled (Optional)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Draft long reading passages with multiple nested multiple-choice questions.
              </p>
            </div>
          </div>

          {/* Toggle Switch */}
          <div className="flex items-center gap-3 self-start sm:self-center bg-slate-50 border border-slate-200/80 px-3.5 py-2 rounded-2xl">
            <span className="text-xs font-bold text-slate-700 select-none">
              {enableReadingComprehension ? 'Comprehension Enabled' : 'Enable RC Section'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={enableReadingComprehension}
              onClick={() => setEnableReadingComprehension(!enableReadingComprehension)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                enableReadingComprehension ? 'bg-[#1c1f58]' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  enableReadingComprehension ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* When Disabled: Informative placeholder */}
        {!enableReadingComprehension ? (
          <div className="p-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 text-center space-y-2">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-indigo-50 text-[#1c1f58]">
              <BookOpen size={20} />
            </div>
            <h3 className="text-xs font-extrabold text-slate-700">Reading Comprehension is Currently Inactive</h3>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              If enabled, students will receive reading comprehension passages and their nested questions alongside standard Question Bank questions.
            </p>
            <button
              type="button"
              onClick={() => setEnableReadingComprehension(true)}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:border-[#1c1f58] hover:text-[#1c1f58] text-slate-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Plus size={14} />
              <span>Enable Reading Comprehension Passages</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* RC Sampling & Distribution Settings Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/40 border border-indigo-100/90 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white border border-indigo-200 flex items-center justify-center text-[#1c1f58] shrink-0 mt-0.5">
                    <Dices size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-[#1c1f58]">
                      Candidate Passage Assignment &amp; Shuffling
                    </h4>
                    <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                      Candidates will receive shuffled reading passages from this pool along with Question Bank questions.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:self-center shrink-0">
                  <span className="text-xs font-bold text-slate-700">Passages per Candidate:</span>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, passages.length)}
                    value={rcPassagesPerStudent}
                    onChange={(e) => setRcPassagesPerStudent(Math.max(1, Math.min(passages.length, Number(e.target.value) || 1)))}
                    className="w-16 px-2 py-1.5 rounded-xl border border-indigo-200 bg-white text-xs font-black text-center text-[#1c1f58] shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
                  />
                  <span className="text-xs font-bold text-slate-400">/ {passages.length} Pool</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2.5 border-t border-indigo-100/70 text-xs">
                <div className="flex flex-wrap items-center gap-2 text-indigo-900 font-semibold">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-200/70 text-indigo-900 text-[11px]">📖</span>
                  <span>RC Weightage:</span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-white border border-indigo-200 font-black text-[#1c1f58] shadow-2xs">
                    +{candidateRcTotalMarks} Marks
                  </span>
                  <span className="text-slate-500 font-medium text-[11px]">
                    ({passages.length} total passage{passages.length === 1 ? '' : 's'} drafted in pool)
                  </span>
                </div>
                <div className="text-[11px] font-bold text-emerald-800 bg-emerald-100/70 px-2.5 py-1 rounded-lg">
                  ✓ Compulsory: Bundle with Question Bank
                </div>
              </div>
            </div>

            {/* List of Reading Passages */}
            <div className="space-y-6">
              {passages.map((passage, pIdx) => (
                <div
                  key={passage.id || pIdx}
                  className="rounded-3xl border border-slate-200/90 bg-slate-50/40 p-4 sm:p-6 space-y-5 transition-all shadow-2xs"
                >
                  {/* Passage Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="px-3 py-1 rounded-xl bg-[#1c1f58] text-white text-xs font-black tracking-wider">
                        PASSAGE #{pIdx + 1}
                      </span>
                      <input
                        type="text"
                        value={passage.title || ''}
                        onChange={(e) => handlePassageFieldChange(pIdx, 'title', e.target.value)}
                        placeholder={`Passage Title / Reference (e.g. Passage ${pIdx + 1}: Modern Computing)...`}
                        className="text-xs sm:text-sm font-extrabold text-[#1c1f58] bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#1c1f58] focus:bg-white px-2 py-1 rounded-md transition-all focus:outline-none placeholder:text-slate-400 w-64 sm:w-80"
                      />
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <span className="text-[11px] font-bold text-slate-500">
                        {(passage.questions || []).length} Question{(passage.questions || []).length === 1 ? '' : 's'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemovePassage(pIdx)}
                        className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                        title="Delete this Reading Passage"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Passage Body / Multi-paragraph Statement */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-extrabold text-slate-800">
                        Comprehension Passage Content <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[11px] text-slate-400 font-medium font-mono">
                        {(passage.content || '').trim().split(/\s+/).filter(Boolean).length} words &bull; {(passage.content || '').length} chars
                      </span>
                    </div>

                    <textarea
                      rows={6}
                      value={passage.content || ''}
                      onChange={(e) => handlePassageFieldChange(pIdx, 'content', e.target.value)}
                      placeholder="Paste or write the full comprehension passage text here (paragraphs, academic excerpts, case studies, etc.)..."
                      className="w-full p-4 rounded-2xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-800 leading-relaxed shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#1c1f58] transition-all resize-y"
                    />
                  </div>

                  {/* Passage Diagram / Map Upload (Optional via S3) */}
                  <div className="pt-1">
                    {passage.imageUrl ? (
                      <div className="flex items-start gap-3 p-3 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                        <img
                          src={getSafeImageUrl(passage.imageUrl)}
                          alt="Passage Reference Diagram"
                          className="w-24 h-24 object-contain rounded-xl border border-slate-100 bg-slate-50 cursor-pointer"
                          onClick={() => setZoomedImageUrl(passage.imageUrl)}
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#1c1f58]">Passage Reference Diagram</span>
                            <button
                              type="button"
                              onClick={() => handlePassageFieldChange(pIdx, 'imageUrl', '')}
                              className="text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            This diagram/map will be shown alongside the comprehension passage in the student exam window.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label
                          htmlFor={`passage-img-upload-${pIdx}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-slate-300 hover:border-[#1c1f58] bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                        >
                          {uploadingPassageImageIdx === pIdx ? (
                            <>
                              <Loader2 size={13} className="animate-spin text-[#1c1f58]" />
                              <span>Uploading to S3...</span>
                            </>
                          ) : (
                            <>
                              <ImageIcon size={13} className="text-[#1c1f58]" />
                              <span>+ Attach Passage Diagram / Map (Optional)</span>
                            </>
                          )}
                        </label>
                        <input
                          id={`passage-img-upload-${pIdx}`}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handlePassageImageUpload(pIdx, e.target.files[0]);
                              e.target.value = '';
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Nested Questions under this Passage */}
                  <div className="space-y-4 pt-3 border-t border-slate-200/80">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                          Questions on Passage #{pIdx + 1}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-[#1c1f58] text-[10px] font-black">
                          {(passage.questions || []).length}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddRcQuestion(pIdx)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-[#1c1f58] text-[#1c1f58] text-xs font-black transition-all shadow-2xs cursor-pointer hover:bg-indigo-50/50"
                      >
                        <Plus size={13} />
                        <span>Add Question to this Passage</span>
                      </button>
                    </div>

                    {/* Question Cards Inside Passage */}
                    <div className="space-y-4">
                      {(passage.questions || []).map((q, qIdx) => (
                        <div
                          key={q.id || qIdx}
                          className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 space-y-4 shadow-2xs"
                        >
                          {/* Nested Question Top Bar */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-[#1c1f58] text-xs font-black">
                                Question {pIdx + 1}.{qIdx + 1}
                              </span>
                              <div className="flex items-center gap-1 text-xs font-bold text-slate-600">
                                <span>Marks:</span>
                                <input
                                  type="number"
                                  min={0.5}
                                  step={0.5}
                                  value={q.marks}
                                  onChange={(e) => handleRcQuestionFieldChange(pIdx, qIdx, 'marks', Math.max(0.5, Number(e.target.value) || 1))}
                                  className="w-14 px-2 py-1 rounded-lg border border-slate-200 text-center font-black text-[#1c1f58] text-xs focus:outline-none focus:ring-1 focus:ring-[#1c1f58]"
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 self-end sm:self-auto">
                              <button
                                type="button"
                                onClick={() => handleDuplicateRcQuestion(pIdx, qIdx)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Duplicate question"
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveRcQuestion(pIdx, qIdx)}
                                className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Delete question"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Nested Question Statement */}
                          <div className="space-y-1.5">
                            <textarea
                              rows={2}
                              value={q.questionText}
                              onChange={(e) => handleRcQuestionFieldChange(pIdx, qIdx, 'questionText', e.target.value)}
                              placeholder={`Write question statement #${pIdx + 1}.${qIdx + 1} based on this passage...`}
                              className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50/50 text-xs sm:text-sm font-semibold text-slate-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-[#1c1f58] focus:bg-white transition-all resize-y"
                            />
                          </div>

                          {/* 4 Options Grid */}
                          <div className="space-y-2">
                            <span className="text-[11px] font-bold text-slate-500">
                              Multiple Choice Options &amp; Correct Answer
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {(q.options || ['', '', '', '']).map((opt, optIdx) => {
                                const isCorrect = q.correctOptionIndex === optIdx;
                                return (
                                  <div
                                    key={optIdx}
                                    className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                                      isCorrect
                                        ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500'
                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => handleRcCorrectOptionChange(pIdx, qIdx, optIdx)}
                                      className={`w-7 h-7 rounded-lg font-black text-xs shrink-0 transition-colors cursor-pointer flex items-center justify-center ${
                                        isCorrect
                                          ? 'bg-emerald-600 text-white shadow-2xs'
                                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                      }`}
                                      title={isCorrect ? 'Correct Option' : 'Click to mark as correct'}
                                    >
                                      {isCorrect ? <Check size={14} /> : String.fromCharCode(65 + optIdx)}
                                    </button>
                                    <input
                                      type="text"
                                      value={opt}
                                      onChange={(e) => handleRcOptionChange(pIdx, qIdx, optIdx, e.target.value)}
                                      placeholder={`Option ${String.fromCharCode(65 + optIdx)} value...`}
                                      className="w-full bg-transparent text-xs font-medium text-slate-800 focus:outline-none"
                                    />
                                    {isCorrect && (
                                      <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider pr-1">
                                        Correct
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Explanation */}
                          <div>
                            <input
                              type="text"
                              value={q.explanation || ''}
                              onChange={(e) => handleRcQuestionFieldChange(pIdx, qIdx, 'explanation', e.target.value)}
                              placeholder="Answer explanation (optional, shown to students after evaluation)..."
                              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-medium text-slate-600 focus:outline-none focus:ring-1 focus:ring-[#1c1f58]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Another Passage Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleAddPassage}
                className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 text-[#1c1f58] font-black text-xs transition-all cursor-pointer shadow-2xs active:scale-[0.99]"
              >
                <BookOpen size={16} />
                <span>+ Add Another Reading Passage to Pool</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* FINAL PUBLISHING ACTIONS BAR                              */}
      {/* ========================================================= */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 flex-wrap">
          <span>Assessment Total:</span>
          <span className="px-3 py-1 rounded-xl bg-[#1c1f58] text-white font-black text-sm shadow-2xs">
            {combinedOverallMarks} Marks
          </span>
          {enableReadingComprehension && (
            <span className="text-xs text-indigo-700 font-extrabold bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
              ({totalCalculatedMarks} Bank + {candidateRcTotalMarks} RC)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {hasDraftContent && (
            <button
              type="button"
              onClick={handleClearDraft}
              className="px-3.5 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors cursor-pointer"
              title="Discard entered draft and start fresh"
            >
              Clear Draft
            </button>
          )}
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmitQuiz}
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl bg-[#1c1f58] hover:bg-[#252975] text-white font-black text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer active:scale-95"
          >
            <span>{isSubmitting ? (quizId ? "Saving Changes..." : "Publishing Assessment...") : (quizId ? "Save Changes" : "Publish Assessment")}</span>
          </button>
        </div>
      </div>


      {/* ========================================================= */}
      {/* 4. STUDENTS LIST MODAL (PORTAL-RENDERED TO PREVENT ANY OVERFLOW/CLIPPING) */}
      {/* ========================================================= */}
      {isStudentModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center cursor-pointer"
          onClick={() => setIsStudentModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 max-w-4xl w-full my-auto h-[80vh] max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-[#1c1f58]">
                  <Users size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#1c1f58]">
                    Students List &bull; Semester {semester}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {isAllSectionsSelected ? 'All Sections' : `Section: ${targetSections.join(', ')}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {studentsRoster.length} Students
                </span>
                <button
                  type="button"
                  onClick={() => setIsStudentModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="p-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white shrink-0">
              {/* Section Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 max-h-20 overflow-y-auto">
                {Object.keys(rosterSectionCounts).length > 1 && (
                  <button
                    type="button"
                    onClick={() => setStudentModalSectionFilter('ALL')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${studentModalSectionFilter === 'ALL'
                      ? 'bg-[#1c1f58] text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    All ({studentsRoster.length})
                  </button>
                )}
                {Object.keys(rosterSectionCounts).map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setStudentModalSectionFilter(sec)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${studentModalSectionFilter === sec || (Object.keys(rosterSectionCounts).length === 1 && studentModalSectionFilter === 'ALL')
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                  >
                    {sec} ({rosterSectionCounts[sec]})
                  </button>
                ))}
              </div>

              {/* Search box */}
              <div className="relative w-full sm:w-64 shrink-0">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search name or roll no..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1c1f58] bg-slate-50/50"
                />
              </div>
            </div>

            {/* Student Table / Scrollable Area */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar relative bg-white">
              {loadingStudents ? (
                <div className="py-20 text-center text-xs font-bold text-slate-400">
                  <div className="w-8 h-8 border-3 border-[#1c1f58] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Loading students...
                </div>
              ) : filteredModalStudents.length === 0 ? (
                <div className="py-16 text-center text-xs font-bold text-slate-400 space-y-1">
                  <Users size={32} className="text-slate-300 mx-auto" />
                  <p>No students found.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-20 shadow-xs">
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="bg-slate-50 py-3 px-4 text-slate-600 font-bold uppercase text-[10px] tracking-wider w-14 text-center">
                        #
                      </th>
                      <th className="bg-slate-50 py-3 px-4 text-slate-600 font-bold uppercase text-[10px] tracking-wider w-36">
                        Roll No
                      </th>
                      <th className="bg-slate-50 py-3 px-4 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                        Student Name
                      </th>
                      <th className="bg-slate-50 py-3 px-4 text-slate-600 font-bold uppercase text-[10px] tracking-wider w-28 text-center">
                        Section
                      </th>
                      <th className="bg-slate-50 py-3 px-4 text-slate-600 font-bold uppercase text-[10px] tracking-wider min-w-[200px]">
                        Email
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700 bg-white">
                    {filteredModalStudents.map((s, idx) => (
                      <tr key={idx} className="hover:bg-indigo-50/40 transition-colors">
                        <td className="py-2.5 px-4 text-slate-400 text-[11px] font-bold text-center">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-[#1c1f58]">
                          {s.rollNo}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">
                          {s.name}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wider inline-block">
                            {s.section}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                          {s.email}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 font-medium">
                Showing {filteredModalStudents.length} of {studentsRoster.length} students
              </span>
              <button
                type="button"
                onClick={() => setIsStudentModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-[#1c1f58] text-white text-xs font-bold hover:bg-[#252975] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================= */}
      {/* 5. QUESTION VAULT IMPORT MODAL (PORTAL-RENDERED)           */}
      {/* ========================================================= */}
      {isVaultModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 flex items-center justify-center cursor-pointer"
          onClick={() => setIsVaultModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-7 space-y-4 shadow-2xl relative border border-slate-100 max-h-[92vh] flex flex-col cursor-default animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Bar */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3.5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-[#1c1f58] flex items-center justify-center font-bold">
                  <Archive size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-[#1c1f58]">Question Vault</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-200">
                      Bank Reuse
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    Import questions from previous assessments into this quiz draft
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsVaultModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Smart Assessment Recommendation Banner — AUTHENTIC GEU ROYAL NAVY (#1c1f58) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#1c1f58] border border-[#2a2e76] text-white flex items-center justify-between gap-3 shadow-md shrink-0">
              <div className="space-y-1">

                <div className="text-2xl sm:text-3xl font-black tracking-tight flex items-baseline gap-2">
                  <span>{filteredVaultQuestions.length}</span>
                  <span className="text-sm sm:text-base font-semibold text-indigo-200">
                    {vaultSelectedSemester !== 'ALL' ? `Questions in Semester ${vaultSelectedSemester}` : 'Total Questions in Vault'}
                  </span>
                </div>
                <div className="text-xs text-indigo-100 font-medium flex items-center gap-2">
                  <span>Selected: <strong className="text-white font-bold">{vaultSelectedIds.size} Questions</strong></span>
                  <span>&bull;</span>
                  <span>Total Vault Bank: <strong className="text-white font-bold">{vaultQuestions.length}</strong></span>
                </div>
              </div>
            </div>

            {/* Breakdown Metric Tiles — 4-Box Clean Layout */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
              {/* Tile 1: Sequential Pick */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center flex flex-col justify-between">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Sequential Pick
                </div>
                <div className="flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePickVaultChunk(5, 'first')}
                    disabled={filteredVaultQuestions.length === 0}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-40"
                  >
                    + 5 Qs
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePickVaultChunk(10, 'first')}
                    disabled={filteredVaultQuestions.length === 0}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-40"
                  >
                    + 10 Qs
                  </button>
                </div>
              </div>

              {/* Tile 2: Random Shuffle */}
              <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 text-center flex flex-col justify-between">
                <div className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider mb-1.5">
                  Random Shuffle
                </div>
                <div className="flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePickVaultChunk(5, 'random')}
                    disabled={filteredVaultQuestions.length === 0}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-40 inline-flex items-center gap-1"
                  >
                    <Dices size={12} />
                    <span>5 Qs</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePickVaultChunk(10, 'random')}
                    disabled={filteredVaultQuestions.length === 0}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-40 inline-flex items-center gap-1"
                  >
                    <Dices size={12} />
                    <span>10 Qs</span>
                  </button>
                </div>
              </div>

              {/* Tile 3: Custom Random */}
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 text-center flex flex-col justify-between">
                <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1.5">
                  Custom Random
                </div>
                <div className="flex items-center justify-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max={filteredVaultQuestions.length || 100}
                    value={vaultChunkCount}
                    onChange={(e) => setVaultChunkCount(Math.max(1, Number(e.target.value) || 1))}
                    className="w-12 px-1 py-0.5 rounded-lg border border-emerald-200 text-xs font-black text-center bg-white text-emerald-950 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handlePickVaultChunk(vaultChunkCount, 'random')}
                    disabled={filteredVaultQuestions.length === 0}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-40"
                  >
                    Pick
                  </button>
                </div>
              </div>

              {/* Tile 4: Selected & Quick Actions */}
              <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100 text-center flex flex-col justify-between">
                <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1.5">
                  Selected Count
                </div>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg font-black text-amber-900 leading-none">
                    {vaultSelectedIds.size}
                  </span>
                  <div className="flex flex-col text-[10px] font-bold items-start leading-tight">
                    <button
                      type="button"
                      onClick={handleSelectAllFilteredVault}
                      disabled={filteredVaultQuestions.length === 0}
                      className="text-indigo-800 hover:underline cursor-pointer disabled:opacity-40"
                    >
                      All ({filteredVaultQuestions.length})
                    </button>
                    {vaultSelectedIds.size > 0 && (
                      <button
                        type="button"
                        onClick={handleClearVaultSelection}
                        className="text-rose-600 hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Clean Filter Controls Bar with Dynamic Cascading */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 shrink-0">
              {/* Search (5 cols) */}
              <div className="sm:col-span-5 relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={vaultSearchQuery}
                  onChange={(e) => {
                    setVaultSearchQuery(e.target.value);
                    setVaultModalPage(1);
                  }}
                  placeholder="Search questions or keywords..."
                  className="w-full pl-9 pr-7 py-1.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#1c1f58] bg-slate-50 focus:bg-white transition-all"
                />
                {vaultSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setVaultSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Semester (2 cols) */}
              <div className="sm:col-span-2">
                <select
                  value={vaultSelectedSemester}
                  onChange={(e) => handleVaultSemesterChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1c1f58] bg-slate-50 cursor-pointer"
                >
                  <option value="ALL">All Sems</option>
                  {(vaultFilterOptions.semesters || [1, 2, 3, 4, 5, 6, 7, 8]).map((sm) => (
                    <option key={sm} value={String(sm)}>
                      Sem {sm} {Number(sm) === Number(semester) ? '★' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Course (2 cols) — Cascaded from Semester */}
              <div className="sm:col-span-2">
                <select
                  value={vaultSelectedCourse}
                  onChange={(e) => handleVaultCourseChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1c1f58] bg-slate-50 cursor-pointer truncate"
                >
                  <option value="ALL">All Courses ({availableVaultCourses.length})</option>
                  {availableVaultCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assessment Bank (3 cols) — Cascaded from Semester & Course */}
              <div className="sm:col-span-3">
                <select
                  value={vaultSelectedQuiz}
                  onChange={(e) => {
                    setVaultSelectedQuiz(e.target.value);
                    setVaultModalPage(1);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1c1f58] bg-slate-50 cursor-pointer truncate"
                >
                  <option value="ALL">All Assessments ({availableVaultQuizzes.length})</option>
                  {availableVaultQuizzes.map((qz) => (
                    <option key={qz.id} value={qz.id}>
                      {qz.title} ({qz.questionCount || 0} Qs)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Questions Header & Breakdown List */}
            <div className="space-y-3 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 shrink-0">
                <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Available Vault Questions
                </h4>
                <span className="text-[11px] text-slate-400 font-medium">
                  Showing {(clampedVaultModalPage - 1) * VAULT_PAGE_SIZE + 1}–{Math.min(clampedVaultModalPage * VAULT_PAGE_SIZE, filteredVaultQuestions.length)} of {filteredVaultQuestions.length} Questions
                </span>
              </div>

              {/* Questions List Body */}
              <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                {vaultLoading ? (
                  <div className="py-12 text-center space-y-2">
                    <RefreshCw size={24} className="animate-spin text-[#1c1f58] mx-auto" />
                    <p className="text-xs font-bold text-slate-500">Loading Question Vault questions...</p>
                  </div>
                ) : vaultError ? (
                  <div className="p-6 text-center bg-rose-50 rounded-2xl border border-rose-200 space-y-2">
                    <AlertCircle size={24} className="text-rose-600 mx-auto" />
                    <p className="text-xs font-bold text-rose-800">{vaultError}</p>
                    <button
                      type="button"
                      onClick={fetchVaultQuestions}
                      className="px-4 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                ) : filteredVaultQuestions.length === 0 ? (
                  <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                    <Archive size={32} className="text-slate-300 mx-auto" />
                    <h4 className="text-sm font-bold text-slate-800">No Questions Found In Vault</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      No questions match your current semester, course, or search filters in the Question Vault.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setVaultSelectedSemester('ALL');
                        setVaultSelectedCourse('ALL');
                        setVaultSelectedQuiz('ALL');
                        setVaultSearchQuery('');
                        setVaultModalPage(1);
                      }}
                      className="px-4 py-1.5 rounded-xl bg-[#1c1f58] text-white text-xs font-bold cursor-pointer"
                    >
                      Reset Vault Filters
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paginatedVaultQuestions.map((q, idx) => {
                      const isSelected = vaultSelectedIds.has(q.id);
                      const globalIdx = (clampedVaultModalPage - 1) * VAULT_PAGE_SIZE + idx + 1;
                      const isAlreadyInDraft = existingQuestionTexts.has(q.questionText?.trim().toLowerCase());
                      const options = Array.isArray(q.options) ? q.options : [];

                      return (
                        <div
                          key={q.id}
                          onClick={() => handleToggleVaultQuestion(q.id)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${isSelected
                            ? 'border-[#1c1f58] bg-indigo-50/20 ring-1 ring-[#1c1f58]/20 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs'
                            }`}
                        >
                          {/* Header Row */}
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-xs">
                            <div className="flex items-center gap-2">
                              <div className="cursor-pointer">
                                {isSelected ? (
                                  <CheckSquare size={18} className="text-[#1c1f58]" />
                                ) : (
                                  <Square size={18} className="text-slate-300 hover:text-slate-500" />
                                )}
                              </div>
                              <span className="font-black text-slate-900 text-xs">
                                Q{globalIdx}.
                              </span>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                [{q.marks || 1} Mark{(q.marks || 1) > 1 ? 's' : ''}]
                              </span>
                              {q.quiz?.title && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                  {q.quiz.course?.code || ''} &bull; {q.quiz.title} (Sem {q.quiz.semester || q.quiz.course?.semester || 5})
                                </span>
                              )}
                              {q.imageUrl && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 inline-flex items-center gap-1">
                                  <ImageIcon size={10} /> Image Attached
                                </span>
                              )}
                            </div>

                            {isAlreadyInDraft && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                Already in draft
                              </span>
                            )}
                          </div>

                          {/* Question Text */}
                          <div className="pl-6 text-xs font-bold text-slate-900 leading-relaxed">
                            {q.questionText}
                          </div>

                          {/* Code snippet */}
                          {q.codeSnippet && (
                            <div className="ml-6 mt-2 p-2 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto">
                              <pre><code>{q.codeSnippet}</code></pre>
                            </div>
                          )}

                          {/* Image preview in vault modal */}
                          {q.imageUrl && (
                            <div className="ml-6 mt-2 inline-block bg-white border border-slate-200 rounded-lg p-1">
                              <img
                                src={getSafeImageUrl(q.imageUrl)}
                                alt="Vault question reference"
                                className="max-h-32 max-w-xs object-contain rounded"
                                loading="lazy"
                              />
                            </div>
                          )}

                          {/* Options Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6 mt-2.5">
                            {options.map((opt, oIdx) => {
                              const isCorrect = oIdx === q.correctOptionIndex;
                              const letter = String.fromCharCode(65 + oIdx);
                              return (
                                <div
                                  key={oIdx}
                                  className={`p-2 rounded-xl text-xs flex items-center justify-between border ${isCorrect
                                    ? 'border-emerald-400 bg-emerald-50/50 text-emerald-900 font-bold'
                                    : 'border-slate-200 bg-white text-slate-700'
                                    }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                                      }`}>
                                      {letter}
                                    </span>
                                    <span className="truncate">{opt}</span>
                                  </div>
                                  {isCorrect && (
                                    <span className="text-[10px] font-bold text-emerald-700 inline-flex items-center gap-1 shrink-0 ml-1">
                                      <Check size={11} strokeWidth={3} />
                                      <span>Correct</span>
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer — Clean & Sleek like Candidate Response Sheet */}
            <div className="flex flex-col sm:flex-row items-center justify-between pt-3 border-t border-slate-100 gap-3 shrink-0">
              <div className="flex items-center gap-3 text-xs w-full sm:w-auto justify-between sm:justify-start">
                <div className="text-[11px] text-slate-500 font-medium">
                  Selected: <strong className="text-slate-900 font-bold">{vaultSelectedIds.size}</strong> Questions
                </div>

                {vaultSelectedIds.size > 0 && (
                  <div className="flex items-center gap-2 pl-3 border-l border-slate-200 text-slate-600 text-[11px]">
                    <label className="flex items-center gap-1 cursor-pointer select-none">
                      <input
                        type="radio"
                        name="vaultMarksOption"
                        checked={vaultMarksOption === 'keep'}
                        onChange={() => setVaultMarksOption('keep')}
                        className="text-[#1c1f58] focus:ring-0"
                      />
                      <span>Keep Marks</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer select-none">
                      <input
                        type="radio"
                        name="vaultMarksOption"
                        checked={vaultMarksOption === 'apply'}
                        onChange={() => setVaultMarksOption('apply')}
                        className="text-[#1c1f58] focus:ring-0"
                      />
                      <span>Quiz Default</span>
                    </label>
                  </div>
                )}

                {totalVaultModalPages > 1 && (
                  <div className="flex items-center gap-1 pl-3 border-l border-slate-200">
                    <button
                      type="button"
                      onClick={() => setVaultModalPage((p) => Math.max(1, p - 1))}
                      disabled={clampedVaultModalPage === 1}
                      className="p-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <span className="px-1 text-[11px] font-bold text-slate-700">
                      {clampedVaultModalPage} / {totalVaultModalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setVaultModalPage((p) => Math.min(totalVaultModalPages, p + 1))}
                      disabled={clampedVaultModalPage === totalVaultModalPages}
                      className="p-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsVaultModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleAddSelectedQuestionsFromVault}
                  disabled={vaultSelectedIds.size === 0}
                  className="px-6 py-2.5 rounded-full bg-[#1c1f58] hover:bg-black text-white text-xs font-bold transition-all cursor-pointer shadow-md disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>
                    Add {vaultSelectedIds.size > 0 ? `${vaultSelectedIds.size} Questions` : 'Questions'} to Assessment
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Question Image Zoom Lightbox Modal */}
      {zoomedImageUrl && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setZoomedImageUrl(null)}
        >
          <div
            className="relative max-w-5xl max-h-[92vh] bg-white rounded-3xl p-3 shadow-2xl flex flex-col items-center overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-2 px-2 border-b border-slate-100">
              <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <ImageIcon size={14} className="text-indigo-600" />
                <span>Reference Diagram / Image</span>
              </span>
              <button
                type="button"
                onClick={() => setZoomedImageUrl(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-2 overflow-auto max-h-[82vh] flex items-center justify-center">
              <img
                src={getSafeImageUrl(zoomedImageUrl)}
                alt="Enlarged diagram"
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

export default CreateQuizView;
