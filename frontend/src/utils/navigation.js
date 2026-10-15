/**
 * Helper to retrieve GEU Connect Campus Hub URL
 */
export const getHubUrl = () => {
  const returnUrl = sessionStorage.getItem('returnUrl');
  if (returnUrl) return returnUrl;
  return '/login';
};

/**
 * Handle Sign-Out:
 * Clears QuizX local storage and redirects to /login
 */
export const handleAppLogout = () => {
  try {
    localStorage.removeItem('quizx_token');
    localStorage.removeItem('quizx_user');
    sessionStorage.removeItem('returnUrl');
  } catch (e) {
    console.error('Logout error clearing storage', e);
  }
  window.location.href = '/login';
};

/**
 * Extract initial for avatar
 */
export const getInitial = (name, fallback = 'U') => {
  if (!name) return fallback;
  const parts = name.trim().split(' ');
  return parts[0] ? parts[0][0].toUpperCase() : fallback;
};
