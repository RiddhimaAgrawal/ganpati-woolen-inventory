import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { ErrorBox } from './components/ui.jsx';
import { useAuth } from './auth.jsx';
import { useLang } from './i18n.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import BuyMaterial from './pages/BuyMaterial.jsx';
import Process from './pages/Process.jsx';
import Sell from './pages/Sell.jsx';
import Customers from './pages/Customers.jsx';
import Account from './pages/Account.jsx';

// Shown while a saved login is being checked. Free hosting puts the server to sleep when nobody
// uses it, so the first visit can take a while: tell the person to wait instead of leaving a blank screen.
function Splash() {
  const { t } = useLang();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className="splash">
      <div className="logo big">🐑</div>
      <div>⏳ {t('common.loading')}</div>
      {slow && <p className="hint">{t('common.waking')}</p>}
    </div>
  );
}

export default function App() {
  const { status, error, retry } = useAuth();

  if (status === 'loading') return <Splash />;
  if (status === 'error') {
    return (
      <div className="splash">
        <ErrorBox error={error} onRetry={retry} />
      </div>
    );
  }
  if (status === 'out') return <Login />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="buy" element={<BuyMaterial />} />
        <Route path="process" element={<Process />} />
        <Route path="sell" element={<Sell />} />
        <Route path="customers" element={<Customers />} />
        <Route path="account" element={<Account />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
