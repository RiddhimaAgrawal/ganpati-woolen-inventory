import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useLoad } from '../hooks.js';
import { useLang } from '../i18n.jsx';
import { useToast } from '../components/Toast.jsx';
import { ErrorBox, Loading, Modal, PageHeader } from '../components/ui.jsx';
import { errMsg } from '../utils.js';

function ChangePassword() {
  const { t } = useLang();
  const toast = useToast();
  const { replaceSession } = useAuth();
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (pw.length < 6) return toast(t('acct.pwShort'), 'err');
    if (pw !== again) return toast(t('acct.pwMismatch'), 'err');
    setBusy(true);
    try {
      replaceSession(await api.changePassword(cur, pw));
      toast(t('acct.pwDone'));
      setCur('');
      setPw('');
      setAgain('');
    } catch (err) {
      toast(errMsg(err, t), 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <h2 className="section tight">{t('acct.changePw')}</h2>
      <label className="field">
        <span>{t('acct.currentPw')}</span>
        <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
      </label>
      <label className="field">
        <span>{t('acct.newPw')}</span>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
      </label>
      <label className="field">
        <span>{t('acct.confirmPw')}</span>
        <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" />
      </label>
      <button className="btn" disabled={busy}>
        {busy ? '…' : `✔ ${t('acct.savePw')}`}
      </button>
    </form>
  );
}

function Team({ me }) {
  const { t } = useLang();
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(api.users, []);
  const [form, setForm] = useState({ name: '', username: '', password: '', is_admin: false });
  const [busy, setBusy] = useState(false);
  const [resetFor, setResetFor] = useState(null);
  const [removeFor, setRemoveFor] = useState(null);
  const [newPw, setNewPw] = useState('');

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function add(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.username.trim() || !form.password) return toast(t('common.fillAll'), 'err');
    setBusy(true);
    try {
      await api.addUser({ ...form, name: form.name.trim(), username: form.username.trim() });
      toast(t('team.added', { name: form.name.trim() }));
      setForm({ name: '', username: '', password: '', is_admin: false });
      reload();
    } catch (err) {
      toast(errMsg(err, t), 'err');
    } finally {
      setBusy(false);
    }
  }

  async function doReset(e) {
    e.preventDefault();
    if (newPw.length < 6) return toast(t('acct.pwShort'), 'err');
    try {
      await api.resetUserPassword(resetFor.id, newPw);
      toast(t('team.resetDone', { name: resetFor.name }));
      setResetFor(null);
      setNewPw('');
    } catch (err) {
      toast(errMsg(err, t), 'err');
    }
  }

  async function doRemove() {
    try {
      await api.removeUser(removeFor.id);
      toast(t('team.removed', { name: removeFor.name }));
      setRemoveFor(null);
      reload();
    } catch (err) {
      toast(errMsg(err, t), 'err');
      setRemoveFor(null);
    }
  }

  return (
    <>
      <h2 className="section">{t('team.title')}</h2>
      <p className="hint">{t('team.sub')}</p>

      {loading && !data ? (
        <Loading />
      ) : error && !data ? (
        <ErrorBox error={error} onRetry={reload} />
      ) : (
        <div className="cards team-list">
          {data.map((u) => (
            <div className="card" key={u.id}>
              <div className="row">
                <div>
                  <div className="card-title">
                    {u.name} {u.id === me.id && <span className="hint">{t('team.you')}</span>}
                  </div>
                  <div className="meta">
                    {u.username} {u.is_admin && <span className="tag">{t('team.adminTag')}</span>}
                  </div>
                </div>
              </div>
              <div className="btn-row">
                <button className="btn small secondary" onClick={() => { setResetFor(u); setNewPw(''); }}>
                  🔑 {t('team.reset')}
                </button>
                {u.id !== me.id && (
                  <button className="btn small secondary danger-btn" onClick={() => setRemoveFor(u)}>
                    🗑 {t('team.remove')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <form className="form add-person" onSubmit={add}>
        <h2 className="section">{t('team.add')}</h2>
        <label className="field">
          <span>{t('team.name')}</span>
          <input value={form.name} onChange={set('name')} />
        </label>
        <label className="field">
          <span>{t('team.username')}</span>
          <input value={form.username} onChange={set('username')} autoCapitalize="none" autoCorrect="off" />
        </label>
        <label className="field">
          <span>{t('team.password')}</span>
          <input type="text" value={form.password} onChange={set('password')} autoComplete="off" />
        </label>
        <label className="check">
          <input type="checkbox" checked={form.is_admin} onChange={set('is_admin')} />
          <span>{t('team.admin')}</span>
        </label>
        <button className="btn" disabled={busy}>
          {busy ? '…' : `✔ ${t('team.addBtn')}`}
        </button>
      </form>

      {resetFor && (
        <Modal title={t('team.resetTitle', { name: resetFor.name })} onClose={() => setResetFor(null)}>
          <form className="form" onSubmit={doReset}>
            <label className="field">
              <span>{t('acct.newPw')}</span>
              <input type="text" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="off" autoFocus />
            </label>
            <button className="btn">✔ {t('acct.savePw')}</button>
          </form>
        </Modal>
      )}

      {removeFor && (
        <Modal title={t('team.remove')} onClose={() => setRemoveFor(null)}>
          <div className="form">
            <p>{t('team.removeConfirm', { name: removeFor.name })}</p>
            <div className="btn-row">
              <button className="btn secondary" onClick={() => setRemoveFor(null)}>
                {t('common.cancel')}
              </button>
              <button className="btn danger-solid" onClick={doRemove}>
                {t('team.remove')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export default function Account() {
  const { t } = useLang();
  const { user, logout } = useAuth();

  return (
    <>
      <PageHeader icon="👤" title={t('acct.title')} sub={t('acct.hello', { name: user.name })} />
      <button className="btn secondary logout" onClick={logout}>
        ⎋ {t('acct.logout')}
      </button>
      <div className="spacer" />
      <ChangePassword />
      {user.is_admin && <Team me={user} />}
    </>
  );
}
