// All communication with the Express backend lives here.
// Dev (npm run dev): talk to the backend on port 5000.
// Production build served by the backend itself: use the same address (relative URLs).

const BASE = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : '')
).replace(/\/+$/, '');


const TOKEN_KEY = 'gw_token';
export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (t) => {
  try { localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ }
};
export const clearToken = () => {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
};

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    const err = new Error('NETWORK');
    err.code = 'NETWORK';
    throw err;
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON response */
  }

  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.code = 'API';
    err.status = res.status;
    // Logged out (expired, password changed elsewhere, removed): send the person back to the login screen.
    if (res.status === 401 && path !== '/api/auth/login') {
      window.dispatchEvent(new Event('gw:unauthorized'));
    }
    throw err;
  }
  return data;
}

// Downloads a file (used for the Excel report). Returns the file as a Blob.
async function download(path) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { headers });
  } catch {
    const err = new Error('NETWORK');
    err.code = 'NETWORK';
    throw err;
  }

  if (!res.ok) {
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* not JSON */
    }
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.code = 'API';
    err.status = res.status;
    if (res.status === 401) window.dispatchEvent(new Event('gw:unauthorized'));
    throw err;
  }
  return res.blob();
}

const qs = (params = {}) => {
  const q = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
  ).toString();
  return q ? `?${q}` : '';
};

export const api = {
  stock: () => request('/api/dashboard/stock'),

  customers: () => request('/api/customers'),
  addCustomer: (body) => request('/api/customers', { method: 'POST', body }),
  updateCustomer: (id, body) => request(`/api/customers/${id}`, { method: 'PUT', body }),
  deleteCustomer: (id) => request(`/api/customers/${id}`, { method: 'DELETE' }),

  imports: () => request('/api/raw-imports'),
  addImport: (body) => request('/api/raw-imports', { method: 'POST', body }),
  updateImport: (id, body) => request(`/api/raw-imports/${id}`, { method: 'PUT', body }),
  deleteImport: (id) => request(`/api/raw-imports/${id}`, { method: 'DELETE' }),

  processing: () => request('/api/processing'),
  addProcessing: (body) => request('/api/processing', { method: 'POST', body }),
  updateProcessing: (id, body) => request(`/api/processing/${id}`, { method: 'PUT', body }),
  deleteProcessing: (id) => request(`/api/processing/${id}`, { method: 'DELETE' }),

  sales: (params) => request(`/api/sales${qs(params)}`),
  addSale: (body) => request('/api/sales', { method: 'POST', body }),
  updateSale: (id, body) => request(`/api/sales/${id}`, { method: 'PUT', body }),
  deleteSale: (id) => request(`/api/sales/${id}`, { method: 'DELETE' }),

  // Excel report. month = 'YYYY-MM', or leave empty for all data.
  exportExcel: (month) => download(`/api/export/excel${qs({ month })}`),

  // login & team
  login: (username, password) => request('/api/auth/login', { method: 'POST', body: { username, password } }),
  me: () => request('/api/auth/me'),
  changePassword: (current_password, new_password) =>
    request('/api/auth/change-password', { method: 'POST', body: { current_password, new_password } }),
  users: () => request('/api/users'),
  addUser: (body) => request('/api/users', { method: 'POST', body }),
  resetUserPassword: (id, password) => request(`/api/users/${id}/reset-password`, { method: 'POST', body: { password } }),
  removeUser: (id) => request(`/api/users/${id}`, { method: 'DELETE' })
};
