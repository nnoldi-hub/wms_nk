import { useEffect, useState, useCallback, useContext } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Table, TableHead, TableRow, TableCell, TableBody, LinearProgress, Stack, IconButton, Tooltip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import GppMaybeIcon from '@mui/icons-material/GppMaybe';
import { pickingService, type PickJob, type PickJobItem } from '../services/picking.service';
import { AuthContext } from '../contexts/AuthContextShared';

interface Props {
  open: boolean;
  jobId: string | null;
  onClose: () => void;
  onChanged?: () => void; // notify parent to refresh list
}

export const PickJobDetailsDialog = ({ open, jobId, onClose, onChanged }: Props) => {
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState<PickJob | null>(null);
  const [items, setItems] = useState<PickJobItem[]>([]);
  const [busy, setBusy] = useState(false);
  const auth = useContext(AuthContext);
  const currentUser = auth?.user?.username || auth?.user?.email || String(auth?.user?.id || '');

  const load = useCallback(async () => {
    if (!open || !jobId) return;
    setLoading(true);
    try {
      const res = await pickingService.getJob(jobId);
      setJob(res.data.job);
      setItems(res.data.items);
    } finally {
      setLoading(false);
    }
  }, [open, jobId]);

  useEffect(() => { load(); }, [load]);

  const handlePickOne = async (itemId: string) => {
    if (!jobId) return;
    setBusy(true);
    try {
      await pickingService.pick(jobId, { item_id: itemId, qty: 1 });
      await load();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async (force = false) => {
    if (!jobId) return;
    if (force && !confirm('Finalizezi jobul cu force?')) return;
    setBusy(true);
    try {
      await pickingService.complete(jobId, force);
      await load();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const handleAcceptItem = async (itemId: string) => {
    if (!jobId) return;
    setBusy(true);
    try {
      await pickingService.acceptItem(jobId, itemId);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleReleaseItem = async (itemId: string) => {
    if (!jobId) return;
    setBusy(true);
    try {
      await pickingService.releaseItem(jobId, itemId);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Pick Job {job?.number} ({job?.status})</DialogTitle>
      <DialogContent>
        {loading && <LinearProgress sx={{ mb: 2 }} />}
        {job && (
          <Box mb={2}>
            <Typography variant="body2">Comanda: {job.order_id || '-'}</Typography>
            {job.assigned_to && <Typography variant="body2">Asignat: {job.assigned_to}</Typography>}
            {job.created_at && <Typography variant="body2">Creat: {new Date(job.created_at).toLocaleString()}</Typography>}
          </Box>
        )}

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>SKU</TableCell>
              <TableCell>Lot</TableCell>
              <TableCell>UM</TableCell>
              <TableCell align="right">Solicitat</TableCell>
              <TableCell align="right">Cules</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Asignat</TableCell>
              <TableCell>Acțiuni</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map(it => (
              <TableRow key={it.id}>
                <TableCell>{it.product_sku}</TableCell>
                <TableCell>{it.lot_label || ''}</TableCell>
                <TableCell>{it.uom || ''}</TableCell>
                <TableCell align="right">{it.requested_qty}</TableCell>
                <TableCell align="right">{it.picked_qty || 0}</TableCell>
                <TableCell>{it.status}</TableCell>
                <TableCell>{it.assigned_to || '-'}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Tooltip title="Acceptă linie">
                      <span>
                        <Button size="small" variant="outlined" onClick={() => handleAcceptItem(it.id)} disabled={busy || !!it.assigned_to && it.assigned_to !== currentUser}>Acceptă</Button>
                      </span>
                    </Tooltip>
                    <Tooltip title="Eliberează linie">
                      <span>
                        <Button size="small" onClick={() => handleReleaseItem(it.id)} disabled={busy || !it.assigned_to || it.assigned_to !== currentUser}>Eliberează</Button>
                      </span>
                    </Tooltip>
                  <Tooltip title="+1 pick">
                    <span>
                      <IconButton size="small" onClick={() => handlePickOne(it.id)} disabled={busy || (it.picked_qty ?? 0) >= it.requested_qty}>
                        <AddIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions>
        <Stack direction="row" spacing={1} sx={{ mr: 'auto' }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading || busy}>Reîncarcă</Button>
        </Stack>
        <Button onClick={() => handleComplete(false)} startIcon={<CheckCircleIcon />} disabled={busy}>Finalizează</Button>
        <Button onClick={() => handleComplete(true)} startIcon={<GppMaybeIcon />} disabled={busy}>Finalizează (force)</Button>
        <Button onClick={onClose} variant="contained">Închide</Button>
      </DialogActions>
    </Dialog>
  );
};

export default PickJobDetailsDialog;
