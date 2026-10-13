import { useLang } from '../i18n.jsx';
import { errMsg } from '../utils.js';

export function Loading() {
  const { t } = useLang();
  return <div className="loading">⏳ {t('common.loading')}</div>;
}

export function ErrorBox({ error, onRetry }) {
  const { t } = useLang();
  return (
    <div className="errorbox">
      <p>⚠️ {errMsg(error, t)}</p>
      {onRetry && (
        <button className="btn secondary" onClick={onRetry}>
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}

export function PageHeader({ icon, title, sub }) {
  return (
    <div className="page-head">
      <h1>
        <span className="ico">{icon}</span> {title}
      </h1>
      {sub && <p>{sub}</p>}
    </div>
  );
}

// Big pill buttons, e.g. Fiber | Wool. options: [{ value, label }]
export function Segmented({ value, onChange, options }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Tap-to-select cards. options: [{ key, title, sub }]
export function ChoiceList({ options, value, onChange }) {
  return (
    <div className="choices">
      {options.map((o) => (
        <button
          type="button"
          key={o.key}
          className={`choice ${value === o.key ? 'active' : ''}`}
          onClick={() => onChange(o.key)}
        >
          <span className="choice-title">{o.title}</span>
          <span className="choice-sub">{o.sub}</span>
        </button>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ text, children }) {
  return (
    <div className="empty">
      <p>{text}</p>
      {children}
    </div>
  );
}
