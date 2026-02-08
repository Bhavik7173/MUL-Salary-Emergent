import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Work Entries API
export const entriesApi = {
  getAll: (year, month) => {
    const params = {};
    if (year && month) {
      params.year = year;
      params.month = month;
    }
    return api.get('/entries', { params });
  },
  
  getOne: (id) => api.get(`/entries/${id}`),
  
  create: (data) => api.post('/entries', data),
  
  update: (id, data) => api.put(`/entries/${id}`, data),
  
  delete: (id) => api.delete(`/entries/${id}`),
};

// Monthly Summary API
export const summaryApi = {
  get: (year, month) => api.get(`/summary/${year}/${month}`),
};

// Settings API
export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
};

// Upload API
export const uploadApi = {
  parse: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  save: (entries) => api.post('/upload/save', entries),
};

// Export API
export const exportApi = {
  excel: (year, month) => 
    api.get(`/export/${year}/${month}/excel`, { responseType: 'blob' }),
  
  pdf: (year, month) => 
    api.get(`/payslip/${year}/${month}/pdf`, { responseType: 'blob' }),
};

// Email API
export const emailApi = {
  send: (data) => api.post('/email/send', data),
};

export default api;
