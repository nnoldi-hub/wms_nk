# Plan Enterprise: Sistem Notificare & Asignare Operatori

> **Ultima actualizare:** 18 Martie 2026
> **Stare generală:** Sprint 1 ✅ | Sprint 2 ✅ | Sprint 3 ✅ (partial) | Sprint 4 ✅ (migrație) | Sprint 5 ⏳ | Sprint 6 ⏳

## Starea curentă a infrastructurii (ce există deja)

```
notifications-service (port 3017)
  ├── Socket.IO cu JWT auth ✅
  ├── Room per user: user:{userId} ✅
  ├── Room per rol: role:operator ✅
  └── RabbitMQ consumer: inventory.events ✅

inventory service (port 3011)
  ├── picking_jobs.assigned_to (coloana există) ✅
  ├── picking_jobs.assigned_at (coloana există) ✅
  ├── GET /pick-jobs?mine=1 ✅
  └── POST /pick-jobs/:id/accept ✅
```

**Concluzie:** Nu trebuie construit nimic de la zero.
Trebuie CONECTATE piesele existente + adăugate 3 straturi noi.

---

## Arhitectura țintă

```
┌─────────────────────────────────────────────────────────┐
│  MANAGER (browser desktop)                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Panou Asignare Joburi                           │   │
│  │  • Lista operatori online (prezență live)        │   │
│  │  │   Drag-and-drop job → operator               │   │
│  │  └────────────────────┐                          │   │
│  └───────────────────────│──────────────────────────┘   │
└──────────────────────────│──────────────────────────────┘
                           │ POST /pick-jobs/:id/assign
                           ▼
┌─────────────────────────────────────────────────────────┐
│  inventory-service (3011)                               │
│  UPDATE picking_jobs SET assigned_to=$1, status='ASSIGNED'│
│           │                                              │
│           │ publish → RabbitMQ                          │
│           │ exchange: inventory.events                   │
│           │ routing key: pick-job.assigned               │
│           │ payload: { jobId, operatorId, priority }    │
└───────────│─────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────┐
│  notifications-service (3017)                           │
│  RabbitMQ consumer → io.to(`user:${operatorId}`)        │
│             .emit('job:assigned', { job, priority })    │
└───────────────────────────┬─────────────────────────────┘
                            │ WebSocket (Socket.IO)
                            ▼
┌─────────────────────────────────────────────────────────┐
│  OPERATOR (telefon/tabletă)                             │
│  ┌──────────────────────────────────────────────────┐   │
│  │  useNotifications() hook                         │   │
│  │  • Conectat la ws://…:3017                       │   │
│  │  • La job:assigned → sunet alertă + notif browser│   │
│  │  ├── HUB: badge roșu cu nr. joburi pe CULEGERE  │   │
│  │  └── Banner fullscreen: "JOB NOU ALOCAT!"        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  Operator apasă ACCEPTĂ (30 sec timeout)                │
│           │                                             │
│           │ POST /pick-jobs/:id/accept                  │
└───────────│─────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────┐
│  SLA Monitor (inventory-service)                        │
│  Dacă nu e acceptat în 5 min → notifică managerul       │
│  Dacă nu e acceptat în 10 min → re-asignează automat    │
└─────────────────────────────────────────────────────────┘
```

---

## Tipuri de notificări (toate canalele)

| Eveniment | Canal | Destinatar | Sunet | Prioritate |
|-----------|-------|-----------|-------|-----------|
| Job picking asignat | WebSocket | operator specific | alertă 3 tonuri | !!!  |
| Job urgent | WebSocket + Browser Notification | operator | alarmă | CRITIC |
| Sarcină putaway nouă | WebSocket | role:operator | bing | normal |
| Expediere de pregătit | WebSocket | role:operator | bing | normal |
| Job neacceptat (SLA) | WebSocket | manager | alertă | !! |
| Operator offline la asignare | WebSocket | manager | — | info |

---

## Sprints de implementare

### Sprint 1 — Hook WebSocket + Badge HUB *(~3 ore)* ✅ IMPLEMENTAT
**Fișiere noi:**
- `frontend/web_ui/src/hooks/useNotifications.ts` — conectare Socket.IO la notifications-service, listen job:assigned, badge counts ✅
- `frontend/web_ui/src/hooks/useJobBadge.ts` — polling fallback + WebSocket count

**Modificări:**
- `ScannerModePage.tsx` — badge roșu pe butonul CULEGERE + DEPOZITARE ✅
- `ScannerModePage.tsx` — banner fullscreen "JOB NOU ALOCAT!" cu sunet + dismiss ✅

**Rezultat vizibil:** Operatorul vede badge pe buton + banner imediat la asignare. ✅

---

### Sprint 2 — Backend: publish event la asignare *(~2 ore)* ✅ IMPLEMENTAT
**Modificări:**
- `services/inventory/src/utils/rabbitmqPublisher.js` — publisher singleton RabbitMQ pentru inventory-service ✅ (fișier nou)
- `services/inventory/src/controllers/pickingController.js` — funcția `assignJob` cu publish la RabbitMQ ✅
- `services/notifications-service/src/rabbitmq.js` — handler specific pentru `pick-job.assigned` → emit `job:assigned` pe room `user:{operatorId}` ✅

**Nou endpoint:**
- `POST /api/v1/pick-jobs/:id/assign` — body: `{ operator_id, priority? }` (doar manager/admin) ✅

**Rezultat vizibil:** Manager asignează → operator primește instant pe telefon. ✅

---

### Sprint 3 — Panou Manager: Prezență + Asignare *(~4 ore)* ⏳ PARȚIAL
**Fișiere noi:**
- `frontend/web_ui/src/pages/JobAssignmentPage.tsx` — panou split: joburi pending | operatori online ⏳ (de implementat)

**Funcționalități:**
- Lista operatori conectați (online/offline/ocupat) — din WebSocket presence
- Lista joburi `status=NEW` nealocat
- Click job + click operator → asignare
- Drag-and-drop (opțional, faza 2)
- Indicator "Operatorul a acceptat" în timp real

**Backend:**
- `GET /api/v1/operators/presence` — returnează lista utilizatori cu rol operator și status online (din Socket.IO rooms) ✅
- `notifications-service` expune endpoint HTTP pentru query rooms ✅

---

### Sprint 4 — Acknowledgment + SLA Monitor *(~3 ore)* ✅ MIGRAȚIE IMPLEMENTATĂ
**Logică:**
- La asignare, se setează `accept_deadline = now() + 5min` în DB ✅
- Cron job (sau setInterval) în inventory-service verifică la fiecare minut ⏳ (de implementat)
- Dacă `now() > accept_deadline` și `status = ASSIGNED` (nu IN_PROGRESS):
  - Publică `pick-job.sla-breach` → manager primește alertă ⏳
  - Dacă `now() > accept_deadline + 5min` → re-setează `status=NEW, assigned_to=NULL` + notifică manager ⏳

**Migrație SQL:**
```sql
ALTER TABLE picking_jobs ADD COLUMN accept_deadline TIMESTAMPTZ;
ALTER TABLE picking_jobs ADD COLUMN accepted_at TIMESTAMPTZ;
ALTER TABLE picking_jobs ADD COLUMN priority VARCHAR(10) DEFAULT 'NORMAL'; -- NORMAL/URGENT/CRITIC
```
`database/migrations/043_operator_notifications.sql` ✅

---

### Sprint 5 — Browser Notification API *(~2 ore)*
**Fișiere noi:**
- `frontend/web_ui/src/utils/browserNotifications.ts` — wrapper peste Notification API + permission request

**Funcționalitate:**
- La prima conectare: `Notification.requestPermission()`
- La `job:assigned` din WebSocket → `new Notification('Job ALOCAT!', { body: 'Job #123 — 5 produse', icon: '/wms-icon.png', vibrate: [200,100,200] })`
- Funcționează și când tab-ul e în fundal sau ecranul e blocat (pe Android)

---

### Sprint 6 — Priorități + Sunete diferențiate *(~2 ore)*
**Sunete:**
- `NORMAL` → 2 tonuri scurte (880Hz)
- `URGENT` → 3 tonuri rapide (1100Hz)  
- `CRITIC` → alarmă continuă pulsată (roșu flash + sunet până dismiss)

**UI diferențiat în HUB:**
- Badge galben = 1-3 joburi normale
- Badge portocaliu = job urgent
- Badge roșu pulsând + flash ecran = job CRITIC

---

## Schema BD suplimentară

```sql
-- Migrație 043_operator_notifications.sql
ALTER TABLE picking_jobs
  ADD COLUMN IF NOT EXISTS priority      VARCHAR(10)  DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS accept_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_breach    BOOLEAN      DEFAULT FALSE;

-- Index pentru SLA monitor
CREATE INDEX IF NOT EXISTS idx_picking_jobs_sla
  ON picking_jobs (status, accept_deadline)
  WHERE status = 'ASSIGNED' AND accepted_at IS NULL;

-- Tabel prezență operatori (fallback dacă Socket.IO nu e disponibil)
CREATE TABLE IF NOT EXISTS operator_presence (
  user_id       UUID PRIMARY KEY,
  username      VARCHAR(100),
  last_seen     TIMESTAMPTZ DEFAULT now(),
  status        VARCHAR(20) DEFAULT 'ONLINE', -- ONLINE/BUSY/OFFLINE
  socket_id     VARCHAR(100),
  device_info   JSONB
);
```

---

## API nou (sumar)

| Method | Path | Service | Descriere |
|--------|------|---------|-----------|
| POST | `/pick-jobs/:id/assign` | inventory | Asignează job la operator |
| GET | `/pick-jobs/unassigned` | inventory | Joburi fără operator |
| GET | `/operators/presence` | notifications | Operatori online acum |
| POST | `/operators/presence` | notifications | Update status operator |
| GET | `/pick-jobs/sla-breaches` | inventory | Joburi care au depășit SLA |

---

## Ordine implementare recomandată

```
Sprint 1 (frontend) → Sprint 2 (backend event) → Test end-to-end
       ↓
Sprint 3 (panou manager) → Sprint 4 (SLA)
       ↓
Sprint 5 (browser notif) → Sprint 6 (priorități)
```

Sprint 1 + 2 împreună = **sistem funcțional de bază** (~5 ore).
Sprint 3-6 = **nivel enterprise complet** (~11 ore total).

---

## Criterii de acceptanță (Definition of Done)

- [x] Operatorul vede badge pe CULEGERE cu numărul joburilor alocate lui
- [x] La asignare de către manager → operatorul primește notificare în < 1 secundă
- [x] Sunet de alertă la job nou (feedbackOK la banner)
- [x] Banner fullscreen dismiss-abil la job URGENT/CRITIC
- [ ] Browser Notification funcționează cu ecranul blocat
- [ ] Manager vede în timp real dacă operatorul a acceptat (pagina JobAssignmentPage)
- [x] Job neacceptat în 5 min → deadline setat în DB (SLA cron de implementat)
- [ ] Job neacceptat în 10 min → re-introdus în coadă automat
- [x] Zero date pierdute la reconectare WebSocket (reconnect + re-fetch state)
