import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Phone,
  Mail,
  GraduationCap,
  Compass,
  School,
  Users,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Edit3,
  List,
  Check,
  Sparkles,
  Search,
  ChevronDown,
  X,
} from 'lucide-react';
import { sound } from '../utils/audio';

export const SCHOOL_LIST = [
  'Shiwalik International School, Dehradun',
  "St Jude's School, Dehradun",
  'Scholars Home, Dehradun',
  'Mount Litera Zee School, Roorkee',
  'Mount Litera Zee School, Shimla Bypass',
  'Mount Litera Zee School, Bhaniyawala',
  'Rainbow School, Saharanpur',
  'KLG Public School, Saharanpur',
  "St Mary's Senior Secondary School, Haridwar",
  "St Mary's Academy, Saharanpur",
  'Edify World School, Dehradun',
  'Greenwood Hills School, Dehradun',
  'Will Field School, Dehradun',
  'Sai Grace Academy, Dehradun',
  'Nirmal Ashram Gyan Daan Academy, Rishikesh',
  'Army Public School, Birpur',
  'Bristol School, Dehradun',
  'Guru Nank Mission Public School, Paonta Sahib',
  'Tonsbridge School, Dehradun',
  'Constancia School, Dehradun',
  'Public Inter College',
  'Brooklyn School',
  'Doon International School, Dehradun',
  'The Asian School, Dehradun',
  'Pinewood School, Saharanpur',
  'The Arcadia School, Dehradun',
  'Graphic Era Global School, Dehradun',
  "St. Joseph's Academy, Dehradun",
  'Army Public School, Clement Town',
  'Jaswant Modern Sr Sec School, Dehradun',
  'Stone Ridge International School, Rudrapur',
  'SGRR',
  'The Heritage School, Dehradun',
  'Olympus High School, Dehradun',
  'Roorkee Public School, Roorkee',
];

const CLASS_OPTIONS = [
  'Class 9th',
  'Class 10th',
  'Class 11th',
  'Class 12th',
  'Dropper / Competitive Prep',
];

const STREAM_OPTIONS = [
  'Science (PCM - Physics, Chem, Math)',
  'Science (PCB - Physics, Chem, Biology)',
  'Science (PCMB - All Sciences)',
  'Commerce with Maths',
  'Commerce without Maths',
  'Humanities & Arts',
  'Computer Science & AI Tech',
  'General Secondary (Class 9-10)',
];

export const POPULAR_CITIES = [
  'Dehradun',
  'Haridwar',
  'Roorkee',
  'Rishikesh',
  'Saharanpur',
  'Delhi NCR',
  'Paonta Sahib',
  'Rudrapur',
  'Chandigarh',
  'Haldwani',
];

export const ALL_CITY_OPTIONS = [
  'Dehradun',
  'Haridwar',
  'Roorkee',
  'Rishikesh',
  'Saharanpur',
  'Delhi NCR',
  'Paonta Sahib',
  'Rudrapur',
  'Chandigarh',
  'Haldwani',
  'Nainital',
  'Kashipur',
  'Kotdwar',
  'Meerut',
  'Moradabad',
  'Muzaffarnagar',
  'Noida',
  'Gurugram',
  'Ghaziabad',
  'Faridabad',
  'Agra',
  'Aligarh',
  'Bareilly',
  'Lucknow',
  'Kanpur',
  'Ambala',
  'Yamunanagar',
  'Shimla',
];

export default function QuesterForm({ formData, setFormData, onSubmit, isSubmitting }) {
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [activeField, setActiveField] = useState(null);
  const [isCustomSchool, setIsCustomSchool] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isSchoolDropdownOpen, setIsSchoolDropdownOpen] = useState(false);
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('');

  // Static Performance State
  const cardRef = useRef(null);
  const section1Ref = useRef(null);
  const section2Ref = useRef(null);
  const section3Ref = useRef(null);
  const schoolDropdownRef = useRef(null);

  // Close school dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (schoolDropdownRef.current && !schoolDropdownRef.current.contains(e.target)) {
        setIsSchoolDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close school dropdown on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsSchoolDropdownOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredSchools = SCHOOL_LIST.filter((school) =>
    school.toLowerCase().includes(schoolSearchQuery.toLowerCase().trim())
  );

  // Switch to custom manual school entry
  const handleSwitchToManual = (customVal = '') => {
    sound.playPop();
    const valueToSet =
      typeof customVal === 'string' && customVal.trim()
        ? customVal.trim()
        : schoolSearchQuery.trim()
        ? schoolSearchQuery.trim()
        : '';

    setFormData((prev) => ({ ...prev, schoolName: valueToSet }));
    validateField('schoolName', valueToSet);
    setIsCustomSchool(true);
    setIsSchoolDropdownOpen(false);
    setSchoolSearchQuery('');
    trigger3DPulse(0.8);

    setTimeout(() => {
      const el = document.getElementById('schoolName');
      if (el) {
        el.focus();
        el.select?.();
      }
    }, 50);
  };

  // Switch back to 35 schools dropdown
  const handleSwitchToList = () => {
    sound.playPop();
    setIsCustomSchool(false);
    setIsSchoolDropdownOpen(true);
    setSchoolSearchQuery('');
    trigger3DPulse(0.8);
  };



  // Section Validation & Completeness checks
  const isCandidateNameValid = Boolean(formData.candidateName && formData.candidateName.trim().length >= 3);
  const isMobileValid = Boolean(formData.mobileNo && /^[6-9]\d{9}$/.test(formData.mobileNo.trim()));
  const isEmailValid = Boolean(formData.emailId && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.emailId.trim()));
  const isCityValid = Boolean(formData.city && formData.city.trim().length > 0);

  const isSchoolValid = Boolean(formData.schoolName && formData.schoolName.trim().length >= 3);
  const isClassValid = Boolean(formData.studentClass && formData.studentClass.trim().length > 0);
  const isStreamValid = Boolean(formData.stream && formData.stream.trim().length > 0);

  const isParentNameValid = Boolean(formData.parentName && formData.parentName.trim().length >= 2);
  const isParentContactValid = Boolean(formData.parentContact && /^[6-9]\d{9}$/.test(formData.parentContact.trim()));

  const isSection1Complete = isCandidateNameValid && isMobileValid && isEmailValid && isCityValid;
  const isSection2Complete = isSchoolValid && isClassValid && isStreamValid;
  const isSection3Complete = isParentNameValid && isParentContactValid;

  const validFieldsCount = [
    isCandidateNameValid,
    isMobileValid,
    isEmailValid,
    isCityValid,
    isSchoolValid,
    isClassValid,
    isStreamValid,
    isParentNameValid,
    isParentContactValid,
  ].filter(Boolean).length;

  const totalFields = 9;
  const progressPercent = Math.round((validFieldsCount / totalFields) * 100);

  // Static mode (zero overhead)
  const trigger3DPulse = () => {};

  // Field change handler
  const handleChange = (e) => {
    const { name, value } = e.target;
    let cleanVal = value;

    // Numeric sanitize for phone fields
    if (name === 'mobileNo' || name === 'parentContact') {
      let digits = value.replace(/\D/g, '');
      if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
      else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
      else if (digits.length > 10) digits = digits.slice(-10);
      cleanVal = digits.slice(0, 10);
    }

    setFormData((prev) => ({ ...prev, [name]: cleanVal }));
    validateField(name, cleanVal);
    trigger3DPulse(0.35);
  };

  // Validate single field
  const validateField = (name, value) => {
    let error = '';
    const cleanVal = (value || '').trim();

    switch (name) {
      case 'candidateName':
        if (!cleanVal) error = 'Candidate full name is required';
        else if (cleanVal.length < 3) error = 'Name must be at least 3 characters';
        break;
      case 'mobileNo':
        if (!cleanVal) error = 'Mobile number is required';
        else if (!/^[6-9]\d{9}$/.test(cleanVal))
          error = 'Enter a valid 10-digit Indian mobile number (starts with 6-9)';
        break;
      case 'emailId':
        if (!cleanVal) error = 'Email ID is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanVal))
          error = 'Enter a valid email address (e.g. name@domain.com)';
        break;
      case 'studentClass':
        if (!cleanVal) error = 'Please select candidate class';
        break;
      case 'stream':
        if (!cleanVal) error = 'Please select your stream';
        break;
      case 'schoolName':
        if (!cleanVal) error = 'School name is required';
        else if (cleanVal.length < 3) error = 'Enter full school name';
        break;
      case 'parentName':
        if (!cleanVal) error = "Father's or Mother's name is required";
        else if (cleanVal.length < 2) error = 'Parent name must be at least 2 characters';
        break;
      case 'parentContact':
        if (!cleanVal) error = "Parent's contact number is required";
        else if (!/^[6-9]\d{9}$/.test(cleanVal))
          error = 'Enter a valid 10-digit mobile number (starts with 6-9)';
        break;
      case 'city':
        if (!cleanVal) error = 'City is required';
        break;
      default:
        break;
    }

    setErrors((prev) => ({ ...prev, [name]: error }));
    return error;
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setActiveField(null);
    setTouched((prev) => ({ ...prev, [name]: true }));
    validateField(name, value);
  };

  const handleFocus = (fieldName) => {
    setActiveField(fieldName);
    sound.playFocus();
    trigger3DPulse(0.7);
  };

  // Validate entire form
  const validateAll = () => {
    const newErrors = {};
    const fields = [
      'candidateName',
      'mobileNo',
      'emailId',
      'city',
      'schoolName',
      'studentClass',
      'stream',
      'parentName',
      'parentContact',
    ];

    fields.forEach((field) => {
      const err = validateField(field, formData[field]);
      if (err) newErrors[field] = err;
    });

    setTouched(
      fields.reduce((acc, field) => {
        acc[field] = true;
        return acc;
      }, {})
    );

    setErrors(newErrors);
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitAttempted(true);
    sound.playPop();
    trigger3DPulse(2.0);

    const validationErrors = validateAll();
    const errorKeys = Object.keys(validationErrors);

    if (errorKeys.length === 0) {
      onSubmit();
    } else {
      // Find first error field and scroll smoothly
      const firstError = errorKeys[0];
      const el = document.getElementById(firstError);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
      }
    }
  };

  const resetForm = () => {
    sound.playPop();
    setIsCustomSchool(false);
    setIsSchoolDropdownOpen(false);
    setSchoolSearchQuery('');
    setSubmitAttempted(false);
    setFormData({
      candidateName: '',
      mobileNo: '',
      emailId: '',
      studentClass: 'Class 12th',
      stream: 'Science (PCM - Physics, Chem, Math)',
      schoolName: '',
      parentName: '',
      parentContact: '',
      city: '',
    });
    setErrors({});
    setTouched({});
  };

  // Copy candidate mobile to parent contact
  const copyCandidateContact = () => {
    sound.playPop();
    if (formData.mobileNo) {
      setFormData((prev) => ({ ...prev, parentContact: prev.mobileNo }));
      validateField('parentContact', formData.mobileNo);
      setTouched((prev) => ({ ...prev, parentContact: true }));
      trigger3DPulse(0.8);
    }
  };

  const scrollToSection = (ref) => {
    sound.playPop();
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="form-static-stage">
      {/* Main Solid Form Card */}
      <div
        ref={cardRef}
        className="form-card-container static-form-card"
      >

        {/* Top Header Strip */}
        <div className="form-card-header layer-3d-front">
          <div className="form-title-group">
            <div className="form-badge-pill">
              <span className="live-dot"></span>
              GRAPHIC ERA UNIVERSITY • AI QUEST 2026 OFFICIAL REGISTRATION
            </div>
            <h2 className="form-title">Quester Application Form</h2>
            <p className="form-subtitle">
              Fill in the details below to generate your official AI Quest 2026 Examination Pass.
            </p>
          </div>

          {/* Action Controls */}
          <div className="form-actions-toolbar">
            <button
              type="button"
              onClick={resetForm}
              className="action-pill-btn reset-btn"
              title="Reset form fields"
            >
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Step Navigation Pill Bar */}
        <div className="form-steps-nav layer-3d-mid">
          <button
            type="button"
            className={`step-nav-pill ${isSection1Complete ? 'step-completed' : 'step-in-progress'}`}
            onClick={() => scrollToSection(section1Ref)}
          >
            <span className="step-num">1</span>
            <span className="step-text">Candidate Details</span>
            {isSection1Complete ? (
              <Check size={14} className="step-check" />
            ) : (
              <span className="step-count">
                {[isCandidateNameValid, isMobileValid, isEmailValid, isCityValid].filter(Boolean).length}/4
              </span>
            )}
          </button>

          <span className="step-nav-connector"></span>

          <button
            type="button"
            className={`step-nav-pill ${isSection2Complete ? 'step-completed' : 'step-in-progress'}`}
            onClick={() => scrollToSection(section2Ref)}
          >
            <span className="step-num">2</span>
            <span className="step-text">Academic Profile</span>
            {isSection2Complete ? (
              <Check size={14} className="step-check" />
            ) : (
              <span className="step-count">
                {[isSchoolValid, isClassValid, isStreamValid].filter(Boolean).length}/3
              </span>
            )}
          </button>

          <span className="step-nav-connector"></span>

          <button
            type="button"
            className={`step-nav-pill ${isSection3Complete ? 'step-completed' : 'step-in-progress'}`}
            onClick={() => scrollToSection(section3Ref)}
          >
            <span className="step-num">3</span>
            <span className="step-text">Parent Contact</span>
            {isSection3Complete ? (
              <Check size={14} className="step-check" />
            ) : (
              <span className="step-count">
                {[isParentNameValid, isParentContactValid].filter(Boolean).length}/2
              </span>
            )}
          </button>
        </div>

        {/* Progress Bar */}
        <div className="form-progress-box layer-3d-mid">
          <div className="progress-info">
            <div className="progress-label-wrap">
              <span className="progress-label">Application Status:</span>
              <span className="progress-sub">
                {validFieldsCount === totalFields
                  ? 'All 9 fields completed! Ready for pass generation.'
                  : `${validFieldsCount} of ${totalFields} fields completed`}
              </span>
            </div>
            <div className="progress-val-badge">
              <Sparkles size={13} className="sparkle-icon" />
              <span>{progressPercent}%</span>
            </div>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>

        {submitAttempted && Object.keys(errors).length > 0 && (
          <div className="form-error-alert-banner">
            <AlertCircle size={16} />
            <span>
              Please complete all required fields highlighted in red below before submitting.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="quester-main-form">
          {/* SECTION 1: CANDIDATE INFORMATION */}
          <div ref={section1Ref} className="form-section-card layer-3d-base">
            <div className="section-title-bar">
              <div className="section-icon-wrap">
                <User size={18} />
              </div>
              <div className="section-title-text">
                <div className="section-heading-row">
                  <h3>1. Candidate Details</h3>
                  {isSection1Complete && (
                    <span className="section-complete-badge">
                      <CheckCircle2 size={13} /> Completed
                    </span>
                  )}
                </div>
                <p>Primary identity, phone, email & city of the applicant</p>
              </div>
            </div>

            <div className="form-grid-row">
              {/* 1. Candidate Name */}
              <div
                className={`form-field-group full-width ${
                  activeField === 'candidateName' ? 'is-focused' : ''
                } ${touched.candidateName && errors.candidateName ? 'has-error' : ''} ${
                  isCandidateNameValid ? 'is-valid' : ''
                }`}
              >
                <div className="label-with-quick">
                  <label htmlFor="candidateName">
                    Candidate Name <span className="req-star">*</span>
                  </label>
                  <span className="field-hint">As in school records</span>
                </div>
                <div className="input-wrap">
                  <User size={18} className="field-icon" />
                  <input
                    id="candidateName"
                    type="text"
                    name="candidateName"
                    placeholder="Enter candidate's full legal name"
                    value={formData.candidateName}
                    onChange={handleChange}
                    onFocus={() => handleFocus('candidateName')}
                    onBlur={handleBlur}
                    autoComplete="name"
                  />
                  {isCandidateNameValid && (
                    <CheckCircle2 size={18} className="field-valid-icon" />
                  )}
                </div>
                {touched.candidateName && errors.candidateName && (
                  <div className="error-msg">
                    <AlertCircle size={13} /> {errors.candidateName}
                  </div>
                )}
              </div>

              {/* 2. Mobile Number */}
              <div
                className={`form-field-group half-width ${
                  activeField === 'mobileNo' ? 'is-focused' : ''
                } ${touched.mobileNo && errors.mobileNo ? 'has-error' : ''} ${
                  isMobileValid ? 'is-valid' : ''
                }`}
              >
                <div className="label-with-quick">
                  <label htmlFor="mobileNo">
                    Mobile No <span className="req-star">*</span>
                  </label>
                  <span className={`digit-counter-pill ${formData.mobileNo.length === 10 ? 'is-complete' : ''}`}>
                    {formData.mobileNo.length}/10
                  </span>
                </div>
                <div className="input-wrap">
                  <span className="prefix-tag">+91</span>
                  <input
                    id="mobileNo"
                    type="tel"
                    name="mobileNo"
                    placeholder="10-digit mobile number"
                    maxLength={16}
                    value={formData.mobileNo}
                    onChange={handleChange}
                    onFocus={() => handleFocus('mobileNo')}
                    onBlur={handleBlur}
                    autoComplete="tel"
                  />
                  {isMobileValid ? (
                    <CheckCircle2 size={18} className="field-valid-icon" />
                  ) : (
                    <Phone size={16} className="field-icon-right" />
                  )}
                </div>
                {touched.mobileNo && errors.mobileNo ? (
                  <div className="error-msg">
                    <AlertCircle size={13} /> {errors.mobileNo}
                  </div>
                ) : (
                  <div className="field-sub-note">Used for SMS updates & login credentials</div>
                )}
              </div>

              {/* 3. Email ID */}
              <div
                className={`form-field-group half-width ${
                  activeField === 'emailId' ? 'is-focused' : ''
                } ${touched.emailId && errors.emailId ? 'has-error' : ''} ${
                  isEmailValid ? 'is-valid' : ''
                }`}
              >
                <div className="label-with-quick">
                  <label htmlFor="emailId">
                    Email ID <span className="req-star">*</span>
                  </label>
                  <span className="field-hint">Admit pass sent here</span>
                </div>
                <div className="input-wrap">
                  <Mail size={18} className="field-icon" />
                  <input
                    id="emailId"
                    type="email"
                    name="emailId"
                    placeholder="candidate@example.com"
                    value={formData.emailId}
                    onChange={handleChange}
                    onFocus={() => handleFocus('emailId')}
                    onBlur={handleBlur}
                    autoComplete="email"
                  />
                  {isEmailValid && (
                    <CheckCircle2 size={18} className="field-valid-icon" />
                  )}
                </div>
                {touched.emailId && errors.emailId && (
                  <div className="error-msg">
                    <AlertCircle size={13} /> {errors.emailId}
                  </div>
                )}
              </div>

              {/* 4. City Selection */}
              <div
                className={`form-field-group full-width ${
                  activeField === 'city' ? 'is-focused' : ''
                } ${touched.city && errors.city ? 'has-error' : ''} ${
                  isCityValid ? 'is-valid' : ''
                }`}
              >
                <div className="label-with-quick">
                  <label htmlFor="city">
                    City / District <span className="req-star">*</span>
                  </label>
                  <span className="field-hint">Select below or type your city</span>
                </div>

                <div className="input-wrap">
                  <MapPin size={18} className="field-icon" />
                  <input
                    id="city"
                    type="text"
                    name="city"
                    list="city-options-datalist"
                    placeholder="Click to select or enter city (e.g. Dehradun, Haridwar, Roorkee, Delhi NCR...)"
                    value={formData.city}
                    onChange={handleChange}
                    onFocus={() => handleFocus('city')}
                    onBlur={handleBlur}
                    autoComplete="off"
                  />
                  <datalist id="city-options-datalist">
                    {ALL_CITY_OPTIONS.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>

                  {formData.city ? (
                    <button
                      type="button"
                      className="city-clear-pill-btn"
                      title="Clear city"
                      onMouseDown={(e) => {
                        e.preventDefault();
                      }}
                      onClick={() => {
                        sound.playPop();
                        setFormData((prev) => ({ ...prev, city: '' }));
                        validateField('city', '');
                        setTouched((prev) => ({ ...prev, city: true }));
                      }}
                    >
                      <X size={15} />
                    </button>
                  ) : isCityValid ? (
                    <CheckCircle2 size={18} className="field-valid-icon" />
                  ) : null}
                </div>

                {/* Prominent Quick-Select Pills Bar */}
                <div className="quick-city-selector-bar">
                  <span className="quick-select-tag-title">⚡ Quick Select City:</span>
                  <div className="quick-city-tags-grid">
                    {POPULAR_CITIES.map((c) => {
                      const isSelected =
                        (formData.city || '').trim().toLowerCase() === c.toLowerCase();
                      return (
                        <button
                          key={c}
                          type="button"
                          className={`city-pill ${isSelected ? 'active' : ''}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                          }}
                          onClick={() => {
                            sound.playPop();
                            setFormData((prev) => ({ ...prev, city: c }));
                            validateField('city', c);
                            setTouched((prev) => ({ ...prev, city: true }));
                          }}
                        >
                          {isSelected && <Check size={12} className="city-check-icon" />}
                          <span>{c}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {touched.city && errors.city && (
                  <div className="error-msg">
                    <AlertCircle size={13} /> {errors.city}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2: ACADEMIC DETAILS */}
          <div
            ref={section2Ref}
            className={`form-section-card layer-3d-base ${
              isSchoolDropdownOpen ? 'section-dropdown-open' : ''
            }`}
          >
            <div className="section-title-bar">
              <div className="section-icon-wrap">
                <GraduationCap size={18} />
              </div>
              <div className="section-title-text">
                <div className="section-heading-row">
                  <h3>2. Academic Background</h3>
                  {isSection2Complete && (
                    <span className="section-complete-badge">
                      <CheckCircle2 size={13} /> Completed
                    </span>
                  )}
                </div>
                <p>School institution, class level & academic stream</p>
              </div>
            </div>

            <div className="form-grid-row">
              {/* 6. School Name with Custom Dropdown (Always opens BELOW) */}
              <div
                ref={schoolDropdownRef}
                className={`form-field-group full-width ${
                  activeField === 'schoolName' || isSchoolDropdownOpen ? 'is-focused is-dropdown-open' : ''
                } ${touched.schoolName && errors.schoolName ? 'has-error' : ''} ${
                  isSchoolValid ? 'is-valid' : ''
                }`}
              >
                <div className="label-with-quick">
                  <label htmlFor="schoolName">
                    School Name <span className="req-star">*</span>
                  </label>
                  <button
                    type="button"
                    className="school-not-on-list-btn"
                    onClick={() => {
                      if (isCustomSchool) {
                        handleSwitchToList();
                      } else {
                        handleSwitchToManual();
                      }
                    }}
                  >
                    {isCustomSchool ? (
                      <>
                        <List size={13} />
                        <span>Select from 35 Schools Dropdown</span>
                      </>
                    ) : (
                      <>
                        <Edit3 size={13} />
                        <span>School not on list? Enter manually</span>
                      </>
                    )}
                  </button>
                </div>

                {isCustomSchool ? (
                  <div className="input-wrap">
                    <School size={18} className="field-icon" />
                    <input
                      id="schoolName"
                      type="text"
                      name="schoolName"
                      placeholder="Type your complete school name & city..."
                      value={formData.schoolName}
                      onChange={handleChange}
                      onFocus={() => handleFocus('schoolName')}
                      onBlur={handleBlur}
                      autoFocus
                    />
                    {isSchoolValid && (
                      <CheckCircle2 size={18} className="field-valid-icon" />
                    )}
                  </div>
                ) : (
                  <div className="school-combobox-container">
                    {/* Trigger Box - Click to open dropdown list strictly BELOW */}
                    <div
                      className={`input-wrap school-custom-trigger ${
                        isSchoolDropdownOpen ? 'trigger-open' : ''
                      }`}
                      onClick={() => {
                        sound.playFocus();
                        setIsSchoolDropdownOpen(!isSchoolDropdownOpen);
                        handleFocus('schoolName');
                      }}
                    >
                      <School size={18} className="field-icon" />
                      <div className="school-trigger-text">
                        {formData.schoolName ? (
                          <span>{formData.schoolName}</span>
                        ) : (
                          <span className="school-trigger-placeholder">
                            Select School Name (Click to open list below)...
                          </span>
                        )}
                      </div>

                      {formData.schoolName && (
                        <button
                          type="button"
                          className="school-clear-btn"
                          title="Clear school selection"
                          onClick={(e) => {
                            e.stopPropagation();
                            sound.playPop();
                            setFormData((prev) => ({ ...prev, schoolName: '' }));
                            validateField('schoolName', '');
                          }}
                        >
                          <X size={15} />
                        </button>
                      )}

                      {isSchoolValid && (
                        <CheckCircle2 size={18} className="field-valid-icon" />
                      )}

                      <ChevronDown
                        size={18}
                        className={`dropdown-arrow ${isSchoolDropdownOpen ? 'rotated' : ''}`}
                      />
                    </div>

                    {/* Dropdown Options Panel - LOCKED TO RENDER BELOW */}
                    {isSchoolDropdownOpen && (
                      <div
                        className="school-custom-dropdown-panel"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Search Filter Header */}
                        <div className="school-search-bar">
                          <Search size={15} className="school-search-icon" />
                          <input
                            type="text"
                            placeholder="Search among 35 schools (e.g. Doon, Army, St, Zee)..."
                            value={schoolSearchQuery}
                            onChange={(e) => setSchoolSearchQuery(e.target.value)}
                            className="school-search-field"
                            autoFocus
                          />
                          {schoolSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setSchoolSearchQuery('')}
                              className="school-search-clear-btn"
                              title="Clear search filter"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>


                        {/* Scrollable List of Schools */}
                        <div className="school-options-scrollable">
                          {filteredSchools.length > 0 ? (
                            <>
                              {filteredSchools.map((sch) => {
                                const isSelected = formData.schoolName === sch;
                                const parts = sch.split(',');
                                const schoolNameOnly = parts[0].trim();
                                const cityTag = parts.length > 1 ? parts.slice(1).join(',').trim() : '';

                                return (
                                  <div
                                    key={sch}
                                    className={`school-custom-option-item ${
                                      isSelected ? 'is-selected' : ''
                                    }`}
                                    onClick={() => {
                                      sound.playPop();
                                      const parts = sch.split(',');
                                      const extractedCity = parts.length > 1 ? parts[parts.length - 1].trim() : '';
                                      setFormData((prev) => ({
                                        ...prev,
                                        schoolName: sch,
                                        city: prev.city ? prev.city : extractedCity,
                                      }));
                                      validateField('schoolName', sch);
                                      if (extractedCity) {
                                        validateField('city', extractedCity);
                                      }
                                      setTouched((prev) => ({
                                        ...prev,
                                        schoolName: true,
                                        city: true,
                                      }));
                                      setIsSchoolDropdownOpen(false);
                                      setSchoolSearchQuery('');
                                    }}
                                  >
                                    <div className="school-item-left">
                                      <School size={16} className="option-school-icon" />
                                      <span className="option-school-name">{schoolNameOnly}</span>
                                    </div>
                                    <div className="school-item-right">
                                      {cityTag && (
                                        <span className="option-city-tag">{cityTag}</span>
                                      )}
                                      {isSelected && (
                                        <Check size={16} className="option-check-icon" />
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Bottom Fallback Option */}
                              <div
                                className="school-bottom-manual-item"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleSwitchToManual();
                                }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleSwitchToManual();
                                }}
                              >
                                <Edit3 size={15} />
                                <span>➕ School not listed above? Enter manually</span>
                              </div>
                            </>
                          ) : (
                            <div className="school-no-matches-box">
                              <p>No schools matching "{schoolSearchQuery}"</p>
                              <button
                                type="button"
                                className="enter-searched-school-btn"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleSwitchToManual(schoolSearchQuery);
                                }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleSwitchToManual(schoolSearchQuery);
                                }}
                              >
                                Use "{schoolSearchQuery}" as School Name
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {touched.schoolName && errors.schoolName && (
                  <div className="error-msg">
                    <AlertCircle size={13} /> {errors.schoolName}
                  </div>
                )}
              </div>

              {/* 4. Class */}
              <div
                className={`form-field-group half-width ${
                  activeField === 'studentClass' ? 'is-focused' : ''
                } ${touched.studentClass && errors.studentClass ? 'has-error' : ''} ${
                  isClassValid ? 'is-valid' : ''
                }`}
              >
                <label htmlFor="studentClass">
                  Class <span className="req-star">*</span>
                </label>
                <div className="input-wrap select-wrap">
                  <GraduationCap size={18} className="field-icon" />
                  <select
                    id="studentClass"
                    name="studentClass"
                    value={formData.studentClass}
                    onChange={handleChange}
                    onFocus={() => handleFocus('studentClass')}
                    onBlur={handleBlur}
                  >
                    <option value="">Select Class...</option>
                    {CLASS_OPTIONS.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                  {isClassValid && (
                    <CheckCircle2 size={18} className="field-valid-icon select-check" />
                  )}
                </div>
                {touched.studentClass && errors.studentClass && (
                  <div className="error-msg">
                    <AlertCircle size={13} /> {errors.studentClass}
                  </div>
                )}
              </div>

              {/* 5. Stream */}
              <div
                className={`form-field-group half-width ${
                  activeField === 'stream' ? 'is-focused' : ''
                } ${touched.stream && errors.stream ? 'has-error' : ''} ${
                  isStreamValid ? 'is-valid' : ''
                }`}
              >
                <label htmlFor="stream">
                  Stream <span className="req-star">*</span>
                </label>
                <div className="input-wrap select-wrap">
                  <Compass size={18} className="field-icon" />
                  <select
                    id="stream"
                    name="stream"
                    value={formData.stream}
                    onChange={handleChange}
                    onFocus={() => handleFocus('stream')}
                    onBlur={handleBlur}
                  >
                    <option value="">Select Stream...</option>
                    {STREAM_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                  {isStreamValid && (
                    <CheckCircle2 size={18} className="field-valid-icon select-check" />
                  )}
                </div>
                {touched.stream && errors.stream && (
                  <div className="error-msg">
                    <AlertCircle size={13} /> {errors.stream}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 3: PARENT / GUARDIAN DETAILS */}
          <div ref={section3Ref} className="form-section-card layer-3d-base">
            <div className="section-title-bar">
              <div className="section-icon-wrap">
                <Users size={18} />
              </div>
              <div className="section-title-text">
                <div className="section-heading-row">
                  <h3>3. Father’s / Mother’s Details</h3>
                  {isSection3Complete && (
                    <span className="section-complete-badge">
                      <CheckCircle2 size={13} /> Completed
                    </span>
                  )}
                </div>
                <p>Parent contact for emergency notifications & verification</p>
              </div>
            </div>

            <div className="form-grid-row">
              {/* 7. Father's / Mother's Name */}
              <div
                className={`form-field-group half-width ${
                  activeField === 'parentName' ? 'is-focused' : ''
                } ${touched.parentName && errors.parentName ? 'has-error' : ''} ${
                  isParentNameValid ? 'is-valid' : ''
                }`}
              >
                <label htmlFor="parentName">
                  Father’s / Mother’s Name <span className="req-star">*</span>
                </label>
                <div className="input-wrap">
                  <Users size={18} className="field-icon" />
                  <input
                    id="parentName"
                    type="text"
                    name="parentName"
                    placeholder="Enter parent's full name"
                    value={formData.parentName}
                    onChange={handleChange}
                    onFocus={() => handleFocus('parentName')}
                    onBlur={handleBlur}
                  />
                  {isParentNameValid && (
                    <CheckCircle2 size={18} className="field-valid-icon" />
                  )}
                </div>
                {touched.parentName && errors.parentName && (
                  <div className="error-msg">
                    <AlertCircle size={13} /> {errors.parentName}
                  </div>
                )}
              </div>

              {/* 8. Father's / Mother's Contact No */}
              <div
                className={`form-field-group half-width ${
                  activeField === 'parentContact' ? 'is-focused' : ''
                } ${touched.parentContact && errors.parentContact ? 'has-error' : ''} ${
                  isParentContactValid ? 'is-valid' : ''
                }`}
              >
                <div className="label-with-quick">
                  <label htmlFor="parentContact">
                    Father’s/Mother’s Contact no. <span className="req-star">*</span>
                  </label>
                  {formData.mobileNo && (
                    <button
                      type="button"
                      className="copy-number-btn"
                      onClick={copyCandidateContact}
                      title="Copy candidate mobile number to parent contact"
                    >
                      📋 Same as Candidate Mobile
                    </button>
                  )}
                </div>
                <div className="input-wrap">
                  <span className="prefix-tag">+91</span>
                  <input
                    id="parentContact"
                    type="tel"
                    name="parentContact"
                    placeholder="10-digit guardian mobile"
                    maxLength={16}
                    value={formData.parentContact}
                    onChange={handleChange}
                    onFocus={() => handleFocus('parentContact')}
                    onBlur={handleBlur}
                  />
                  {isParentContactValid ? (
                    <CheckCircle2 size={18} className="field-valid-icon" />
                  ) : (
                    <Phone size={16} className="field-icon-right" />
                  )}
                </div>
                {touched.parentContact && errors.parentContact ? (
                  <div className="error-msg">
                    <AlertCircle size={13} /> {errors.parentContact}
                  </div>
                ) : (
                  <div className="field-sub-note">Parent mobile for emergency updates</div>
                )}
              </div>
            </div>
          </div>

          {/* Form Submission Button */}
          <div className="submit-action-area layer-3d-front">
            <div className="submission-disclaimer">
              <ShieldCheck size={18} className="disclaimer-icon" />
              <span>
                Official Graphic Era University AI Quest 2026 Portal • Instant admit card pass generation.
              </span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`golden-submit-button ${isSubmitting ? 'submitting' : ''}`}
            >
              <div className="button-glare"></div>
              <span className="button-icon-star">★</span>
              <span className="button-text">
                {isSubmitting
                  ? 'Verifying & Generating Official Pass...'
                  : validFieldsCount === totalFields
                  ? 'Submit Application & Generate Official Pass'
                  : `Submit Quester Application (${validFieldsCount}/${totalFields} Complete)`}
              </span>
              <ArrowRight size={20} className="button-arrow" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
