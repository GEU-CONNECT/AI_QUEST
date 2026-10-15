import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useNavigate } from 'react-router-dom';
import { GraphicEraLogo, AIQuestLogo, TrophyBanner, SunburstBadge } from './BrandingAssets';
import {
  CheckCircle2,
  Printer,
  Sparkles,
  X,
  QrCode,
  MapPin,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { sound } from '../utils/audio';

export default function SuccessModal({ isOpen, onClose, data, regId }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;

    sound.playSuccess();

    // Golden & Royal Blue celebratory confetti explosion
    const count = 200;
    const defaults = {
      origin: { y: 0.6 },
      zIndex: 99999,
    };

    function fire(particleRatio, opts) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, { spread: 26, startVelocity: 55, colors: ['#ffd700', '#ffb703', '#ffffff'] });
    fire(0.2, { spread: 60, colors: ['#00e5ff', '#1e40af', '#3b82f6'] });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8, colors: ['#ffd700', '#f59e0b', '#2563eb'] });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2, colors: ['#ffd700', '#ffffff'] });
    fire(0.1, { spread: 120, startVelocity: 45, colors: ['#00e5ff', '#38bdf8', '#ffd700'] });
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePrint = () => {
    sound.playPop();
    window.print();
  };

  const handleProceedToDashboard = () => {
    sound.playPop();
    onClose();
    navigate('/student');
  };

  return (
    <div className="modal-backdrop-blur">
      <div className="modal-scroll-wrapper">
        <div className="success-dialog-card">
          {/* Close Button */}
          <button onClick={onClose} className="modal-close-icon-btn" title="Close Modal">
            <X size={20} />
          </button>

          {/* Modal Header */}
          <div className="modal-celebration-head">
            <div className="celebration-badge-pill">
              <CheckCircle2 size={16} />
              <span>REGISTRATION CONFIRMED • OFFICIAL ADMIT PASS</span>
            </div>
            <h2 className="modal-heading">Welcome to AI Quest 2026!</h2>
            <p className="modal-subheading">
              Your application has been received and verified by Graphic Era University.
            </p>
          </div>

          {/* The Official AI Quest Admit Pass */}
          <div className="modal-pass-container" id="printable-quester-pass">
            <div className="official-pass-canvas">
              <div className="pass-card-bezel">
                {/* Top University Branding Row */}
                <div className="pass-brand-header">
                  <GraphicEraLogo className="scale-down" />
                  <AIQuestLogo className="scale-down" subtitle={false} />
                </div>

                {/* Trophy & Laurel Ribbon */}
                <TrophyBanner title="CONFIRMED QUESTER" />

                {/* Candidate Name */}
                <div className="pass-candidate-block">
                  <div className="pass-candidate-title">
                    {(data.candidateName || data.name || 'CANDIDATE').toUpperCase()}
                  </div>
                  <div className="pass-school-title">
                    {(data.schoolName || 'GRAPHIC ERA UNIVERSITY').toUpperCase()}
                  </div>
                </div>

                {/* Status Badge */}
                <SunburstBadge label="STATUS" score="ADMITTED" />

                {/* Detailed Verified Information Grid */}
                <div className="pass-meta-details-grid">
                  <div className="meta-item">
                    <span className="m-label">Class & Stream</span>
                    <span className="m-val">
                      {data.studentClass || 'Class 12th'} • {data.stream || 'Science'}
                    </span>
                  </div>
                  <div className="meta-item">
                    <span className="m-label">City</span>
                    <span className="m-val">{data.city || 'Dehradun'}</span>
                  </div>
                  <div className="meta-item">
                    <span className="m-label">Registration ID</span>
                    <span className="m-val highlight-id">{regId || data.registrationId || 'GEU-AIQ-2026-ACTIVE'}</span>
                  </div>
                </div>

                {/* Guardian & Contact Footer Row */}
                <div className="pass-guardian-strip">
                  <div className="guardian-text">
                    <strong>Parent / Guardian:</strong> {data.parentName || 'N/A'} ({data.parentContact || 'N/A'})
                  </div>
                  <div className="candidate-contact">
                    <strong>Contact:</strong> +91 {data.mobileNo || data.mobile} • {data.emailId || data.email}
                  </div>
                </div>

                {/* Bottom Verification QR & Seal */}
                <div className="pass-security-seal">
                  <div className="security-left">
                    <QrCode size={40} className="qr-pass" />
                    <div>
                      <div className="qr-title">GEU OFFICIAL AUTH CODE</div>
                      <div className="qr-hash">{regId || 'GEU-AIQ-2026'}-SECURE-VERIFIED</div>
                    </div>
                  </div>
                  <div className="security-right">
                    <div className="venue-tag">
                      <MapPin size={13} />
                      <span>Graphic Era University Campus, Dehradun</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Action Buttons */}
          <div className="modal-actions-bar">
            <button
              onClick={handleProceedToDashboard}
              className="modal-primary-btn bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 font-extrabold shadow-lg flex items-center justify-center gap-2"
            >
              <span>Proceed to Assessment Dashboard</span>
              <ArrowRight size={18} />
            </button>
            <button onClick={handlePrint} className="modal-secondary-btn flex items-center justify-center gap-2">
              <Printer size={18} />
              <span>Print Admit Pass</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
