# OPERATOR MODE — Plan de implementare WMS NK

> **Obiectiv:** Transformarea UI-ului din „admin-based" în „workflow-based".
> Operatorul de depozit nu navighează — el **scanează și confirmă**.

---

## 🎯 Problema actuală

UI-ul existent este conceput pentru **manageri și administratori**:
- sidebar cu 30+ meniuri
- navigare complexă între pagini
- formulare lungi, tabele, filtre

**Operatorul de depozit are nevoie de:**
- ecran mare, clar, fără distrageri
- maxim 2-3 acțiuni per pas
- feedback imediat (vizual + sonor + haptik)
- flux linear: scanează → confirmă → next

---

## 🗺️ Arhitectura Operator Mode

```
LOGIN (rol: operator)
        │
        ▼
/scanner-mode  — full screen, fără sidebar
        │
   ┌────▼────┐
   │  HUB    │  — alege fluxul (butoane mari, iconițe)
   └────┬────┘
        │
   ┌────┴──────────────────────────────┐
   │           │           │           │
   ▼           ▼           ▼           ▼
RECEPȚIE   PUTAWAY     PICKING     LIVRARE
```

---

## 📋 Etape de implementare

---

### ETAPA 1 — Fundament routing & redirect operator
**Estimare:** 1 sesiune  
**Fișiere afectate:** `App.tsx`, `AuthContext`

- [ ] **1.1** — În `App.tsx`, după login: dacă `user.role === 'operator'` → redirect automat la `/scanner-mode`
  ```tsx
  // în ProtectedRoute sau redirect din AuthContext
  if (user.role === 'operator') return <Navigate to="/scanner-mode" replace />;
  ```
- [ ] **1.2** — Adaugă ruta `/scanner-mode` în `App.tsx` **în afara componentei `<Layout>`** (fără sidebar, fără AppBar normal)
  ```tsx
  <Route path="/scanner-mode/*" element={
    <ProtectedRoute roles={['operator','admin','manager']}>
      <ScannerModePage />
    </ProtectedRoute>
  } />
  ```
- [ ] **1.3** — Buton „Mod Operator" în Layout.tsx pentru admin/manager (pentru testare și switch rapid)

---

### ETAPA 2 — ScannerModePage — pagina container
**Estimare:** 1 sesiune  
**Fișiere noi:** `pages/ScannerModePage.tsx`

- [ ] **2.1** — Creare `ScannerModePage.tsx`:
  - full screen (100vh, fără padding lateral)
  - fundal închis (`#0a0a0a` sau `#1a1a2e`) — contrast maxim pentru depozit
  - Header minimal: logo mic + nume operator + buton logout
  - **HUB central** — 4 butoane mari (touch-friendly, minim 120px înălțime):

  ```
  ┌─────────────┐  ┌─────────────┐
  │  📥          │  │  📦          │
  │  RECEPȚIE   │  │  PUTAWAY    │
  └─────────────┘  └─────────────┘
  ┌─────────────┐  ┌─────────────┐
  │  🛒          │  │  🚚          │
  │  PICKING    │  │  LIVRARE    │
  └─────────────┘  └─────────────┘
  ```

- [ ] **2.2** — Fiecare buton deschide componenta de workflow corespunzătoare (nu navighează — swap în același ecran)
- [ ] **2.3** — Buton „← Înapoi la HUB" în orice workflow (abandon flow)

---

### ETAPA 3 — ScannerWorkflow.tsx — state machine core
**Estimare:** 2 sesiuni  
**Fișiere noi:** `components/scanner/ScannerWorkflow.tsx`, `components/scanner/types.ts`

- [ ] **3.1** — Definire tipuri state machine în `types.ts`:
  ```ts
  type WorkflowType = 'RECEPTIE' | 'PUTAWAY' | 'PICKING' | 'LIVRARE';

  type ScanStep =
    | 'IDLE'
    | 'SCAN_PRODUCT'
    | 'CONFIRM_PRODUCT'
    | 'SCAN_LOCATION'
    | 'CONFIRM_QUANTITY'
    | 'CONFIRM_ACTION'
    | 'SUCCESS'
    | 'ERROR';

  interface WorkflowState {
    step: ScanStep;
    workflow: WorkflowType;
    scannedCode: string | null;
    resolvedProduct: Product | null;
    resolvedLocation: Location | null;
    quantity: number;
    message: string;
    submessage?: string;
  }
  ```

- [ ] **3.2** — Componenta `ScannerWorkflow.tsx`:
  - primește `workflow: WorkflowType` ca prop
  - conține un singur `<input>` auto-focus pentru scanner (ascuns vizual sau mare)
  - afișează conținut diferit per `step` (nu pagini separate — conditional rendering)
  - tranziții animatate între stări (slide/fade)

- [ ] **3.3** — Input handler pentru scanner:
  ```ts
  // La scan (Enter sau timeout 50ms după ultimul caracter):
  onScanComplete(code: string) → dispatchStep(code)
  ```
  Scannerul trimite codul + Enter → eveniment capturat global (`keydown` listener)

---

### ETAPA 4 — Flux RECEPȚIE (workflow complet)
**Estimare:** 2 sesiuni  
**Fișiere:** `components/scanner/workflows/ReceptieWorkflow.tsx`

**State machine RECEPȚIE:**
```
IDLE
  │ operator apasă START
  ▼
SCAN_PRODUCT  →  „Scanează codul produsului"
  │ cod scanat
  ▼
 [API: GET /purchase-orders/by-product/:code]
  │ PO găsit
  ▼
CONFIRM_PRODUCT → afișează: produs, PO, cantitate așteptată
  │ operator confirmă (buton VERDE mare)
  ▼
CONFIRM_QUANTITY → tastatură numerică, cantitate primită
  │ confirmat
  ▼
SCAN_LOCATION → „Scanează locația PENDING_PUTAWAY"
  │ cod locație scanat
  ▼
 [API: POST /goods-receipts + lot automat + status PENDING_PUTAWAY]
  ▼
SUCCESS → „✅ Produs recepționat! Lot #XXX creat"
  │ 3 secunde
  ▼
IDLE (gata pentru următorul produs)
```

- [ ] **4.1** — Ecran SCAN_PRODUCT: text mare „📷 Scanează produsul", câmp input auto-focus
- [ ] **4.2** — Ecran CONFIRM_PRODUCT: card cu detalii produs + PO + stoc așteptat, buton CONFIRMĂ (verde) + Anulează (roșu)
- [ ] **4.3** — Ecran CONFIRM_QUANTITY: tastatură numerică mare (input tip number, font 48px)
- [ ] **4.4** — Ecran SCAN_LOCATION: text „Scanează locația de depozitare"
- [ ] **4.5** — Ecran SUCCESS: fundal verde, checkmark animat, text lot creat
- [ ] **4.6** — Ecran ERROR: fundal roșu, mesaj eroare clar, buton Retry

---

### ETAPA 5 — Flux PUTAWAY (workflow complet)
**Estimare:** 1-2 sesiuni  
**Fișiere:** `components/scanner/workflows/PutawayWorkflow.tsx`

**State machine PUTAWAY:**
```
IDLE
  │ operator apasă START
  ▼
 [API: GET /putaway-tasks/next] → primul task PENDING
  ▼
SHOW_TASK → afișează: produs, cantitate, locație SUGERATĂ
  │         „Mergi la: [LOC-A-01-03]"
  ▼
SCAN_LOCATION → „Scanează locația [LOC-A-01-03]"
  │ cod loc scanat
  ▼
 [validare: codul scanat = locația sugerată?]
  ├── NU → ERROR: „Locație greșită! Așteptat: A-01-03"
  └── DA →
SCAN_PRODUCT → „Scanează produsul pentru confirmare"
  │
  ▼
 [API: PATCH /putaway-tasks/:id/confirm]
  ▼
SUCCESS → „✅ Depozitat în A-01-03"
  │ 2 sec → auto next task (sau IDLE dacă nu mai sunt)
  ▼
NEXT_TASK sau IDLE
```

- [ ] **5.1** — Ecran SHOW_TASK: locația afișată MARE (font 72px), direcție vizuală (hartă mini opțional)
- [ ] **5.2** — Validare locație scanată vs sugerată — eroare clară dacă greșit
- [ ] **5.3** — Contor tasks rămase: „Task 3 din 12"
- [ ] **5.4** — Opțiune „Skip task" (cu confirmare) pentru situații excepționale

---

### ETAPA 6 — Flux PICKING (workflow complet)
**Estimare:** 2 sesiuni  
**Fișiere:** `components/scanner/workflows/PickingWorkflow.tsx`

**State machine PICKING:**
```
IDLE → SELECT_JOB
  │ [API: GET /picking/jobs?status=ASSIGNED&operator=me]
  ▼
SHOW_JOBS → listă joburi (maxim 3 afișate, stilizat simplu)
  │ operator alege un job
  ▼
START_JOB → [API: PATCH /picking/jobs/:id/start]
  │
  ▼
SHOW_ITEM → „Mergi la: [A-02-05]"
            „Produs: CABLU NYY 3x2.5"
            „Cantitate: 150m"
  │
  ▼
SCAN_LOCATION → „Scanează locația A-02-05"
  │ validare
  ▼
SCAN_PRODUCT → „Scanează produsul"
  │ validare
  ▼
CONFIRM_QUANTITY → tastatură numerică
  │ [API: POST /picking/jobs/:id/items/:itemId/pick]
  ▼
SUCCESS_ITEM → „✅ 150m culese"
  │ auto → SHOW_ITEM (next item) sau JOB_COMPLETE
  ▼
JOB_COMPLETE → „🎉 Job finalizat! Mergi la zona SHIP"
  │
  ▼
IDLE
```

- [ ] **6.1** — Ecranul SHOW_ITEM: 2/3 din ecran ocupat de locație (font masiv), 1/3 detalii produs
- [ ] **6.2** — Progress bar job: „Item 4 din 7"
- [ ] **6.3** — La cantitate parțială: „Ai doar 80m? Introdu cantitatea disponibilă" → split automat
- [ ] **6.4** — Ecran JOB_COMPLETE: animație confetti/checkmark + instrucțiuni next step

---

### ETAPA 7 — Flux LIVRARE (workflow complet)
**Estimare:** 1 sesiune  
**Fișiere:** `components/scanner/workflows/LivrareWorkflow.tsx`

**State machine LIVRARE:**
```
IDLE
  │
  ▼
SCAN_SHIPMENT → „Scanează bon de livrare / comandă"
  │ [API: GET /shipments/by-order/:code]
  ▼
SHOW_SHIPMENT → detalii comandă, nr. colete, destinație
  │ operator confirmă
  ▼
SCAN_PRODUCTS_LOOP → pentru fiecare produs în comandă:
  │  „Scanează: CABLU YY 2x1.5 (3 colete)"
  │  scanare produs → confirmare
  ▼ (toate produsele ok)
CONFIRM_LOADING → „Toate produsele verificate. Confirmă încărcare?"
  │ [API: PATCH /shipments/:id/status → LOADED]
  ▼
SUCCESS → „✅ Livrare confirmată. Bon: #SHP-2026-042"
```

- [ ] **7.1** — Scanare bon livrare sau selecție din listă (fallback fără scanner)
- [ ] **7.2** — Verificare produs cu produs (scan fiecare colet)
- [ ] **7.3** — Generare bon confirmare (link PDF) la final

---

### ETAPA 8 — Sistem feedback multi-senzorial
**Estimare:** 1 sesiune  
**Fișiere noi:** `utils/scannerFeedback.ts`

Acesta este unul din elementele **cele mai importante** pentru UX în depozit.

#### 8.1 — Feedback sonor (Web Audio API — fără fișiere externe)
- [ ] **8.1.1** — `beepSuccess()` — ton scurt înalt (880Hz, 100ms) — scanare reușită
- [ ] **8.1.2** — `beepError()` — ton dublu jos (220Hz, 200ms x2) — eroare
- [ ] **8.1.3** — `beepComplete()` — melodie scurtă 3 note (task finalizat)
- [ ] **8.1.4** — Volum controlabil din header operator (slider 0-100%)
- [ ] **8.1.5** — Toggle sunet ON/OFF salvat în localStorage

```ts
// utils/scannerFeedback.ts
const ctx = new (window.AudioContext || window.webkitAudioContext)();

export function beepSuccess() {
  const osc = ctx.createOscillator();
  osc.frequency.value = 880;
  osc.connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + 0.1);
}
```

#### 8.2 — Feedback vizual (prioritate ridicată)
- [ ] **8.2.1** — Flash verde fullscreen (200ms, opacity 0.3) la scanare reușită
- [ ] **8.2.2** — Flash roșu fullscreen (300ms, opacity 0.5) la eroare
- [ ] **8.2.3** — Animație checkmark SVG la SUCCESS (bounce-in)
- [ ] **8.2.4** — Indicator de stare permanent (bară colorată sus): verde = OK, galben = în progres, roșu = eroare
- [ ] **8.2.5** — Font minim 32px pentru instrucțiuni principale (lizibilitate de la distanță / mănuși)

#### 8.3 — Feedback haptik (mobil / tableta)
- [ ] **8.3.1** — `navigator.vibrate(50)` la scanare reușită
- [ ] **8.3.2** — `navigator.vibrate([100, 50, 100])` la eroare (pattern dublu)
- [ ] **8.3.3** — `navigator.vibrate(200)` la finalizare task
- [ ] **8.3.4** — Fallback silențios pe desktop (vibrate nu e suportat)

#### 8.4 — Logică centralizată feedback
- [ ] **8.4.1** — Hook `useScannerFeedback()` care combină toate cele 3 tipuri:
  ```ts
  const { feedbackOK, feedbackError, feedbackDone } = useScannerFeedback();
  // feedbackOK() → beep + flash verde + vibratie scurta
  // feedbackError(msg) → beep err + flash rosu + vibratie dubla
  // feedbackDone() → melodie + animatie + vibratie lunga
  ```

---

### ETAPA 9 — Componente UI reutilizabile scanner
**Estimare:** 1 sesiune  
**Director nou:** `components/scanner/ui/`

- [ ] **9.1** — `ScanInput.tsx` — input ascuns, auto-focus, captează Enter de la scanner
  - re-focus automat după 2 secunde dacă pierde focus
  - indicator vizual „scanner activ / inactiv"

- [ ] **9.2** — `BigInstruction.tsx` — afișare instrucțiune principală (font 48px, centrată)
  ```tsx
  <BigInstruction icon="📷" text="Scanează produsul" />
  ```

- [ ] **9.3** — `LocationBadge.tsx` — afișare cod locație (font 72px, fundal contrast)
  ```tsx
  <LocationBadge code="A-02-05" zone="H1" highlight />
  ```

- [ ] **9.4** — `ActionButton.tsx` — buton mare touch-friendly (min 80px înălțime)
  - variante: `confirm` (verde), `cancel` (roșu), `skip` (gri), `primary` (albastru)

- [ ] **9.5** — `QuantityKeypad.tsx` — tastatură numerică native mobile (tip number, fontSize 48px)
  - butoane rapide: +1, +5, +10, +50

- [ ] **9.6** — `ProgressBar.tsx` — bară progres task curent (ex: „3 / 7 items")

- [ ] **9.7** — `StatusFlash.tsx` — overlay fullscreen transparent pentru flash vizual (success/error)

---

### ETAPA 10 — Persistență & edge cases
**Estimare:** 1 sesiune

- [ ] **10.1** — Salvare stare workflow în `sessionStorage` (operator poate închide accidental tab-ul)
- [ ] **10.2** — Reconnect automat dacă API-ul cade (retry cu backoff + mesaj „Reconectare...")
- [ ] **10.3** — Mod offline parțial: scanările se stochează local (queue) și se trimit când revine conexiunea
- [ ] **10.4** — Timeout de inactivitate: după 5 minute inactiv → ecran de blocare (PIN sau re-scan badge)
- [ ] **10.5** — Log toate acțiunile operatorului → `POST /api/v1/audit/ui-event` cu `workflow` și `step`

---

### ETAPA 11 — Dark mode & responsive pentru tableta/mobil
**Estimare:** 0.5 sesiuni

- [ ] **11.1** — Tema întunecată dedicată scanner mode (MUI `createTheme` separat, nu afectează admin UI)
- [ ] **11.2** — Layout responsive: vertical pe telefon, 2 coloane pe tabletă
- [ ] **11.3** — Touch targets minim 48x48px (Google Material guideline)
- [ ] **11.4** — Suport pentru ecrane rotite (landscape pe tabletă — preferat în depozit)
- [ ] **11.5** — Testare pe Chrome Mobile DevTools (simulare scanner Zebra / Honeywell)

---

## 📁 Structura finală fișiere noi

```
frontend/web_ui/src/
├── pages/
│   └── ScannerModePage.tsx              # Container principal, HUB
├── components/
│   └── scanner/
│       ├── types.ts                     # WorkflowState, ScanStep etc.
│       ├── ScannerWorkflow.tsx          # State machine core
│       ├── workflows/
│       │   ├── ReceptieWorkflow.tsx
│       │   ├── PutawayWorkflow.tsx
│       │   ├── PickingWorkflow.tsx
│       │   └── LivrareWorkflow.tsx
│       └── ui/
│           ├── ScanInput.tsx
│           ├── BigInstruction.tsx
│           ├── LocationBadge.tsx
│           ├── ActionButton.tsx
│           ├── QuantityKeypad.tsx
│           ├── ProgressBar.tsx
│           └── StatusFlash.tsx
├── hooks/
│   └── useScannerFeedback.ts            # Beep + flash + vibrate combinat
└── utils/
    └── scannerFeedback.ts               # Web Audio API + vibrate
```

---

## 🔄 Modificări fișiere existente

| Fișier | Modificare |
|--------|-----------|
| `App.tsx` | Adaugă ruta `/scanner-mode/*` în afara Layout; redirect operator după login |
| `contexts/AuthContext.tsx` | Expune `user.role` pentru redirect logic |
| `components/Layout.tsx` | Buton „Mod Operator" pentru admin/manager |

---

## 🚦 Ordinea de implementare recomandată

```
ETAPA 1 (routing)
    → ETAPA 2 (pagina HUB)
        → ETAPA 3 (state machine + ScanInput)
            → ETAPA 8 (feedback — paralel cu workflows)
            → ETAPA 4 (Recepție)
            → ETAPA 5 (Putaway)
            → ETAPA 6 (Picking)
            → ETAPA 7 (Livrare)
        → ETAPA 9 (componente UI)
    → ETAPA 10 (edge cases)
    → ETAPA 11 (dark mode + responsive)
```

**Prioritate maximă: Etapele 1-6 + Etapa 8** — acestea acoperă 90% din activitatea zilnică a operatorului.

---

## 📊 Progres general

| Etapă | Status | Sesiuni |
|-------|--------|---------|
| 1 — Routing & redirect | ⬜ Neînceput | 1 |
| 2 — ScannerModePage HUB | ⬜ Neînceput | 1 |
| 3 — State machine core | ⬜ Neînceput | 2 |
| 4 — Flux Recepție | ⬜ Neînceput | 2 |
| 5 — Flux Putaway | ⬜ Neînceput | 2 |
| 6 — Flux Picking | ⬜ Neînceput | 2 |
| 7 — Flux Livrare | ⬜ Neînceput | 1 |
| 8 — Feedback multi-senzorial | ⬜ Neînceput | 1 |
| 9 — Componente UI reutilizabile | ⬜ Neînceput | 1 |
| 10 — Persistență & edge cases | ⬜ Neînceput | 1 |
| 11 — Dark mode & responsive | ⬜ Neînceput | 1 |
| **TOTAL** | | **~15 sesiuni** |
