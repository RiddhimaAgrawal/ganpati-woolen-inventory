import { useState } from 'react';
import { api } from '../api.js';
import { useLoad } from '../hooks.js';
import { useLang } from '../i18n.jsx';
import { useToast } from '../components/Toast.jsx';
import { ConfirmDelete, Empty, ErrorBox, Loading, Modal, PageHeader, RowActions } from '../components/ui.jsx';
import { errMsg, telLink } from '../utils.js';

// Pop-up form to change a customer's details
function EditCustomer({ row, onClose, onSaved }) {
  const { t } = useLang();
  const toast = useToast();
  const [form, setForm] = useState({
    name: row.name || '',
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || ''
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    if (!form.name.trim()) return toast(t('cust.nameReq'), 'err');
    setBusy(true);
    try {
      await api.updateCustomer(row.id, {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined
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
    <Modal title={t('cust.editTitle')} onClose={onClose}>
      <form className="form" onSubmit={save}>
        <label className="field">
          <span>{t('cust.name')}</span>
          <input value={form.name} onChange={set('name')} />
        </label>
        <div className="two">
          <label className="field">
            <span>
              {t('cust.phone')} <em>{t('common.optional')}</em>
            </span>
            <input type="tel" value={form.phone} onChange={set('phone')} />
          </label>
          <label className="field">
            <span>
              {t('cust.email')} <em>{t('common.optional')}</em>
            </span>
            <input type="email" value={form.email} onChange={set('email')} />
          </label>
        </div>
        <label className="field">
          <span>
            {t('cust.address')} <em>{t('common.optional')}</em>
          </span>
          <input value={form.address} onChange={set('address')} />
        </label>
        <button className="btn" disabled={busy}>
          {busy ? '…' : `✔ ${t('common.saveChanges')}`}
        </button>
      </form>
    </Modal>
  );
}

export default function Customers() {
  const { t } = useLang();
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(api.customers, []);

  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' });
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [delBusy, setDelBusy] = useState(false);

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;

  const list = data.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()));

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return toast(t('cust.nameReq'), 'err');
    setBusy(true);
    try {
      await api.addCustomer({
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined
      });
      toast(t('cust.done', { name: form.name.trim() }));
      setForm({ name: '', phone: '', email: '', address: '' });
      reload();
    } catch (err) {
      toast(errMsg(err, t), 'err');
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    setDelBusy(true);
    try {
      await api.deleteCustomer(deleting.id);
      toast(t('common.deleted'));
      setDeleting(null);
      reload();
    } catch (err) {
      toast(errMsg(err, t), 'err');
      setDeleting(null);
    } finally {
      setDelBusy(false);
    }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <PageHeader icon="👥" title={t('cust.title')} sub={t('cust.sub')} />

      <form className="form" onSubmit={submit}>
        <h2 className="section tight">{t('cust.add')}</h2>
        <label className="field">
          <span>{t('cust.name')}</span>
          <input value={form.name} onChange={set('name')} />
        </label>
        <div className="two">
          <label className="field">
            <span>
              {t('cust.phone')} <em>{t('common.optional')}</em>
            </span>
            <input type="tel" value={form.phone} onChange={set('phone')} />
          </label>
          <label className="field">
            <span>
              {t('cust.email')} <em>{t('common.optional')}</em>
            </span>
            <input type="email" value={form.email} onChange={set('email')} />
          </label>
        </div>
        <label className="field">
          <span>
            {t('cust.address')} <em>{t('common.optional')}</em>
          </span>
          <input value={form.address} onChange={set('address')} />
        </label>
        <button className="btn" disabled={busy}>
          {busy ? '…' : `✔ ${t('cust.btn')}`}
        </button>
      </form>

      <div className="toolbar spaced">
        <input className="search" placeholder={`🔍 ${t('cust.search')}`} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {list.length === 0 ? (
        <Empty text={t('cust.empty')} />
      ) : (
        <div className="cards">
          {list.map((c) => {
            const tel = telLink(c.phone);
            return (
              <div className="card row" key={c.id}>
                <div>
                  <div className="card-title">{c.name}</div>
                  {(c.phone || c.email) && (
                    <div className="meta">
                      {c.phone || ''}
                      {c.phone && c.email ? ' · ' : ''}
                      {c.email || ''}
                    </div>
                  )}
                  {c.address && <div className="meta">{c.address}</div>}
                  <RowActions onEdit={() => setEditing(c)} onDelete={() => setDeleting(c)} />
                </div>
                {tel && (
                  <a className="btn small secondary" href={tel} aria-label="Call">
                    📞
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <EditCustomer
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}

      {deleting && (
        <ConfirmDelete busy={delBusy} onCancel={() => setDeleting(null)} onConfirm={doDelete}>
          <p className="confirm-what">{deleting.name}</p>
          <p className="hint">{t('cust.deleteWarn')}</p>
        </ConfirmDelete>
      )}
    </>
  );
}
