# Plan Enterprise: Sistem Notificare & Asignare Operatori

> **Ultima actualizare:** 18 Martie 2026
> **Stare generală:** Sprint 1 ✅ | Sprint 2 ✅ | Sprint 3 ✅ | Sprint 4 ✅ | Sprint 5 ✅ | Sprint 6 ✅ | SLA Monitor ✅

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

### Sprint 3 — Panou Manager: Prezență + Asignare *(~4 ore)* ✅ IMPLEMENTAT
**Fișiere noi:**
- `frontend/web_ui/src/pages/JobAssignmentPage.tsx` — panou split: joburi pending | operatori online ✅
  - Coloana stânga: joburi `status=NEW` nealocate cu chip prioritate
  - Coloana dreapta: operatori online din Socket.IO rooms
  - Click job → dialog selecție prioritate (NORMAL/URGENT/CRITIC) → POST /assign
  - Auto-refresh la 10 secunde

**Backend:**
- `GET /operators/presence` (notifications-service) — query Socket.IO rooms, returnează operatori online ✅
- Route + menu item adăugate în App.tsx și Layout.tsx (roles: admin, manager) ✅

---

### Sprint 4 — Acknowledgment + SLA Monitor *(~3 ore)* ✅ IMPLEMENTAT COMPLET
**Logică:**
- La asignare, se setează `accept_deadline = now() + 5min` în DB ✅
- `setInterval(60s)` în `services/inventory/src/index.js` (rulează în app.listen) ✅
- Dacă `now() > accept_deadline` și `status = ASSIGNED` (nu IN_PROGRESS):
  - Marchează `sla_breach=TRUE`, publică `pick-job.sla-breach` → manager primește `job:sla-breach` via WebSocket ✅
  - Dacă `now() > accept_deadline + 5min` → re-setează `status=NEW, assigned_to=NULL`, publică `pick-job.requeued` ✅
- `notifications-service/rabbitmq.js` — handlers pentru `pick-job.sla-breach` și `pick-job.requeued` ✅

**Migrație SQL:**
```sql
ALTER TABLE picking_jobs ADD COLUMN accept_deadline TIMESTAMPTZ;
ALTER TABLE picking_jobs ADD COLUMN accepted_at TIMESTAMPTZ;
ALTER TABLE picking_jobs ADD COLUMN priority VARCHAR(10) DEFAULT 'NORMAL'; -- NORMAL/URGENT/CRITIC
```
`database/migrations/043_operator_notifications.sql` ✅

---

### Sprint 5 — Browser Notification API *(~2 ore)* ✅ IMPLEMENTAT
**Fișiere noi:**
- `frontend/web_ui/src/utils/browserNotifications.ts` — wrapper peste Notification API ✅

**Funcționalitate:**
- `requestNotificationPermission()` — async, apelat la mount în useNotifications ✅
- `notifyJobAssigned({ jobId, priority, orderRef, itemsCount })` — creează `new Notification(...)` ✅
  - Tag per `jobId` → previne duplicate
  - `requireInteraction: true` pentru prioritate CRITIC (nu dispare automat)
- Funcționează cu tab în fundal sau ecran blocat pe Android (PWA) ✅

---

### Sprint 6 — Priorități + Sunete diferențiate *(~2 ore)* ✅ IMPLEMENTAT
**Fișiere noi:**
- `frontend/web_ui/src/hooks/useJobSound.ts` — Web Audio API, fără librării externe ✅

**Sunete implementate:**
- `NORMAL` → 2 beepuri sine la 880Hz (0.15s, 0.25s pauză) ✅
- `URGENT` → 3 beepuri rapide sine la 1100Hz, gain 0.5 ✅
- `CRITIC` → sawtooth sweep 1400→800Hz în 0.5s, pulsat via setInterval(800ms) până `stopCritic()` ✅

**UI diferențiat:**
- Banner CRITIC → fundal roșu (MUI error.main) vs. portocaliu pentru URGENT/NORMAL ✅
- `stopCritic()` apelat la ACCEPTĂ și la Ignoră din ScannerModePage ✅
- `useNotifications` integrează `playForPriority` + browser notification la fiecare `job:assigned` ✅

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
- [x] Sunet de alertă la job nou (diferențiat per prioritate — Sprint 6)
- [x] Banner fullscreen dismiss-abil la job URGENT/CRITIC
- [x] Browser Notification funcționează cu ecranul blocat (Sprint 5)
- [x] Manager vede în timp real dacă operatorul a acceptat (JobAssignmentPage — Sprint 3)
- [x] Job neacceptat în 5 min → SLA breach notificat managerului (Sprint 4)
- [x] Job neacceptat în 10 min → re-introdus în coadă automat (Sprint 4)
- [x] Zero date pierdute la reconectare WebSocket (reconnect + re-fetch state)
