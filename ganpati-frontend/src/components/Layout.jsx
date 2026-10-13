import { NavLink, Outlet } from 'react-router-dom';
import { useLang } from '../i18n.jsx';

const items = [
  { to: '/', icon: '🏠', key: 'nav.home', end: true },
  { to: '/buy', icon: '📥', key: 'nav.buy' },
  { to: '/process', icon: '⚙️', key: 'nav.process' },
  { to: '/sell', icon: '🧾', key: 'nav.sell' },
  { to: '/customers', icon: '👥', key: 'nav.customers' },
  { to: '/account', icon: '👤', key: 'nav.account' }
];

export default function Layout() {
  const { t, lang, setLang } = useLang();

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">🐑</span>
          <span>{t('app.name')}</span>
        </div>
        <button className="lang" onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}>
          {lang === 'en' ? 'हिंदी' : 'English'}
        </button>
      </header>

      <nav className="nav">
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span className="ico">{i.icon}</span>
            <span className="lbl">{t(i.key)}</span>
          </NavLink>
        ))}
      </nav>

      <main className="content">
        <div className="page">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
