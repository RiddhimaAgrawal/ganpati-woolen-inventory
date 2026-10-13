export const num = (v) => Number(v) || 0;

export const fmtKg = (v) =>
  `${num(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })} kg`;

export const fmtRupees = (v) =>
  `₹${num(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const pad = (n) => String(n).padStart(2, '0');
const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const todayStr = () => toStr(new Date());

export const addDays = (dateStr, n) => {
  const d = parse(dateStr);
  d.setDate(d.getDate() + n);
  return toStr(d);
};

// Negative = already past, 0 = today, positive = in the future
export const daysUntil = (dateStr) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((parse(dateStr) - today) / 86400000);
};

export const fmtDate = (s) =>
  s
    ? parse(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

export const typeKey = (r) => `${r.material_type}|${r.sub_type}`;

// "Merino Wool" / "Merino ऊन"
export const typeLabel = (t, material, sub) =>
  `${sub} ${material === 'WOOL' ? t('common.woolShort') : t('common.fiberShort')}`;

export const errMsg = (e, t) => {
  if (e && e.code === 'NETWORK') return t('err.network');
  return (e && e.message) || t('err.generic');
};

// Phone helpers. 10-digit numbers are assumed to be Indian (+91).
export const waLink = (phone, message) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const full = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
};

export const telLink = (phone) => {
  const clean = String(phone || '').replace(/[^\d+]/g, '');
  return clean ? `tel:${clean}` : null;
};

// Search helper for the "recent entries" lists.
// With no search text: the latest 10 rows. With search text: up to 50 matching rows.
export function searchRows(rows, query, getText) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return rows.slice(0, 10);
  return rows.filter((r) => String(getText(r)).toLowerCase().includes(q)).slice(0, 50);
}
