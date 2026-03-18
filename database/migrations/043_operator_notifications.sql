-- Migrație 043: Notificări operatori + SLA monitor pentru picking jobs
-- Sprint 4 din PLAN_NOTIFICARE_OPERATORI.md

-- Câmpuri suplimentare pe picking_jobs pentru SLA + priorități
ALTER TABLE picking_jobs
  ADD COLUMN IF NOT EXISTS priority        VARCHAR(10)  NOT NULL DEFAULT 'NORMAL'
    CHECK (priority IN ('NORMAL','URGENT','CRITIC')),
  ADD COLUMN IF NOT EXISTS accept_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_breach      BOOLEAN      NOT NULL DEFAULT FALSE;

-- Index pentru SLA monitor (verificare rapidă joburi ASSIGNED neacceptate)
CREATE INDEX IF NOT EXISTS idx_picking_jobs_sla
  ON picking_jobs (status, accept_deadline)
  WHERE status = 'ASSIGNED' AND accepted_at IS NULL;

-- Tabel prezență operatori (fallback HTTP când Socket.IO nu e interogabil direct)
CREATE TABLE IF NOT EXISTS operator_presence (
  user_id     TEXT         PRIMARY KEY,
  username    VARCHAR(100),
  last_seen   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  status      VARCHAR(20)  NOT NULL DEFAULT 'ONLINE'
                CHECK (status IN ('ONLINE','BUSY','OFFLINE')),
  socket_id   VARCHAR(100),
  device_info JSONB
);

-- Actualizare automată last_seen → funcție + trigger opțional (folosit de notifications-service)
CREATE INDEX IF NOT EXISTS idx_operator_presence_status ON operator_presence (status);
