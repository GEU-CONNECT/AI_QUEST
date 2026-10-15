import React from 'react';
import { TrophyBanner, SunburstBadge } from './BrandingAssets';
import { Sparkles, QrCode, ShieldCheck, MapPin, GraduationCap } from 'lucide-react';

export default function PassPreviewCard({ formData, regId, isSubmitted = false }) {
  const candidateName = formData.candidateName.trim() || 'PRAGYA KARNWAL';
  const schoolName = formData.schoolName.trim() || 'DOON INTERNATIONAL SCHOOL';
  const city = formData.city.trim() || 'Dehradun';
  const grade = formData.studentClass || 'Class 12th';
  const stream = formData.stream || 'Science - PCM';

  return (
    <div className="pass-card-perspective-wrapper">
      <div className={`preview-winner-card ${isSubmitted ? 'submitted-celebration' : ''}`}>
        {/* Hologram Card Border Glow */}
        <div className="card-ambient-glow"></div>

        {/* Top Trophy & Laurels Ribbon */}
        <TrophyBanner title={isSubmitted ? 'CONFIRMED QUESTER' : 'QUESTER CANDIDATE'} />

        {/* Candidate Name */}
        <div className="card-name-section">
          <h2 className="preview-candidate-name">{candidateName.toUpperCase()}</h2>
          <div className="preview-school-name">{schoolName.toUpperCase()}</div>
        </div>

        {/* Dynamic Badges Row */}
        <div className="card-tags-row">
          <span className="info-chip">
            <GraduationCap size={13} className="chip-icon" />
            {grade} • {stream}
          </span>
          <span className="info-chip">
            <MapPin size={13} className="chip-icon" />
            {city}
          </span>
        </div>

        {/* Sunburst Score / Status Badge */}
        <SunburstBadge
          label={isSubmitted ? 'APPLICATION STATUS' : 'TARGET SCORE'}
          score={isSubmitted ? 'VERIFIED' : '98/100'}
        />

        {/* Card Footer with Hologram & Registration ID */}
        <div className="card-footer-strip">
          <div className="reg-id-box">
            <span className="reg-label">REGISTRATION ID</span>
            <span className="reg-val">{regId || 'GEU-AIQ-2026-PENDING'}</span>
          </div>

          <div className="card-qr-box" title="AI Quest Verification QR">
            <QrCode size={34} className="qr-icon" />
            <span className="qr-sub">SCAN PASS</span>
          </div>
        </div>

        {/* Subtle Watermark Badge */}
        <div className="card-watermark">
          <ShieldCheck size={14} />
          <span>Graphic Era University Verified Quest Pass</span>
        </div>
      </div>
    </div>
  );
}
