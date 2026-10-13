import { useState } from 'react';
import { api } from '../api.js';
import { useLoad } from '../hooks.js';
import { useLang } from '../i18n.jsx';
import { useToast } from '../components/Toast.jsx';
import { Empty, ErrorBox, Loading, PageHeader, Segmented } from '../components/ui.jsx';
import { errMsg, fmtDate, fmtKg, fmtRupees, num, searchRows, todayStr, typeLabel } from '../utils.js';

export default function BuyMaterial() {
  const { t } = useLang();
  const toast = useToast();
  const stockQ = useLoad(api.stock, []);
  const listQ = useLoad(api.imports, []);

  const [material, setMaterial] = useState('');
  const [sub, setSub] = useState('');
  const [qty, setQty] = useState('');
  const [rate, setRate] = useState('');
  const [supplier, setSupplier] = useState('');
  const [lc, setLc] = useState('');
  const [find, setFind] = useState('');
  const [date, setDate] = useState(todayStr());
  const [busy, setBusy] = useState(false);

  const suggestions = [
    ...new Set((stockQ.data || []).filter((r) => r.material_type === material).map((r) => r.sub_type))
  ];
  const total = num(qty) * num(rate);
  const ready = material && sub.trim() && num(qty) > 0 && num(rate) > 0 && date;
  const shown = listQ.data
    ? searchRows(listQ.data, find, (r) => [r.lc_no, r.sub_type, r.supplier_name, r.material_type].join(' '))
    : [];

  async function submit(e) {
    e.preventDefault();
    if (!ready) return toast(t('common.fillAll'), 'err');
    setBusy(true);
    try {
      await api.addImport({
        material_type: material,
        sub_type: sub.trim(),
        quantity_kg: num(qty),
        rate_per_kg: num(rate),
        supplier_name: supplier.trim() || undefined,
        lc_no: lc.trim() || undefined,
        import_date: date
      });
      toast(t('buy.done', { qty: fmtKg(qty), type: typeLabel(t, material, sub.trim()) }));
      setQty('');
      setRate('');
      setSupplier('');
      setLc('');
      listQ.reload();
      stockQ.reload();
    } catch (err) {
      toast(errMsg(err, t), 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader icon="📥" title={t('buy.title')} sub={t('buy.sub')} />

      <form className="form" onSubmit={submit}>
        <div className="field">
          <span>{t('common.whatKind')}</span>
          <Segmented
            value={material}
            onChange={setMaterial}
            options={[
              { value: 'FIBER', label: `🌿 ${t('common.fiber')}` },
              { value: 'WOOL', label: `🐑 ${t('common.wool')}` }
            ]}
          />
        </div>

        <label className="field">
          <span>{t('common.typeName')}</span>
          <input list="sub-types" value={sub} onChange={(e) => setSub(e.target.value)} autoComplete="off" />
          <datalist id="sub-types">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>

        <div className="two">
          <label className="field">
            <span>{t('buy.qty')}</span>
            <input type="number" inputMode="decimal" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
          </label>
          <label className="field">
            <span>{t('buy.rate')}</span>
            <input type="number" inputMode="decimal" min="0" step="any" value={rate} onChange={(e) => setRate(e.target.value)} />
          </label>
        </div>

        <label className="field">
          <span>
            {t('buy.supplier')} <em>{t('common.optional')}</em>
          </span>
          <input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        </label>

        <label className="field">
          <span>
            {t('buy.lc')} <em>{t('common.optional')}</em>
          </span>
          <input value={lc} onChange={(e) => setLc(e.target.value)} autoComplete="off" />
        </label>

        <label className="field">
          <span>{t('buy.date')}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>

        {ready && (
          <div className="summary">
            {t('buy.summary', {
              qty: fmtKg(qty),
              type: typeLabel(t, material, sub.trim()),
              rate: fmtRupees(rate),
              total: fmtRupees(total)
            })}
          </div>
        )}

        <button className="btn" disabled={busy}>
          {busy ? '…' : `✔ ${t('buy.btn')}`}
        </button>
      </form>

      <h2 className="section">{t('common.recent')}</h2>
      {listQ.loading && !listQ.data ? (
        <Loading />
      ) : listQ.error && !listQ.data ? (
        <ErrorBox error={listQ.error} onRetry={listQ.reload} />
      ) : listQ.data.length === 0 ? (
        <Empty text={t('common.nothing')} />
      ) : (
        <>
          <input className="search" placeholder={`🔍 ${t('buy.search')}`} value={find} onChange={(e) => setFind(e.target.value)} />
          {shown.length === 0 ? (
            <Empty text={t('common.noMatch')} />
          ) : (
            <div className="cards">
              {shown.map((r) => (
                <div className="card" key={r.id}>
                  <div className="card-title">
                    {fmtKg(r.quantity_kg)} · {typeLabel(t, r.material_type, r.sub_type)}
                  </div>
                  <div className="meta">
                    {r.lc_no && (
                      <>
                        <span className="tag">{t('buy.lcShort', { no: r.lc_no })}</span> ·{' '}
                      </>
                    )}
                    {fmtRupees(r.rate_per_kg)}
                    {t('common.perKg')} · <b>{fmtRupees(r.total_cost)}</b> · {fmtDate(r.import_date)}
                    {r.supplier_name ? ` · ${t('buy.from', { name: r.supplier_name })}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
