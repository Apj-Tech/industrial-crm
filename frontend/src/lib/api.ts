import axios from 'axios';

// An explicitly empty string means "same origin" (used behind nginx in production).
const API_URL = process.env.NEXT_PUBLIC_API_URL !== undefined
  ? process.env.NEXT_PUBLIC_API_URL
  : 'http://localhost:5000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('crm_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally — redirect to login
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('crm_token');
      localStorage.removeItem('crm_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────
export const authApi = {
  login:          (email: string, password: string) => api.post('/auth/login', { email, password }),
  me:             () => api.get('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) => api.put('/auth/change-password', { currentPassword, newPassword }),
  updateProfile:  (data: Record<string, unknown>) => api.put('/auth/profile', data),
  logout:         () => api.post('/auth/logout'),
};

// ─── Users ────────────────────────────────────────────────────────────
export const usersApi = {
  list:          (params?: Record<string, unknown>) => api.get('/users', { params }),
  get:           (id: string) => api.get(`/users/${id}`),
  create:        (data: Record<string, unknown>) => api.post('/users', data),
  update:        (id: string, data: Record<string, unknown>) => api.put(`/users/${id}`, data),
  resetPassword: (id: string, newPassword: string) => api.patch(`/users/${id}/reset-password`, { newPassword }),
  toggleLock:    (id: string) => api.patch(`/users/${id}/toggle-lock`),
  reactivate:    (id: string) => api.patch(`/users/${id}/reactivate`),
  deactivate:    (id: string) => api.delete(`/users/${id}`),
};

// ─── Customers ────────────────────────────────────────────────────────
export const customersApi = {
  list:         (params?: Record<string, unknown>) => api.get('/customers', { params }),
  get:          (id: string) => api.get(`/customers/${id}`),
  withLocation: () => api.get('/customers/with-location'),
  create:       (data: Record<string, unknown>) => api.post('/customers', data),
  update:       (id: string, data: Record<string, unknown>) => api.put(`/customers/${id}`, data),
  delete:       (id: string) => api.delete(`/customers/${id}`),
  filterMeta:   () => api.get('/customers/meta/filters'),
};

// ─── Meetings ─────────────────────────────────────────────────────────
export const meetingsApi = {
  list:           (params?: Record<string, unknown>) => api.get('/meetings', { params }),
  get:            (id: string) => api.get(`/meetings/${id}`),
  create:         (data: Record<string, unknown>) => api.post('/meetings', data),
  update:         (id: string, data: Record<string, unknown>) => api.put(`/meetings/${id}`, data),
  todayFollowups: () => api.get('/meetings/today-followups'),
  alerts:         () => api.get('/meetings/alerts'),
  markAlertRead:  (id: string) => api.patch(`/meetings/alerts/${id}/read`),
  checkIn:        (id: string, lat: number, lng: number) => api.post(`/meetings/${id}/checkin`, { lat, lng }),
  timer:          (id: string, action: string) => api.patch(`/meetings/${id}/timer`, { action }),
  customerVisits: (customerId: string) => api.get(`/meetings/customer/${customerId}/visits`),
};

// ─── Products ─────────────────────────────────────────────────────────
export const productsApi = {
  list:        (params?: Record<string, unknown>) => api.get('/products', { params }),
  get:         (id: string) => api.get(`/products/${id}`),
  searchByCode:(code: string) => api.get(`/products/code/${encodeURIComponent(code)}`),
  autocomplete:(q: string) => api.get('/products/search', { params: { q } }),
  create:      (data: Record<string, unknown>) => api.post('/products', data),
  update:      (id: string, data: Record<string, unknown>) => api.put(`/products/${id}`, data),
};

// ─── Attendance ───────────────────────────────────────────────────────
export const attendanceApi = {
  checkIn:   (lat?: number, lng?: number) => api.post('/attendance/checkin', { lat, lng }),
  checkOut:  (lat?: number, lng?: number) => api.post('/attendance/checkout', { lat, lng }),
  today:     () => api.get('/attendance/today'),
  list:      (params?: Record<string, unknown>) => api.get('/attendance', { params }),
  ping:      (lat: number, lng: number, accuracy?: number) => api.post('/attendance/ping', { lat, lng, accuracy }),
  live:      () => api.get('/attendance/live'),
  locations: (attendanceId: string) => api.get(`/attendance/${attendanceId}/locations`),
};

// ─── Leaves ───────────────────────────────────────────────────────────
export const leavesApi = {
  list:    (params?: Record<string, unknown>) => api.get('/leaves', { params }),
  create:  (data: Record<string, unknown>) => api.post('/leaves', data),
  approve: (id: string, status: string, adminNote?: string) =>
    api.patch(`/leaves/${id}/approve`, { status, adminNote }),
};

// ─── Dashboard ────────────────────────────────────────────────────────
export const dashboardApi = {
  admin: () => api.get('/dashboard/admin'),
  user:  () => api.get('/dashboard/user'),
};

// ─── Activity ─────────────────────────────────────────────────────────
export const activityApi = {
  list: (params?: Record<string, unknown>) => api.get('/activity', { params }),
};

// ─── Quotations ───────────────────────────────────────────────────────
export const quotationsApi = {
  list:    (params?: Record<string, unknown>) => api.get('/quotations', { params }),
  stats:   () => api.get('/quotations/stats'),
  get:     (id: string) => api.get(`/quotations/${id}`),
  create:  (data: Record<string, unknown>) => api.post('/quotations', data),
  update:  (id: string, data: Record<string, unknown>) => api.put(`/quotations/${id}`, data),
  delete:  (id: string) => api.delete(`/quotations/${id}`),
  approve: (id: string, action: string, note?: string) => api.patch(`/quotations/${id}/approve`, { action, note }),
  pdfUrl:  (id: string) => `${API_URL}/api/quotations/${id}/pdf`,
};

// ─── Stock ────────────────────────────────────────────────────────────
export const stockApi = {
  list:    (params?: Record<string, unknown>) => api.get('/products/stock', { params }),
  alerts:  () => api.get('/products/stock/alerts'),
  stats:   () => api.get('/products/stock/stats'),
};

// ─── Categories ───────────────────────────────────────────────────────
export const categoriesApi = {
  list:   () => api.get('/categories'),
  create: (data: Record<string, unknown>) => api.post('/categories', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/categories/${id}`, data),
  delete: (id: string) => api.delete(`/categories/${id}`),
};

// ─── Analytics ────────────────────────────────────────────────────────
export const analyticsApi = {
  overview:      () => api.get('/analytics/overview'),
  monthly:       (months?: number) => api.get('/analytics/monthly', { params: { months } }),
  employee:      () => api.get('/analytics/employee'),
  segmentation:  () => api.get('/analytics/segmentation'),
  winLoss:       () => api.get('/analytics/win-loss'),
};
