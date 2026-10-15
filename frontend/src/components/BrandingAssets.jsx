import React from 'react';

// Graphic Era University Official Logo using /image.png
export function GraphicEraLogo({ className = '' }) {
  return (
    <div className={`geu-branding-container ${className}`}>
      {/* Official Circular Emblem from public/image.png */}
      <div className="geu-emblem-wrapper">
        <img
          src="/image.png"
          alt="Graphic Era Deemed to be University"
          className="geu-logo-img"
        />
      </div>

      {/* University Wordmark */}
      <div className="geu-text-wrapper">
        <div className="geu-title">Graphic Era</div>
        <div className="geu-subtitle">
          Deemed to be <span>University</span>
        </div>
        <div className="geu-location">DEHRADUN</div>
      </div>
    </div>
  );
}

// 3D AI Quest 2026 Logo Badge
export function AIQuestLogo({ className = '', subtitle = true }) {
  return (
    <div className={`ai-quest-badge-wrapper ${className}`}>
      <div className="ai-quest-logo-inner">
        <div className="ai-title-row">
          <span className="cyber-ai-text">AI</span>
          <span className="golden-quest-text">Quest</span>
        </div>
        <div className="year-2026-badge">2026</div>
      </div>

      {subtitle && (
        <div className="ai-quest-meta">
          <div className="learn-best-pill">
            <span className="sparkle-dot"></span>
            LEARN FROM THE BEST
            <span className="sparkle-dot"></span>
          </div>
          <div className="quest-date-tag">— October 16, 2026 —</div>
        </div>
      )}
    </div>
  );
}

// Golden Trophy with Laurels & Ribbon Banner (Matches the card header from image)
export function TrophyBanner({ title = 'OFFICIAL QUESTER', className = '' }) {
  return (
    <div className={`trophy-banner-container ${className}`}>
      {/* Laurel Wreath Left */}
      <svg className="laurel-wreath laurel-left" viewBox="0 0 60 90">
        <g fill="#f59e0b" stroke="#d97706" strokeWidth="1">
          <path d="M50,80 Q20,60 15,20 Q30,40 50,60 Z" />
          <path d="M40,70 Q10,50 10,15 Q25,35 40,50 Z" />
          <path d="M30,55 Q5,35 15,5 Q20,25 30,35 Z" />
        </g>
      </svg>

      {/* Trophy Center */}
      <div className="trophy-cup-glow">
        <div className="trophy-star-top">★</div>
        <svg viewBox="0 0 100 90" className="trophy-svg">
          <defs>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fffbeb" />
              <stop offset="25%" stopColor="#fde047" />
              <stop offset="60%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
            <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#f59e0b" floodOpacity="0.4" />
            </filter>
          </defs>
          {/* Trophy Handles */}
          <path d="M22,25 C10,25 10,48 24,52" fill="none" stroke="url(#goldGrad)" strokeWidth="6" strokeLinecap="round" />
          <path d="M78,25 C90,25 90,48 76,52" fill="none" stroke="url(#goldGrad)" strokeWidth="6" strokeLinecap="round" />
          {/* Main Cup */}
          <path
            d="M24,18 L76,18 C76,46 64,62 50,62 C36,62 24,46 24,18 Z"
            fill="url(#goldGrad)"
            filter="url(#goldGlow)"
          />
          {/* Star on Cup */}
          <polygon points="50,26 53,35 63,35 55,41 58,50 50,44 42,50 45,41 37,35 47,35" fill="#ffffff" opacity="0.95" />
          {/* Trophy Stem & Base */}
          <rect x="44" y="62" width="12" height="12" fill="url(#goldGrad)" />
          <path d="M32,74 L68,74 L72,82 L28,82 Z" fill="url(#goldGrad)" />
        </svg>
      </div>

      {/* Laurel Wreath Right */}
      <svg className="laurel-wreath laurel-right" viewBox="0 0 60 90">
        <g fill="#f59e0b" stroke="#d97706" strokeWidth="1" transform="scale(-1, 1) translate(-60, 0)">
          <path d="M50,80 Q20,60 15,20 Q30,40 50,60 Z" />
          <path d="M40,70 Q10,50 10,15 Q25,35 40,50 Z" />
          <path d="M30,55 Q5,35 15,5 Q20,25 30,35 Z" />
        </g>
      </svg>

      {/* Blue Winner / Quester Ribbon Banner */}
      <div className="royal-ribbon-banner">
        <div className="ribbon-tail ribbon-tail-left"></div>
        <div className="ribbon-center">
          <span className="ribbon-title">{title}</span>
        </div>
        <div className="ribbon-tail ribbon-tail-right"></div>
      </div>
    </div>
  );
}

// Sunburst Score / Status Badge (Matching reference image)
export function SunburstBadge({ score = '98/100', label = 'QUEST SCORE' }) {
  return (
    <div className="sunburst-badge-container">
      {/* Sunburst Rays Left */}
      <div className="sunburst-rays rays-left">
        <span></span>
        <span></span>
        <span></span>
      </div>

      {/* Brush stroke style blue pill */}
      <div className="sunburst-pill">
        <div className="sunburst-label">{label}</div>
        <div className="sunburst-score">{score}</div>
      </div>

      {/* Sunburst Rays Right */}
      <div className="sunburst-rays rays-right">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  );
}
