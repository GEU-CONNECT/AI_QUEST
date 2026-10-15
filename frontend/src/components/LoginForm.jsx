import React, { useState, useRef } from 'react';
import { Phone, ArrowRight, AlertCircle, ShieldCheck, UserCheck, Lock, Sparkles, KeyRound } from 'lucide-react';
import { sound } from '../utils/audio';
import api from '../api/client';

export default function LoginForm({ onLoginSuccess, onSwitchToRegister }) {
  const [loginType, setLoginType] = useState('student'); // 'student' | 'admin'
  const [phone, setPhone] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // 3D Tilt State
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, gx: 50, gy: 50 });

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rx = ((y - centerY) / centerY) * -5;
    const ry = ((x - centerX) / centerX) * 5;

    const gx = (x / rect.width) * 100;
    const gy = (y / rect.height) * 100;

    setTilt({ rx, ry, gx, gy });
  };

  const handleMouseLeave = () => {
    setTilt({ rx: 0, ry: 0, gx: 50, gy: 50 });
  };

  const trigger3DPulse = (intensity = 0.8) => {
    window.dispatchEvent(new CustomEvent('ai-quest-activity', { detail: { intensity } }));
  };

  // Quick fill helper for testing
  const handleQuickFill = (type) => {
    sound.playPop();
    setError('');
    if (type === 'admin') {
      setLoginType('admin');
      setIdentifier('9999999999');
      setPassword('admin123');
    } else if (type === 'subadmin') {
      setLoginType('admin');
      setIdentifier('9800000001');
      setPassword('lab123');
    } else if (type === 'student') {
      setLoginType('student');
      setPhone('9812345678');
      setPassword('');
    }
  };

  // Intelligent handler for candidate phone / registration ID / email input
  const handleCandidateInputChange = (rawVal) => {
    setError('');
    // Check if user is typing or pasting a phone number (digits, optional +91, spaces, dashes)
    const isPhoneLike = /^[\d\s+\-()]+$/.test(rawVal);
    if (isPhoneLike) {
      let digits = rawVal.replace(/\D/g, '');
      if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
      else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
      else if (digits.length > 10) digits = digits.slice(-10);
      setPhone(digits.slice(0, 10));
    } else {
      // Registration ID or Email (e.g. GEU-AIQ-2026-10001, test@domain.com)
      setPhone(rawVal.trim());
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    sound.playPop();
    setError('');

    let loginPayload = {};

    if (loginType === 'student') {
      const cleanInput = phone.trim();
      if (!cleanInput) {
        setError('Please enter your 10-digit registered mobile number or Registration ID');
        return;
      }

      // Check if it's purely digits (phone number)
      const isDigitsOnly = /^\d+$/.test(cleanInput);
      if (isDigitsOnly) {
        if (cleanInput.length !== 10) {
          setError('Please enter your complete 10-digit mobile number');
          return;
        }
        if (!/^[6-9]\d{9}$/.test(cleanInput)) {
          setError('Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9');
          return;
        }
      }

      loginPayload = {
        phone: cleanInput,
        identifier: cleanInput
      };
    } else {
      if (!identifier.trim()) {
        setError('Please enter your username, email, or mobile');
        return;
      }
      if (!password.trim()) {
        setError('Please enter your password');
        return;
      }
      loginPayload = {
        identifier: identifier.trim(),
        password: password.trim()
      };
    }

    try {
      setIsLoading(true);
      trigger3DPulse(2.5);

      const res = await api.post('/auth/login', loginPayload);

      if (res.data?.success) {
        localStorage.setItem('quizx_token', res.data.token);
        localStorage.setItem('quizx_user', JSON.stringify(res.data.user));
        sound.playSuccess();
        onLoginSuccess(res.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="form-3d-perspective-stage login-form-stage">
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="form-card-container interactive-3d-card login-card-container"
        style={{
          transform: `perspective(1200px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
        }}
      >
        {/* Dynamic Specular Glare */}
        <div
          className="card-specular-glare"
          style={{
            background: `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, rgba(255, 255, 255, 0.14) 0%, rgba(250, 204, 21, 0.05) 45%, transparent 70%)`,
          }}
        ></div>

        {/* Header Strip */}
        <div className="form-card-header layer-3d-front">
          <div className="form-title-group">
            <div className="form-badge-pill">
              <span className="live-dot"></span>
              GRAPHIC ERA UNIVERSITY • AI QUEST 2026
            </div>
            <h2 className="form-title">
              {loginType === 'student' ? 'Candidate Login' : 'Invigilator & Admin Login'}
            </h2>
            <p className="form-subtitle">
              {loginType === 'student'
                ? 'Sign in to access your AI Quest 2026 examination room and admit pass.'
                : 'Authorized access for Lab Invigilators and University Administrators.'}
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center justify-center gap-2 p-1 bg-slate-900/60 rounded-xl border border-slate-700/60 mt-4 max-w-xs mx-auto">
            <button
              type="button"
              onClick={() => { sound.playPop(); setLoginType('student'); setError(''); }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                loginType === 'student'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Candidate
            </button>
            <button
              type="button"
              onClick={() => { sound.playPop(); setLoginType('admin'); setError(''); }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                loginType === 'admin'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Admin / Invigilator
            </button>
          </div>
        </div>

        {/* Login Form Body */}
        <form onSubmit={handleSubmit} noValidate className="login-dedicated-form layer-3d-base">
          {loginType === 'student' ? (
            <>
              <div className={`form-field-group full-width ${isFocused ? 'is-focused' : ''} ${error ? 'has-error' : ''}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="loginPhone" className="text-xs font-bold text-slate-200">
                    Registered Mobile / Registration ID <span className="req-star">*</span>
                  </label>
                  {phone && /^\d{10}$/.test(phone) && (
                    <span className="text-[11px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                      10/10 Digits
                    </span>
                  )}
                </div>
                <div className="input-wrap login-big-input-wrap">
                  {(!phone || /^\d+$/.test(phone)) && (
                    <span className="prefix-tag">+91</span>
                  )}
                  <input
                    id="loginPhone"
                    type="text"
                    name="phone"
                    placeholder="e.g. 9812345678 or GEU-AIQ-2026-XXXXX"
                    maxLength={32}
                    value={phone}
                    onChange={(e) => {
                      handleCandidateInputChange(e.target.value);
                      trigger3DPulse(0.5);
                    }}
                    onFocus={() => {
                      setIsFocused(true);
                      sound.playFocus();
                      trigger3DPulse(0.8);
                    }}
                    onBlur={() => setIsFocused(false)}
                    autoFocus
                    autoComplete="off"
                  />
                  <Phone size={18} className="field-icon-right" />
                </div>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                  <span>Sign in instantly with your 10-digit mobile or Registration ID</span>
                  <span className="text-amber-400/90 font-medium">No Password Needed</span>
                </div>
              </div>

            </>
          ) : (
            <>
              <div className={`form-field-group full-width ${error ? 'has-error' : ''}`}>
                <label htmlFor="loginId">
                  Identifier / Mobile / Email <span className="req-star">*</span>
                </label>
                <div className="input-wrap login-big-input-wrap">
                  <input
                    id="loginId"
                    type="text"
                    name="identifier"
                    placeholder="Admin mobile (e.g. 9999999999) or Lab (9800000001)"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      setError('');
                    }}
                    autoFocus
                  />
                  <KeyRound size={18} className="field-icon-right" />
                </div>
              </div>

              <div className="form-field-group full-width mt-3">
                <label htmlFor="adminPassword">
                  Password <span className="req-star">*</span>
                </label>
                <div className="input-wrap login-big-input-wrap">
                  <input
                    id="adminPassword"
                    type="password"
                    name="password"
                    placeholder="Enter administrative password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <Lock size={18} className="field-icon-right" />
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="error-msg mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Fill Test Shortcuts */}
          <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-400">
            <span className="font-semibold text-slate-400">Quick Test:</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickFill('student')}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 transition-colors"
                title="Pragya Karnwal (LAB-01)"
              >
                Sample Student
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('subadmin')}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 transition-colors"
                title="Invigilator LAB-01"
              >
                Lab 01 Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('admin')}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-rose-300 transition-colors"
                title="Super Admin"
              >
                Super Admin
              </button>
            </div>
          </div>

          <div className="login-action-block layer-3d-front mt-5">
            <button
              type="submit"
              disabled={isLoading}
              className="golden-submit-button w-full flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <div className="button-glare"></div>
              <UserCheck size={18} />
              <span className="button-text">
                {isLoading ? 'Verifying Account...' : 'Sign In & Enter Portal'}
              </span>
              <ArrowRight size={18} className="button-arrow" />
            </button>
          </div>

          <div className="text-center mt-4">
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="text-xs text-amber-400/90 hover:text-amber-300 font-semibold underline underline-offset-4 cursor-pointer"
            >
              New candidate? Register for AI Quest 2026
            </button>
          </div>

          <div className="login-security-notice mt-4">
            <ShieldCheck size={14} className="shield-icon" />
            <span>Encrypted Graphic Era University Official Portal</span>
          </div>
        </form>
      </div>
    </div>
  );
}
