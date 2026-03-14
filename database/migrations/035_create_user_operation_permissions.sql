-- Migration 035: User Operation Permissions (Faza 6.2)
-- Tabel pentru permisiuni granulare per user + per tip operatiune

CREATE TABLE IF NOT EXISTS user_operation_permissions (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource    TEXT    NOT NULL,   -- 'orders','batches','picking','reception','cutting','sewing','qc','reports','config','users'
    can_view    BOOLEAN NOT NULL DEFAULT TRUE,
    can_create  BOOLEAN NOT NULL DEFAULT FALSE,
    can_edit    BOOLEAN NOT NULL DEFAULT FALSE,
    can_delete  BOOLEAN NOT NULL DEFAULT FALSE,
    can_approve BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, resource)
);

CREATE INDEX IF NOT EXISTS idx_uop_user_id ON user_operation_permissions(user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_uop_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_uop_updated_at ON user_operation_permissions;
CREATE TRIGGER trg_uop_updated_at
    BEFORE UPDATE ON user_operation_permissions
    FOR EACH ROW EXECUTE FUNCTION update_uop_updated_at();

COMMENT ON TABLE user_operation_permissions IS
  'Permisiuni granulare per user x resursa (Faza 6.2). Completeaza sistemul de roluri.';
