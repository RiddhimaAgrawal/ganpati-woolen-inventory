import { useState } from 'react';
import { api } from '../api.js';
import { useLang } from '../i18n.jsx';
import { useToast } from './Toast.jsx';
import { Segmented } from './ui.jsx';
import { errMsg, todayStr } from '../utils.js';

// Home-page card: download everything as an Excel file (one month, or all data).
export default function ExportCard() {
  const { t, lang } = useLang();
  const toast = useToast();
  const now = todayStr(); // YYYY-MM-DD
  const [mode, setMode] = useState('month');
  const [year, setYear] = useState(now.slice(0, 4));
  const [mon, setMon] = useState(now.slice(5, 7));
  const [busy, setBusy] = useState(false);

  const thisYear = Number(now.slice(0, 4));
  const years = [0, 1, 2, 3, 4, 5].map((n) => String(thisYear - n));
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1).padStart(2, '0'),
    label: new Date(2000, i, 1).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { month: 'long' })
  }));

  async function download() {
    setBusy(true);
    try {
      const month = mode === 'month' ? `${year}-${mon}` : undefined;
      const blob = await api.exportExcel(month);
      const name = month ? `Ganpati_Report_${month}.xlsx` : `Ganpati_All_Data_${now}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 15000);
      toast(t('export.done'));
    } catch (err) {
      toast(errMsg(err, t), 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form export-card">
      <p className="hint">{t('export.sub')}</p>
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'month', label: `📅 ${t('export.month')}` },
          { value: 'all', label: `🗂 ${t('export.all')}` }
        ]}
      />
      {mode === 'month' && (
        <div className="two">
          <label className="field">
            <span>{t('export.pickMonth')}</span>
            <select value={mon} onChange={(e) => setMon(e.target.value)}>
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('export.pickYear')}</span>
            <select value={year} onChange={(e) => setYear(e.target.value)}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <button type="button" className="btn" onClick={download} disabled={busy}>
        {busy ? '…' : `⬇ ${t('export.btn')}`}
      </button>
      <p className="hint">{t('export.note')}</p>
    </div>
  );
}
