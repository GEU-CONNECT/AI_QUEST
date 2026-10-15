import React from 'react';
import { GraphicEraLogo } from './BrandingAssets';

export default function Navbar() {
  return (
    <header className="global-navbar">
      <div className="nav-container">
        {/* Left: Graphic Era Branding */}
        <div className="nav-brand-left">
          <GraphicEraLogo />
        </div>

        {/* Right: AI Quest Event Badge */}
        <div className="nav-center-quest">
          <div className="nav-quest-pill">
            <span className="live-pulse"></span>
            <span className="gold-text">AI QUEST 2026</span>
            <span className="date-sep">•</span>
            <span className="date-val">October 16, 2026</span>
          </div>
        </div>
      </div>
    </header>
  );
}
