import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { useLang } from '../i18n.jsx';
import { errMsg } from '../utils.js';

export default function Login() {
  const { t, lang, setLang } = useLang();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!username.trim() || !password) return setError(t('login.needBoth'));
    setBusy(true);
    setError('');
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(errMsg(err, t));
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-top">
        <button className="lang" onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}>
          {lang === 'en' ? 'हिंदी' : 'English'}
        </button>
      </div>

      <form className="login-card form" onSubmit={submit}>
        <div className="login-brand">
          <div className="logo">🐑</div>
          <h1>{t('app.name')}</h1>
          <p>{t('login.sub')}</p>
        </div>

        <label className="field">
          <span>{t('login.username')}</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            autoFocus
          />
        </label>

        <label className="field">
          <span>{t('login.password')}</span>
          <div className="with-btn">
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button type="button" className="btn small secondary" onClick={() => setShow(!show)}>
              {show ? t('login.hide') : t('login.show')}
            </button>
          </div>
        </label>

        {error && <div className="summary bad">{error}</div>}

        <button className="btn" disabled={busy}>
          {busy ? '…' : t('login.btn')}
        </button>
      </form>
    </div>
  );
}
