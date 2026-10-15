import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useLoad } from '../hooks.js';
import { useLang } from '../i18n.jsx';
import { useToast } from '../components/Toast.jsx';
import { ChoiceList, ConfirmDelete, Empty, ErrorBox, Loading, Modal, PageHeader, RowActions, Segmented } from '../components/ui.jsx';
import { addDays, errMsg, fmtDate, fmtKg, fmtRupees, num, searchRows, todayStr, typeKey, typeLabel } from '../utils.js';

// Pop-up form to change an existing sale
function EditSale({ row, customers, stock, onClose, onSaved }) {
  const { t } = useLang();
  const toast = useToast();
  const [bill, setBill] = useState(row.bill_no || '');
  const [customerId, setCustomerId] = useState(String(row.customer_id));
  const [material, setMaterial] = useState(row.material_type);
  const [sub, setSub] = useState(row.sub_type);
  const [qty, setQty] = useState(String(Number(row.quantity_kg)));
  const [rate, setRate] = useState(String(Number(row.rate_per_kg)));
  const [saleDate, setSaleDate] = useState(String(row.sale_date).slice(0, 10));
  const [dueDate, setDueDate] = useState(String(row.due_date).slice(0, 10));
  const [busy, setBusy] = useState(false);

  const suggestions = [...new Set((stock || []).filter((r) => r.material_type === material).map((r) => r.sub_type))];
  const total = num(qty) * num(rate);
  const ready = customerId && material && sub.trim() && num(qty) > 0 && num(rate) > 0 && saleDate && dueDate;

  async function save(e) {
    e.preventDefault();
    if (!ready) return toast(t('common.fillAll'), 'err');
    setBusy(true);
    try {
      await api.updateSale(row.id, {
        customer_id: Number(customerId),
        bill_no: bill.trim() || undefined,
        material_type: material,
        sub_type: sub.trim(),
        quantity_kg: num(qty),
        rate_per_kg: num(rate),
        sale_date: saleDate,
        due_date: dueDate
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
    <Modal title={t('sell.editTitle')} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <label className="field">
          <span>
            {t('sell.bill')} <em>{t('common.optional')}</em>
          </span>
          <input value={bill} onChange={(e) => setBill(e.target.value)} autoComplete="off" />
        </label>
        <label className="field">
          <span>{t('sell.customer')}</span>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
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
          <input list="edit-sale-types" value={sub} onChange={(e) => setSub(e.target.value)} autoComplete="off" />
          <datalist id="edit-sale-types">
            {suggestions.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </label>
        <div className="two">
          <label className="field">
            <span>{t('sell.qty')}</span>
            <input type="number" inputMode="decimal" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
          </label>
          <label className="field">
            <span>{t('sell.rate')}</span>
            <input type="number" inputMode="decimal" min="0" step="any" value={rate} onChange={(e) => setRate(e.target.value)} />
          </label>
        </div>
        {total > 0 && (
          <div className="summary">
            = <b>{fmtRupees(total)}</b>
          </div>
        )}
        <label className="field">
          <span>{t('sell.date')}</span>
          <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
        </label>
        <label className="field">
          <span>{t('sell.dueDate')}</span>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <button className="btn" disabled={busy}>
          {busy ? '…' : `✔ ${t('common.saveChanges')}`}
        </button>
      </form>
    </Modal>
  );
}

export default function Sell() {
  const { t } = useLang();
  const toast = useToast();
  const stockQ = useLoad(api.stock, []);
  const custQ = useLoad(api.customers, []);
  const listQ = useLoad(() => api.sales(), []);

  const [bill, setBill] = useState('');
  const [find, setFind] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [nc, setNc] = useState({ name: '', phone: '', email: '' });
  const [pick, setPick] = useState('');
  const [qty, setQty] = useState('');
  const [rate, setRate] = useState('');
  const [saleDate, setSaleDate] = useState(todayStr());
  const [dueMode, setDueMode] = useState('15');
  const [customDue, setCustomDue] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [delBusy, setDelBusy] = useState(false);

  if (stockQ.loading && !stockQ.data) return <Loading />;
  if (stockQ.error && !stockQ.data) return <ErrorBox error={stockQ.error} onRetry={stockQ.reload} />;

  const customers = custQ.data || [];
  const products = stockQ.data.filter((r) => num(r.finished_stock_in_hand_kg) > 0);
  const selected = products.find((r) => typeKey(r) === pick);
  const available = selected ? num(selected.finished_stock_in_hand_kg) : 0;
  const dueDate = dueMode === 'custom' ? customDue : addDays(saleDate, Number(dueMode));
  const customerName = isNew ? nc.name.trim() : (customers.find((c) => String(c.id) === customerId) || {}).name;
  const total = num(qty) * num(rate);
  const ready = selected && customerName && num(qty) > 0 && num(rate) > 0 && saleDate && dueDate;
  const shown = listQ.data
    ? searchRows(listQ.data, find, (s) => [s.bill_no, s.customer_name, s.sub_type, s.material_type].join(' '))
    : [];

  async function doDelete() {
    setDelBusy(true);
    try {
      await api.deleteSale(deleting.id);
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
    if (isNew ? !nc.name.trim() : !customerId) return toast(isNew ? t('cust.nameReq') : t('sell.needCustomer'), 'err');
    if (!selected) return toast(t('sell.needProduct'), 'err');
    if (!ready) return toast(t('common.fillAll'), 'err');
    if (num(qty) > available) return toast(t('common.onlyHave', { qty: fmtKg(available) }), 'err');

    setBusy(true);
    try {
      let cid = customerId;
      if (isNew) {
        const c = await api.addCustomer({
          name: nc.name.trim(),
          phone: nc.phone.trim() || undefined,
          email: nc.email.trim() || undefined
        });
        cid = String(c.id);
        // Switch to the saved customer straight away so a retry never creates a duplicate.
        setCustomerId(cid);
        setIsNew(false);
        setNc({ name: '', phone: '', email: '' });
        custQ.reload();
      }
      await api.addSale({
        customer_id: Number(cid),
        bill_no: bill.trim() || undefined,
        material_type: selected.material_type,
        sub_type: selected.sub_type,
        quantity_kg: num(qty),
        rate_per_kg: num(rate),
        sale_date: saleDate,
        due_date: dueDate
      });
      toast(
        t('sell.done', { qty: fmtKg(qty), type: typeLabel(t, selected.material_type, selected.sub_type), name: customerName })
      );
      setQty('');
      setRate('');
      setBill('');
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
      <PageHeader icon="🧾" title={t('sell.title')} sub={t('sell.sub')} />

      {products.length === 0 ? (
        <Empty text={t('sell.none')}>
          <Link to="/process" className="btn">
            {t('sell.goProcess')}
          </Link>
        </Empty>
      ) : (
        <form className="form" onSubmit={submit}>
          <label className="field">
            <span>
              {t('sell.bill')} <em>{t('common.optional')}</em>
            </span>
            <input value={bill} onChange={(e) => setBill(e.target.value)} autoComplete="off" />
          </label>

          <div className="field">
            <span>{t('sell.customer')}</span>
            {isNew ? (
              <div className="newcust">
                <input placeholder={t('sell.custName')} value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} />
                <input
                  type="tel"
                  placeholder={t('sell.custPhone')}
                  value={nc.phone}
                  onChange={(e) => setNc({ ...nc, phone: e.target.value })}
                />
                <input
                  type="email"
                  placeholder={`${t('sell.custEmail')} ${t('common.optional')}`}
                  value={nc.email}
                  onChange={(e) => setNc({ ...nc, email: e.target.value })}
                />
                <button type="button" className="link-btn" onClick={() => setIsNew(false)}>
                  {t('sell.existing')}
                </button>
              </div>
            ) : (
              <>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">{t('sell.pickCustomer')}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button type="button" className="link-btn" onClick={() => setIsNew(true)}>
                  {t('sell.newCustomer')}
                </button>
              </>
            )}
          </div>

          <div className="field">
            <span>{t('sell.pick')}</span>
            <ChoiceList
              value={pick}
              onChange={setPick}
              options={products.map((r) => ({
                key: typeKey(r),
                title: `${r.material_type === 'WOOL' ? '🐑' : '🌿'} ${typeLabel(t, r.material_type, r.sub_type)}`,
                sub: t('proc.available', { qty: fmtKg(r.finished_stock_in_hand_kg) })
              }))}
            />
          </div>

          <div className="two">
            <label className="field">
              <span>{t('sell.qty')}</span>
              <input type="number" inputMode="decimal" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
            </label>
            <label className="field">
              <span>{t('sell.rate')}</span>
              <input type="number" inputMode="decimal" min="0" step="any" value={rate} onChange={(e) => setRate(e.target.value)} />
            </label>
          </div>

          <label className="field">
            <span>{t('sell.date')}</span>
            <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
          </label>

          <div className="field">
            <span>{t('sell.dueIn')}</span>
            <Segmented
              value={dueMode}
              onChange={setDueMode}
              options={[
                ...['7', '15', '30', '45'].map((n) => ({ value: n, label: t('sell.days', { n }) })),
                { value: 'custom', label: t('sell.custom') }
              ]}
            />
            {dueMode === 'custom' && <input type="date" value={customDue} onChange={(e) => setCustomDue(e.target.value)} />}
            {dueDate && (
              <div className="hint">
                📅 {t('sell.dueDate')}: <b>{fmtDate(dueDate)}</b>
              </div>
            )}
          </div>

          {ready && (
            <div className="summary">
              {t('sell.summary', {
                qty: fmtKg(qty),
                type: typeLabel(t, selected.material_type, selected.sub_type),
                name: customerName,
                rate: fmtRupees(rate),
                total: fmtRupees(total),
                date: fmtDate(dueDate)
              })}
            </div>
          )}

          <button className="btn" disabled={busy}>
            {busy ? '…' : `✔ ${t('sell.btn')}`}
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
          <input className="search" placeholder={`🔍 ${t('sell.search')}`} value={find} onChange={(e) => setFind(e.target.value)} />
          {shown.length === 0 ? (
            <Empty text={t('common.noMatch')} />
          ) : (
            <div className="cards">
              {shown.map((s) => (
                <div className="card" key={s.id}>
                  <div className="card-title">
                    {s.customer_name} · {typeLabel(t, s.material_type, s.sub_type)}
                  </div>
                  <div className="meta">
                    {s.bill_no && (
                      <>
                        <span className="tag">{t('sell.billShort', { no: s.bill_no })}</span> ·{' '}
                      </>
                    )}
                    {t('sell.line', { qty: fmtKg(s.quantity_kg), rate: fmtRupees(s.rate_per_kg), total: fmtRupees(s.total_amount) })} ·{' '}
                    {fmtDate(s.sale_date)} · {t('sell.due', { date: fmtDate(s.due_date) })}
                  </div>
                  <RowActions onEdit={() => setEditing(s)} onDelete={() => setDeleting(s)} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {editing && (
        <EditSale
          row={editing}
          customers={customers}
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
            {deleting.customer_name} · {fmtKg(deleting.quantity_kg)} {typeLabel(t, deleting.material_type, deleting.sub_type)} ·{' '}
            {fmtRupees(deleting.total_amount)} · {fmtDate(deleting.sale_date)}
          </p>
          {num(deleting.paid_amount) > 0 && (
            <p className="summary bad">{t('sell.payWarn', { amount: fmtRupees(deleting.paid_amount) })}</p>
          )}
        </ConfirmDelete>
      )}
    </>
  );
}
