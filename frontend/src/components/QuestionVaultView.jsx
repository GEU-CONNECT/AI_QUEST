import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Archive,
  Search,
  Filter,
  Download,
  Printer,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  BookOpen,
  Building2,
  Users,
  CheckSquare,
  FileSpreadsheet,
  FileCode,
  FileText,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  Layers,
  GraduationCap,
  Calendar,
  Eye,
  EyeOff,
  X,
  Clock,
  HelpCircle,
  ArrowLeft,
  Image as ImageIcon,
  Maximize2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../api/client';
import { getSafeImageUrl } from '../utils/imageUrl';

/**
 * QuestionVaultView
 * Unified Question Vault for Faculty and Super Control Panel (Admin)
 * Supports:
 * - Faculty authored questions repository
 * - Super Control Panel institutional hierarchy flow: University -> Department -> Semester -> Section -> Course -> Quiz -> Questions
 * - Multi-level cascading filters
 * - CSV, JSON, and Formatted Printable Question Paper / PDF export
 */
const QuestionVaultView = ({ isSuperAdmin = false, user = {} }) => {
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [questions, setQuestions] = useState([]);
  const [hierarchy, setHierarchy] = useState([]);
  const [zoomedImage, setZoomedImage] = useState(null);
  const [stats, setStats] = useState({
    totalQuestions: 0,
    totalQuizzes: 0,
    totalCourses: 0,
    totalDepartments: 0,
    totalFaculties: 0
  });
  const [filterOptions, setFilterOptions] = useState({
    universities: [],
    departments: [],
    semesters: [],
    sections: [],
    courses: [],
    quizzes: [],
    faculties: []
  });

  // Active view mode: 'banks' (stacked assessment question banks) vs 'grid' (all questions roster) vs 'flow' (hierarchical flow for admin)
  const [viewMode, setViewMode] = useState(isSuperAdmin ? 'flow' : 'banks');

  // Active quiz question bank inspector state
  const [activeQuizVaultId, setActiveQuizVaultId] = useState(null);
  const [inQuizSearch, setInQuizSearch] = useState('');
  const [activePrintQuiz, setActivePrintQuiz] = useState(null);
  const [bankPage, setBankPage] = useState(1);
  const QUESTIONS_PER_PAGE = 5;
  const questionListRef = useRef(null);

  // Filter selections
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUniversity, setSelectedUniversity] = useState('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [selectedSemester, setSelectedSemester] = useState('ALL');
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [selectedCourse, setSelectedCourse] = useState('ALL');
  const [selectedQuiz, setSelectedQuiz] = useState('ALL');
  const [selectedFaculty, setSelectedFaculty] = useState('ALL');

  // Interactive accordion state for Hierarchical Flow Tree
  const [expandedNodes, setExpandedNodes] = useState({});

  // Print modal / sheet state
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [includeAnswerKey, setIncludeAnswerKey] = useState(false);
  const [copiedQuestionId, setCopiedQuestionId] = useState(null);

  // Fetch Vault Data
  const fetchVaultData = async () => {
    try {
      setLoading(true);
      setError('');

      if (isSuperAdmin) {
        const params = {};
        if (selectedUniversity !== 'ALL') params.universityId = selectedUniversity;
        if (selectedDepartment !== 'ALL') params.department = selectedDepartment;
        if (selectedSemester !== 'ALL') params.semester = selectedSemester;
        if (selectedSection !== 'ALL') params.section = selectedSection;
        if (selectedCourse !== 'ALL') params.courseId = selectedCourse;
        if (selectedQuiz !== 'ALL') params.quizId = selectedQuiz;
        if (selectedFaculty !== 'ALL') params.facultyId = selectedFaculty;
        if (searchQuery.trim()) params.search = searchQuery.trim();

        const res = await api.get('/admin/question-vault', { params });
        if (res.data?.success) {
          setQuestions(res.data.questions || []);
          setHierarchy(res.data.hierarchy || []);
          setStats(res.data.stats || {});
          setFilterOptions(res.data.filterOptions || {});
        }
      } else {
        const params = {};
        if (selectedCourse !== 'ALL') params.courseId = selectedCourse;
        if (selectedQuiz !== 'ALL') params.quizId = selectedQuiz;
        if (selectedSemester !== 'ALL') params.semester = selectedSemester;
        if (searchQuery.trim()) params.search = searchQuery.trim();

        const res = await api.get('/quizzes/vault/questions', { params });
        if (res.data?.success) {
          setQuestions(res.data.questions || []);
          setStats({
            totalQuestions: res.data.summary?.totalQuestions || res.data.questions?.length || 0,
            totalQuizzes: res.data.summary?.totalQuizzes || 0,
            totalCourses: res.data.summary?.totalCourses || 0,
            totalDepartments: 1,
            totalFaculties: 1
          });
          setFilterOptions({
            universities: [{ id: 'geu', code: 'GEU', name: 'Graphic Era University' }],
            departments: [{ code: user?.department || 'CSE', name: user?.department || 'Computer Science' }],
            semesters: res.data.filterOptions?.semesters || [],
            sections: [],
            courses: res.data.filterOptions?.courses || [],
            quizzes: res.data.filterOptions?.quizzes || [],
            faculties: []
          });
        }
      }
    } catch (err) {
      console.error('Failed to load question vault:', err);
      setError(err.response?.data?.message || 'Failed to fetch question vault data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVaultData();
  }, [
    isSuperAdmin,
    selectedUniversity,
    selectedDepartment,
    selectedSemester,
    selectedSection,
    selectedCourse,
    selectedQuiz,
    selectedFaculty
  ]);

  // Auto-expand the first branches in flow tree on first load
  useEffect(() => {
    if (hierarchy.length > 0 && Object.keys(expandedNodes).length === 0) {
      const initial = {};
      hierarchy.forEach((u) => {
        initial[`uni-${u.code}`] = true;
        u.departments?.forEach((d) => {
          initial[`dept-${u.code}-${d.code}`] = true;
          d.semesters?.forEach((sm) => {
            initial[`sem-${u.code}-${d.code}-${sm.semester}`] = true;
          });
        });
      });
      setExpandedNodes(initial);
    }
  }, [hierarchy]);

  const toggleNode = (nodeKey) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeKey]: !prev[nodeKey]
    }));
  };

  // Group questions by Quiz / Assessment Question Bank
  const quizBanks = useMemo(() => {
    const bankMap = new Map();

    // 1. Seed from filterOptions.quizzes if available
    (filterOptions.quizzes || []).forEach((qz) => {
      bankMap.set(qz.id, {
        id: qz.id,
        title: qz.title || 'Untitled Assessment',
        semester: qz.semester || 5,
        courseCode: qz.courseCode || qz.course?.code || 'GEN',
        courseTitle: qz.courseTitle || qz.course?.title || 'Core Subject',
        courseId: qz.courseId,
        totalMarks: qz.totalMarks || 0,
        passingMarks: qz.passingMarks || 0,
        durationMinutes: qz.durationMinutes || 60,
        targetSections: Array.isArray(qz.targetSections) ? qz.targetSections : [],
        submissionCount: qz.submissionCount || 0,
        isPublished: qz.isPublished ?? true,
        questions: []
      });
    });

    // 2. Populate questions into banks
    (questions || []).forEach((q) => {
      const qz = q.quiz;
      const qzId = qz?.id || q.quizId || 'unassigned';
      if (!bankMap.has(qzId)) {
        bankMap.set(qzId, {
          id: qzId,
          title: qz?.title || 'General Assessment Bank',
          semester: qz?.semester || q.course?.semester || 5,
          courseCode: q.course?.code || qz?.course?.code || 'GEN',
          courseTitle: q.course?.title || qz?.course?.title || 'Core Subject',
          courseId: q.course?.id || qz?.course?.id,
          totalMarks: qz?.totalMarks || 0,
          passingMarks: qz?.passingMarks || 0,
          durationMinutes: qz?.durationMinutes || 60,
          targetSections: Array.isArray(qz?.targetSections)
            ? qz.targetSections
            : Array.isArray(q.sections)
              ? q.sections
              : [],
          submissionCount: qz?.submissionCount || 0,
          isPublished: qz?.isPublished ?? true,
          questions: []
        });
      }
      const bank = bankMap.get(qzId);
      if (qz?.title && bank.title === 'General Assessment Bank') bank.title = qz.title;
      if (q.course?.code && (!bank.courseCode || bank.courseCode === 'GEN')) bank.courseCode = q.course.code;
      if (q.course?.title && (!bank.courseTitle || bank.courseTitle === 'Core Subject')) bank.courseTitle = q.course.title;
      if (qz?.totalMarks && !bank.totalMarks) bank.totalMarks = qz.totalMarks;
      if (qz?.passingMarks && !bank.passingMarks) bank.passingMarks = qz.passingMarks;
      if (qz?.semester && !bank.semester) bank.semester = qz.semester;
      if (Array.isArray(qz?.targetSections) && qz.targetSections.length > 0 && bank.targetSections.length === 0) {
        bank.targetSections = qz.targetSections;
      }
      bank.questions.push(q);
    });

    const list = Array.from(bankMap.values());
    list.forEach((b) => {
      if (!b.totalMarks || b.totalMarks === 0) {
        b.totalMarks = b.questions.reduce((sum, item) => sum + (item.marks || 1), 0);
      }
    });
    return list;
  }, [questions, filterOptions.quizzes]);

  // Filtered Quiz Banks matching current filter criteria
  const filteredQuizBanks = useMemo(() => {
    return quizBanks.filter((bank) => {
      if (selectedSemester !== 'ALL' && String(bank.semester) !== String(selectedSemester)) {
        return false;
      }
      if (selectedCourse !== 'ALL' && bank.courseId !== selectedCourse && bank.courseCode !== selectedCourse) {
        return false;
      }
      if (selectedQuiz !== 'ALL' && bank.id !== selectedQuiz) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = bank.title?.toLowerCase().includes(q);
        const matchCode = bank.courseCode?.toLowerCase().includes(q);
        const matchCourseTitle = bank.courseTitle?.toLowerCase().includes(q);
        const matchQuestions = bank.questions.some((item) =>
          item.questionText?.toLowerCase().includes(q) ||
          item.explanation?.toLowerCase().includes(q) ||
          item.codeSnippet?.toLowerCase().includes(q)
        );
        if (!matchTitle && !matchCode && !matchCourseTitle && !matchQuestions) {
          return false;
        }
      }
      return true;
    });
  }, [quizBanks, selectedSemester, selectedCourse, selectedQuiz, searchQuery]);

  // Currently inspected quiz bank
  const activeBank = useMemo(() => {
    if (!activeQuizVaultId) return null;
    return quizBanks.find((b) => b.id === activeQuizVaultId) || null;
  }, [quizBanks, activeQuizVaultId]);

  // Filtered questions within the active quiz bank
  const activeBankQuestions = useMemo(() => {
    if (!activeBank) return [];
    if (!inQuizSearch.trim()) return activeBank.questions || [];
    const q = inQuizSearch.toLowerCase().trim();
    return (activeBank.questions || []).filter((item) =>
      item.questionText?.toLowerCase().includes(q) ||
      item.codeSnippet?.toLowerCase().includes(q) ||
      item.explanation?.toLowerCase().includes(q)
    );
  }, [activeBank, inQuizSearch]);

  // Reset page to 1 whenever active bank changes or search input changes
  useEffect(() => {
    setBankPage(1);
  }, [activeQuizVaultId, inQuizSearch]);

  // 5 Questions per page pagination
  const totalBankPages = Math.max(1, Math.ceil(activeBankQuestions.length / QUESTIONS_PER_PAGE));
  const clampedBankPage = Math.min(Math.max(1, bankPage), totalBankPages);

  const paginatedBankQuestions = useMemo(() => {
    const start = (clampedBankPage - 1) * QUESTIONS_PER_PAGE;
    return activeBankQuestions.slice(start, start + QUESTIONS_PER_PAGE);
  }, [activeBankQuestions, clampedBankPage]);

  const handleBankPageChange = (newPage) => {
    const p = Math.min(Math.max(1, newPage), totalBankPages);
    setBankPage(p);
    if (questionListRef.current) {
      questionListRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const getPageNumbers = (current, total) => {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages = [];
    if (current <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push('...');
      pages.push(total);
    } else if (current >= total - 3) {
      pages.push(1);
      pages.push('...');
      for (let i = total - 4; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push('...');
      pages.push(current - 1);
      pages.push(current);
      pages.push(current + 1);
      pages.push('...');
      pages.push(total);
    }
    return pages;
  };

  // Filtered questions in grid mode (client-side search fallback)
  const displayedQuestions = useMemo(() => {
    if (!searchQuery.trim()) return questions;
    const q = searchQuery.toLowerCase().trim();
    return questions.filter((item) => {
      return (
        item.questionText?.toLowerCase().includes(q) ||
        item.codeSnippet?.toLowerCase().includes(q) ||
        item.explanation?.toLowerCase().includes(q) ||
        item.quiz?.title?.toLowerCase().includes(q) ||
        item.course?.code?.toLowerCase().includes(q) ||
        item.course?.title?.toLowerCase().includes(q) ||
        item.faculty?.name?.toLowerCase().includes(q)
      );
    });
  }, [questions, searchQuery]);

  // Questions and metadata to display in the examination printable paper
  const printableQuestions = useMemo(() => {
    if (activePrintQuiz) return activePrintQuiz.questions || [];
    if (activeBank) return activeBank.questions || [];
    return displayedQuestions;
  }, [activePrintQuiz, activeBank, displayedQuestions]);

  const printableMeta = useMemo(() => {
    const target = activePrintQuiz || activeBank;
    if (target) {
      return {
        courseCode: target.courseCode || 'GEN',
        courseTitle: target.courseTitle || 'Core Module',
        semester: target.semester || 5,
        section: target.targetSections?.[0] || 'All Sections',
        assessmentTitle: target.title
      };
    }
    return {
      courseCode: displayedQuestions[0]?.course?.code || 'TCS',
      courseTitle: displayedQuestions[0]?.course?.title || 'Core Module',
      semester: displayedQuestions[0]?.course?.semester || 5,
      section: displayedQuestions[0]?.sections?.[0] || 'All Sections',
      assessmentTitle: displayedQuestions[0]?.quiz?.title || 'Central Examination'
    };
  }, [activePrintQuiz, activeBank, displayedQuestions]);

  // Copy Question Text & Options to Clipboard
  const handleCopyQuestion = (q) => {
    const options = Array.isArray(q.options) ? q.options : [];
    const correctLetter = ['A', 'B', 'C', 'D'][q.correctOptionIndex] || 'A';
    const text = [
      `Question: ${q.questionText}`,
      q.codeSnippet ? `\nCode:\n${q.codeSnippet}` : '',
      `\nOptions:`,
      options.map((opt, i) => `  ${String.fromCharCode(65 + i)}. ${opt}`).join('\n'),
      `\nCorrect Answer: Option ${correctLetter}`,
      q.explanation ? `Explanation: ${q.explanation}` : '',
      `Marks: ${q.marks} | Course: ${q.course?.code || ''} (${q.course?.title || ''})`
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(text);
    setCopiedQuestionId(q.id);
    setTimeout(() => setCopiedQuestionId(null), 2000);
  };

  // Export a Single Quiz Bank to Excel (.xlsx)
  const exportQuizBankToExcel = (bank) => {
    if (!bank || !bank.questions || bank.questions.length === 0) {
      alert('No questions in this assessment bank to export.');
      return;
    }

    const rows = bank.questions.map((q, idx) => {
      const opts = Array.isArray(q.options) ? q.options : [];
      const correctLetter = ['A', 'B', 'C', 'D'][q.correctOptionIndex] || 'A';
      const correctOptText = opts[q.correctOptionIndex] || '';
      const sections = Array.isArray(bank.targetSections) && bank.targetSections.length > 0
        ? bank.targetSections.join(', ')
        : (Array.isArray(q.sections) ? q.sections.join(', ') : 'All Sections');

      return {
        'Q.No': idx + 1,
        'Question Text': q.questionText || '',
        'Code Snippet': q.codeSnippet || '',
        'Image URL': q.imageUrl || '',
        'Option A': opts[0] || '',
        'Option B': opts[1] || '',
        'Option C': opts[2] || '',
        'Option D': opts[3] || '',
        'Correct Option': correctLetter,
        'Correct Answer Text': correctOptText,
        'Marks': q.marks || 1,
        'Academic Explanation': q.explanation || '',
        'Course Code': bank.courseCode || q.course?.code || '',
        'Course Title': bank.courseTitle || q.course?.title || '',
        'Assessment Title': bank.title || '',
        'Semester': bank.semester || q.course?.semester || 5,
        'Target Sections': sections
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 8 },   // Q.No
      { wch: 55 },  // Question Text
      { wch: 32 },  // Code Snippet
      { wch: 25 },  // Option A
      { wch: 25 },  // Option B
      { wch: 25 },  // Option C
      { wch: 25 },  // Option D
      { wch: 15 },  // Correct Option
      { wch: 25 },  // Correct Answer Text
      { wch: 8 },   // Marks
      { wch: 50 },  // Academic Explanation
      { wch: 15 },  // Course Code
      { wch: 30 },  // Course Title
      { wch: 25 },  // Assessment Title
      { wch: 10 },  // Semester
      { wch: 20 }   // Target Sections
    ];

    const wb = XLSX.utils.book_new();
    const safeSheetName = (bank.title || 'Question_Bank')
      .replace(/[:\\/?*[\]]/g, '')
      .slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName || 'Questions');

    const cleanTitle = (bank.title || 'Assessment').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanCode = (bank.courseCode || 'Quiz').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${cleanCode}_${cleanTitle}_Question_Bank.xlsx`;

    XLSX.writeFile(wb, filename);
  };

  // Export All Displayed Questions to Excel (.xlsx)
  const handleExportAllExcel = () => {
    if (!displayedQuestions.length) {
      alert('No questions available to export.');
      return;
    }

    const rows = displayedQuestions.map((q, idx) => {
      const opts = Array.isArray(q.options) ? q.options : [];
      const correctLetter = ['A', 'B', 'C', 'D'][q.correctOptionIndex] || 'A';
      const correctOptText = opts[q.correctOptionIndex] || '';
      const sections = Array.isArray(q.sections)
        ? q.sections.join(', ')
        : (Array.isArray(q.quiz?.targetSections) ? q.quiz.targetSections.join(', ') : 'All Sections');

      return {
        'Q.No': idx + 1,
        'Assessment Title': q.quiz?.title || '',
        'Course Code': q.course?.code || '',
        'Course Title': q.course?.title || '',
        'Semester': q.course?.semester || q.quiz?.semester || 5,
        'Target Sections': sections,
        'Marks': q.marks || 1,
        'Question Text': q.questionText || '',
        'Code Snippet': q.codeSnippet || '',
        'Image URL': q.imageUrl || '',
        'Option A': opts[0] || '',
        'Option B': opts[1] || '',
        'Option C': opts[2] || '',
        'Option D': opts[3] || '',
        'Correct Option': correctLetter,
        'Correct Answer Text': correctOptText,
        'Academic Explanation': q.explanation || '',
        'Faculty Author': q.faculty?.name || q.quiz?.creatorName || user?.name || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 8 },   // Q.No
      { wch: 25 },  // Assessment Title
      { wch: 15 },  // Course Code
      { wch: 30 },  // Course Title
      { wch: 10 },  // Semester
      { wch: 20 },  // Target Sections
      { wch: 8 },   // Marks
      { wch: 55 },  // Question Text
      { wch: 32 },  // Code Snippet
      { wch: 25 },  // Option A
      { wch: 25 },  // Option B
      { wch: 25 },  // Option C
      { wch: 25 },  // Option D
      { wch: 15 },  // Correct Option
      { wch: 25 },  // Correct Answer Text
      { wch: 50 },  // Academic Explanation
      { wch: 22 }   // Faculty Author
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Question_Vault');
    const filename = isSuperAdmin
      ? `GEU_Central_Question_Vault_${new Date().toISOString().slice(0, 10)}.xlsx`
      : `My_Question_Vault_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // CSV Export for displayed questions
  const handleExportCSV = () => {
    if (!displayedQuestions.length) {
      alert('No questions available to export.');
      return;
    }

    const headers = [
      'Question ID',
      'University',
      'Department',
      'Course Code',
      'Course Title',
      'Semester',
      'Assessment / Quiz Title',
      'Target Sections',
      'Faculty Author',
      'Marks',
      'Question Text',
      'Code Snippet',
      'Option A',
      'Option B',
      'Option C',
      'Option D',
      'Correct Answer',
      'Explanation',
      'Created Date'
    ];

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = displayedQuestions.map((q) => {
      const opts = Array.isArray(q.options) ? q.options : [];
      const correctLetter = ['A', 'B', 'C', 'D'][q.correctOptionIndex] || 'A';
      const sections = Array.isArray(q.sections) ? q.sections.join('; ') : Array.isArray(q.quiz?.targetSections) ? q.quiz.targetSections.join('; ') : 'All Sections';

      return [
        escapeCSV(q.id),
        escapeCSV(q.university?.name || 'Graphic Era University'),
        escapeCSV(q.department?.name || q.course?.department || 'CSE'),
        escapeCSV(q.course?.code || ''),
        escapeCSV(q.course?.title || ''),
        escapeCSV(`Semester ${q.course?.semester || q.quiz?.semester || ''}`),
        escapeCSV(q.quiz?.title || ''),
        escapeCSV(sections),
        escapeCSV(q.faculty?.name || q.quiz?.creatorName || user?.name || ''),
        escapeCSV(q.marks || 1),
        escapeCSV(q.questionText || ''),
        escapeCSV(q.codeSnippet || ''),
        escapeCSV(opts[0] || ''),
        escapeCSV(opts[1] || ''),
        escapeCSV(opts[2] || ''),
        escapeCSV(opts[3] || ''),
        escapeCSV(correctLetter),
        escapeCSV(q.explanation || ''),
        escapeCSV(q.createdAt ? new Date(q.createdAt).toLocaleDateString() : '')
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filename = isSuperAdmin
      ? `GEU_Central_Question_Vault_${new Date().toISOString().slice(0, 10)}.csv`
      : `Faculty_Question_Vault_${user?.name?.replace(/\s+/g, '_') || 'Author'}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // JSON Export for displayed questions
  const handleExportJSON = () => {
    if (!displayedQuestions.length) {
      alert('No questions available to export.');
      return;
    }

    const exportData = {
      institution: 'Graphic Era (Deemed to be University)',
      exportedAt: new Date().toISOString(),
      vaultType: isSuperAdmin ? 'Super_Admin_Central_Vault' : 'Faculty_Author_Vault',
      author: user?.name || 'Faculty User',
      totalQuestions: displayedQuestions.length,
      questions: displayedQuestions
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filename = isSuperAdmin
      ? `GEU_Question_Vault_Backup_${new Date().toISOString().slice(0, 10)}.json`
      : `My_Question_Vault_${new Date().toISOString().slice(0, 10)}.json`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Reset all filters to default state
  const handleResetFilters = () => {
    setSelectedUniversity('ALL');
    setSelectedDepartment('ALL');
    setSelectedSemester('ALL');
    setSelectedSection('ALL');
    setSelectedCourse('ALL');
    setSelectedQuiz('ALL');
    setSelectedFaculty('ALL');
    setSearchQuery('');
    setActiveQuizVaultId(null);
    setInQuizSearch('');
    setActivePrintQuiz(null);
    setBankPage(1);
  };

  // Trigger native print / PDF save
  const handleTriggerPrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* HEADER & HERO STATS BANNER                                */}
      {/* ========================================================= */}
      <div className="bg-gradient-to-r from-[#1c1f58] via-[#232873] to-[#2c3394] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none flex items-center justify-end pr-6">
          <Archive size={260} />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-white/15 text-indigo-100 backdrop-blur-md border border-white/20">
              <span>{isSuperAdmin ? 'Super Control Panel • Central Bank' : 'Faculty Assessment Repository'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
              <Archive size={28} className="text-indigo-300" />
              <span>{isSuperAdmin ? 'Institutional Question Vault' : 'My Question Vault'}</span>
            </h1>
            <p className="text-xs sm:text-sm text-indigo-100 leading-relaxed font-medium">
              {isSuperAdmin
                ? 'Centralized institutional question bank across Graphic Era University. Seamlessly explore questions organized hierarchically from University, Department, Semester, Section, down to Course & Quiz level, or export examination dossiers.'
                : 'All multiple-choice questions authored across your assessments. Filter by course, semester, or quiz title, and download test papers or question bank backups anytime.'}
            </p>
          </div>

          {/* Action Buttons: Export & Print */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportAllExcel}
              disabled={loading || displayedQuestions.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#1c1f58] text-xs font-bold hover:bg-indigo-50 transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
              title="Download entire question vault as formatted Excel spreadsheet (.xlsx)"
            >
              <FileSpreadsheet size={15} className="text-emerald-600" />
              <span>Download Excel</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={loading || displayedQuestions.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-md border border-white/20 transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
              title="Download CSV format"
            >
              <Download size={15} className="text-indigo-200" />
              <span>Download CSV</span>
            </button>

            <button
              type="button"
              onClick={handleExportJSON}
              disabled={loading || displayedQuestions.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-md border border-white/20 transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
              title="Download structured JSON backup"
            >
              <FileCode size={15} className="text-amber-300" />
              <span>Export JSON</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActivePrintQuiz(null);
                setShowPrintModal(true);
              }}
              disabled={loading || displayedQuestions.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
              title="Print formatted Graphic Era exam paper / PDF"
            >
              <Printer size={15} />
              <span>Exam Paper / PDF</span>
            </button>
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="mt-6 pt-6 border-t border-white/15 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3.5 border border-white/10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">Total Questions</span>
            <div className="text-xl sm:text-2xl font-black text-white mt-1">{stats.totalQuestions}</div>
            <span className="text-[10px] text-indigo-200">Verified MCQ Items</span>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3.5 border border-white/10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">Assessments</span>
            <div className="text-xl sm:text-2xl font-black text-white mt-1">{stats.totalQuizzes}</div>
            <span className="text-[10px] text-indigo-200">Active Test Modules</span>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3.5 border border-white/10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">Subjects / Courses</span>
            <div className="text-xl sm:text-2xl font-black text-white mt-1">{stats.totalCourses}</div>
            <span className="text-[10px] text-indigo-200">Core Curriculum</span>
          </div>

          {isSuperAdmin && (
            <>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3.5 border border-white/10">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">Departments</span>
                <div className="text-xl sm:text-2xl font-black text-white mt-1">{stats.totalDepartments || 2}</div>
                <span className="text-[10px] text-indigo-200">CSE, CA & Allied</span>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3.5 border border-white/10">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">Faculty Authors</span>
                <div className="text-xl sm:text-2xl font-black text-white mt-1">{stats.totalFaculties || 1}</div>
                <span className="text-[10px] text-indigo-200">Question Contributors</span>
              </div>
            </>
          )}

          {!isSuperAdmin && (
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3.5 border border-white/10">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">Filtered View</span>
              <div className="text-xl sm:text-2xl font-black text-white mt-1">{filteredQuizBanks.length} Banks</div>
              <span className="text-[10px] text-indigo-200">{displayedQuestions.length} Matching Questions</span>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* FILTER CONTROLS & VIEW SWITCHER                           */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search question text, code snippet, course, or explanation..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1c1f58] bg-slate-50/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Right controls: View Mode Switcher + Refresh */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setViewMode('banks');
                  setActiveQuizVaultId(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === 'banks'
                    ? 'bg-[#1c1f58] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <Layers size={13} />
                <span>Assessment Banks ({quizBanks.length})</span>
              </button>

              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('flow');
                    setActiveQuizVaultId(null);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === 'flow'
                      ? 'bg-[#1c1f58] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  <Building2 size={13} />
                  <span>Hierarchical Flow</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={fetchVaultData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin text-[#1c1f58]' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {(selectedDepartment !== 'ALL' ||
              selectedSemester !== 'ALL' ||
              selectedSection !== 'ALL' ||
              selectedCourse !== 'ALL' ||
              selectedQuiz !== 'ALL' ||
              selectedFaculty !== 'ALL' ||
              searchQuery) && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-xs font-bold text-rose-600 hover:text-rose-800 px-2 py-1 transition-colors"
                >
                  Clear Filters
                </button>
              )}
          </div>
        </div>

        {/* Dynamic Cascading Filters Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100">
          {/* Department Filter (Admin) */}
          {isSuperAdmin && (
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-600 tracking-wider mb-1">
                Department
              </label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1c1f58] text-slate-800"
              >
                <option value="ALL">All Departments</option>
                {filterOptions.departments?.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name || d.code}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Semester Filter */}
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-600 tracking-wider mb-1">
              Semester
            </label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1c1f58] text-slate-800"
            >
              <option value="ALL">All Semesters</option>
              {filterOptions.semesters?.map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>
          </div>

          {/* Section Filter (Admin) */}
          {isSuperAdmin && (
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-600 tracking-wider mb-1">
                Section
              </label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1c1f58] text-slate-800"
              >
                <option value="ALL">All Sections</option>
                {filterOptions.sections?.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Course / Subject Filter */}
          <div className={isSuperAdmin ? '' : 'sm:col-span-2'}>
            <label className="block text-[10px] font-black uppercase text-slate-600 tracking-wider mb-1">
              Course / Subject
            </label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1c1f58] text-slate-800 truncate"
            >
              <option value="ALL">All Courses</option>
              {filterOptions.courses?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Assessment / Quiz Filter */}
          <div className={isSuperAdmin ? '' : 'sm:col-span-2'}>
            <label className="block text-[10px] font-black uppercase text-slate-600 tracking-wider mb-1">
              Assessment
            </label>
            <select
              value={selectedQuiz}
              onChange={(e) => setSelectedQuiz(e.target.value)}
              className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1c1f58] text-slate-800 truncate"
            >
              <option value="ALL">All Quizzes</option>
              {filterOptions.quizzes?.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                </option>
              ))}
            </select>
          </div>

          {/* Faculty Author Filter (Admin Only) */}
          {isSuperAdmin && (
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-600 tracking-wider mb-1">
                Faculty Author
              </label>
              <select
                value={selectedFaculty}
                onChange={(e) => setSelectedFaculty(e.target.value)}
                className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1c1f58] text-slate-800 truncate"
              >
                <option value="ALL">All Authors</option>
                {filterOptions.faculties?.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* VIEW MODE 1: HIERARCHICAL FLOW TREE (Super Admin Flow)     */}
      {/* University -> Department -> Semester -> Section -> Course -> Quiz -> Questions */}
      {/* ========================================================= */}
      {isSuperAdmin && viewMode === 'flow' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Layers size={18} className="text-[#1c1f58]" />
                <span>Institutional Flow Tree</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                University &rarr; Department &rarr; Semester &rarr; Section &rarr; Course &rarr; Assessment &rarr; Questions
              </p>
            </div>

            <div className="text-xs font-bold text-slate-600">
              Showing {hierarchy.length} University Hierarchy {hierarchy.length === 1 ? 'Branch' : 'Branches'}
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
              <RefreshCw size={24} className="animate-spin text-[#1c1f58] mx-auto" />
              <p className="text-xs font-bold text-slate-500">Mapping institutional hierarchy flow...</p>
            </div>
          ) : hierarchy.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3 shadow-2xs">
              <Archive size={36} className="text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900">No Questions Match Hierarchy Filter</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No assessments or questions match the selected department, semester, or section parameters. Try clearing your filters above.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-xl bg-[#1c1f58] text-white text-xs font-bold cursor-pointer hover:bg-[#282d80]"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {hierarchy.map((uni) => {
                const uniKey = `uni-${uni.code}`;
                const isUniOpen = !!expandedNodes[uniKey];

                return (
                  <div key={uni.code} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                    {/* LEVEL 1: UNIVERSITY */}
                    <div
                      onClick={() => toggleNode(uniKey)}
                      className="p-4 bg-slate-900 text-white flex items-center justify-between cursor-pointer hover:bg-slate-800 transition-colors select-none"
                    >
                      <div className="flex items-center gap-3">
                        {isUniOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        <Building2 size={20} className="text-amber-400" />
                        <div>
                          <div className="text-sm font-black">{uni.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono tracking-wider font-bold">
                            CODE: {uni.code} &bull; INSTITUTIONAL HEADQUARTERS
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-indigo-200 border border-white/15">
                          {uni.questionCount} Questions in Central Vault
                        </span>
                      </div>
                    </div>

                    {/* LEVEL 2: DEPARTMENTS */}
                    {isUniOpen && (
                      <div className="p-3 sm:p-4 space-y-3 bg-slate-50/60">
                        {uni.departments?.map((dept) => {
                          const deptKey = `dept-${uni.code}-${dept.code}`;
                          const isDeptOpen = !!expandedNodes[deptKey];

                          return (
                            <div key={dept.code} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                              <div
                                onClick={() => toggleNode(deptKey)}
                                className="p-3.5 bg-indigo-50/60 hover:bg-indigo-50 flex items-center justify-between cursor-pointer transition-colors select-none border-b border-slate-100"
                              >
                                <div className="flex items-center gap-2.5">
                                  {isDeptOpen ? <ChevronDown size={16} className="text-[#1c1f58]" /> : <ChevronRight size={16} className="text-[#1c1f58]" />}
                                  <GraduationCap size={18} className="text-[#1c1f58]" />
                                  <span className="text-xs font-black text-slate-900">
                                    Department: {dept.name} ({dept.code})
                                  </span>
                                </div>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-900 border border-indigo-200">
                                  {dept.questionCount} Questions
                                </span>
                              </div>

                              {/* LEVEL 3: SEMESTERS */}
                              {isDeptOpen && (
                                <div className="p-3 space-y-3 bg-white">
                                  {dept.semesters?.map((sem) => {
                                    const semKey = `sem-${uni.code}-${dept.code}-${sem.semester}`;
                                    const isSemOpen = !!expandedNodes[semKey];

                                    return (
                                      <div key={sem.semester} className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50/40">
                                        <div
                                          onClick={() => toggleNode(semKey)}
                                          className="p-3 bg-slate-100/80 hover:bg-slate-200/60 flex items-center justify-between cursor-pointer transition-colors select-none"
                                        >
                                          <div className="flex items-center gap-2">
                                            {isSemOpen ? <ChevronDown size={14} className="text-slate-700" /> : <ChevronRight size={14} className="text-slate-700" />}
                                            <Calendar size={15} className="text-blue-600" />
                                            <span className="text-xs font-extrabold text-slate-800">
                                              Semester {sem.semester}
                                            </span>
                                          </div>
                                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white text-slate-700 border border-slate-200">
                                            {sem.questionCount} Questions
                                          </span>
                                        </div>

                                        {/* LEVEL 4: SECTIONS */}
                                        {isSemOpen && (
                                          <div className="p-3 space-y-3 bg-white">
                                            {sem.sections?.map((sec) => {
                                              const secKey = `sec-${uni.code}-${dept.code}-${sem.semester}-${sec.section}`;
                                              const isSecOpen = !!expandedNodes[secKey];

                                              return (
                                                <div key={sec.section} className="rounded-lg border border-slate-200 overflow-hidden">
                                                  <div
                                                    onClick={() => toggleNode(secKey)}
                                                    className="p-2.5 bg-amber-50/40 hover:bg-amber-50 flex items-center justify-between cursor-pointer transition-colors select-none"
                                                  >
                                                    <div className="flex items-center gap-2">
                                                      {isSecOpen ? <ChevronDown size={13} className="text-amber-800" /> : <ChevronRight size={13} className="text-amber-800" />}
                                                      <Users size={14} className="text-amber-700" />
                                                      <span className="text-xs font-bold text-amber-950">
                                                        Section: {sec.section}
                                                      </span>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-amber-800">
                                                      {sec.questionCount} Questions
                                                    </span>
                                                  </div>

                                                  {/* LEVEL 5: COURSES */}
                                                  {isSecOpen && (
                                                    <div className="p-3 space-y-3 bg-slate-50/30">
                                                      {sec.courses?.map((course) => {
                                                        const courseKey = `course-${secKey}-${course.code}`;
                                                        const isCourseOpen = !!expandedNodes[courseKey];

                                                        return (
                                                          <div key={course.code} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                                                            <div
                                                              onClick={() => toggleNode(courseKey)}
                                                              className="p-2.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between cursor-pointer transition-colors select-none"
                                                            >
                                                              <div className="flex items-center gap-2">
                                                                {isCourseOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                                                <BookOpen size={14} className="text-indigo-600" />
                                                                <span className="text-xs font-bold text-slate-900">
                                                                  {course.code}: {course.title}
                                                                </span>
                                                              </div>
                                                              <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                                                {course.questionCount} Questions
                                                              </span>
                                                            </div>

                                                            {/* LEVEL 6: QUIZZES */}
                                                            {isCourseOpen && (
                                                              <div className="p-3 space-y-3 bg-white">
                                                                {course.quizzes?.map((quiz) => (
                                                                  <div key={quiz.id} className="p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/20 space-y-3">
                                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                                      <div>
                                                                        <div className="text-xs font-black text-slate-900 flex items-center gap-2">
                                                                          <CheckSquare size={14} className="text-[#1c1f58]" />
                                                                          <span>{quiz.title}</span>
                                                                        </div>
                                                                        <div className="text-[10px] text-slate-500 font-medium">
                                                                          Faculty: <span className="font-bold text-slate-700">{quiz.facultyName}</span> &bull; Duration: {quiz.durationMinutes}m &bull; Total Marks: {quiz.totalMarks}
                                                                        </div>
                                                                      </div>
                                                                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#1c1f58] text-white">
                                                                        {quiz.questions?.length || 0} Questions In Bank
                                                                      </span>
                                                                    </div>

                                                                    {/* LEVEL 7: QUESTIONS PREVIEW */}
                                                                    <div className="space-y-2 pt-2 border-t border-indigo-100/60">
                                                                      {quiz.questions?.map((q, idx) => (
                                                                        <div key={q.id} className="p-3 rounded-lg bg-white border border-slate-200 hover:border-slate-300 transition-colors space-y-2">
                                                                          <div className="flex items-start justify-between gap-3">
                                                                            <div className="text-xs font-bold text-slate-900 flex gap-2">
                                                                              <span className="text-[#1c1f58] font-black">Q{idx + 1}.</span>
                                                                              <span>{q.questionText}</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                                                                [{q.marks} Mark{q.marks > 1 ? 's' : ''}]
                                                                              </span>
                                                                              <button
                                                                                type="button"
                                                                                onClick={() => handleCopyQuestion(q)}
                                                                                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                                                                                title="Copy question text"
                                                                              >
                                                                                {copiedQuestionId === q.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                                                                              </button>
                                                                            </div>
                                                                          </div>

                                                                          {q.codeSnippet && (
                                                                            <pre className="p-2 rounded bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto">
                                                                              <code>{q.codeSnippet}</code>
                                                                            </pre>
                                                                          )}

                                                                          {q.imageUrl && (
                                                                            <div className="pt-1">
                                                                              <img
                                                                                src={getSafeImageUrl(q.imageUrl)}
                                                                                alt="Question reference"
                                                                                className="max-h-36 max-w-xs object-contain rounded-lg border border-slate-200 bg-white p-1 cursor-pointer hover:opacity-95"
                                                                                onClick={() => setZoomedImage(q.imageUrl)}
                                                                                title="Click to enlarge"
                                                                              />
                                                                            </div>
                                                                          )}

                                                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                                                                            {Array.isArray(q.options) &&
                                                                              q.options.map((opt, oIdx) => {
                                                                                const isCorrect = oIdx === q.correctOptionIndex;
                                                                                const letter = String.fromCharCode(65 + oIdx);
                                                                                return (
                                                                                  <div
                                                                                    key={oIdx}
                                                                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 border ${isCorrect
                                                                                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-bold'
                                                                                        : 'bg-slate-50 text-slate-700 border-slate-200'
                                                                                      }`}
                                                                                  >
                                                                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                                                                                      }`}>
                                                                                      {letter}
                                                                                    </span>
                                                                                    <span className="truncate">{opt}</span>
                                                                                  </div>
                                                                                );
                                                                              })}
                                                                          </div>

                                                                          {q.explanation && (
                                                                            <div className="text-[11px] text-slate-500 font-medium pt-1 border-t border-slate-100">
                                                                              <span className="font-bold text-slate-700">Explanation:</span> {q.explanation}
                                                                            </div>
                                                                          )}
                                                                        </div>
                                                                      ))}
                                                                    </div>
                                                                  </div>
                                                                ))}
                                                              </div>
                                                            )}
                                                          </div>
                                                        );
                                                      })}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW MODE 1: ASSESSMENT QUESTION BANKS STACK (Image 2 Style)*/}
      {/* ========================================================= */}
      {viewMode === 'banks' && !activeBank && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Layers size={18} className="text-[#1c1f58]" />
                <span>Question Banks by Assessment</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {filteredQuizBanks.length} Assessment {filteredQuizBanks.length === 1 ? 'Bank' : 'Banks'} available &bull; Click "Download" to export Excel spreadsheet or "View" to inspect questions
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                Total Banks: {filteredQuizBanks.length}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
              <RefreshCw size={24} className="animate-spin text-[#1c1f58] mx-auto" />
              <p className="text-xs font-bold text-slate-500">Loading Question Banks...</p>
            </div>
          ) : filteredQuizBanks.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3 shadow-2xs">
              <Archive size={36} className="text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900">No Assessment Banks Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No question banks match your filter criteria. Adjust your filters or create assessments in Faculty Dashboard.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-xl bg-[#1c1f58] text-white text-xs font-bold cursor-pointer hover:bg-[#282d80]"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-2xs">
              {filteredQuizBanks.map((bank) => {
                const qCount = bank.questions?.length || 0;
                const sections = Array.isArray(bank.targetSections) && bank.targetSections.length > 0
                  ? bank.targetSections.join(', ')
                  : 'All Sections';

                return (
                  <div
                    key={bank.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-indigo-700">{bank.courseCode || 'GEN'}</span>
                        <h3 className="text-sm font-bold text-slate-900">{bank.title}</h3>
                        {bank.courseTitle && bank.courseTitle !== 'Core Subject' && (
                          <span className="text-xs text-slate-400 font-medium">({bank.courseTitle})</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Target: Sem {bank.semester || 5} &bull; Total Marks: {bank.totalMarks} &bull; Passing: {bank.passingMarks || Math.round((bank.totalMarks || 100) * 0.4)} &bull; Questions: {qCount}
                        {bank.targetSections?.length > 0 && (
                          <> &bull; Sections: {sections}</>
                        )}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span>{qCount} Questions</span>
                      </span>

                      {/* Download Excel Button */}
                      <button
                        type="button"
                        onClick={() => exportQuizBankToExcel(bank)}
                        disabled={qCount === 0}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all border border-emerald-200/80 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                        title="Download questions as Excel spreadsheet (.xlsx)"
                      >
                        <FileSpreadsheet size={14} className="text-emerald-600" />
                        <span>Download</span>
                      </button>

                      {/* View Questions Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveQuizVaultId(bank.id);
                          setInQuizSearch('');
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-2xs"
                        title="View full questions, options and academic explanations"
                      >
                        <Eye size={14} className="text-purple-600" />
                        <span>View</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW MODE 1B: ACTIVE QUIZ QUESTION BANK INSPECTOR         */}
      {/* ========================================================= */}
      {viewMode === 'banks' && activeBank && (
        <div ref={questionListRef} className="space-y-4">
          {/* Top Return & Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setActiveQuizVaultId(null);
                setInQuizSearch('');
                setBankPage(1);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-bold transition-all cursor-pointer shadow-2xs group w-fit"
            >
              <ArrowLeft size={15} className="text-indigo-600 group-hover:-translate-x-0.5 transition-transform" />
              <span>&larr; Back to All Question Banks</span>
            </button>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => exportQuizBankToExcel(activeBank)}
                disabled={!activeBank.questions?.length}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                title="Download this assessment's questions as Excel (.xlsx)"
              >
                <FileSpreadsheet size={14} />
                <span>Download Excel (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActivePrintQuiz(activeBank);
                  setShowPrintModal(true);
                }}
                disabled={!activeBank.questions?.length}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1c1f58] hover:bg-[#282d80] text-white text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                title="Print formatted Graphic Era exam paper"
              >
                <Printer size={14} />
                <span>Exam Paper / PDF</span>
              </button>
            </div>
          </div>

          {/* Assessment Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-100 text-indigo-900 border border-indigo-200">
                    {activeBank.courseCode || 'GEN'}
                  </span>
                  <h2 className="text-lg font-black text-slate-900">{activeBank.title}</h2>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {activeBank.courseTitle && <span className="font-semibold text-slate-700">{activeBank.courseTitle} &bull; </span>}
                  Target: Sem {activeBank.semester || 5} &bull; Total Marks: {activeBank.totalMarks} &bull; Passing: {activeBank.passingMarks || Math.round(activeBank.totalMarks * 0.4)} &bull; Duration: {activeBank.durationMinutes}m
                  {Array.isArray(activeBank.targetSections) && activeBank.targetSections.length > 0 && (
                    <> &bull; Sections: {activeBank.targetSections.join(', ')}</>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {activeBank.questions?.length || 0} Questions in Bank
                </span>
              </div>
            </div>

            {/* In-bank Search Filter */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={inQuizSearch}
                  onChange={(e) => setInQuizSearch(e.target.value)}
                  placeholder="Search in this question bank..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#1c1f58] bg-slate-50/50"
                />
                {inQuizSearch && (
                  <button
                    type="button"
                    onClick={() => setInQuizSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 font-medium">
                  {activeBankQuestions.length === 0 ? (
                    'Showing 0 questions'
                  ) : (
                    <>
                      Showing{' '}
                      <span className="font-bold text-slate-800">
                        {(clampedBankPage - 1) * QUESTIONS_PER_PAGE + 1}–{Math.min(clampedBankPage * QUESTIONS_PER_PAGE, activeBankQuestions.length)}
                      </span>{' '}
                      of <span className="font-bold text-slate-800">{activeBankQuestions.length}</span> questions
                    </>
                  )}
                </span>

                {totalBankPages > 1 && (
                  <div className="flex items-center gap-1 border-l border-slate-200 pl-3">
                    <button
                      type="button"
                      onClick={() => handleBankPageChange(clampedBankPage - 1)}
                      disabled={clampedBankPage === 1}
                      className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 cursor-pointer"
                      title="Previous 5 questions"
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <span className="text-[11px] font-black text-slate-700 px-1">
                      {clampedBankPage} / {totalBankPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleBankPageChange(clampedBankPage + 1)}
                      disabled={clampedBankPage === totalBankPages}
                      className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 cursor-pointer"
                      title="Next 5 questions"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Question List */}
          {activeBankQuestions.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3 shadow-2xs">
              <Archive size={36} className="text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900">
                {inQuizSearch ? 'No Questions Match Search' : 'No Questions In This Bank'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {inQuizSearch
                  ? 'No questions matched your search query in this question bank.'
                  : 'This assessment currently has no questions registered.'}
              </p>
              {inQuizSearch && (
                <button
                  type="button"
                  onClick={() => setInQuizSearch('')}
                  className="px-4 py-2 rounded-xl bg-[#1c1f58] text-white text-xs font-bold cursor-pointer"
                >
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-3.5">
                {paginatedBankQuestions.map((q, idx) => {
                  const options = Array.isArray(q.options) ? q.options : [];
                  const correctLetter = ['A', 'B', 'C', 'D'][q.correctOptionIndex] || 'A';
                  const globalQNumber = (clampedBankPage - 1) * QUESTIONS_PER_PAGE + idx + 1;

                  return (
                    <div
                      key={q.id}
                      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-xs transition-shadow space-y-3"
                    >
                      {/* Top Row: Q Number, Marks badge, Copy */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-indigo-50 text-indigo-800 border border-indigo-200">
                            Question {globalQNumber}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            [{q.marks} Mark{q.marks > 1 ? 's' : ''}]
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCopyQuestion(q)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors cursor-pointer"
                          title="Copy question text and options to clipboard"
                        >
                          {copiedQuestionId === q.id ? (
                            <>
                              <Check size={12} className="text-emerald-600" />
                              <span className="text-emerald-600 font-bold">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Question Content */}
                      <div className="pt-1">
                        <div className="text-sm font-bold text-slate-900 leading-snug flex items-start gap-2">
                          <span className="text-[#1c1f58] font-black">Q{globalQNumber}.</span>
                          <span>{q.questionText}</span>
                        </div>

                        {q.codeSnippet && (
                          <div className="mt-2.5 p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto shadow-inner">
                            <pre>
                              <code>{q.codeSnippet}</code>
                            </pre>
                          </div>
                        )}

                        {q.imageUrl && (
                          <div className="mt-2.5">
                            <img
                              src={getSafeImageUrl(q.imageUrl)}
                              alt="Question diagram"
                              className="max-h-48 max-w-sm object-contain rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xs cursor-pointer hover:opacity-95"
                              onClick={() => setZoomedImage(q.imageUrl)}
                              title="Click to enlarge"
                            />
                          </div>
                        )}
                      </div>

                      {/* MCQ Options Matrix */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {options.map((opt, oIdx) => {
                          const isCorrect = oIdx === q.correctOptionIndex;
                          const letter = String.fromCharCode(65 + oIdx);

                          return (
                            <div
                              key={oIdx}
                              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2.5 border transition-all ${isCorrect
                                  ? 'bg-emerald-50/90 text-emerald-950 border-emerald-300 ring-1 ring-emerald-300'
                                  : 'bg-slate-50 text-slate-700 border-slate-200'
                                }`}
                            >
                              <span
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${isCorrect ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-200 text-slate-600'
                                  }`}
                              >
                                {letter}
                              </span>
                              <span className="truncate">{opt}</span>
                              {isCorrect && (
                                <span className="ml-auto text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                                  Correct Answer
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Academic Explanation */}
                      {q.explanation && (
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
                          <HelpCircle size={15} className="text-indigo-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-slate-900">Academic Explanation: </span>
                            <span>{q.explanation}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls Bar */}
              {totalBankPages > 1 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-slate-600 font-semibold">
                    Page <span className="font-black text-[#1c1f58]">{clampedBankPage}</span> of{' '}
                    <span className="font-black text-slate-900">{totalBankPages}</span>
                    <span className="text-slate-400 ml-1.5 font-normal">(5 questions per page)</span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap justify-center">
                    {/* First Page */}
                    <button
                      type="button"
                      onClick={() => handleBankPageChange(1)}
                      disabled={clampedBankPage === 1}
                      className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title="First page"
                    >
                      <ChevronsLeft size={14} />
                    </button>

                    {/* Previous Page */}
                    <button
                      type="button"
                      onClick={() => handleBankPageChange(clampedBankPage - 1)}
                      disabled={clampedBankPage === 1}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title="Previous 5 questions"
                    >
                      <ChevronLeft size={14} />
                      <span className="hidden sm:inline">Prev</span>
                    </button>

                    {/* Page Numbers with Smart Ellipsis */}
                    {getPageNumbers(clampedBankPage, totalBankPages).map((p, pIdx) => {
                      if (p === '...') {
                        return (
                          <span key={`ellipsis-${pIdx}`} className="px-2 py-1 text-slate-400 text-xs font-bold select-none">
                            ...
                          </span>
                        );
                      }
                      const isCurrent = p === clampedBankPage;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => handleBankPageChange(p)}
                          className={`w-8 h-8 rounded-xl text-xs font-black transition-all cursor-pointer ${isCurrent
                              ? 'bg-[#1c1f58] text-white shadow-xs'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                        >
                          {p}
                        </button>
                      );
                    })}

                    {/* Next Page */}
                    <button
                      type="button"
                      onClick={() => handleBankPageChange(clampedBankPage + 1)}
                      disabled={clampedBankPage === totalBankPages}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title="Next 5 questions"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight size={14} />
                    </button>

                    {/* Last Page */}
                    <button
                      type="button"
                      onClick={() => handleBankPageChange(totalBankPages)}
                      disabled={clampedBankPage === totalBankPages}
                      className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title="Last page"
                    >
                      <ChevronsRight size={14} />
                    </button>
                  </div>

                  {/* Jump to Page Selector (if > 5 pages) */}
                  {totalBankPages > 5 && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-slate-500 font-medium">Go to:</span>
                      <select
                        value={clampedBankPage}
                        onChange={(e) => handleBankPageChange(Number(e.target.value))}
                        className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1c1f58] cursor-pointer"
                      >
                        {Array.from({ length: totalBankPages }, (_, i) => i + 1).map((pg) => (
                          <option key={pg} value={pg}>
                            Page {pg}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW MODE 2: MASTER QUESTIONS GRID (Faculty / Admin Grid) */}
      {/* ========================================================= */}
      {viewMode === 'grid' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <CheckSquare size={18} className="text-[#1c1f58]" />
                <span>Question Bank Roster</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {displayedQuestions.length} Questions Displayed &bull; Click "Download Excel", "Download CSV" or "Exam Paper / PDF" to export
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                Page Total: {displayedQuestions.length} Items
              </span>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
              <RefreshCw size={24} className="animate-spin text-[#1c1f58] mx-auto" />
              <p className="text-xs font-bold text-slate-500">Loading Question Vault repository...</p>
            </div>
          ) : displayedQuestions.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3 shadow-2xs">
              <Archive size={36} className="text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900">No Questions Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No multiple-choice questions match your current query or filter criteria. Create assessments or clear filters to view questions.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-xl bg-[#1c1f58] text-white text-xs font-bold cursor-pointer hover:bg-[#282d80]"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {displayedQuestions.map((q, idx) => {
                const options = Array.isArray(q.options) ? q.options : [];
                const correctLetter = ['A', 'B', 'C', 'D'][q.correctOptionIndex] || 'A';
                const sections = Array.isArray(q.sections) ? q.sections.join(', ') : Array.isArray(q.quiz?.targetSections) ? q.quiz.targetSections.join(', ') : 'All Sections';

                return (
                  <div
                    key={q.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-xs transition-shadow space-y-3"
                  >
                    {/* Top Row: Course, Quiz, Semester, Section badges */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-blue-50 text-blue-800 border border-blue-200">
                          {q.course?.code || 'GEN'}
                        </span>
                        <span className="font-bold text-slate-800">{q.course?.title}</span>
                        <span className="text-slate-400">&bull;</span>
                        <span className="font-semibold text-indigo-700">{q.quiz?.title}</span>
                        <span className="text-slate-400">&bull;</span>
                        <span className="text-slate-500 font-medium">Sem {q.course?.semester || q.quiz?.semester || 5}</span>
                        <span className="text-slate-400">&bull;</span>
                        <span className="text-slate-500 font-medium">Sec: {sections}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isSuperAdmin && q.faculty?.name && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            By: {q.faculty.name}
                          </span>
                        )}
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-black bg-indigo-50 text-indigo-800 border border-indigo-200">
                          [{q.marks} Mark{q.marks > 1 ? 's' : ''}]
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyQuestion(q)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors cursor-pointer"
                          title="Copy question text and options to clipboard"
                        >
                          {copiedQuestionId === q.id ? (
                            <>
                              <Check size={12} className="text-emerald-600" />
                              <span className="text-emerald-600 font-bold">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Question Content */}
                    <div className="pt-1">
                      <div className="text-sm font-bold text-slate-900 leading-snug flex items-start gap-2">
                        <span className="text-[#1c1f58] font-black">Q{idx + 1}.</span>
                        <span>{q.questionText}</span>
                      </div>

                      {q.codeSnippet && (
                        <div className="mt-2.5 p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto shadow-inner">
                          <pre>
                            <code>{q.codeSnippet}</code>
                          </pre>
                        </div>
                      )}

                      {q.imageUrl && (
                        <div className="mt-2.5">
                          <img
                            src={getSafeImageUrl(q.imageUrl)}
                            alt="Question diagram"
                            className="max-h-48 max-w-sm object-contain rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xs cursor-pointer hover:opacity-95"
                            onClick={() => setZoomedImage(q.imageUrl)}
                            title="Click to enlarge"
                          />
                        </div>
                      )}
                    </div>

                    {/* MCQ Options Matrix */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {options.map((opt, oIdx) => {
                        const isCorrect = oIdx === q.correctOptionIndex;
                        const letter = String.fromCharCode(65 + oIdx);

                        return (
                          <div
                            key={oIdx}
                            className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2.5 border transition-all ${isCorrect
                                ? 'bg-emerald-50/90 text-emerald-950 border-emerald-300 ring-1 ring-emerald-300'
                                : 'bg-slate-50 text-slate-700 border-slate-200'
                              }`}
                          >
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${isCorrect ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-200 text-slate-600'
                                }`}
                            >
                              {letter}
                            </span>
                            <span className="truncate">{opt}</span>
                            {isCorrect && (
                              <span className="ml-auto text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                                Correct Answer
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation Footer */}
                    {q.explanation && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
                        <HelpCircle size={15} className="text-indigo-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-slate-900">Academic Explanation: </span>
                          <span>{q.explanation}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* PRINTABLE EXAMINATION PAPER / PDF MODAL                    */}
      {/* ========================================================= */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <Printer size={22} className="text-amber-400" />
                <div>
                  <h3 className="text-base font-black">Examination Paper / Question Bank Dossier</h3>
                  <p className="text-xs text-slate-400 font-medium">
                    Formatted for Graphic Era University examinations, NAAC dossiers, or offline distribution
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs font-bold text-indigo-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeAnswerKey}
                    onChange={(e) => setIncludeAnswerKey(e.target.checked)}
                    className="rounded text-[#1c1f58] focus:ring-0 cursor-pointer"
                  />
                  <span>Include Answer Key & Solutions</span>
                </label>

                <button
                  type="button"
                  onClick={handleTriggerPrint}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-all shadow-md cursor-pointer"
                >
                  <Printer size={14} />
                  <span>Print / Save PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Printable Sheet Body */}
            <div className="p-6 sm:p-8 overflow-y-auto flex-1 font-serif text-slate-900 space-y-6 printable-exam-paper">
              {/* Institutional Header */}
              <div className="text-center space-y-1 pb-4 border-b-2 border-slate-900">
                <h1 className="text-lg sm:text-xl font-extrabold uppercase tracking-wide">
                  GRAPHIC ERA (DEEMED TO BE UNIVERSITY), DEHRADUN
                </h1>
                <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700">
                  DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING / ALLIED SCIENCES
                </h2>
                <div className="text-xs font-semibold text-slate-600">
                  CENTRAL EXAMINATION QUESTION BANK & ASSESSMENT DOSSIER
                </div>
              </div>

              {/* Assessment Meta Table */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-sans border border-slate-300 p-3 rounded-lg bg-slate-50">
                <div>
                  <span className="font-bold text-slate-500 block">Course / Subject:</span>
                  <span className="font-bold text-slate-900">
                    {printableMeta.courseCode} - {printableMeta.courseTitle}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block">Semester & Section:</span>
                  <span className="font-bold text-slate-900">
                    Sem {printableMeta.semester} &bull; {printableMeta.section}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block">Total Questions:</span>
                  <span className="font-bold text-slate-900">{printableQuestions.length} Questions</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500 block">Max Marks:</span>
                  <span className="font-bold text-slate-900">
                    {printableQuestions.reduce((sum, q) => sum + (q.marks || 1), 0)} Marks
                  </span>
                </div>
              </div>

              {/* General Instructions */}
              <div className="text-[11px] font-sans text-slate-600 space-y-0.5 border-l-2 border-[#1c1f58] pl-3">
                <div className="font-bold text-slate-800">General Instructions:</div>
                <div>1. All questions are compulsory and carry specified marks.</div>
                <div>2. Choose the single most appropriate option for each question.</div>
                <div>3. Calculators and unauthorized electronic gadgets are strictly prohibited.</div>
              </div>

              {/* Numbered Questions */}
              <div className="space-y-5 pt-2">
                {printableQuestions.map((q, idx) => {
                  const options = Array.isArray(q.options) ? q.options : [];
                  const correctLetter = ['A', 'B', 'C', 'D'][q.correctOptionIndex] || 'A';

                  return (
                    <div key={q.id} className="space-y-2 border-b border-slate-200 pb-4">
                      <div className="flex items-start justify-between gap-4 text-xs font-sans">
                        <div className="font-bold text-slate-900 flex gap-2">
                          <span>Q{idx + 1}.</span>
                          <span>{q.questionText}</span>
                        </div>
                        <span className="font-mono font-bold text-slate-700 shrink-0">
                          [{q.marks} Mark{q.marks > 1 ? 's' : ''}]
                        </span>
                      </div>

                      {q.codeSnippet && (
                        <pre className="p-2.5 rounded bg-slate-100 text-slate-900 font-mono text-[11px] overflow-x-auto border border-slate-200">
                          <code>{q.codeSnippet}</code>
                        </pre>
                      )}

                      {q.imageUrl && (
                        <div className="pl-4">
                          <img
                            src={getSafeImageUrl(q.imageUrl)}
                            alt="Question diagram"
                            className="max-h-36 max-w-xs object-contain rounded border border-slate-200 bg-white p-1"
                            loading="lazy"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-xs font-sans pl-4">
                        {options.map((opt, oIdx) => (
                          <div key={oIdx} className="flex items-center gap-2">
                            <span className="font-bold">{String.fromCharCode(65 + oIdx)}.</span>
                            <span>{opt}</span>
                          </div>
                        ))}
                      </div>

                      {includeAnswerKey && (
                        <div className="mt-2 p-2 rounded bg-emerald-50 border border-emerald-200 text-xs font-sans text-emerald-950">
                          <span className="font-bold">Correct Answer: Option {correctLetter}</span>
                          {q.explanation && (
                            <div className="text-[11px] text-emerald-800 mt-0.5">
                              <span className="font-semibold">Solution: </span>
                              {q.explanation}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-6 text-center text-xs text-slate-400 font-sans border-t border-slate-200">
                End of Examination Paper &bull; Graphic Era Deemed to be University
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Zoom Image Lightbox Modal */}
      {zoomedImage && (
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
        </div>
      )}
    </div>
  );
};

export default QuestionVaultView;
