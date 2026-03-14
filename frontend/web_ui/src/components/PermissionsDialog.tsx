/**
 * PermissionsDialog.tsx — Faza 6.2: Matrice Permisiuni Granulare
 *
 * Dialog pentru admin: editeaza permisiunile granulare per user x resursa.
 * Actiunile disponibile: view / create / edit / delete / approve.
 */

import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Checkbox, Table, TableHead, TableRow,
  TableCell, TableBody, CircularProgress, Alert, Chip, Box,
  Tooltip, IconButton,
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { usersService, type User } from '../services/users.service';

// ─── Constante ────────────────────────────────────────────────────────────────

const RESOURCES = [
  { key: 'orders',     label: 'Comenzi' },
  { key: 'batches',    label: 'Loturi' },
  { key: 'picking',    label: 'Picking' },
  { key: 'reception',  label: 'Recepție' },
  { key: 'cutting',    label: 'Tăiere' },
  { key: 'sewing',     label: 'Cusut' },
  { key: 'qc',         label: 'Control Calitate' },
  { key: 'reports',    label: 'Rapoarte' },
  { key: 'config',     label: 'Configurare' },
  { key: 'users',      label: 'Utilizatori' },
];

const ACTIONS: Array<{ key: string; label: string; tooltip: string }> = [
  { key: 'can_view',    label: 'View',    tooltip: 'Poate vedea lista / datele' },
  { key: 'can_create',  label: 'Create',  tooltip: 'Poate crea intrări noi' },
  { key: 'can_edit',    label: 'Edit',    tooltip: 'Poate modifica date existente' },
  { key: 'can_delete',  label: 'Delete',  tooltip: 'Poate șterge înregistrări' },
  { key: 'can_approve', label: 'Approve', tooltip: 'Poate aproba / confirma operațiuni' },
];

type PermMatrix = Record<string, Record<string, boolean>>;

const ROLE_DEFAULTS: Record<string, Record<string, boolean>> = {
  manager:  { can_view: true, can_create: true, can_edit: true, can_delete: false, can_approve: true },
  operator: { can_view: true, can_create: true, can_edit: false, can_delete: false, can_approve: false },
  sofer:    { can_view: true, can_create: false, can_edit: false, can_delete: false, can_approve: false },
};

function buildDefaultMatrix(role: string): PermMatrix {
  const defaults = ROLE_DEFAULTS[role] ?? ROLE_DEFAULTS.operator;
  return Object.fromEntries(RESOURCES.map(r => [r.key, { ...defaults }]));
}

// ─── Componenta ───────────────────────────────────────────────────────────────

interface Props {
  user: User | null;
  open: boolean;
  onClose: () => void;
}

export default function PermissionsDialog({ user, open, onClose }: Props) {
  const [matrix, setMatrix] = useState<PermMatrix>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const userId = user?.id;
  const userRole = user?.role;

  useEffect(() => {
    if (!open || !userId || !userRole) return;
    setSaved(false);
    setError(null);
    setLoading(true);

    usersService.getPermissions(userId)
      .then(perms => {
        // Merge cu defaults pentru resursele fara perms
        const defaults = buildDefaultMatrix(userRole);
        const merged: PermMatrix = { ...defaults };
        for (const [res, p] of Object.entries(perms)) {
          merged[res] = p as Record<string, boolean>;
        }
        setMatrix(merged);
      })
      .catch(() => {
        setMatrix(buildDefaultMatrix(userRole));
      })
      .finally(() => setLoading(false));
  }, [open, userId, userRole]);

  const toggle = (resource: string, action: string) => {
    setMatrix(prev => ({
      ...prev,
      [resource]: {
        ...prev[resource],
        [action]: !prev[resource]?.[action],
      },
    }));
  };

  const toggleAll = (action: string, value: boolean) => {
    setMatrix(prev => {
      const next = { ...prev };
      for (const r of RESOURCES) {
        next[r.key] = { ...next[r.key], [action]: value };
      }
      return next;
    });
  };

  const handleReset = () => {
    if (user) setMatrix(buildDefaultMatrix(user.role));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      await usersService.updatePermissions(user.id, matrix);
      setSaved(true);
      setTimeout(onClose, 800);
    } catch {
      setError('Salvarea a eșuat. Verificați conexiunea.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon color="primary" />
          <Box>
            <Typography variant="h6">Permisiuni granulare</Typography>
            <Typography variant="caption" color="text.secondary">
              {user.username} &mdash;{' '}
              <Chip label={user.role} size="small" color="warning" sx={{ height: 18, fontSize: '0.65rem' }} />
            </Typography>
          </Box>
          <Tooltip title="Resetează la valorile implicite ale rolului">
            <IconButton size="small" sx={{ ml: 'auto' }} onClick={handleReset}>
              <RestartAltIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {saved && <Alert severity="success" sx={{ mb: 2 }}>Permisiuni salvate ✓</Alert>}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', minWidth: 140 }}>Resursă</TableCell>
                {ACTIONS.map(a => (
                  <TableCell key={a.key} align="center" sx={{ fontWeight: 'bold' }}>
                    <Tooltip title={a.tooltip}>
                      <Box>
                        <Typography variant="caption">{a.label}</Typography>
                        <Box>
                          <Checkbox
                            size="small"
                            indeterminate={
                              RESOURCES.some(r => matrix[r.key]?.[a.key]) &&
                              !RESOURCES.every(r => matrix[r.key]?.[a.key])
                            }
                            checked={RESOURCES.every(r => matrix[r.key]?.[a.key])}
                            onChange={e => toggleAll(a.key, e.target.checked)}
                            sx={{ p: 0.5 }}
                          />
                        </Box>
                      </Box>
                    </Tooltip>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {RESOURCES.map(r => (
                <TableRow key={r.key} hover>
                  <TableCell>
                    <Typography variant="body2">{r.label}</Typography>
                    <Typography variant="caption" color="text.disabled">{r.key}</Typography>
                  </TableCell>
                  {ACTIONS.map(a => (
                    <TableCell key={a.key} align="center">
                      <Checkbox
                        size="small"
                        checked={!!matrix[r.key]?.[a.key]}
                        onChange={() => toggle(r.key, a.key)}
                        color={
                          a.key === 'can_delete' ? 'error'
                            : a.key === 'can_approve' ? 'success'
                            : 'primary'
                        }
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          * Adminii au întotdeauna acces complet indiferent de această matrice.
          Permisiunile granulare se aplică doar rolurilor manager / operator / sofer.
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Anulează</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || loading}
          startIcon={saving ? <CircularProgress size={16} /> : undefined}
        >
          {saving ? 'Se salvează...' : 'Salvează permisiunile'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
