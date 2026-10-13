# Ganpati Woolen Industries — Frontend (React + Vite)

```bash
npm install
npm run dev        # http://localhost:5173  (expects the API on http://localhost:5000)
npm run build      # outputs dist/, which the Express backend serves automatically
```

- `src/api.js` — the only file that talks to the backend
- `src/i18n.jsx` — all English + Hindi text (add a key in both languages to add new text)
- `src/pages/` — Home, BuyMaterial, Process, Sell, Money, Customers
- `src/components/` — Layout, Toast, shared UI pieces
- Set `VITE_API_URL` (see `.env.example`) only if the API runs somewhere other than port 5000 during development.
