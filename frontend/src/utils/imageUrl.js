/**
 * Converts stored question image URLs into safe, proxy-backed stream URLs
 * to ensure private AWS S3 objects render seamlessly in all browsers without 403 Forbidden errors.
 */
export const getSafeImageUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Data URLs or local blob previews
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // If already pointing to our proxy
  if (trimmed.includes('/api/quizzes/image-proxy')) {
    if (trimmed.startsWith('/')) {
      const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');
      return baseUrl ? `${baseUrl}${trimmed}` : trimmed;
    }
    return trimmed;
  }

  // If S3 key or AWS S3 URL with mcq-images/ prefix
  if (trimmed.includes('mcq-images/')) {
    const key = trimmed.slice(trimmed.indexOf('mcq-images/'));
    const apiBase = import.meta.env.VITE_API_URL || '/api';
    const cleanApi = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
    return `${cleanApi}/quizzes/image-proxy?key=${encodeURIComponent(key)}`;
  }

  return trimmed;
};
