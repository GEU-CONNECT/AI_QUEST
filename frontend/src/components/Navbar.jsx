import React, { useState, useEffect } from 'react';
import { GraphicEraLogo } from './BrandingAssets';
import { Zap, Sparkles } from 'lucide-react';
import { getLiteModeState, setLiteModeState } from '../utils/performance';
import { sound } from '../utils/audio';

export default function Navbar() {
  const [isLite, setIsLite] = useState(getLiteModeState());

  useEffect(() => {
    const handlePerfChange = (e) => {
      setIsLite(Boolean(e.detail?.isLite));
    };
    window.addEventListener('aiquest-perf-change', handlePerfChange);
    return () => window.removeEventListener('aiquest-perf-change', handlePerfChange);
  }, []);

  const handleToggle = () => {
    try {
      sound.playPop();
    } catch (_) {}
    const nextState = !isLite;
    setIsLite(nextState);
    setLiteModeState(nextState);
  };

  return (
    <header className="global-navbar">
      <div className="nav-container">
        {/* Left: Graphic Era Branding with official logo */}
        <div className="nav-brand-left">
          <GraphicEraLogo />
        </div>

        {/* Center: AI Quest Event Badge */}
        <div className="nav-center-quest">
          <div className="nav-quest-pill">
            <span className="live-pulse"></span>
            <span className="gold-text">AI QUEST 2026</span>
            <span className="date-sep">•</span>
            <span className="date-val">October 16, 2026</span>
          </div>
        </div>

        {/* Right: Low-End PC / Smooth Mode Toggle */}
        <div className="nav-controls-right">
          <button
            type="button"
            onClick={handleToggle}
            className={`perf-toggle-btn ${isLite ? 'lite-active' : 'three-active'}`}
            title={
              isLite
                ? 'Smooth Mode is active (0% GPU/CPU lag for older PCs & monitors). Click to switch to 3D Mode.'
                : '3D Animation Mode is active. If your screen or PC is lagging, click to enable Smooth Mode.'
            }
            aria-label="Toggle Smooth Mode for performance"
          >
            {isLite ? (
              <>
                <Zap size={14} className="perf-icon-zap" />
                <span className="perf-text">⚡ Smooth Mode: <strong className="text-emerald-400">ON</strong></span>
              </>
            ) : (
              <>
                <Sparkles size={14} className="perf-icon-3d" />
                <span className="perf-text">🚀 3D Mode</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
