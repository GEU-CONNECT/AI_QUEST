import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ThreeCanvas from '../components/ThreeCanvas';
import Navbar from '../components/Navbar';
import QuesterForm from '../components/QuesterForm';
import LoginForm from '../components/LoginForm';
import SuccessModal from '../components/SuccessModal';
import { AIQuestLogo, GraphicEraLogo } from '../components/BrandingAssets';
import { LogIn, UserPlus, AlertCircle } from 'lucide-react';
import { sound } from '../utils/audio';
import api from '../api/client';
import '../App.css';

export default function AuthLanding({ onLoginSuccess }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('register'); // 'register' | 'login'

  const [formData, setFormData] = useState({
    candidateName: '',
    mobileNo: '',
    emailId: '',
    studentClass: 'Class 12th',
    stream: 'Science (PCM - Physics, Chem, Math)',
    schoolName: '',
    parentName: '',
    parentContact: '',
    city: '',
    password: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [regId, setRegId] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Real backend submission for registration
  const handleFormSubmit = async () => {
    setIsSubmitting(true);
    setServerError('');

    try {
      const res = await api.post('/auth/register', formData);

      if (res.data?.success) {
        localStorage.setItem('quizx_token', res.data.token);
        localStorage.setItem('quizx_user', JSON.stringify(res.data.user));
        setRegId(res.data.regId);
        setIsSubmitting(false);
        setShowModal(true);
        if (onLoginSuccess) {
          onLoginSuccess(res.data.user, false);
        }
      }
    } catch (err) {
      setIsSubmitting(false);
      const msg = err.response?.data?.message || 'Registration failed. Please check details and try again.';
      setServerError(msg);

      if (err.response?.status === 409) {
        // Mobile already registered
        setTimeout(() => {
          window.scrollTo({ top: 120, behavior: 'smooth' });
        }, 100);
      }
    }
  };

  // Real login success handler with dynamic role routing
  const handleLoginSuccess = (user) => {
    if (onLoginSuccess) {
      onLoginSuccess(user, true);
    } else {
      if (user.role === 'ADMIN') {
        navigate('/admin');
      } else if (user.role === 'SUBADMIN' || user.role === 'FACULTY') {
        navigate('/faculty');
      } else {
        navigate('/student');
      }
    }
  };

  return (
    <div className="app-viewport-root">
      {/* 3D Three.js Interactive Background */}
      <ThreeCanvas />

      {/* Main Foreground Container */}
      <div className="app-foreground-content">
        <Navbar />

        <main className="main-content-layout">
          {/* Top Hero Banner Section */}
          <section className="hero-banner-section">
            <div className="hero-branding-grid">
              <div className="hero-brand-left">
                <GraphicEraLogo className="hero-geu-logo" />
              </div>
              <div className="hero-brand-center">
                <AIQuestLogo className="hero-ai-logo" />
              </div>
            </div>

            <p className="hero-tagline-text">
              Embark on an intellectual journey with Northern India's premier technology & AI championship.
              Showcase your talents and compete for prestigious academic recognition and awards.
            </p>
          </section>

          {/* Server Error Alert Banner if any */}
          {serverError && (
            <div className="max-w-xl mx-auto mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-2.5">
                <AlertCircle size={18} className="shrink-0 text-rose-400" />
                <span>{serverError}</span>
              </div>
              {serverError.includes('already registered') && (
                <button
                  type="button"
                  onClick={() => {
                    sound.playPop();
                    setActiveTab('login');
                    setServerError('');
                  }}
                  className="px-3 py-1 rounded-lg bg-amber-400 text-slate-950 font-bold text-xs shrink-0 cursor-pointer hover:bg-amber-300"
                >
                  Go to Login
                </button>
              )}
            </div>
          )}

          {/* Interactive Form Section: Switches between Registration and Login */}
          <section className="centered-form-stage">
            {activeTab === 'register' ? (
              <QuesterForm
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleFormSubmit}
                isSubmitting={isSubmitting}
              />
            ) : (
              <LoginForm
                onLoginSuccess={handleLoginSuccess}
                onSwitchToRegister={() => {
                  sound.playPop();
                  setActiveTab('register');
                  window.scrollTo({ top: 120, behavior: 'smooth' });
                }}
              />
            )}
          </section>
        </main>

        {/* Global Footer */}
        <footer className="global-site-footer">
          <div className="footer-content">
            <div className="footer-geu-info">
              <span className="footer-brand">Graphic Era University</span>
              <p className="footer-address">
                Graphic Era University, 566/6, Bell Road, Society Area, Clement Town, Dehradun, Uttarakhand 248002
              </p>
              <p className="footer-sub-text">
                Graphic Era University Admissions & AI Quest 2026 Secretariat
              </p>
            </div>

            {/* Toggle Button */}
            <div className="footer-login-center-block">
              {activeTab === 'register' ? (
                <button
                  type="button"
                  onClick={() => {
                    sound.playPop();
                    setActiveTab('login');
                    window.scrollTo({ top: 120, behavior: 'smooth' });
                  }}
                  className="footer-small-login-btn cursor-pointer"
                  title="Switch to Candidate Login"
                >
                  <LogIn size={13} />
                  <span>Login</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    sound.playPop();
                    setActiveTab('register');
                    window.scrollTo({ top: 120, behavior: 'smooth' });
                  }}
                  className="footer-small-login-btn register-mode cursor-pointer"
                  title="Switch to Quester Registration Form"
                >
                  <UserPlus size={13} />
                  <span>Register</span>
                </button>
              )}
            </div>

            <div className="footer-meta">
              <p>© 2026 Graphic Era University. All Rights Reserved.</p>
              <p className="footer-sub">Graphic Era University • AI Quest 2026 • Northern India Championship</p>
            </div>
          </div>
        </footer>
      </div>

      {/* Success Admit Pass Modal */}
      <SuccessModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        data={formData}
        regId={regId}
      />
    </div>
  );
}
