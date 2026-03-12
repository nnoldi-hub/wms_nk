-- Migration 025: Versionare reguli WMS
-- Salvează automat versiunile anterioare la fiecare editare a unei reguli.

CREATE TABLE IF NOT EXISTS wms_rule_versions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id       UUID        NOT NULL REFERENCES wms_rules(id) ON DELETE CASCADE,
  version       INTEGER     NOT NULL,
  -- Snapshot complet al regulii la momentul schimbării
  name          TEXT,
  rule_type     VARCHAR(50),
  scope         VARCHAR(30),
  priority      INTEGER,
  conditions    JSONB,
  actions       JSONB,
  description   TEXT,
  is_active     BOOLEAN,
  -- Metadate schimbare
  changed_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
  change_reason TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rule_versions_rule_id  ON wms_rule_versions(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_versions_version  ON wms_rule_versions(rule_id, version DESC);

-- Adaugă coloana version_number pe wms_rules pentru tracking ușor
ALTER TABLE wms_rules
  ADD COLUMN IF NOT EXISTS version_number INTEGER NOT NULL DEFAULT 1;

COMMENT ON TABLE  wms_rule_versions IS 'Istoricul complet al modificărilor pentru fiecare regulă WMS';
COMMENT ON COLUMN wms_rule_versions.version IS 'Numărul versiunii (incrementat la fiecare PUT /rules/:id)';
