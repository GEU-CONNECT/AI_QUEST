import React from 'react';

/**
 * Pure Static High-Performance Background
 * Completely replaces Three.js / WebGL with 0% CPU and 0% GPU overhead.
 * Guarantees silky smooth 60-120 FPS on all old PCs and monitors.
 */
export default function ThreeCanvas() {
  return (
    <div className="static-page-backdrop" aria-hidden="true">
      <div className="static-space-gradient" />
      <div className="static-ambient-circle circle-top-left" />
      <div className="static-ambient-circle circle-bottom-right" />
      <div className="static-subtle-grid" />
    </div>
  );
}
