import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('quizx_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.includes('/login') && window.location.pathname !== '/') {
      localStorage.removeItem('quizx_token');
      localStorage.removeItem('quizx_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
