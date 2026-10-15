import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useLoad } from '../hooks.js';
import { useLang } from '../i18n.jsx';
import { useToast } from '../components/Toast.jsx';
import { ChoiceList, ConfirmDelete, Empty, ErrorBox, Loading, Modal, PageHeader, RowActions, Segmented } from '../components/ui.jsx';
import { errMsg, fmtDate, fmtKg, fmtRupees, num, searchRows, todayStr, typeKey, typeLabel } from '../utils.js';

// Pop-up form to change an existing processing entry
function EditBatch({ row, stock, onClose, onSaved }) {
  const { t } = useLang();
  const toast = useToast();
  const [material, setMaterial] = useState(row.material_type);
  const [sub, setSub] = useState(row.sub_type);
  const [batch, setBatch] = useState(row.batch_no || '');
  const [inQty, setInQty] = useState(String(Number(row.input_qty_kg)));
  const [outQty, setOutQty] = useState(String(Number(row.output_qty_kg)));
  const [cost, setCost] = useState(String(Number(row.processing_cost) || ''));
  const [date, setDate] = useState(String(row.processing_date).slice(0, 10));
  const [busy, setBusy] = useState(false);

  const suggestions = [...new Set((stock || []).filter((r) => r.material_type === material).map((r) => r.sub_type))];
  const waste = num(inQty) - num(outQty);
  const wastePct = num(inQty) > 0 ? ((waste / num(inQty)) * 100).toFixed(1) : '0';
  const ready = material && sub.trim() && num(inQty) > 0 && num(outQty) > 0 && date;

  async function save(e) {
    e.preventDefault();
    if (!ready) return toast(t('common.fillAll'), 'err');
    if (num(outQty) > num(inQty)) return toast(t('proc.outTooMuch'), 'err');
    setBusy(true);
    try {
      await api.updateProcessing(row.id, {
        material_type: material,
        sub_type: sub.trim(),
        batch_no: batch.trim() || undefined,
        input_qty_kg: num(inQty),
        output_qty_kg: num(outQty),
        processing_cost: num(cost),
        processing_date: date
      });
      toast(t('common.edited'));
      onSaved();
    } catch (err) {
      toast(errMsg(err, t), 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={t('proc.editTitle')} onClose={onClose}>
      <form className="form" onSubmit={save}>
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
          <input list="edit-proc-types" value={sub} onChange={(e) => setSub(e.target.value)} autoComplete="off" />
          <datalist id="edit-proc-types">
            {suggestions.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>
            {t('proc.batch')} <em>{t('common.optional')}</em>
          </span>
          <input value={batch} onChange={(e) => setBatch(e.target.value)} autoComplete="off" />
        </label>
        <label className="field">
          <span>{t('proc.in')}</span>
          <input type="number" inputMode="decimal" min="0" step="any" value={inQty} onChange={(e) => setInQty(e.target.value)} />
        </label>
        <label className="field">
          <span>{t('proc.out')}</span>
          <input type="number" inputMode="decimal" min="0" step="any" value={outQty} onChange={(e) => setOutQty(e.target.value)} />
        </label>
        {num(inQty) > 0 && num(outQty) > 0 && (
          <div className={`summary ${waste < 0 ? 'bad' : ''}`}>
            {waste < 0 ? t('proc.outTooMuch') : t('proc.waste', { qty: fmtKg(waste), pct: wastePct })}
          </div>
        )}
        <label className="field">
          <span>
            {t('proc.cost')} <em>{t('common.optional')}</em>
          </span>
          <input type="number" inputMode="decimal" min="0" step="any" value={cost} onChange={(e) => setCost(e.target.value)} />
        </label>
        <label className="field">
          <span>{t('proc.date')}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <button className="btn" disabled={busy}>
          {busy ? '…' : `✔ ${t('common.saveChanges')}`}
        </button>
      </form>
    </Modal>
  );
}

export default function Process() {
  const { t } = useLang();
  const toast = useToast();
  const stockQ = useLoad(api.stock, []);
  const listQ = useLoad(api.processing, []);

  const [pick, setPick] = useState('');
  const [batch, setBatch] = useState('');
  const [find, setFind] = useState('');
  const [inQty, setInQty] = useState('');
  const [outQty, setOutQty] = useState('');
  const [cost, setCost] = useState('');
  const [date, setDate] = useState(todayStr());
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [delBusy, setDelBusy] = useState(false);

  if (stockQ.loading && !stockQ.data) return <Loading />;
  if (stockQ.error && !stockQ.data) return <ErrorBox error={stockQ.error} onRetry={stockQ.reload} />;

  const options = stockQ.data.filter((r) => num(r.raw_stock_remaining_kg) > 0);
  const selected = options.find((r) => typeKey(r) === pick);
  const available = selected ? num(selected.raw_stock_remaining_kg) : 0;
  const waste = num(inQty) - num(outQty);
  const wastePct = num(inQty) > 0 ? ((waste / num(inQty)) * 100).toFixed(1) : '0';
  const ready = selected && num(inQty) > 0 && num(outQty) > 0 && date;
  const shown = listQ.data
    ? searchRows(listQ.data, find, (r) => [r.batch_no, r.sub_type, r.material_type].join(' '))
    : [];

  async function doDelete() {
    setDelBusy(true);
    try {
      await api.deleteProcessing(deleting.id);
      toast(t('common.deleted'));
      setDeleting(null);
      listQ.reload();
      stockQ.reload();
    } catch (err) {
      toast(errMsg(err, t), 'err');
    } finally {
      setDelBusy(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!selected) return toast(t('proc.pickFirst'), 'err');
    if (!ready) return toast(t('common.fillAll'), 'err');
    if (num(inQty) > available) return toast(t('common.onlyHave', { qty: fmtKg(available) }), 'err');
    if (num(outQty) > num(inQty)) return toast(t('proc.outTooMuch'), 'err');

    setBusy(true);
    try {
      await api.addProcessing({
        material_type: selected.material_type,
        sub_type: selected.sub_type,
        batch_no: batch.trim() || undefined,
        input_qty_kg: num(inQty),
        output_qty_kg: num(outQty),
        processing_cost: num(cost),
        processing_date: date
      });
      toast(t('proc.done', { qty: fmtKg(outQty), type: typeLabel(t, selected.material_type, selected.sub_type) }));
      setInQty('');
      setOutQty('');
      setCost('');
      setBatch('');
      setPick('');
      stockQ.reload();
      listQ.reload();
    } catch (err) {
      toast(errMsg(err, t), 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader icon="⚙️" title={t('proc.title')} sub={t('proc.sub')} />

      {options.length === 0 ? (
        <Empty text={t('proc.none')}>
          <Link to="/buy" className="btn">
            {t('proc.goBuy')}
          </Link>
        </Empty>
      ) : (
        <form className="form" onSubmit={submit}>
          <div className="field">
            <span>{t('proc.pick')}</span>
            <ChoiceList
              value={pick}
              onChange={setPick}
              options={options.map((r) => ({
                key: typeKey(r),
                title: `${r.material_type === 'WOOL' ? '🐑' : '🌿'} ${typeLabel(t, r.material_type, r.sub_type)}`,
                sub: t('proc.available', { qty: fmtKg(r.raw_stock_remaining_kg) })
              }))}
            />
          </div>

          <label className="field">
            <span>
              {t('proc.batch')} <em>{t('common.optional')}</em>
            </span>
            <input value={batch} onChange={(e) => setBatch(e.target.value)} autoComplete="off" />
          </label>

          <label className="field">
            <span>{t('proc.in')}</span>
            <div className="with-btn">
              <input type="number" inputMode="decimal" min="0" step="any" value={inQty} onChange={(e) => setInQty(e.target.value)} />
              {selected && (
                <button type="button" className="btn small secondary" onClick={() => setInQty(String(available))}>
                  {t('common.useAll')}
                </button>
              )}
            </div>
          </label>

          <label className="field">
            <span>{t('proc.out')}</span>
            <input type="number" inputMode="decimal" min="0" step="any" value={outQty} onChange={(e) => setOutQty(e.target.value)} />
          </label>

          {num(inQty) > 0 && num(outQty) > 0 && (
            <div className={`summary ${waste < 0 ? 'bad' : ''}`}>
              {waste < 0 ? t('proc.outTooMuch') : t('proc.waste', { qty: fmtKg(waste), pct: wastePct })}
            </div>
          )}

          <label className="field">
            <span>
              {t('proc.cost')} <em>{t('common.optional')}</em>
            </span>
            <input type="number" inputMode="decimal" min="0" step="any" value={cost} onChange={(e) => setCost(e.target.value)} />
          </label>

          <label className="field">
            <span>{t('proc.date')}</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>

          {ready && waste >= 0 && (
            <div className="summary">
              {t('proc.summary', {
                in: fmtKg(inQty),
                out: fmtKg(outQty),
                type: typeLabel(t, selected.material_type, selected.sub_type)
              })}
            </div>
          )}

          <button className="btn" disabled={busy}>
            {busy ? '…' : `✔ ${t('proc.btn')}`}
          </button>
        </form>
      )}

      <h2 className="section">{t('common.recent')}</h2>
      {listQ.loading && !listQ.data ? (
        <Loading />
      ) : listQ.error && !listQ.data ? (
        <ErrorBox error={listQ.error} onRetry={listQ.reload} />
      ) : listQ.data.length === 0 ? (
        <Empty text={t('common.nothing')} />
      ) : (
        <>
          <input className="search" placeholder={`🔍 ${t('proc.search')}`} value={find} onChange={(e) => setFind(e.target.value)} />
          {shown.length === 0 ? (
            <Empty text={t('common.noMatch')} />
          ) : (
            <div className="cards">
              {shown.map((r) => (
                <div className="card" key={r.id}>
                  <div className="card-title">{typeLabel(t, r.material_type, r.sub_type)}</div>
                  <div className="meta">
                    {r.batch_no && (
                      <>
                        <span className="tag">{t('proc.batchShort', { no: r.batch_no })}</span> ·{' '}
                      </>
                    )}
                    {t('proc.line', { in: fmtKg(r.input_qty_kg), out: fmtKg(r.output_qty_kg), waste: fmtKg(r.wastage_kg) })}
                    {num(r.processing_cost) > 0 ? ` · ${t('proc.costLine', { cost: fmtRupees(r.processing_cost) })}` : ''} ·{' '}
                    {fmtDate(r.processing_date)}
                  </div>
                  <RowActions onEdit={() => setEditing(r)} onDelete={() => setDeleting(r)} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {editing && (
        <EditBatch
          row={editing}
          stock={stockQ.data}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            listQ.reload();
            stockQ.reload();
          }}
        />
      )}

      {deleting && (
        <ConfirmDelete busy={delBusy} onCancel={() => setDeleting(null)} onConfirm={doDelete}>
          <p className="confirm-what">
            {typeLabel(t, deleting.material_type, deleting.sub_type)} · {fmtKg(deleting.input_qty_kg)} → {fmtKg(deleting.output_qty_kg)} · {fmtDate(deleting.processing_date)}
          </p>
        </ConfirmDelete>
      )}
    </>
  );
}
