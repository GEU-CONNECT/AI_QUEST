import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, CheckCircle, HelpCircle, Clock, BookOpen, AlertCircle } from 'lucide-react';
import api from '../api/client';

const CreateQuizModal = ({ isOpen, onClose, onCreated }) => {
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [passingMarks, setPassingMarks] = useState(8);
  const [negativeMarking, setNegativeMarking] = useState(false);
  const [negativeMarksPerWrong, setNegativeMarksPerWrong] = useState(0.25);

  const [questions, setQuestions] = useState([
    {
      questionText: '',
      codeSnippet: '',
      options: ['', '', '', ''],
      correctOptionIndex: 0,
      marks: 2,
      explanation: ''
    }
  ]);

  useEffect(() => {
    if (isOpen) {
      fetchCourses();
    }
  }, [isOpen]);

  const fetchCourses = async () => {
    try {
      setLoadingCourses(true);
      const res = await api.get('/courses');
      if (res.data.success && res.data.courses.length > 0) {
        setCourses(res.data.courses);
        setCourseId(res.data.courses[0].id);
      }
    } catch (err) {
      console.error('Failed to load courses', err);
    } finally {
      setLoadingCourses(false);
    }
  };

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      {
        questionText: '',
        codeSnippet: '',
        options: ['', '', '', ''],
        correctOptionIndex: 0,
        marks: 2,
        explanation: ''
      }
    ]);
  };

  const handleRemoveQuestion = (index) => {
    if (questions.length === 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;
    setQuestions(updated);
  };

  const handleOptionChange = (qIndex, optIndex, value) => {
    const updated = [...questions];
    updated[qIndex].options[optIndex] = value;
    setQuestions(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!courseId) {
      setError('Please select a course');
      return;
    }
    if (!title.trim()) {
      setError('Quiz title is required');
      return;
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].questionText.trim()) {
        setError(`Question #${i + 1} text cannot be empty`);
        return;
      }
      for (let j = 0; j < 4; j++) {
        if (!questions[i].options[j]?.trim()) {
          setError(`Question #${i + 1} Option ${String.fromCharCode(65 + j)} cannot be empty`);
          return;
        }
      }
    }

    try {
      setIsSubmitting(true);
      const payload = {
        courseId,
        title: title.trim(),
        description: description.trim(),
        durationMinutes: Number(durationMinutes),
        passingMarks: Number(passingMarks),
        negativeMarking,
        negativeMarksPerWrong: Number(negativeMarksPerWrong),
        questions
      };

      const res = await api.post('/quizzes', payload);
      if (res.data.success) {
        onCreated(res.data.quiz);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create quiz');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Close modal on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 cursor-pointer"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              +
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-800">Create Assessment Quiz</h2>
              <p className="text-xs text-slate-500">Course Creator Studio • Faculty Portal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Basic Info */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">1. Assessment Parameters</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Target Course / Subject *</label>
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                  required
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{c.code}] {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Quiz / Test Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Unit 3 Dynamic Programming Assessment"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Instructions & Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Enter evaluation guidelines, exam instructions or syllabus topics covered..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Duration (Minutes)</label>
                <input
                  type="number"
                  min="5"
                  max="180"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Passing Marks</label>
                <input
                  type="number"
                  min="1"
                  value={passingMarks}
                  onChange={(e) => setPassingMarks(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={negativeMarking}
                    onChange={(e) => setNegativeMarking(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-xs font-bold text-slate-700">Enable Negative Marking</span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 2: Question Builder */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                2. MCQ Question Bank ({questions.length} Questions)
              </h3>
              <button
                type="button"
                onClick={handleAddQuestion}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus size={14} />
                <span>Add Question</span>
              </button>
            </div>

            {questions.map((q, qIndex) => (
              <div key={qIndex} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3 relative group">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#1c1f58]">Question {qIndex + 1}</span>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveQuestion(qIndex)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                      title="Remove question"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                <div>
                  <textarea
                    value={q.questionText}
                    onChange={(e) => handleQuestionChange(qIndex, 'questionText', e.target.value)}
                    placeholder="Enter question statement..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    required
                  />
                </div>

                {/* 4 Options Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {['A', 'B', 'C', 'D'].map((label, optIndex) => (
                    <div
                      key={optIndex}
                      className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                        q.correctOptionIndex === optIndex
                          ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-400'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`correct-${qIndex}`}
                        checked={q.correctOptionIndex === optIndex}
                        onChange={() => handleQuestionChange(qIndex, 'correctOptionIndex', optIndex)}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-bold text-slate-500">{label}:</span>
                      <input
                        type="text"
                        value={q.options[optIndex]}
                        onChange={(e) => handleOptionChange(qIndex, optIndex, e.target.value)}
                        placeholder={`Option ${label}`}
                        className="w-full bg-transparent text-xs font-semibold focus:outline-none"
                        required
                      />
                    </div>
                  ))}
                </div>

                {/* Explanation */}
                <div>
                  <input
                    type="text"
                    value={q.explanation}
                    onChange={(e) => handleQuestionChange(qIndex, 'explanation', e.target.value)}
                    placeholder="Answer explanation / solution note (visible to student after test)..."
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#1c1f58] hover:bg-[#252975] text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? 'Publishing Quiz...' : 'Publish & Activate Quiz'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateQuizModal;
