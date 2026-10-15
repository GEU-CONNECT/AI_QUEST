// Hardware and performance utility for low-end PC & monitor optimization

export const isLowSpecDevice = () => {
  // If user explicitly chose a mode in localStorage, prioritize it
  const saved = localStorage.getItem('aiquest_lite_mode');
  if (saved !== null) {
    return saved === 'true';
  }

  // Auto-detect based on hardware specs
  // 1. Hardware Concurrency (logical cores): <= 4 cores is typical for older dual-core / low-end CPUs
  const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4;
  
  // 2. Device Memory (RAM in GB)
  const memory = typeof navigator !== 'undefined' ? (navigator.deviceMemory || 4) : 4;

  // 3. User agent check for mobile or low-power embedded
  const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // If cores <= 4 or memory <= 4 or mobile, default to Lite Mode for 60 FPS silky smoothness
  return cores <= 4 || memory <= 4 || isMobile;
};

export const getLiteModeState = () => {
  if (typeof window === 'undefined') return false;
  return isLowSpecDevice();
};

export const setLiteModeState = (enabled) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('aiquest_lite_mode', String(enabled));
  
  if (enabled) {
    document.body.classList.add('lite-mode');
  } else {
    document.body.classList.remove('lite-mode');
  }

  window.dispatchEvent(new CustomEvent('aiquest-perf-change', {
    detail: { isLite: enabled }
  }));
};

export const initPerformanceMode = () => {
  if (typeof window === 'undefined') return false;
  const isLite = isLowSpecDevice();
  if (isLite) {
    document.body.classList.add('lite-mode');
  } else {
    document.body.classList.remove('lite-mode');
  }
  return isLite;
};
