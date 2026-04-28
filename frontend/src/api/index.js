import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('netops_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('netops_token');
      localStorage.removeItem('netops_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

export const expensesApi = {
  list: (params) => api.get('/expenses', { params }),
  get: (id) => api.get(`/expenses/${id}`),
  submit: (formData) => api.post('/expenses', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  requestUpdate: (id, formData) => api.post(`/expenses/${id}/update-request`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  approve: (id, expense_type, category) => api.put(`/expenses/${id}/approve`, { expense_type, ...(category ? { category } : {}) }),
  reject: (id, reason) => api.put(`/expenses/${id}/reject`, { reason }),
  approveUpdateRequest: (id, expense_type) => api.put(`/expenses/update-requests/${id}/approve`, { expense_type }),
  rejectUpdateRequest: (id, reason) => api.put(`/expenses/update-requests/${id}/reject`, { reason }),
};

export const categoriesApi = {
  list: () => api.get('/categories'),
  create: (name) => api.post('/categories', { name }),
  remove: (id) => api.delete(`/categories/${id}`),
};

export const budgetApi = {
  get: (params) => api.get('/budget', { params }),
  update: (data) => api.put('/budget', data),
};

export const usersApi = {
  list: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  changePassword: (data) => api.put('/users/me/password', data),
  remove: (id) => api.delete(`/users/${id}`),
};

export const notificationsApi = {
  list: () => api.get('/notifications'),
  markAllRead: () => api.put('/notifications/read'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
};

export const auditApi = {
  list: (params) => api.get('/audit', { params }),
  listAccess: (params) => api.get('/audit/access', { params }),
};

export const reportsApi = {
  export: (params) => api.get('/reports/export', { params, responseType: 'blob' }),
};

export default api;
