# WMS NK — Ghid pentru asistenți AI și contribuitori

## Comenzi esențiale

### Pornire sistem
```bash
docker-compose up -d          # Pornire toate serviciile
docker-compose down           # Oprire
make logs                     # Urmărire log-uri
```

### Rulare frontend (development)
```bash
cd frontend/web_ui && npm run dev    # Vite dev server → localhost:5173
```

### Rulare serviciu backend (development)
```bash
cd services/<serviciu> && node src/index.js   # sau npm run dev
```

### Teste
```bash
cd services/warehouse-config && npm test      # Suite Jest completă
cd services/inventory && node test-lot-parser.js
```

---

## Convenții cod

### Servicii backend (Node.js/Express)
- **Entry point:** `src/index.js` sau `src/app.js`
- **Structura:** `controllers/` → `routes/` → `middleware/` → `services/` → `utils/`
- **Logging:** Winston (`utils/logger.js` în fiecare serviciu)
- **Validare:** Joi pentru toate input-urile externe
- **Autentificare:** JWT verificat în `middleware/auth.js` din fiecare serviciu
- **Baza de date:** Pool PostgreSQL (`config/database.js`), nu ORM
- **Erori:** Handler centralizat în `middleware/errorHandler.js`

### Frontend (React/TypeScript)
- **O pagină per feature** în `pages/` — nu componente mega-monolitice
- **API calls** exclusiv prin fișierele din `services/*.service.ts`
- **Auth:** `useAuth()` hook → `AuthContextShared.ts` ca sursă de adevăr
- **State management:** React Context (nu Redux sau Zustand)
- **UI:** Material UI 7 — nu mixați cu alte biblioteci CSS

### Migrații SQL
- Fișiere în `database/migrations/` cu prefix numeric secvențial: `NNN_descriere.sql`
- Sufixele `a/b/c` pentru variante ale aceluiași număr (ex: `015b_create_location_types.sql`)
- Niciodată modificați o migrație existentă — adăugați una nouă

---

## Arhitectura serviciilor

| Serviciu | Port | Director |
|---------|------|---------|
| auth | 3010 | `services/auth/` |
| inventory | 3011 | `services/inventory/` |
| scanner-service | 3012 | `services/scanner-service/` |
| cutting-service | 3013 | `services/cutting-service/` |
| sewing-service | 3014 | `services/sewing-service/` |
| quality-control-service | 3015 | `services/quality-control-service/` |
| shipments-service | 3016 | `services/shipments-service/` |
| notifications-service | 3017 | `services/notifications-service/` |
| erp-connector | 3018 | `services/erp-connector/` |
| warehouse-config | 3020 | `services/warehouse-config/` |

**Documentație arhitectură completă:** `docs/ARCHITECTURE.md`

---

## Variabile de mediu critice

Copiați `.env.example` → `.env` și completați:

| Variabilă | Unde | Importanță |
|-----------|------|-----------|
| `JWT_SECRET` | auth, warehouse-config | **Schimbați în producție!** |
| `PLURIVA_API_KEY` | erp-connector | Cheia ERP Pluriva |
| `DB_PASSWORD` | toate | Default: `wms_secure_pass_2025` în dev |

---

## Ce NU faceți

- NU adăugați fișiere `.md` în `frontend/web_ui/src/pages/` — documentele merg în `docs/`
- NU creați servicii noi fără implementare (foldere goale)
- NU committeti `token.txt`, `*.pdf` temporare, `dist/`, `node_modules/`
- NU duplicați controllere între servicii (inventory-service vs inventory — **inventory** e cel activ)
- NU hardcodați credențiale în codul sursă (ex: parole în scripturi)
