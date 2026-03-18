/**
 * JobAssignmentPage.tsx — Panou manager: asignare joburi la operatori
 *
 * Layout split:
 * - Stânga: joburi cu status NEW (nealocate)
 * - Dreapta: operatori online (din notifications-service /operators/presence)
 *
 * Click job → se selectează; click operator → se asignează cu dialog prioritate.
 * Actualizări în timp real prin polling 10s (simplu, nu Socket.IO pe managerul desktop).
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, CardActionArea,
  Chip, Button, CircularProgress, Alert, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  ToggleButtonGroup, ToggleButton, Tooltip, Badge, Divider,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import PersonIcon from '@mui/icons-material/Person';
import WifiIcon from '@mui/icons-material/Wifi';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import axios from 'axios';

// ── Typuri ──────────────────────────────────────────────────
interface PickJob {
  id: string;
  number?: string;
  order_ref?: string;
  status: string;
  priority?: string;
  items_count?: number;
  created_at?: string;
}

interface OperatorPresence {
  socketId: string;
  userId: string;
  username: string;
  role: string;
  status: 'ONLINE' | 'BUSY' | 'OFFLINE';
}

type Priority = 'NORMAL' | 'URGENT' | 'CRITIC';

// ── API helpers ───────────────────────────────────────────────
const INVENTORY_URL =
  (import.meta.env.VITE_INVENTORY_URL as string) || 'http://localhost:3011';
const NOTIF_URL =
  (import.meta.env.VITE_NOTIFICATIONS_URL as string) || 'http://localhost:3017';

function authHeader() {
  const token = localStorage.getItem('accessToken') || '';
  return { Authorization: `Bearer ${token}` };
}

async function fetchUnassignedJobs(): Promise<PickJob[]> {
  const r = await axios.get(`${INVENTORY_URL}/api/v1/pick-jobs`, {
    headers: authHeader(),
    params: { status: 'NEW', limit: 50 },
  });
  return r.data?.data ?? [];
}

async function fetchOperatorsPresence(): Promise<OperatorPresence[]> {
  const r = await axios.get(`${NOTIF_URL}/operators/presence`, {
    headers: authHeader(),
  });
  return r.data?.data ?? [];
}

async function assignJob(jobId: string, operatorId: string, priority: Priority) {
  const r = await axios.post(
    `${INVENTORY_URL}/api/v1/pick-jobs/${jobId}/assign`,
    { operator_id: operatorId, priority },
    { headers: authHeader() }
  );
  return r.data;
}

// ── Constante UI ──────────────────────────────────────────────
const PRIORITY_COLORS: Record<Priority, 'default' | 'warning' | 'error'> = {
  NORMAL: 'default',
  URGENT: 'warning',
  CRITIC: 'error',
};

const PRIORITY_LABELS: Record<Priority, string> = {
  NORMAL: 'Normal',
  URGENT: '⚠️ Urgent',
  CRITIC: '🚨 Critic',
};

// ── Component ─────────────────────────────────────────────────
export default function JobAssignmentPage() {
  const [jobs, setJobs] = useState<PickJob[]>([]);
  const [operators, setOperators] = useState<OperatorPresence[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingOps, setLoadingOps] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedJob, setSelectedJob] = useState<PickJob | null>(null);
  const [selectedOp, setSelectedOp] = useState<OperatorPresence | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [assigning, setAssigning] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoadingJobs(true);
    setLoadingOps(true);
    setError(null);
    try {
      const [j, o] = await Promise.all([fetchUnassignedJobs(), fetchOperatorsPresence()]);
      setJobs(j);
      setOperators(o);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Eroare la încărcare: ${msg}`);
    } finally {
      setLoadingJobs(false);
      setLoadingOps(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 10_000);
    return () => clearInterval(interval);
  }, [loadAll]);

  const handleSelectJob = (job: PickJob) => {
    setSelectedJob((prev) => (prev?.id === job.id ? null : job));
    setSuccessMsg(null);
  };

  const handleSelectOperator = (op: OperatorPresence) => {
    if (!selectedJob) return;
    setSelectedOp(op);
    setPriority('NORMAL');
    setDialogOpen(true);
  };

  const handleAssign = async () => {
    if (!selectedJob || !selectedOp) return;
    setAssigning(true);
    try {
      await assignJob(selectedJob.id, selectedOp.userId, priority);
      setSuccessMsg(
        `Job ${selectedJob.number || selectedJob.id.slice(0, 8)} → ${selectedOp.username} (${PRIORITY_LABELS[priority]})`
      );
      setSelectedJob(null);
      setDialogOpen(false);
      // Reîncarcă joburile
      const updated = await fetchUnassignedJobs();
      setJobs(updated);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Eroare la asignare';
      setError(msg);
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <AssignmentIcon color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h5" fontWeight={700}>
          Asignare Joburi Operatori
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Reîncarcă">
          <IconButton onClick={loadAll} disabled={loadingJobs || loadingOps}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {successMsg && (
        <Alert severity="success" onClose={() => setSuccessMsg(null)} sx={{ mb: 2 }}
          icon={<CheckCircleIcon />}
        >
          Asignat: {successMsg}
        </Alert>
      )}

      {selectedJob && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Job selectat: <strong>{selectedJob.number || selectedJob.id.slice(0, 8)}</strong>
          {selectedJob.order_ref && ` — Comandă: ${selectedJob.order_ref}`}
          &nbsp;→ Acum apasă pe un operator pentru a asigna.
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* ── Stânga: Joburi nealocate ── */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Typography variant="h6" fontWeight={600}>
              Joburi nealocate
            </Typography>
            <Chip label={jobs.length} size="small" color="primary" />
            {loadingJobs && <CircularProgress size={16} />}
          </Box>

          {jobs.length === 0 && !loadingJobs && (
            <Alert severity="success">Toate joburile sunt alocate!</Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {jobs.map((job) => {
              const isSelected = selectedJob?.id === job.id;
              return (
                <Card
                  key={job.id}
                  variant="outlined"
                  sx={{
                    borderColor: isSelected ? 'primary.main' : undefined,
                    borderWidth: isSelected ? 2 : 1,
                    bgcolor: isSelected ? 'primary.50' : undefined,
                    transition: 'all 0.15s',
                  }}
                >
                  <CardActionArea onClick={() => handleSelectJob(job)}>
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography fontWeight={700} fontSize={15}>
                          {job.number || `Job ${job.id.slice(0, 8)}`}
                        </Typography>
                        {job.priority && job.priority !== 'NORMAL' && (
                          <Chip
                            label={PRIORITY_LABELS[job.priority as Priority] || job.priority}
                            size="small"
                            color={PRIORITY_COLORS[job.priority as Priority] || 'default'}
                          />
                        )}
                        {isSelected && (
                          <Chip label="Selectat" size="small" color="primary" variant="filled" />
                        )}
                      </Box>
                      {job.order_ref && (
                        <Typography variant="body2" color="text.secondary" mt={0.5}>
                          Comandă: {job.order_ref}
                        </Typography>
                      )}
                      {job.items_count !== undefined && (
                        <Typography variant="caption" color="text.secondary">
                          {job.items_count} produse
                        </Typography>
                      )}
                    </CardContent>
                  </CardActionArea>
                </Card>
              );
            })}
          </Box>
        </Grid>

        {/* ── Dreapta: Operatori online ── */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Typography variant="h6" fontWeight={600}>
              Operatori online
            </Typography>
            <Chip label={operators.length} size="small" color="success" />
            {loadingOps && <CircularProgress size={16} />}
          </Box>

          {operators.length === 0 && !loadingOps && (
            <Alert severity="warning">Niciun operator conectat momentan.</Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {operators.map((op) => (
              <Card
                key={op.socketId}
                variant="outlined"
                sx={{
                  borderColor: selectedJob ? 'success.light' : undefined,
                  transition: 'all 0.15s',
                  opacity: selectedJob ? 1 : 0.75,
                }}
              >
                <CardActionArea
                  onClick={() => handleSelectOperator(op)}
                  disabled={!selectedJob}
                >
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Badge
                        overlap="circular"
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        badgeContent={
                          <WifiIcon sx={{ fontSize: 12, color: 'success.main' }} />
                        }
                      >
                        <Box sx={{
                          width: 36, height: 36, borderRadius: '50%',
                          bgcolor: 'primary.main', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          <PersonIcon sx={{ color: '#fff', fontSize: 20 }} />
                        </Box>
                      </Badge>
                      <Box>
                        <Typography fontWeight={700} fontSize={15}>
                          {op.username}
                        </Typography>
                        <Typography variant="caption" color="success.main">
                          ● Online
                        </Typography>
                      </Box>
                      {selectedJob && (
                        <Box sx={{ ml: 'auto' }}>
                          <Button size="small" variant="contained" color="primary">
                            Asignează
                          </Button>
                        </Box>
                      )}
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        </Grid>
      </Grid>

      {/* ── Dialog confirmare asignare ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirmă asignarea</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Asignezi jobul <strong>{selectedJob?.number || selectedJob?.id?.slice(0, 8)}</strong> la operatorul{' '}
            <strong>{selectedOp?.username}</strong>.
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Prioritate:
          </Typography>
          <ToggleButtonGroup
            value={priority}
            exclusive
            onChange={(_, v) => v && setPriority(v as Priority)}
            size="small"
            fullWidth
          >
            <ToggleButton value="NORMAL">Normal</ToggleButton>
            <ToggleButton value="URGENT" sx={{ color: 'warning.main' }}>
              ⚠️ Urgent
            </ToggleButton>
            <ToggleButton value="CRITIC" sx={{ color: 'error.main' }}>
              🚨 Critic
            </ToggleButton>
          </ToggleButtonGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={assigning}>
            Anulează
          </Button>
          <Button
            variant="contained"
            onClick={handleAssign}
            disabled={assigning}
            startIcon={assigning ? <CircularProgress size={16} /> : undefined}
          >
            {assigning ? 'Se asignează...' : 'Asignează'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
