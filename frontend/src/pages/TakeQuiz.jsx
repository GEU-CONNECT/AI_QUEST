import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Clock,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Bookmark,
  Send,
  RefreshCw,
  Key,
  Lock,
  X,
  Loader2,
  ShieldAlert,
  Maximize,
  ShieldCheck,
  Printer,
  Calendar,
  Image as ImageIcon,
  Maximize2,
  BookOpen,
  Type,
  FileText
} from 'lucide-react';
import api from '../api/client';
import { getSafeImageUrl } from '../utils/imageUrl';


// Device detection helpers for high-security mobile kiosk proctoring
const isIOSDevice = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
};

const isMobileOrTabletDevice = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.innerWidth <= 850 && ('ontouchstart' in window || navigator.maxTouchPoints > 0))
  );
};

// Helper array shuffler using linear congruential pseudorandom generator
const shuffleArray = (arr, seedStr) => {
  if (!arr || arr.length <= 1) return arr;
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed << 5) - seed + seedStr.charCodeAt(i);
    seed |= 0;
  }
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const rnd = Math.abs(seed) / 233280;
    const j = Math.floor(rnd * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// Deterministic question shuffler (seeded by student identifier + quizId)
// Keeps Reading Comprehension passage questions grouped coherently together
const getShuffledQuestions = (questions, seedStr) => {
  if (!questions || questions.length <= 1) return questions;
  const regular = questions.filter(q => !q.passageId && !q.passage);
  const rc = questions.filter(q => q.passageId || q.passage);

  if (rc.length === 0) {
    return shuffleArray(questions, seedStr);
  }

  // Deterministically shuffle regular questions
  const shuffledRegular = shuffleArray(regular, `${seedStr}_reg`);

  // Group RC questions by passage
  const passageMap = new Map();
  rc.forEach(q => {
    const pid = q.passageId || q.passage?.id || 'rc_general';
    if (!passageMap.has(pid)) passageMap.set(pid, []);
    passageMap.get(pid).push(q);
  });

  // Deterministically shuffle passage groups so order of passages varies per student
  const passageGroups = Array.from(passageMap.values());
  const shuffledGroups = shuffleArray(passageGroups, `${seedStr}_passages`);
  const groupedRcQuestions = shuffledGroups.flatMap(group => group);

  // Return compulsory bundled regular questions followed by RC passage questions
  return [...shuffledRegular, ...groupedRcQuestions];
};

// Deterministic option shuffler (seeded by student identifier + quizId + questionId)
// Preserves originalIndex so answers map 1:1 with backend grading with zero server changes
const getShuffledOptionsForQuestion = (options, seedStr) => {
  if (!options || options.length <= 1) {
    return (options || []).map((text, idx) => ({ text, originalIndex: idx }));
  }
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed << 5) - seed + seedStr.charCodeAt(i);
    seed |= 0;
  }
  const copy = options.map((text, idx) => ({ text, originalIndex: idx }));

  // Pin options like "All of the above" or "None of the above" to the final slot if present
  const lastOpt = copy[copy.length - 1];
  const isLastFixed = /^(all|none|both)\s+(of\s+the\s+above|of\s+these|above)/i.test(lastOpt?.text?.trim() || '');
  const shuffleLimit = isLastFixed ? copy.length - 2 : copy.length - 1;

  for (let i = shuffleLimit; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const rnd = Math.abs(seed) / 233280;
    const j = Math.floor(rnd * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const TakeQuiz = ({ user }) => {

  const { id: quizId } = useParams();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState(null);
  const quizRef = useRef(null);
  const serverOffsetRef = useRef(0);
  const autoSubmittingRef = useRef(false);
  useEffect(() => {
    quizRef.current = quiz;
  }, [quiz]);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]); // { [qId]: selectedOptIdx }
  const [markedForReview, setMarkedForReview] = useState(new Set());
  const [timeLeft, setTimeLeft] = useState(null); // in seconds
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [zoomedDiagram, setZoomedDiagram] = useState(null);
  const [passageFontSize, setPassageFontSize] = useState(14);

  // Security & Password Protection State
  const [accessRequired, setAccessRequired] = useState(false);
  const [isClosedError, setIsClosedError] = useState(false);
  const [notStartedData, setNotStartedData] = useState(null);
  const [authErrorMessage, setAuthErrorMessage] = useState('');
  const [enteredPassword, setEnteredPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

  // Anti-Cheat & Tab-Switch Proctoring State
  // Pre-Submission Review & Declaration State
  const [showSubmitReviewModal, setShowSubmitReviewModal] = useState(false);
  const [declarationAgreed, setDeclarationAgreed] = useState(false);
  const getInitialViolations = () => {
    try {
      const v = localStorage.getItem(`quizx_violations_${quizId}`);
      return v ? Number(v) : 0;
    } catch (e) {
      return 0;
    }
  };
  const [tabViolations, setTabViolations] = useState(getInitialViolations);
  const [showViolationWarning, setShowViolationWarning] = useState(false);
  const violationsRef = useRef(getInitialViolations());
  const lastResetTokenRef = useRef(null);

  // Dynamic Institutional Proctoring Engine State
  const [proctoringRules, setProctoringRules] = useState({
    maxTabSwitches: 3,
    violationAction: 'AUTO_LOCK',
    enforceFullscreen: true,
    disableClipboard: true,
    showWarningModal: true,
    reconnectGraceMin: 10,
    preventScreenshots: true,
    detectExtensions: true
  });
  const lastViolationTimeRef = useRef(0);
  const [isSessionLocked, setIsSessionLocked] = useState(false);
  const [isCheckingUnlock, setIsCheckingUnlock] = useState(false);
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);
  const isFullscreenModeRef = useRef(false);
  const fullscreenGraceRef = useRef(0);
  const wasInFullscreenRef = useRef(false);
  const [isFocusLost, setIsFocusLost] = useState(false);
  const hasLeftWindowRef = useRef(false);
  const [isSplitScreenDetected, setIsSplitScreenDetected] = useState(false);

  useEffect(() => {
    isFullscreenModeRef.current = isFullscreenMode;
  }, [isFullscreenMode]);

  // Helper for 0ms instantaneous DOM blackout and blur
  const applyImmediateBlackout = useCallback((show) => {
    const shieldEl = document.getElementById("exam-blackout-shield");
    if (shieldEl) {
      shieldEl.style.display = show ? "flex" : "none";
    }
    const contentEl = document.getElementById("exam-main-content");
    if (contentEl) {
      contentEl.style.filter = show ? "blur(50px)" : "none";
      contentEl.style.userSelect = show ? "none" : "auto";
      contentEl.style.pointerEvents = show ? "none" : "auto";
    }
    if (!show) {
      try {
        window.focus();
        if (document.body) {
          document.body.tabIndex = -1;
          document.body.focus();
        }
      } catch (_) {}
    }
  }, []);

  const timerRef = useRef(null);
  const saveProgressDebounced = useRef(null);

  useEffect(() => {
    fetchQuiz();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (saveProgressDebounced.current) clearTimeout(saveProgressDebounced.current);
    };
  }, [quizId]);

  const fetchQuiz = async (providedCode = null) => {
    try {
      setLoading(true);
      const code = providedCode || sessionStorage.getItem(`quizx_access_${quizId}`) || '';
      const headers = code ? { 'x-quiz-access-code': code } : {};

      const res = await api.get(`/quizzes/${quizId}`, { headers });
      if (res.data.success) {
        setAccessRequired(false);
        const qData = res.data.quiz;
        // Synchronize server-client clock offset
        const serverNow = res.data.quiz?.serverTime || res.data?.serverTime || Date.now();
        serverOffsetRef.current = serverNow - Date.now();
        quizRef.current = qData;
        if (qData.questions && qData.questions.length > 0) {
          const studentSeed = `${user?.universityId || user?.id || 'candidate'}_${quizId}`;
          qData.questions = getShuffledQuestions(qData.questions, studentSeed);
          qData.questions.forEach((q) => {
            const qSeed = `${studentSeed}_${q.id}`;
            q.shuffledOptions = getShuffledOptionsForQuestion(q.options, qSeed);
          });
        }
        setQuiz(qData);

        // Fetch active institutional proctoring policies
        try {
          const pRulesRes = await api.get('/quizzes/proctoring-rules');
          if (pRulesRes.data?.success && pRulesRes.data.rules) {
            setProctoringRules(pRulesRes.data.rules);
          }
        } catch (rErr) {
          console.warn('Could not load proctoring rules, using defaults', rErr);
        }

        // Check if candidate attempt is locked
        const savedViolations = Number(qData.mySubmission?.tabViolations) || 0;
        const localViolations = Number(localStorage.getItem(`quizx_violations_${quizId}`)) || 0;
        const finalViolations = Math.max(savedViolations, localViolations, violationsRef.current);
        violationsRef.current = finalViolations;
        setTabViolations(finalViolations);
        try {
          localStorage.setItem(`quizx_violations_${quizId}`, String(finalViolations));
        } catch (e) { }

        const maxThreshold = Number(proctoringRules.maxTabSwitches) || Number(qData.maxTabSwitches) || 3;
        const isLockedOnServer = qData.isLocked || qData.mySubmission?.status === 'LOCKED';
        const isExceededLimit = finalViolations >= maxThreshold && proctoringRules.violationAction === 'AUTO_LOCK';

        if (isLockedOnServer || isExceededLimit) {
          setIsSessionLocked(true);
          applyImmediateBlackout(false);
        } else {
          setIsSessionLocked(false);
        }

        // If already submitted, show scorecard
        if (qData.mySubmission && (qData.mySubmission.status === 'SUBMITTED' || qData.mySubmission.status === 'EVALUATED')) {
          setSubmissionResult({
            score: qData.mySubmission.score,
            totalMarks: qData.mySubmission.totalMarks || qData.totalMarks,
            percentage: qData.mySubmission.percentage,
            isPassed: qData.mySubmission.isPassed,
            passingMarks: qData.passingMarks,
            showResultsAfterSubmit: Boolean(qData.showResultsAfterSubmit),
            alreadySubmitted: true
          });
        } else {
          // RESTORE ATTEMPT ANSWERS & PROGRESS RESILIENCE
          const localKey = `quizx_attempt_${quizId}`;
          let restoredAnswers = {};

          // 1. From Server DB Submission
          if (qData.mySubmission?.answers && typeof qData.mySubmission.answers === "object") {
            restoredAnswers = { ...qData.mySubmission.answers };
          }

          const isResetByInstructor = qData.mySubmission?.lockReason?.startsWith("RESET_BY_INSTRUCTOR:") && Object.keys(restoredAnswers).length === 0;
          lastResetTokenRef.current = qData.mySubmission?.lockReason?.startsWith("RESET_BY_INSTRUCTOR:") ? qData.mySubmission.lockReason : null;

          if (!isResetByInstructor) {
            // Normal restore: read from DB and LocalStorage
            try {
              const cached = localStorage.getItem(localKey);
              if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed.answers && typeof parsed.answers === "object") {
                  restoredAnswers = { ...restoredAnswers, ...parsed.answers };
                }
                if (parsed.markedForReview && Array.isArray(parsed.markedForReview)) {
                  setMarkedForReview(new Set(parsed.markedForReview));
                }
                if (parsed.currentIdx !== undefined && parsed.currentIdx >= 0) {
                  setCurrentIdx(parsed.currentIdx);
                }
              }
            } catch (e) { }
          } else {
            // Submission was reset by instructor: clean local attempt cache
            try {
              localStorage.removeItem(localKey);
              localStorage.removeItem(`quizx_attempt_${quizId}_${user?.universityId || user?.id || "std"}`);
            } catch (e) { }
            restoredAnswers = {};
            setCurrentIdx(0);
            setMarkedForReview(new Set());
          }

          setAnswers(restoredAnswers);
          answersRef.current = restoredAnswers;

          // Initialize timer from server remaining time
          const currentServerTime = Date.now() + serverOffsetRef.current;
          const totalSec = (qData.durationMinutes || 20) * 60;
          let durationSeconds = qData.timeRemainingSeconds;
          if (durationSeconds === undefined || durationSeconds === null) {
            if (qData.mySubmission?.startedAt) {
              const elapsed = Math.max(0, Math.floor((currentServerTime - new Date(qData.mySubmission.startedAt).getTime()) / 1000));
              durationSeconds = Math.max(0, totalSec - elapsed);
            } else {
              durationSeconds = totalSec;
            }
          }

          // In strict timing mode, strictly bound duration by the synchronized window end time
          if (qData.timingMode === 'STRICT' && qData.endTime) {
            const strictRemaining = Math.max(0, Math.floor((new Date(qData.endTime).getTime() - currentServerTime) / 1000));
            if (strictRemaining <= 0) {
              setIsClosedError(true);
              setLoading(false);
              return;
            }
            durationSeconds = Math.min(durationSeconds, strictRemaining);
          }

          // Protect timer with localStorage cache: can only decrease remaining time, never inflate it
          try {
            const cachedTimer = localStorage.getItem(`quizx_timer_${quizId}`) ||
              localStorage.getItem(`quizx_timer_${quizId}_${user?.universityId || user?.id || "std"}`);
            if (cachedTimer) {
              const parsed = JSON.parse(cachedTimer);
              if (parsed.timeLeft !== undefined && parsed.timestamp) {
                const elapsedSinceSave = Math.floor((Date.now() - parsed.timestamp) / 1000);
                const localRemaining = Math.max(0, Number(parsed.timeLeft) - Math.max(0, elapsedSinceSave));
                if (localRemaining < durationSeconds) {
                  durationSeconds = localRemaining;
                }
              } else if (parsed.timeLeft !== undefined && Number(parsed.timeLeft) < durationSeconds) {
                durationSeconds = Number(parsed.timeLeft);
              }
            }
          } catch (e) { }

          // Enforce strict upper bound again after local cache check
          if (qData.timingMode === 'STRICT' && qData.endTime) {
            const strictRemaining = Math.max(0, Math.floor((new Date(qData.endTime).getTime() - currentServerTime) / 1000));
            durationSeconds = Math.min(durationSeconds, strictRemaining);
          }

          setTimeLeft(durationSeconds);
          startTimer(durationSeconds, qData);
        }
      }
    } catch (err) {
      console.error('Failed to load quiz', err);
      if (err.response?.data?.requiresPassword) {
        setAccessRequired(true);
      } else if (err.response?.data?.notStarted) {
        setNotStartedData({
          startTime: err.response.data.startTime,
          message: err.response.data.message
        });
      } else if (err.response?.data?.isClosed) {
        setIsClosedError(true);
      } else if (err.response?.data?.message) {
        setAuthErrorMessage(err.response.data.message);
      }
    } finally {
      setLoading(false);
    }
  };


  // 1. Continuous Live Proctoring Status Pulse: Detects admin lock, unlock, or answer reset in real time (2s heartbeat)
  useEffect(() => {
    if (loading || accessRequired || isClosedError || submissionResult) return;

    const poller = setInterval(async () => {
      try {
        const res = await api.get(`/quizzes/${quizId}/session-status`);
        if (res.data?.success) {
          if (res.data.serverTime) {
            serverOffsetRef.current = res.data.serverTime - Date.now();
          }

          if (res.data.isStrictEnded) {
            handleAutoSubmit();
            return;
          }

          const serverLocked = res.data.isLocked || res.data.status === "LOCKED";

          if (serverLocked) {
            // Invigilator/Admin or policy has FROZEN / LOCKED the candidate
            if (!isSessionLocked) {
              setIsSessionLocked(true);
              setShowViolationWarning(false);
              setShowSubmitReviewModal(false);
              applyImmediateBlackout(false);
            }
            const sViolations = Number(res.data.tabViolations) || violationsRef.current;
            violationsRef.current = sViolations;
            setTabViolations(sViolations);
          } else {
            // Session is UNLOCKED / ACTIVE on server
            if (isSessionLocked) {
              // Candidate was previously frozen, now authorized to resume
              setIsSessionLocked(false);
              applyImmediateBlackout(false);
            }

            // CHECK IF INSTRUCTOR/ADMIN EXPLICITLY RESET THE ANSWERS
            const currentResetToken = res.data.resetToken;
            if (currentResetToken && currentResetToken !== lastResetTokenRef.current && res.data.status === "IN_PROGRESS") {
              // Instructor explicitly triggered an answer reset!
              lastResetTokenRef.current = currentResetToken;
              try {
                localStorage.removeItem(`quizx_attempt_${quizId}`);
                localStorage.removeItem(`quizx_attempt_${quizId}_${user?.universityId || user?.id || "std"}`);
              } catch (e) { }
              setAnswers({});
              answersRef.current = {};
              setCurrentIdx(0);
              setMarkedForReview(new Set());
              violationsRef.current = 0;
              setTabViolations(0);
              // CRITICAL: active exam timer is preserved and continues ticking!
            } else {
              const sViolations = Number(res.data.tabViolations) || 0;
              if (sViolations !== violationsRef.current) {
                violationsRef.current = sViolations;
                setTabViolations(sViolations);
                try {
                  localStorage.setItem(`quizx_violations_${quizId}`, String(sViolations));
                } catch (cErr) { }
              }
            }
          }
        }
      } catch (err) { }
    }, 2000);

    return () => clearInterval(poller);
  }, [quizId, isSessionLocked, loading, accessRequired, isClosedError, submissionResult, applyImmediateBlackout, user]);

  // Real-time wall-clock timer synchronization on visibility change or window focus
  useEffect(() => {
    const handleVisibilitySync = () => {
      if (!document.hidden && quizRef.current && timerRef.current) {
        const activeQuiz = quizRef.current;
        if (activeQuiz.timingMode === 'STRICT' && activeQuiz.endTime) {
          const currentServerNow = Date.now() + (serverOffsetRef.current || 0);
          const endMs = new Date(activeQuiz.endTime).getTime();
          const rem = Math.max(0, Math.floor((endMs - currentServerNow) / 1000));
          setTimeLeft(rem);
          if (rem <= 0) {
            handleAutoSubmit();
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilitySync);
    window.addEventListener("focus", handleVisibilitySync);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilitySync);
      window.removeEventListener("focus", handleVisibilitySync);
    };
  }, []);

  // Unified violation recorder that notifies server and syncs state
  const recordFocusViolation = async (reason = 'Focus lost / tab switch') => {
    if (
      loading ||
      accessRequired ||
      isClosedError ||
      submissionResult ||
      isSubmitting ||
      isSessionLocked
    ) {
      return;
    }

    const now = Date.now();
    // Debounce to prevent multiple triggers in rapid succession (minimum 600ms)
    if (now - lastViolationTimeRef.current < 600) return;
    lastViolationTimeRef.current = now;

    violationsRef.current += 1;
    const count = violationsRef.current;
    setTabViolations(count);
    try {
      localStorage.setItem(`quizx_violations_${quizId}`, String(count));
    } catch (e) { }

    const threshold = Number(proctoringRules.maxTabSwitches) || 3;
    const action = proctoringRules.violationAction || 'AUTO_LOCK';

    // 0. High-reliability beacon transmission for mobile backgrounding & app-switch
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const base = api.defaults.baseURL || '/api';
      const beaconUrl = `${base}/quizzes/${quizId}/record-violation?token=${encodeURIComponent(token || '')}`;
      const beaconData = new Blob([JSON.stringify({
        violationCount: count,
        reason: `${reason} (${count}/${threshold})`
      })], { type: 'application/json' });
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(beaconUrl, beaconData);
      }
    } catch (_) {}

    // 1. Send live violation count to server in real time
    try {
      const vRes = await api.post(`/quizzes/${quizId}/record-violation`, {
        violationCount: count,
        reason: `${reason} (${count}/${threshold})`
      });
      if (vRes.data?.isLocked) {
        setIsSessionLocked(true);
        setShowViolationWarning(false);
        applyImmediateBlackout(false);
        return;
      }
    } catch (rErr) {
      if (rErr.response?.data?.isLocked || rErr.response?.status === 403) {
        setIsSessionLocked(true);
        setShowViolationWarning(false);
        applyImmediateBlackout(false);
        return;
      }
    }

    // 2. Client-side threshold action
    if (count >= threshold) {
      if (action === 'AUTO_LOCK') {
        try {
          await api.post(`/quizzes/${quizId}/lock-attempt`, {
            violationsCount: count,
            reason: `${reason} (${count}/${threshold})`
          });
        } catch (lErr) { }
        setIsSessionLocked(true);
        setShowViolationWarning(false);
      } else {
        alert(`Maximum academic integrity violations reached (${threshold} Tab Switches). Assessment automatically submitted.`);
        handleSubmit(true);
      }
    } else {
      if (proctoringRules.showWarningModal !== false) {
        setShowViolationWarning(true);
      }
    }
  };

  // 2. Tab Switch, Window Blur & Always-Active Extension Detection (ZERO False Positives)
  useEffect(() => {
    if (loading || accessRequired || isClosedError || submissionResult || isSubmitting || isSessionLocked) return;

    // Standard W3C Page Visibility API (Fires when tab is hidden or minimized)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        applyImmediateBlackout(true);
        setIsFocusLost(true);
        if (!hasLeftWindowRef.current) {
          hasLeftWindowRef.current = true;
          recordFocusViolation("Tab switch / backgrounded window");
        }
      } else {
        hasLeftWindowRef.current = false;
        applyImmediateBlackout(false);
        setIsFocusLost(false);
      }
    };

    // Standard Window Blur (Verifies true focus loss to prevent DOM/extension false positives)
    let blurTimer = null;
    const handleWindowBlur = () => {
      if (blurTimer) clearTimeout(blurTimer);

      // Grace period after fullscreen toggle to let browser notification banner clear
      if (Date.now() < fullscreenGraceRef.current) return;

      // Debounce window blur by 1500ms to verify if candidate truly switched applications
      blurTimer = setTimeout(() => {
        // If tab is actually hidden, visibilitychange handles it instantly
        if (document.hidden) return;

        // If the document currently has focus, it was an internal click or DOM focus shift
        if (document.hasFocus && document.hasFocus()) return;

        // Candidate has truly focused another application outside the browser
        applyImmediateBlackout(true);
        setIsFocusLost(true);
        if (!hasLeftWindowRef.current) {
          hasLeftWindowRef.current = true;
          recordFocusViolation("Window blur / switched application");
        }
      }, 1500);
    };

    const handleWindowFocus = () => {
      if (blurTimer) {
        clearTimeout(blurTimer);
        blurTimer = null;
      }
      hasLeftWindowRef.current = false;
      applyImmediateBlackout(false);
      setIsFocusLost(false);
    };

    // Mobile / iOS Safari App Switch & Tab Departure Guard (Guaranteed to fire on iOS app switch)
    const handlePageHide = () => {
      applyImmediateBlackout(true);
      setIsFocusLost(true);
      if (!hasLeftWindowRef.current) {
        hasLeftWindowRef.current = true;
        recordFocusViolation("Switched application / backgrounded browser (Mobile/iOS)");
      }
    };

    // iOS Safari BFCache & App-Return Resumption Guard
    const handlePageShow = (e) => {
      if (e.persisted || hasLeftWindowRef.current) {
        hasLeftWindowRef.current = false;
        applyImmediateBlackout(false);
        setIsFocusLost(false);
        recordFocusViolation("Returned from app switch / backgrounded state (iOS BFCache)");
      }
    };

    // Mobile Edge-Swipe Navigation Interceptor (Detects horizontal app-switch or history peek gesture)
    let touchStartX = 0;
    let touchStartY = 0;

    const handleTouchStart = (e) => {
      if (e.touches && e.touches.length > 0) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e) => {
      if (!isFullscreenModeRef.current || Date.now() < fullscreenGraceRef.current) return;
      if (!e.touches || e.touches.length === 0) return;
      const touchX = e.touches[0].clientX;
      const touchY = e.touches[0].clientY;
      const diffX = Math.abs(touchX - touchStartX);
      const diffY = Math.abs(touchY - touchStartY);

      // Edge gesture swipe check (touch within 40px of left/right border, dragging horizontally)
      const isEdge = touchStartX < 40 || touchStartX > (window.innerWidth - 40);
      if (isEdge && diffX > 35 && diffX > diffY * 1.3) {
        applyImmediateBlackout(true);
        setIsFocusLost(true);
        recordFocusViolation("Edge swipe navigation gesture intercepted (iOS/Mobile)");
      }
    };

    // Chrome/Chromium Hardware Compositor RAF Throttling (Interception for Always-Active Extensions)
    // When a tab is in the background, Chrome compositor freezes requestAnimationFrame.
    // In normal page usage (mouse movement, answering, scrolling), RAF runs at 60 FPS (~16ms).
    // A gap of > 2500ms in RAF ONLY happens if the tab was frozen/hidden in background.
    let lastRafTime = performance.now();
    let rafId = null;
    let isInitialized = false;

    // 2-second grace period after mount so initial rendering does not trigger false positives
    const initTimer = setTimeout(() => {
      lastRafTime = performance.now();
      isInitialized = true;
    }, 2000);

    const rafCheck = (now) => {
      if (isInitialized && !isFocusLost && !isSessionLocked && !isSubmitting && !submissionResult) {
        const delta = now - lastRafTime;
        if (delta > 2500 && (document.fullscreenElement || isIOSDevice())) {
          applyImmediateBlackout(true);
          setIsFocusLost(true);
          if (!hasLeftWindowRef.current) {
            hasLeftWindowRef.current = true;
            recordFocusViolation("Background tab switch detected (Window compositor suspended / Always-Active bypass intercepted)");
          }
        }
      }
      lastRafTime = now;
      rafId = requestAnimationFrame(rafCheck);
    };
    rafId = requestAnimationFrame(rafCheck);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("freeze", handlePageHide);
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });

    return () => {
      clearTimeout(initTimer);
      if (rafId) cancelAnimationFrame(rafId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("freeze", handlePageHide);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [loading, accessRequired, isClosedError, notStartedData, submissionResult, isSubmitting, isSessionLocked, proctoringRules, quizId, applyImmediateBlackout]);

  // 3a. Unconditional Right-Click & Context-Menu Lockdown (Ironclad & Omnipresent)
  useEffect(() => {
    window.__QUIZX_LOCKDOWN__ = true;
    if (document.body) {
      document.body.classList.add('quizx-exam-lockdown');
    }

    const blockContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    };

    const blockMouseButtons = (e) => {
      // button 2 = right click, which 3 = right click, ctrlKey + click on Mac
      if (e.button === 2 || e.which === 3 || (e.ctrlKey && e.button === 0)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
    };

    // Direct property assignment for instant native engine interception
    try {
      window.oncontextmenu = blockContextMenu;
      document.oncontextmenu = blockContextMenu;
      if (document.body) {
        document.body.oncontextmenu = blockContextMenu;
      }
      if (document.documentElement) {
        document.documentElement.oncontextmenu = blockContextMenu;
      }
    } catch (_) {}

    // High-priority capturing event listeners on all DOM levels
    const targets = [window, document, document.documentElement, document.body].filter(Boolean);
    const mouseEvents = ["mousedown", "mouseup", "pointerdown", "pointerup", "auxclick"];

    targets.forEach((target) => {
      target.addEventListener("contextmenu", blockContextMenu, { capture: true, passive: false });
      mouseEvents.forEach((evt) => {
        target.addEventListener(evt, blockMouseButtons, { capture: true, passive: false });
      });
    });

    const blockSelectStart = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return true;
      }
      e.preventDefault();
      return false;
    };

    const blockGestureZoom = (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    };

    document.addEventListener("selectstart", blockSelectStart, { capture: true, passive: false });
    document.addEventListener("touchstart", blockGestureZoom, { passive: false });

    return () => {
      window.__QUIZX_LOCKDOWN__ = false;
      if (document.body) {
        document.body.classList.remove('quizx-exam-lockdown');
        document.body.oncontextmenu = null;
      }
      window.oncontextmenu = null;
      document.oncontextmenu = null;
      if (document.documentElement) document.documentElement.oncontextmenu = null;

      targets.forEach((target) => {
        target.removeEventListener("contextmenu", blockContextMenu, { capture: true });
        mouseEvents.forEach((evt) => {
          target.removeEventListener(evt, blockMouseButtons, { capture: true });
        });
      });

      document.removeEventListener("selectstart", blockSelectStart, { capture: true });
      document.removeEventListener("touchstart", blockGestureZoom);
    };
  }, []);

  // 3b. Ironclad Keyboard & Shortcut Lockdown (Capturing Phase Interception)
  useEffect(() => {
    if (submissionResult || isSessionLocked) return;

    const handleKeyDown = (e) => {
      // 1. Function Keys (F1 through F12)
      const isFunctionKey = /^F([1-9]|1[0-2])$/i.test(e.key) || (e.keyCode >= 112 && e.keyCode <= 123);

      // 2. Any Ctrl or Meta (Command/Windows) combination
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      // 3. Any Alt combination (Alt+Tab, Alt+F4, Alt+Left/Right, etc.)
      const isAlt = e.altKey;

      // 4. PrintScreen / Screenshot key
      const isPrintScreen = e.key === "PrintScreen" || e.code === "PrintScreen" || e.keyCode === 44;

      // 5. ContextMenu key or Shift+F10
      const isContextMenuKey = e.key === "ContextMenu" || (e.shiftKey && (e.key === "F10" || e.keyCode === 121));

      // 6. Escape key
      const isEscape = e.key === "Escape" || e.keyCode === 27;

      if (isPrintScreen) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        applyImmediateBlackout(true);
        setIsFocusLost(true);
        try {
          if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText("CONFIDENTIAL EXAMINATION - SCREEN CAPTURE FORBIDDEN");
          }
        } catch (_) {}
        if (proctoringRules.preventScreenshots) {
          recordFocusViolation("Screenshot attempt intercepted");
        }
        return false;
      }

      if (isFunctionKey || isCtrlOrMeta || isAlt || isContextMenuKey) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }

      if (isEscape) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleCopyPaste = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true, passive: false });
    document.addEventListener("keydown", handleKeyDown, { capture: true, passive: false });
    window.addEventListener("copy", handleCopyPaste, { capture: true, passive: false });
    window.addEventListener("cut", handleCopyPaste, { capture: true, passive: false });
    window.addEventListener("paste", handleCopyPaste, { capture: true, passive: false });

    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("copy", handleCopyPaste, { capture: true });
      window.removeEventListener("cut", handleCopyPaste, { capture: true });
      window.removeEventListener("paste", handleCopyPaste, { capture: true });
    };
  }, [submissionResult, isSessionLocked, proctoringRules, applyImmediateBlackout]);

  // 4. Fullscreen Enforcer & Exit Violation (Full iOS Safari Kiosk & Desktop/Android Compatibility)
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (isIOSDevice()) {
        return;
      }

      const isFull = Boolean(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreenMode(isFull);
      isFullscreenModeRef.current = isFull;

      if (isFull) {
        wasInFullscreenRef.current = true;
        fullscreenGraceRef.current = Date.now() + 1500;
        hasLeftWindowRef.current = false;
        applyImmediateBlackout(false);
        setIsFocusLost(false);
        try {
          window.focus();
          document.body?.focus?.();
          if (navigator.keyboard && navigator.keyboard.lock) {
            navigator.keyboard.lock(['Escape']).catch(() => {});
          }
        } catch (_) {}
      } else {
        const wasInFull = wasInFullscreenRef.current;
        wasInFullscreenRef.current = false;

        // Trigger exit infraction ONLY if candidate was ACTUALLY inside fullscreen mode
        if (
          wasInFull &&
          proctoringRules.enforceFullscreen &&
          !loading &&
          !accessRequired &&
          !submissionResult &&
          !isSessionLocked &&
          !isSubmitting
        ) {
          applyImmediateBlackout(true);
          setIsFocusLost(true);
          recordFocusViolation('Exited fullscreen mode');
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [proctoringRules, loading, accessRequired, submissionResult, isSessionLocked, isSubmitting, quizId, applyImmediateBlackout]);

  // 5. Mobile Split-Screen & Multi-Window Detector (Blocks Android Split-Screen / Floating Apps)
  useEffect(() => {
    if (loading || accessRequired || isClosedError || submissionResult || isSubmitting || isSessionLocked) return;

    const checkMobileSplitScreen = () => {
      if (!isFullscreenModeRef.current || Date.now() < fullscreenGraceRef.current) return;
      if (!isMobileOrTabletDevice()) return;

      const screenH = window.screen.height || window.screen.availHeight || 1;
      const screenW = window.screen.width || window.screen.availWidth || 1;
      const winH = window.innerHeight;
      const winW = window.innerWidth;

      const isPortrait = winH >= winW;
      const ratioH = winH / screenH;
      const ratioW = winW / screenW;

      // In split screen on Android/iOS, viewport height or width drops drastically (< 0.64)
      const isSplit = (isPortrait && (ratioH < 0.64 || winH < 440)) ||
                      (!isPortrait && (ratioH < 0.52 || ratioW < 0.65 || winH < 280));

      if (isSplit) {
        setIsSplitScreenDetected(true);
        applyImmediateBlackout(true);
        if (!hasLeftWindowRef.current) {
          hasLeftWindowRef.current = true;
          recordFocusViolation("Split-screen / Multi-window mode prohibited");
        }
      } else {
        if (isSplitScreenDetected) {
          setIsSplitScreenDetected(false);
          if (!isFocusLost) {
            hasLeftWindowRef.current = false;
            applyImmediateBlackout(false);
          }
        }
      }
    };

    window.addEventListener("resize", checkMobileSplitScreen);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", checkMobileSplitScreen);
    }
    const orientHandler = () => {
      fullscreenGraceRef.current = Date.now() + 1500;
      setTimeout(checkMobileSplitScreen, 400);
    };
    window.addEventListener("orientationchange", orientHandler);

    const initialTimer = setTimeout(checkMobileSplitScreen, 1500);

    return () => {
      clearTimeout(initialTimer);
      window.removeEventListener("resize", checkMobileSplitScreen);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", checkMobileSplitScreen);
      }
      window.removeEventListener("orientationchange", orientHandler);
    };
  }, [loading, accessRequired, isClosedError, notStartedData, submissionResult, isSubmitting, isSessionLocked, isSplitScreenDetected, isFocusLost, applyImmediateBlackout]);

  const handleVerifyInPageCode = async (e) => {
    if (e) e.preventDefault();
    if (!enteredPassword.trim()) {
      setPasswordError('Please enter the exam access password.');
      return;
    }

    try {
      setIsVerifyingPassword(true);
      setPasswordError('');

      const res = await api.post(`/quizzes/${quizId}/verify-access`, {
        accessCode: enteredPassword.trim()
      });

      if (res.data.success && res.data.verified) {
        fullscreenGraceRef.current = Date.now() + 1000;
        hasLeftWindowRef.current = false;
        applyImmediateBlackout(false);
        setIsFocusLost(false);
        sessionStorage.setItem(`quizx_access_${quizId}`, enteredPassword.trim());
        await fetchQuiz(enteredPassword.trim());
      }
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Invalid access code. Please confirm with your instructor.');
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const persistAttempt = (newAnswers, newMarked = markedForReview, newIdx = currentIdx) => {
    const localKey = `quizx_attempt_${quizId}`;
    try {
      localStorage.setItem(localKey, JSON.stringify({
        answers: newAnswers,
        markedForReview: Array.from(newMarked),
        currentIdx: newIdx,
        updatedAt: Date.now()
      }));
    } catch (e) { }

    // Server-side background auto-save (debounced by 400ms)
    if (saveProgressDebounced.current) clearTimeout(saveProgressDebounced.current);
    saveProgressDebounced.current = setTimeout(async () => {
      try {
        await api.post(`/quizzes/${quizId}/save-progress`, { answers: newAnswers });
      } catch (err) {
        if (err.response?.data?.isLocked || err.response?.status === 403) {
          setIsSessionLocked(true);
          setShowViolationWarning(false);
          setShowSubmitReviewModal(false);
          applyImmediateBlackout(false);
        }
        console.warn("Auto-save progress to server failed", err);
      }
    }, 400);
  };

  const startTimer = (initialSeconds, quizInfo) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const activeQuiz = quizInfo || quizRef.current;
    const isStrict = activeQuiz?.timingMode === 'STRICT' && activeQuiz?.endTime;

    // Hard wall-clock target timestamp anchored in server-synchronized clock
    const targetEndMs = isStrict
      ? new Date(activeQuiz.endTime).getTime()
      : (Date.now() + (serverOffsetRef.current || 0)) + initialSeconds * 1000;

    const computeRemaining = () => {
      const currentServerNow = Date.now() + (serverOffsetRef.current || 0);
      return Math.max(0, Math.floor((targetEndMs - currentServerNow) / 1000));
    };

    let rem = computeRemaining();
    setTimeLeft(rem);

    if (rem <= 0) {
      setTimeLeft(0);
      handleAutoSubmit();
      return;
    }

    timerRef.current = setInterval(() => {
      const currentRem = computeRemaining();
      setTimeLeft(currentRem);
      try {
        const timerData = JSON.stringify({ timeLeft: currentRem, timestamp: Date.now() });
        localStorage.setItem(`quizx_timer_${quizId}`, timerData);
        localStorage.setItem(
          `quizx_timer_${quizId}_${user?.universityId || user?.id || "std"}`,
          timerData
        );
      } catch (e) { }

      if (currentRem <= 0) {
        clearInterval(timerRef.current);
        setTimeLeft(0);
        handleAutoSubmit();
      }
    }, 1000);
  };

  const handleSelectOption = (questionId, optionIdx) => {
    setAnswers((prev) => {
      const updated = {
        ...prev,
        [questionId]: optionIdx
      };
      answersRef.current = updated;
      persistAttempt(updated, markedForReview, currentIdx);
      return updated;
    });
  };

  const handleClearOption = (questionId) => {
    setAnswers((prev) => {
      const updated = { ...prev };
      delete updated[questionId];
      answersRef.current = updated;
      persistAttempt(updated, markedForReview, currentIdx);
      return updated;
    });
  };

  const handleNextQuestion = () => {
    if (saveProgressDebounced.current) {
      clearTimeout(saveProgressDebounced.current);
      api.post(`/quizzes/${quizId}/save-progress`, { answers: answersRef.current }).catch(() => { });
    }
    setCurrentIdx((prev) => Math.min(totalCount - 1, prev + 1));
  };

  const handlePreviousQuestion = () => {
    if (saveProgressDebounced.current) {
      clearTimeout(saveProgressDebounced.current);
      api.post(`/quizzes/${quizId}/save-progress`, { answers: answersRef.current }).catch(() => { });
    }
    setCurrentIdx((prev) => Math.max(0, prev - 1));
  };

  const handleJumpToQuestion = (idx) => {
    if (saveProgressDebounced.current) {
      clearTimeout(saveProgressDebounced.current);
      api.post(`/quizzes/${quizId}/save-progress`, { answers: answersRef.current }).catch(() => { });
    }
    setCurrentIdx(idx);
  };

  const toggleMarkReview = (questionId) => {
    setMarkedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      persistAttempt(answers, next, currentIdx);
      return next;
    });
  };

  // Sync currentIdx navigation to local storage
  useEffect(() => {
    if (loading || !quiz) return;
    const localKey = `quizx_attempt_${quizId}`;
    try {
      const cached = localStorage.getItem(localKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        parsed.currentIdx = currentIdx;
        localStorage.setItem(localKey, JSON.stringify(parsed));
      }
    } catch (e) { }
  }, [currentIdx, loading, quiz, quizId, user]);

  const handleOpenSubmitReview = () => {
    setDeclarationAgreed(false);
    setShowSubmitReviewModal(true);
  };

  const performFinalSubmit = async () => {
    if (autoSubmittingRef.current) return;
    autoSubmittingRef.current = true;
    setShowSubmitReviewModal(false);

    if (timerRef.current) clearInterval(timerRef.current);
    if (saveProgressDebounced.current) clearTimeout(saveProgressDebounced.current);

    try {
      localStorage.removeItem(`quizx_attempt_${quizId}`);
      localStorage.removeItem(`quizx_timer_${quizId}`);
      localStorage.removeItem(`quizx_violations_${quizId}`);
      localStorage.removeItem(`quizx_attempt_${quizId}_${user?.universityId || user?.id || "std"}`);
      localStorage.removeItem(`quizx_timer_${quizId}_${user?.universityId || user?.id || "std"}`);
    } catch (e) { }

    try {
      setIsSubmitting(true);
      const finalAnswers = answersRef.current || answers;
      const res = await api.post(`/quizzes/${quizId}/submit`, { answers: finalAnswers });
      if (res.data.success) {
        setSubmissionResult(res.data.result || res.data.submission);
      }
    } catch (err) {
      console.error("Submission failed", err);
      autoSubmittingRef.current = false;
      const data = err.response?.data;
      if (data?.result || data?.submission) {
        setSubmissionResult(data.result || data.submission);
      } else if (data?.isClosed) {
        setIsClosedError(true);
      } else {
        alert(data?.message || 'Failed to submit quiz');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (isAuto = false) => {
    if (isAuto) {
      performFinalSubmit();
    } else {
      handleOpenSubmitReview();
    }
  };

  const handleAutoSubmit = () => {
    performFinalSubmit();
  };

  const formatTimer = (seconds) => {
    if (seconds === null || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-24 text-center font-sans">
        <div className="w-10 h-10 border-3 border-[#1c1f58] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-xs font-black text-slate-500 uppercase tracking-wider">
          Preparing secure assessment environment...
        </p>
      </div>
    );
  }

  // Scheduled / Not Started Yet State (Waiting Room)
  if (notStartedData) {
    const formattedStartTime = notStartedData.startTime
      ? new Date(notStartedData.startTime).toLocaleString('en-US', {
        dateStyle: 'full',
        timeStyle: 'short'
      })
      : 'Scheduled Time';

    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center space-y-6 font-sans animate-in fade-in">
        <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-200 flex items-center justify-center mx-auto text-[#1c1f58] shadow-sm">
          <Calendar size={32} />
        </div>
        <div className="space-y-2">
          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-900 border border-indigo-200">
            Upcoming Assessment
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-[#1c1f58] tracking-tight">
            Assessment Not Yet Live
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed max-w-md mx-auto">
            {notStartedData.message || `This assessment is scheduled to open on ${formattedStartTime}. Please wait until the start time.`}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scheduled Start Time</div>
          <div className="text-sm font-black text-slate-800 flex items-center justify-center gap-2">
            <Clock size={16} className="text-indigo-600" />
            <span>{formattedStartTime}</span>
          </div>
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                fetchQuiz();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-[#1c1f58] text-xs font-bold transition-all cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>Check If Live Now</span>
            </button>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition-all"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Assessment Closed State
  if (isClosedError) {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center space-y-4 font-sans">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-700">
          <Clock size={32} />
        </div>
        <h2 className="text-lg font-black text-[#1c1f58]">Assessment Closed</h2>
        <p className="text-xs text-slate-500 font-medium">
          This examination has been marked CLOSED by the instructor and is no longer accepting student submissions.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="px-5 py-2.5 rounded-xl bg-[#1c1f58] hover:bg-[#252975] text-white text-xs font-black cursor-pointer shadow-sm transition-all"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // Direct URL access: Password Entry Required
  if (accessRequired) {
    return (
      <div className="max-w-md mx-auto py-20 px-4 font-sans">
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xl space-y-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-800">
            <Lock size={28} />
          </div>

          <div>
            <h2 className="text-lg font-black text-[#1c1f58]">Password Protected Assessment</h2>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Please enter the exam access password announced by your instructor to unlock and attempt this test.
            </p>
          </div>

          <form onSubmit={handleVerifyInPageCode} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Exam Access Password:
              </label>
              <input
                type="text"
                autoFocus
                value={enteredPassword}
                onChange={(e) => {
                  setEnteredPassword(e.target.value.toUpperCase());
                  if (passwordError) setPasswordError('');
                }}
                placeholder="e.g. GEU-8421"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 font-mono font-black text-sm text-[#1c1f58] tracking-widest text-center uppercase bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1c1f58]"
              />
            </div>

            {passwordError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-rose-600" />
                <span>{passwordError}</span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="w-1/2 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isVerifyingPassword || !enteredPassword.trim()}
                className="w-1/2 py-2.5 px-4 rounded-xl bg-[#1c1f58] hover:bg-[#252975] text-white font-black text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer active:scale-98"
              >
                <span>{isVerifyingPassword ? 'Verifying...' : 'Unlock & Start'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center space-y-4 font-sans">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600">
          <AlertCircle size={32} />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-base font-extrabold text-slate-800">
            {authErrorMessage || "Quiz not found or unauthorized"}
          </h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {authErrorMessage
              ? "If you believe this is an error, please contact the AI Quest Examination Secretariat or Lab Invigilator."
              : "The assessment you are trying to access does not exist or your student account does not have permission to view it."}
          </p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="px-5 py-2.5 rounded-xl bg-[#1c1f58] hover:bg-[#252975] text-white text-xs font-black shadow-md transition-all cursor-pointer"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // =========================================================================
  // VIEW A: RESULT / SCORECARD REVIEW & SUBMISSION ACKNOWLEDGMENT
  // =========================================================================
  if (submissionResult) {
    const canShowAnswers = Boolean(quiz?.showResultsAfterSubmit || submissionResult?.showResultsAfterSubmit);

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans selection:bg-none">
        {/* Top Institutional Header */}
        <div className="bg-white border-b border-slate-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <img
              src="/geu-logo.webp"
              alt="Graphic Era University"
              className="h-8 sm:h-9 object-contain"
            />
            <div>
              <div className="text-xs font-bold text-slate-900 tracking-tight">Graphic Era Deemed to be University</div>
              <div className="text-[10px] text-slate-500 font-medium">Central Examination & Assessment Portal</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#1c1f58] text-white text-xs font-bold shadow-xs hover:bg-[#252975] transition-all cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>Back to Assessments</span>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="max-w-3xl w-full mx-auto px-4 py-8 sm:py-10 space-y-6 flex-1">
          {!canShowAnswers ? (
            /* OFFICIAL SUBMISSION ACKNOWLEDGMENT (CONFIDENTIAL MODE: NO SCORES, NO ANSWERS) */
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-200">
              {/* Header Banner */}
              <div className="bg-[#1c1f58] px-6 sm:px-8 py-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-200 block">
                    Central Examination Portal
                  </span>
                  <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">{quiz.title}</h1>
                  <p className="text-xs text-indigo-200/90 font-medium">
                    {quiz.course?.code || "COURSE"} &bull; {quiz.course?.title || "Academic Assessment"}
                  </p>
                </div>
                <div className="self-start sm:self-center">
                  <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500 text-white inline-flex items-center gap-1.5 shadow-2xs">
                    <CheckCircle2 size={13} />
                    <span>Submitted & Logged</span>
                  </span>
                </div>
              </div>

              {/* Success Message Banner */}
              <div className="p-6 sm:p-8 text-center space-y-3 border-b border-slate-100">

                <div className="space-y-1">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Your Paper Has Been Successfully Submitted!
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-lg mx-auto leading-relaxed">
                    Your assessment answers have been officially logged and encrypted in the university assessment portal. No further changes can be made.
                  </p>
                </div>
              </div>

              {/* Student & Verification Details Grid */}
              <div className="p-6 sm:p-8 bg-slate-50/50 space-y-5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Candidate Verification & Exam Record
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                  <div className="p-4 rounded-2xl bg-white border border-slate-200/80 space-y-1 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Candidate Name</span>
                    <span className="font-extrabold text-slate-900 text-sm block">{user?.name || "Candidate"}</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-slate-200/80 space-y-1 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Registration ID</span>
                    <span className="font-mono font-extrabold text-slate-900 text-sm block">{user?.registrationId || user?.universityId || user?.mobileNo || "N/A"}</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-slate-200/80 space-y-1 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Class & Stream</span>
                    <span className="font-bold text-slate-800 block">
                      {user?.studentClass || "Class 12th"} &bull; {user?.stream || "Science"}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-slate-200/80 space-y-1 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">School / Institution</span>
                    <span className="font-bold text-slate-800 block truncate" title={user?.schoolName || "Graphic Era University"}>
                      {user?.schoolName || "Graphic Era University"}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-slate-200/80 space-y-1 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Assessment Title</span>
                    <span className="font-bold text-slate-800 block truncate" title={quiz.title}>
                      {quiz.title} ({quiz.course?.code || "COURSE"})
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-slate-200/80 space-y-1 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Submission Timestamp</span>
                    <span className="font-semibold text-slate-700 block">
                      {new Date().toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true
                      })}
                    </span>
                  </div>
                </div>

                {/* Institutional Integrity & Evaluation Notice */}
                <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3">

                  <div className="space-y-0.5 text-xs">
                    <span className="font-bold text-[#1c1f58] block">Rules for Fair Assessment</span>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      Your submission was verified and logged under Central Anti-Cheating & AI Proctoring standards. Grades and answer keys will be released by the course instructor per university regulations.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Action */}
              <div className="p-6 bg-white border-t border-slate-100 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="w-full sm:w-auto px-8 py-3 rounded-xl bg-[#1c1f58] hover:bg-[#252975] text-white text-xs font-bold tracking-wide shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                >
                  <ArrowLeft size={14} />
                  <span>Return to Assessments Portal</span>
                </button>
              </div>
            </div>
          ) : (
            /* OFFICIAL SCORECARD & DETAILED REVIEW (ONLY WHEN FACULTY EXPLICITLY RELEASED IT) */
            <>
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-200">
                {/* Card Top Accent Banner */}
                <div className="bg-[#1c1f58] px-6 sm:px-8 py-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-indigo-200 text-[11px] font-bold uppercase tracking-wider">
                      <ShieldCheck size={14} className="text-emerald-400" />
                      <span>Official Examination Scorecard</span>
                    </div>
                    <h1 className="text-lg sm:text-xl font-bold tracking-tight">{quiz.title}</h1>
                    <p className="text-xs text-indigo-200/90 font-medium">
                      {quiz.course?.code || "COURSE"} &bull; {quiz.course?.title || "Academic Assessment"}
                    </p>
                  </div>

                  <div className="self-start sm:self-center">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs ${submissionResult.isPassed
                      ? "bg-emerald-500 text-white"
                      : "bg-rose-500 text-white"
                      }`}>
                      {submissionResult.isPassed ? (
                        <>
                          <CheckCircle2 size={13} />
                          <span>Qualified / Passed</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle size={13} />
                          <span>Needs Improvement</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Candidate Meta Info Strip */}
                <div className="bg-slate-50/70 border-b border-slate-100 px-6 sm:px-8 py-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Candidate Name</span>
                    <span className="font-bold text-slate-800">{user?.name || "Candidate"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Registration ID</span>
                    <span className="font-mono font-bold text-slate-800">{user?.registrationId || user?.universityId || user?.mobileNo || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Class & Stream</span>
                    <span className="font-semibold text-slate-700">{user?.studentClass || "Class 12th"} &bull; {user?.stream || "Science"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Status</span>
                    <span className="font-bold text-emerald-700 inline-flex items-center gap-1">
                      <CheckCircle2 size={11} /> Submitted & Logged
                    </span>
                  </div>
                </div>

                {/* Performance Metrics Section */}
                <div className="p-6 sm:p-8 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Metric 1: Marks Score */}
                    <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-1 text-center">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Score Obtained</span>
                      <div className="text-2xl sm:text-3xl font-black text-[#1c1f58]">
                        {submissionResult.score}
                        <span className="text-sm font-semibold text-slate-400"> / {submissionResult.totalMarks}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium block">Total Marks Assigned</span>
                    </div>

                    {/* Metric 2: Percentage */}
                    <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-1 text-center">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Percentage</span>
                      <div className="text-2xl sm:text-3xl font-black text-indigo-900">
                        {submissionResult.percentage}%
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium block">
                        {submissionResult.isPassed ? "Above Passing Cutoff" : "Below Minimum Cutoff"}
                      </span>
                    </div>

                    {/* Metric 3: Passing Benchmark */}
                    <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-1 text-center">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Passing Benchmark</span>
                      <div className="text-2xl sm:text-3xl font-black text-slate-700">
                        {quiz.passingMarks || submissionResult.passingMarks || 0}
                        <span className="text-sm font-semibold text-slate-400"> Marks</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium block">Required to Qualify</span>
                    </div>
                  </div>

                  {/* Security & Verification Banner */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-medium flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
                      <span>Candidate session evaluated under academic integrity protocol. Records synced to official gradebook.</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400 font-bold shrink-0">
                      ID: {submissionResult.submissionId ? submissionResult.submissionId.slice(0, 8) : "VERIFIED"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detailed Solutions */}
              {submissionResult.detailedAnalysis && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <FileText size={16} className="text-[#1c1f58]" />
                    <span>Question-by-Question Review</span>
                  </h3>
                  {submissionResult.detailedAnalysis.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-5 rounded-2xl border bg-white space-y-3 ${item.isCorrect
                        ? "border-emerald-200 bg-emerald-50/20"
                        : item.isAttempted
                          ? "border-rose-200 bg-rose-50/20"
                          : "border-slate-200"
                        }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-500">Question {idx + 1}</span>
                        <span className={item.isCorrect ? "text-emerald-700" : item.isAttempted ? "text-rose-700" : "text-slate-400"}>
                          {item.isCorrect ? `+${item.marksAwarded} Marks` : item.isAttempted ? `${item.marksAwarded} Marks` : "Unattempted"}
                        </span>
                      </div>

                      <p className="text-xs font-bold text-slate-800">{item.questionText}</p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {item.options.map((opt, optIdx) => {
                          const isStudentChoice = item.studentSelected === optIdx;
                          const isCorrectAnswer = item.correctOptionIndex === optIdx;
                          return (
                            <div
                              key={optIdx}
                              className={`p-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 ${isCorrectAnswer
                                ? "border-emerald-500 bg-emerald-100/70 text-emerald-950 font-bold"
                                : isStudentChoice
                                  ? "border-rose-500 bg-rose-100/70 text-rose-950 font-bold"
                                  : "border-slate-100 bg-slate-50 text-slate-600"
                                }`}
                            >
                              <span className="font-bold">{String.fromCharCode(65 + optIdx)}:</span>
                              <span>{opt}</span>
                              {isCorrectAnswer && <span className="ml-auto text-[10px] text-emerald-700 font-extrabold">CORRECT</span>}
                              {isStudentChoice && !isCorrectAnswer && <span className="ml-auto text-[10px] text-rose-700 font-extrabold">YOUR CHOICE</span>}
                            </div>
                          );
                        })}
                      </div>

                      {item.explanation && (
                        <div className="p-3 rounded-xl bg-purple-50 text-purple-900 text-[11px] font-medium border border-purple-100">
                          <span className="font-bold">Explanation: </span>
                          {item.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Institutional Footer */}
        <div className="py-4 text-center text-xs text-slate-400 font-medium">
          Verified Academic Examination Record &bull; Graphic Era Deemed to be University
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW B: ACTIVE TEST TAKING CANVAS
  // =========================================================================
  const currentQ = quiz.questions[currentIdx];
  const isAnswered = answers[currentQ?.id] !== undefined;
  const isMarked = markedForReview.has(currentQ?.id);

  const answeredCount = Object.keys(answers).length;
  const markedCount = markedForReview.size;
  const totalCount = quiz.questions.length;

  const isUrgentTimer = timeLeft !== null && timeLeft <= 120; // 2 minutes

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }}
      className={`min-h-screen bg-slate-100 flex flex-col font-sans relative selection:bg-none quizx-exam-lockdown ${isIOSDevice() && isFullscreenMode ? 'ios-kiosk-container' : ''}`}
    >
      {/* Print Suppression CSS */}
      {proctoringRules.preventScreenshots && (
        <style>{`
          @media print {
            body * { display: none !important; }
            body::after {
              content: "CONFIDENTIAL EXAMINATION - PRINTING IS STRICTLY PROHIBITED";
              display: block;
              font-size: 24pt;
              font-weight: 900;
              color: red;
              text-align: center;
              margin-top: 200px;
            }
          }
        `}</style>
      )}

      {/* Forensic Anti-Leak Watermark Grid (Overlaid directly ON TOP of questions at z-60) */}
      {proctoringRules.preventScreenshots && (
        <div
          className="pointer-events-none fixed inset-0 z-[60] select-none overflow-hidden opacity-[0.24] flex flex-wrap gap-x-14 gap-y-12 p-4 items-center justify-around rotate-[-12deg]"
          style={{ mixBlendMode: "multiply" }}
        >
          {Array.from({ length: 96 }).map((_, i) => (
            <div
              key={i}
              className="text-[11px] font-black font-mono tracking-widest text-slate-900 whitespace-nowrap"
            >
              {user?.name?.toUpperCase() || "CANDIDATE"} &bull; {user?.universityId || user?.rollNo || "GEU"} &bull; GRAPHIC ERA &bull; {quiz?.title || "ASSESSMENT"}
            </div>
          ))}
        </div>
      )}

      {/* Anti-Screenshot / Out-of-Focus Blackout Shield (0ms Latency Synchronous) */}
      <div
        id="exam-blackout-shield"
        className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none"
        style={{ display: isFocusLost ? "flex" : "none" }}
      >
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 animate-pulse">
          <ShieldAlert size={36} />
        </div>
        <h2 className="text-xl font-black text-white tracking-wide">
          SECURITY SHIELD ACTIVE
        </h2>
        <p className="text-xs text-slate-400 font-medium max-w-md mt-2 leading-relaxed">
          Assessment questions and options are concealed while window focus is lost or screen capture is attempted. Click below to resume your assessment.
        </p>
        <button
          onClick={() => {
            applyImmediateBlackout(false);
            setIsFocusLost(false);
            hasLeftWindowRef.current = false;
            try {
              window.focus();
              if (document.body) {
                document.body.tabIndex = -1;
                document.body.focus();
              }
            } catch (_) {}
          }}
          className="mt-6 px-6 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-950 text-xs font-black tracking-wider uppercase transition-all shadow-xl cursor-pointer active:scale-95"
        >
          Resume Assessment
        </button>
      </div>

      {/* Mobile Split-Screen / Multi-Window Intercept Shield */}
      {isSplitScreenDetected && (
        <div className="fixed inset-0 z-[10000] bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 animate-bounce">
            <ShieldAlert size={36} />
          </div>
          <h2 className="text-xl font-black text-white tracking-wide">
            SPLIT-SCREEN MODE DETECTED
          </h2>
          <p className="text-xs text-slate-300 font-medium max-w-sm mt-2 leading-relaxed">
            Running QuizX in split-screen, floating bubble, or multi-window mode is strictly prohibited. Close other applications and maximize QuizX to full screen to continue.
          </p>
          <div className="mt-4 px-3 py-1.5 rounded-lg bg-rose-950/60 border border-rose-800 text-[11px] font-bold text-rose-300">
            Proctoring Violation Recorded
          </div>
        </div>
      )}

      {/* Mandatory Full-Screen Enforcer Gate */}
      {!isFullscreenMode && quiz && !submissionResult && !accessRequired && !isClosedError && !isSessionLocked && (
        <div className="fixed inset-0 z-[9998] bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-150">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#1c1f58]">
              <Maximize size={32} />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                {isIOSDevice() ? "Secure Mobile Kiosk Mode Required" : "Full-Screen Mode Required"}
              </h2>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {isIOSDevice()
                  ? "To safeguard academic integrity, this exam runs in iOS Secure Kiosk Mode. Exiting Safari, switching apps, opening tabs, or accessing notification centers records an academic infraction."
                  : "To safeguard academic integrity, this exam must be taken in Full-Screen Mode. Exiting full-screen or switching windows records an academic infraction."}
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  fullscreenGraceRef.current = Date.now() + 1000;
                  wasInFullscreenRef.current = true;
                  isFullscreenModeRef.current = true;
                  hasLeftWindowRef.current = false;
                  applyImmediateBlackout(false);
                  setIsFocusLost(false);

                  if (isIOSDevice()) {
                    window.scrollTo(0, 0);
                    setIsFullscreenMode(true);
                  } else {
                    if (document.documentElement.requestFullscreen) {
                      await document.documentElement.requestFullscreen();
                    } else if (document.documentElement.webkitRequestFullscreen) {
                      await document.documentElement.webkitRequestFullscreen();
                    } else if (document.documentElement.mozRequestFullScreen) {
                      await document.documentElement.mozRequestFullScreen();
                    } else if (document.documentElement.msRequestFullscreen) {
                      await document.documentElement.msRequestFullscreen();
                    }
                    setIsFullscreenMode(true);
                  }
                  setTimeout(() => {
                    try {
                      window.focus();
                      document.body?.focus?.();
                    } catch (_) {}
                  }, 100);
                } catch (err) {
                  setIsFullscreenMode(true);
                  fullscreenGraceRef.current = Date.now() + 1000;
                }
              }}
              className="w-full py-3 px-6 rounded-2xl bg-[#1c1f58] hover:bg-[#252975] text-white font-black text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
            >
              <Maximize size={16} />
              <span>{isIOSDevice() ? "Enter Secure Kiosk Mode to Begin Exam" : "Enter Full-Screen to Begin Exam"}</span>
            </button>
          </div>
        </div>
      )}

      {/* 1. Exam Top Bar */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sticky top-0 z-40 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (window.confirm('Do you want to leave? Your test progress will be lost unless submitted.')) {
                navigate('/');
              }
            }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xs sm:text-sm font-extrabold text-slate-900 line-clamp-1">{quiz.title}</h1>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {quiz.course?.code} &bull; {quiz.questions.length} Questions
            </span>
          </div>
        </div>

        {/* Live Status Indicators: Clock, Warnings, and Submit */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live Integrity Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-black transition-all ${
              tabViolations > 0
                ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}
            title="Real-time proctoring integrity active"
          >
            <ShieldAlert size={14} className={tabViolations > 0 ? 'text-rose-600' : 'text-slate-400'} />
            <span>{tabViolations > 0 ? 'Proctoring Flagged' : 'AI Proctored'}</span>
          </div>

          {quiz.timingMode === 'STRICT' && (
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-black uppercase tracking-wider" title="Strict assessment window: test closes at scheduled end time for all candidates">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              <span>Strict Window</span>
            </div>
          )}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-extrabold text-xs transition-all ${isUrgentTimer
            ? 'bg-rose-50 text-rose-700 border-rose-300 animate-urgent'
            : 'bg-slate-50 text-slate-700 border-slate-200'
            }`}>
            <Clock size={15} className={isUrgentTimer ? 'text-rose-600 animate-spin' : 'text-slate-500'} />
            <span>{formatTimer(timeLeft)}</span>
          </div>

          <button
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting}
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <Send size={14} />
            <span>Submit Test</span>
          </button>
        </div>
      </div>

      {/* 2. Main Question & Palette Layout */}
      <div id="exam-main-content" onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); return false; }} className="max-w-7xl mx-auto w-full p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 transition-all duration-75 select-none">
        {/* Left: Active Question Card */}
        <div className="lg:col-span-3 bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            {/* Forensic Candidate Header Stamp */}
            <div className="flex items-center justify-between pb-1 text-[10px] font-mono font-bold text-slate-400/90 select-none">
              <span>CANDIDATE: {user?.name?.toUpperCase() || "STUDENT"} ({user?.universityId || user?.rollNo || "GEU"})</span>
              <span>VERIFIED EXAM SESSION &bull; GRAPHIC ERA</span>
            </div>

            {/* Question Index & Marks */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-[#1c1f58]/10 text-[#1c1f58]">
                  Question {currentIdx + 1} of {totalCount}
                </span>
                {currentQ?.passage && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <BookOpen size={12} className="shrink-0" />
                    <span>Reading Comprehension</span>
                  </span>
                )}
              </div>
              <span className="text-xs font-bold text-slate-500">
                +{currentQ?.marks || 1} Marks {quiz.negativeMarking && `(-${quiz.negativeMarksPerWrong} on wrong)`}
              </span>
            </div>

            {/* Split Screen RC Layout vs Standard Layout */}
            {currentQ?.passage ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-1">
                {/* Left Column: Reading Passage & Reference Diagram */}
                <div className="lg:col-span-7 bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4 max-h-[640px] overflow-y-auto">
                  <div className="space-y-3">
                    {/* Passage Header & Font Zoom Toolbar */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                      <div className="flex items-center gap-2 min-w-0">
                        <BookOpen size={15} className="text-indigo-600 shrink-0" />
                        <span className="text-xs sm:text-sm font-extrabold text-slate-800 truncate">
                          {currentQ.passage.title || 'Reading Comprehension Passage'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs shrink-0">
                        <button
                          type="button"
                          onClick={() => setPassageFontSize(prev => Math.max(12, prev - 1))}
                          className="px-2 py-0.5 text-[11px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                          title="Decrease font size"
                        >
                          A-
                        </button>
                        <span className="text-[10px] font-mono font-bold text-slate-400 px-1">
                          {passageFontSize}px
                        </span>
                        <button
                          type="button"
                          onClick={() => setPassageFontSize(prev => Math.min(22, prev + 1))}
                          className="px-2 py-0.5 text-[11px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                          title="Increase font size"
                        >
                          A+
                        </button>
                      </div>
                    </div>

                    {/* Passage Content */}
                    <div
                      className="text-slate-800 leading-relaxed whitespace-pre-wrap font-serif sm:font-sans selection:bg-indigo-100"
                      style={{ fontSize: `${passageFontSize}px` }}
                    >
                      {currentQ.passage.content}
                    </div>

                    {/* Passage Reference Diagram (if available) */}
                    {currentQ.passage.imageUrl && (
                      <div className="pt-2">
                        <div
                          onClick={() => setZoomedDiagram(currentQ.passage.imageUrl)}
                          className="group/img relative inline-flex flex-col items-center max-w-full bg-white hover:bg-slate-100/70 rounded-xl border border-slate-200 p-2 shadow-2xs transition-all cursor-zoom-in"
                          title="Click to enlarge diagram"
                        >
                          <img
                            src={getSafeImageUrl(currentQ.passage.imageUrl)}
                            alt="Passage Reference Diagram"
                            className="max-h-60 w-auto max-w-full object-contain rounded-lg"
                            loading="eager"
                          />
                          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 group-hover/img:text-indigo-600 transition-colors">
                            <Maximize2 size={11} />
                            <span>Enlarge passage diagram</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-200/50 text-[10px] text-slate-400 font-medium flex items-center justify-between">
                    <span>Reference passage for this question</span>
                    <span>Scroll to read complete text</span>
                  </div>
                </div>

                {/* Right Column: Question Statement & Options */}
                <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
                  <div className="space-y-4">
                    {/* Question Statement */}
                    <div className="text-sm sm:text-base font-extrabold text-slate-900 leading-relaxed whitespace-pre-wrap">
                      {currentQ?.questionText}
                    </div>

                    {/* Code Snippet (if available) */}
                    {currentQ?.codeSnippet && (
                      <div className="p-4 rounded-2xl bg-slate-900 text-emerald-400 font-mono text-xs overflow-x-auto shadow-inner">
                        <pre>{currentQ.codeSnippet}</pre>
                      </div>
                    )}

                    {/* Question Specific Diagram (if available) */}
                    {currentQ?.imageUrl && (
                      <div className="pt-1">
                        <div
                          onClick={() => setZoomedDiagram(currentQ.imageUrl)}
                          className="group/img relative inline-flex flex-col items-center max-w-full bg-slate-50 hover:bg-slate-100/70 rounded-2xl border border-slate-200/90 p-2 shadow-2xs transition-all cursor-zoom-in"
                          title="Click to enlarge diagram"
                        >
                          <img
                            src={getSafeImageUrl(currentQ.imageUrl)}
                            alt="Question Reference Diagram"
                            className="max-h-56 w-auto max-w-full object-contain rounded-xl"
                            loading="eager"
                          />
                          <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-slate-500 group-hover/img:text-indigo-600 transition-colors">
                            <Maximize2 size={11} />
                            <span>Click diagram to expand</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Options */}
                    <div className="space-y-2.5 pt-1">
                      {(currentQ?.shuffledOptions || (currentQ?.options || []).map((opt, idx) => ({ text: opt, originalIndex: idx }))).map((optItem, dispIdx) => {
                        const isSelected = answers[currentQ.id] === optItem.originalIndex;
                        return (
                          <div
                            key={optItem.originalIndex}
                            onClick={() => handleSelectOption(currentQ.id, optItem.originalIndex)}
                            className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-3 select-none ${isSelected
                              ? 'border-[#1c1f58] bg-indigo-50/70 text-indigo-950 font-bold shadow-xs'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-medium'
                              }`}
                          >
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-extrabold shrink-0 transition-colors ${isSelected
                              ? 'border-[#1c1f58] bg-[#1c1f58] text-white'
                              : 'border-slate-300 text-slate-500'
                              }`}>
                              {String.fromCharCode(65 + dispIdx)}
                            </div>
                            <span className="text-xs sm:text-sm">{optItem.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Standard Single Column Question View */
              <>
                {/* Question Statement */}
                <div className="text-sm sm:text-base font-extrabold text-slate-900 leading-relaxed whitespace-pre-wrap">
                  {currentQ?.questionText}
                </div>

                {/* Code Snippet (if available) */}
                {currentQ?.codeSnippet && (
                  <div className="p-4 rounded-2xl bg-slate-900 text-emerald-400 font-mono text-xs overflow-x-auto shadow-inner">
                    <pre>{currentQ.codeSnippet}</pre>
                  </div>
                )}

                {/* Question Reference Diagram / Image */}
                {currentQ?.imageUrl && (
                  <div className="pt-2">
                    <div
                      onClick={() => setZoomedDiagram(currentQ.imageUrl)}
                      className="group/img relative inline-flex flex-col items-center max-w-full bg-slate-50 hover:bg-slate-100/70 rounded-2xl border border-slate-200/90 p-2.5 shadow-2xs transition-all cursor-zoom-in"
                      title="Click to enlarge diagram"
                    >
                      <img
                        src={getSafeImageUrl(currentQ.imageUrl)}
                        alt="Question Reference Diagram"
                        className="max-h-72 sm:max-h-80 w-auto max-w-full object-contain rounded-xl"
                        loading="eager"
                      />
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 group-hover/img:text-indigo-600 transition-colors">
                        <Maximize2 size={12} />
                        <span>Click diagram to expand full screen</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Options */}
                <div className="space-y-3 pt-2">
                  {(currentQ?.shuffledOptions || (currentQ?.options || []).map((opt, idx) => ({ text: opt, originalIndex: idx }))).map((optItem, dispIdx) => {
                    const isSelected = answers[currentQ.id] === optItem.originalIndex;
                    return (
                      <div
                        key={optItem.originalIndex}
                        onClick={() => handleSelectOption(currentQ.id, optItem.originalIndex)}
                        className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-3.5 select-none ${isSelected
                          ? 'border-[#1c1f58] bg-indigo-50/70 text-indigo-950 font-bold shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-medium'
                          }`}
                      >
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-extrabold shrink-0 transition-colors ${isSelected
                          ? 'border-[#1c1f58] bg-[#1c1f58] text-white'
                          : 'border-slate-300 text-slate-500'
                          }`}>
                          {String.fromCharCode(65 + dispIdx)}
                        </div>
                        <span className="text-xs sm:text-sm">{optItem.text}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Question Bottom Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleMarkReview(currentQ.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${isMarked
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
              >
                <Bookmark size={14} />
                <span>{isMarked ? 'Marked for Review' : 'Mark Review'}</span>
              </button>

              {isAnswered && (
                <button
                  type="button"
                  onClick={() => handleClearOption(currentQ.id)}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  Clear Selection
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentIdx === 0}
                onClick={handlePreviousQuestion}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentIdx === totalCount - 1}
                onClick={handleNextQuestion}
                className="px-4 py-2 rounded-xl bg-[#1c1f58] hover:bg-[#252975] text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 transition-all active:scale-95 cursor-pointer"
              >
                <span>Save & Next</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Question Navigation Palette */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-5 h-fit">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Question Palette</h3>
            <div className="grid grid-cols-3 gap-2 mt-2 text-center text-[11px]">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800">
                <div className="font-extrabold">{answeredCount}</div>
                <div className="text-[10px]">Answered</div>
              </div>
              <div className="p-2 rounded-xl bg-purple-50 text-purple-800">
                <div className="font-extrabold">{markedCount}</div>
                <div className="text-[10px]">Review</div>
              </div>
              <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                <div className="font-extrabold">{totalCount - answeredCount}</div>
                <div className="text-[10px]">Remaining</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2 max-h-72 overflow-y-auto p-1">
            {quiz.questions.map((q, idx) => {
              const qAnswered = answers[q.id] !== undefined;
              const qMarked = markedForReview.has(q.id);
              const isCurrent = idx === currentIdx;
              const isRc = Boolean(q.passageId || q.passage);

              let style = 'bg-slate-100 text-slate-700 border-slate-200';
              if (qMarked) {
                style = 'bg-purple-100 text-purple-800 border-purple-300 font-bold';
              } else if (qAnswered) {
                style = 'bg-emerald-500 text-white border-emerald-600 font-bold';
              }

              return (
                <button
                  key={q.id}
                  onClick={() => handleJumpToQuestion(idx)}
                  className={`relative h-9 rounded-xl border text-xs flex items-center justify-center transition-all cursor-pointer ${style} ${isCurrent ? 'ring-2 ring-[#1c1f58] ring-offset-2 scale-105 font-black' : 'hover:opacity-80'
                    }`}
                  title={`${isRc ? '[Reading Comprehension] ' : ''}Question ${idx + 1}`}
                >
                  <span>{idx + 1}</span>
                  {isRc && (
                    <span className="absolute -top-1 -right-1 px-1 py-0.2 rounded text-[8px] font-black bg-indigo-600 text-white leading-tight shadow-2xs">
                      RC
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100">
            <button
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition-all cursor-pointer shadow-sm active:scale-98"
            >
              Submit Assessment
            </button>
          </div>
        </div>
      </div>

      {/* PRE-SUBMISSION REVIEW & ACADEMIC DECLARATION MODAL */}
      {showSubmitReviewModal && (
        <div className="fixed inset-0 z-[90] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
              <div className="flex items-center gap-2.5">

                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Review Responses Before Final Submission
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Please inspect your chosen answers across all {quiz.questions.length} questions.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSubmitReviewModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Summary Stats Row */}
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Answered</span>
                  <span className="text-lg font-black text-emerald-800">{answeredCount}</span>
                </div>
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">Marked for Review</span>
                  <span className="text-lg font-black text-purple-800">{markedCount}</span>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">Unanswered (Skipped)</span>
                  <span className="text-lg font-black text-amber-800">{totalCount - answeredCount}</span>
                </div>
              </div>

              {totalCount - answeredCount > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={15} className="text-amber-600 shrink-0" />
                  <span>
                    You have {totalCount - answeredCount} unanswered question(s). You can click &quot;Edit / Jump&quot; on any question below to answer it before submitting.
                  </span>
                </div>
              )}

              {/* Question-by-Question Review List */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700 block">
                  Question Response Matrix:
                </span>
                <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white shadow-2xs">
                  {quiz.questions.map((q, idx) => {
                    const selectedOptIdx = answers[q.id];
                    const hasAnswer = selectedOptIdx !== undefined && selectedOptIdx !== null;
                    const dispIdx = q.shuffledOptions ? q.shuffledOptions.findIndex(o => o.originalIndex === selectedOptIdx) : selectedOptIdx;
                    const optLetter = hasAnswer && dispIdx >= 0 ? String.fromCharCode(65 + dispIdx) : (hasAnswer ? String.fromCharCode(65 + selectedOptIdx) : null);
                    const optText = hasAnswer && q.options && q.options[selectedOptIdx] ? q.options[selectedOptIdx] : null;
                    const isMarked = markedForReview.has(q.id);

                    return (
                      <div
                        key={q.id}
                        className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/80 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="font-mono font-bold text-slate-500 shrink-0">
                            Q{idx + 1}.
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {Boolean(q.passageId || q.passage) && (
                                <span className="text-[9px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded shrink-0">
                                  RC
                                </span>
                              )}
                              <p className="text-slate-800 font-semibold truncate" title={q.questionText}>
                                {q.questionText}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {hasAnswer ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 truncate max-w-xs">
                                  <span>Selected: [{optLetter}]</span>
                                  <span className="font-normal truncate">{optText}</span>
                                </span>
                              ) : (
                                <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                  Not Answered
                                </span>
                              )}
                              {isMarked && (
                                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                  Marked Review
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setShowSubmitReviewModal(false);
                            setCurrentIdx(idx);
                          }}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-[11px] font-bold text-slate-700 transition-colors shrink-0 cursor-pointer"
                        >
                          Edit Answer
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Student Honor & Academic Integrity Declaration */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={declarationAgreed}
                    onChange={(e) => setDeclarationAgreed(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-[#1c1f58] focus:ring-[#1c1f58] cursor-pointer"
                  />
                  <span className="text-xs text-slate-700 font-semibold leading-relaxed">
                    I confirm that I have reviewed all my selected responses above. I am submitting my final assessment voluntarily and understand that once submitted, responses cannot be modified.
                  </span>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowSubmitReviewModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Return to Test
              </button>

              <button
                type="button"
                disabled={!declarationAgreed || isSubmitting}
                onClick={performFinalSubmit}
                className="px-5 py-2 rounded-xl bg-[#1c1f58] hover:bg-[#252975] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Submitting Assessment...</span>
                  </>
                ) : (
                  <>
                    <Send size={13} />
                    <span>Confirm & Final Submit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Anti-Cheat Violation Warning Modal */}
      {showViolationWarning && (
        <div className="fixed inset-0 z-[10001] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-200 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center mx-auto">
              <AlertCircle size={24} />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-sm font-black text-rose-950 uppercase tracking-wider">
                Academic Integrity Alert
              </h3>
              <p className="text-xs text-rose-600 font-extrabold">
                Window Focus Loss / Full-Screen Exit Detected
              </p>
            </div>
            <div className="p-4 bg-rose-50/80 border border-rose-200 rounded-xl text-xs text-rose-900 leading-relaxed space-y-2">
              <p className="font-bold">
                Examination guidelines strictly require continuous, uninterrupted active focus in full-screen mode at all times.
              </p>
              <p className="text-rose-700 text-[11px] leading-relaxed">
                Your activity has been officially logged with an encrypted timestamp on the institutional examination server. Any further tab switching, window minimization, or exiting full-screen will result in immediate examination session lock-out.
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                setShowViolationWarning(false);
                hasLeftWindowRef.current = false;
                applyImmediateBlackout(false);
                setIsFocusLost(false);

                try {
                  fullscreenGraceRef.current = Date.now() + 600;
                  if (!document.fullscreenElement) {
                    if (document.documentElement.requestFullscreen) {
                      await document.documentElement.requestFullscreen();
                    } else if (document.documentElement.webkitRequestFullscreen) {
                      await document.documentElement.webkitRequestFullscreen();
                    } else if (document.documentElement.mozRequestFullScreen) {
                      await document.documentElement.mozRequestFullScreen();
                    } else if (document.documentElement.msRequestFullscreen) {
                      await document.documentElement.msRequestFullscreen();
                    }
                  }
                  setIsFullscreenMode(true);
                  isFullscreenModeRef.current = true;
                  wasInFullscreenRef.current = true;
                  if (navigator.keyboard && navigator.keyboard.lock) {
                    navigator.keyboard.lock(['Escape']).catch(() => {});
                  }
                  window.focus();
                  document.body?.focus?.();
                } catch (_) {
                  setIsFullscreenMode(true);
                  isFullscreenModeRef.current = true;
                  wasInFullscreenRef.current = true;
                }
              }}
              className="w-full py-2.5 rounded-xl bg-[#1c1f58] hover:bg-[#131540] text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              I Acknowledge & Return to Exam
            </button>
          </div>
        </div>
      )}

      {/* Persistent Full-Screen Lockout Screen when Candidate is Locked */}
      {isSessionLocked && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl border border-rose-300 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-rose-100 border border-rose-300 text-rose-700 flex items-center justify-center mx-auto shadow-inner">
              <Lock size={32} className="animate-pulse" />
            </div>

            <div className="space-y-1.5">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300 inline-block">
                Security Policy Enforcement
              </span>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Assessment Session Locked
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Your test session has been frozen by institutional proctoring rules or invigilator intervention.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 text-left space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold text-slate-800">
                <span>Detected Violations:</span>
                <span className="text-rose-700 font-mono text-sm">{tabViolations} Infractions</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Security Protocol:</span>
                <span className="font-semibold text-rose-800">Exam Session Frozen</span>
              </div>
              <div className="border-t border-rose-200/70 pt-2 text-[11px] text-slate-600 leading-relaxed">
                All responses recorded up to this moment are securely saved. Please notify your invigilator or hall administrator immediately. Once unlocked in the Control Panel, click the button below to resume.
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                disabled={isCheckingUnlock}
                onClick={async () => {
                  try {
                    setIsCheckingUnlock(true);
                    const res = await api.get(`/quizzes/${quizId}/session-status`);
                    if (res.data?.success) {
                      const isUnlocked = !res.data.isLocked && res.data.status !== "LOCKED" && (
                        res.data.status === "IN_PROGRESS" ||
                        res.data.status === "NOT_STARTED" ||
                        !res.data.exists
                      );

                      if (isUnlocked) {
                        setIsSessionLocked(false);
                        violationsRef.current = 0;
                        setTabViolations(0);
                        applyImmediateBlackout(false);
                        if (res.data.resetToken && res.data.resetToken !== lastResetTokenRef.current) {
                          lastResetTokenRef.current = res.data.resetToken;
                          try {
                            localStorage.removeItem(`quizx_attempt_${quizId}`);
                            localStorage.removeItem(`quizx_attempt_${quizId}_${user?.universityId || user?.id || "std"}`);
                          } catch (e) { }
                          setAnswers({});
                          answersRef.current = {};
                          setCurrentIdx(0);
                          setMarkedForReview(new Set());
                        } else if (!res.data.exists || res.data.status === "NOT_STARTED") {
                          setAnswers({});
                          setCurrentIdx(0);
                          setMarkedForReview(new Set());
                          fetchQuiz();
                        }
                      } else {
                        alert("Your session is currently locked by the invigilator. Please request unlock from your exam administrator to resume.");
                      }
                    } else {
                      alert("Could not verify session status. Please retry.");
                    }
                  } catch (err) {
                    alert("Could not verify session status. Please retry.");
                  } finally {
                    setIsCheckingUnlock(false);
                  }
                }}
                className="w-full py-3 rounded-xl bg-[#1c1f58] hover:bg-[#131540] text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
              >
                {isCheckingUnlock ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                <span>Check Status & Resume Exam</span>
              </button>
              <p className="text-[10px] text-slate-400 font-medium">
                Auto-detecting authorization updates every 4 seconds...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Question Diagram Zoom Lightbox Modal */}
      {zoomedDiagram && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-150"
          onClick={() => setZoomedDiagram(null)}
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
                onClick={() => setZoomedDiagram(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-2 overflow-auto max-h-[82vh] flex items-center justify-center">
              <img
                src={getSafeImageUrl(zoomedDiagram)}
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

export default TakeQuiz;
