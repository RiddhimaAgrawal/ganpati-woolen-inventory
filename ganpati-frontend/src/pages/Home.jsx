
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useLoad } from '../hooks.js';
import { useLang } from '../i18n.jsx';
import { Empty, ErrorBox, Loading, PageHeader } from '../components/ui.jsx';
import ExportCard from '../components/ExportCard.jsx';
import { fmtKg, num, typeKey, typeLabel } from '../utils.js';

export default function Home() {
  const { t } = useLang();
  const { data: stock, error, loading, reload } = useLoad(
    () => api.stock(),
    []
  );

  if (loading && !stock) return <Loading />;
  if (error && !stock) return <ErrorBox error={error} onRetry={reload} />;

  const sum = (key) =>
    stock.reduce((total, row) => total + num(row[key]), 0);

  const cards = [
    {
      icon: '📦',
      label: t('home.raw'),
      value: fmtKg(sum('raw_stock_remaining_kg'))
    },
    {
      icon: '🧶',
      label: t('home.ready'),
      value: fmtKg(sum('finished_stock_in_hand_kg'))
    },
    {
      icon: '🧾',
      label: t('home.sold'),
      value: fmtKg(sum('total_sold_kg'))
    }
  ];

  const actions = [
    { to: '/buy', icon: '📥', label: t('home.actBuy') },
    { to: '/process', icon: '⚙️', label: t('home.actProcess') },
    { to: '/sell', icon: '🧾', label: t('home.actSell') },
    { to: '/customers', icon: '👥', label: t('nav.customers') }
  ];

  return (
    <>
      <PageHeader icon="🏠" title={t('home.title')} />

      <div className="stats">
        {cards.map((card) => (
          <div key={card.label} className="stat">
            <div className="stat-ico">{card.icon}</div>
            <div className="stat-val">{card.value}</div>
            <div className="stat-lbl">{card.label}</div>
          </div>
        ))}
      </div>

      <h2 className="section">{t('home.quick')}</h2>
      <div className="actions">
        {actions.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="action"
          >
            <span className="action-ico">{action.icon}</span>
            <span>{action.label}</span>
          </Link>
        ))}
      </div>

      <h2 className="section">📊 {t('export.title')}</h2>
      <ExportCard />

      <h2 className="section">{t('home.byType')}</h2>

      {stock.length === 0 ? (
        <Empty text={t('home.empty')}>
          <Link to="/buy" className="btn">
            {t('home.actBuy')}
          </Link>
        </Empty>
      ) : (
        <div className="cards">
          {stock.map((row) => (
            <div className="card" key={typeKey(row)}>
              <div className="card-title">
                {row.material_type === 'WOOL' ? '🐑' : '🌿'}{' '}
                {typeLabel(t, row.material_type, row.sub_type)}
              </div>

              <div className="trio">
                <div>
                  <b>{fmtKg(row.raw_stock_remaining_kg)}</b>
                  <span>{t('home.waiting')}</span>
                </div>
                <div>
                  <b>{fmtKg(row.finished_stock_in_hand_kg)}</b>
                  <span>{t('home.readyShort')}</span>
                </div>
                <div>
                  <b>{fmtKg(row.total_sold_kg)}</b>
                  <span>{t('home.soldShort')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
