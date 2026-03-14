/**
 * CutItemDialog — dialog pentru înregistrarea tăierii fizice dintr-un lot de cablu.
 *
 * Fluxul:
 * 1. Se deschide cu informațiile liniei de picking (SKU, lot, cantitate solicitată)
 * 2. Caută automat batch-urile disponibile pentru acel SKU + lot
 * 3. Operatorul selectează batch-ul fizic (dacă sunt mai multe) și introduce cantitatea tăiată
 * 4. Dialogul calculează restul = batch.current_quantity - cut_qty
 * 5. La confirmare, apelează POST /pick-jobs/:id/items/:itemId/cut
 * 6. Afișează batch-ul de rest creat, cu numărul său nou
 */

import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Typography, Box, Stack, Alert,
  MenuItem, Select, FormControl, InputLabel, LinearProgress, Chip,
  Divider,
} from '@mui/material';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { pickingService, type PickJobItem } from '../services/picking.service';

const INVENTORY_API = 'http://localhost:3011/api/v1';

const apiClient = axios.create({ baseURL: INVENTORY_API });
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    const headers = (config.headers ?? {}) as Record<string, string>;
    headers.Authorization = `Bearer ${token}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config.headers = headers as any;
  }
  return config;
});

interface Batch {
  id: string;
  batch_number: string;
  product_sku: string;
  current_quantity: number;
  initial_quantity: number;
  length_meters: number | null;
  weight_kg: number | null;
  status: string;
  location_id: string | null;
}

interface CutResult {
  remainder_batch: { id: string; batch_number: string; current_quantity: number } | null;
  source_batch_number: string;
  cut_qty: number;
  remainder_qty: number;
  transformation: { transformation_number: string };
}

interface Props {
  open: boolean;
  jobId: string;
  item: PickJobItem | null;
  onClose: () => void;
  onDone: () => void;
}

export const CutItemDialog = ({ open, jobId, item, onClose, onDone }: Props) => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [cutQty, setCutQty] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CutResult | null>(null);

  const selectedBatch = batches.find(b => b.id === selectedBatchId) ?? null;
  const cutQtyNum = Number(cutQty.replace(',', '.'));
  const remainder = selectedBatch ? Math.max(0, Number(selectedBatch.current_quantity) - cutQtyNum) : null;

  // Validare câmp cut_qty
  const cutQtyValid = Number.isFinite(cutQtyNum) && cutQtyNum > 0
    && (!selectedBatch || cutQtyNum <= Number(selectedBatch.current_quantity) + 0.001);

  // Încarcă batch-urile disponibile pentru SKU + (opțional) lot_label
  useEffect(() => {
    if (!open || !item) return;
    setLoadingBatches(true);
    setError('');
    setResult(null);
    setCutQty('');
    setSelectedBatchId('');

    const params = new URLSearchParams({ product_sku: item.product_sku, status: 'INTACT', limit: '50' });
    apiClient.get(`/batches?${params.toString()}`)
      .then(res => {
        const allBatches: Batch[] = res.data?.data ?? [];
        // Filtrare suplimentară după lot dacă există
        const filtered = item.lot_label
          ? allBatches.filter(b =>
              b.batch_number.includes(item.lot_label!) ||
              String(b.batch_number).toLowerCase().includes(String(item.lot_label!).toLowerCase())
            )
          : allBatches;
        setBatches(filtered.length > 0 ? filtered : allBatches);
        if ((filtered.length === 1) || (allBatches.length === 1)) {
          setSelectedBatchId((filtered.length === 1 ? filtered : allBatches)[0].id);
        }
      })
      .catch(() => setError('Nu am putut incarca batch-urile disponibile.'))
      .finally(() => setLoadingBatches(false));
  }, [open, item]);

  const handleConfirm = async () => {
    if (!item || !selectedBatchId || !cutQtyValid) return;
    setBusy(true);
    setError('');
    try {
      const res = await pickingService.cutItem(jobId, item.id, {
        cut_qty: cutQtyNum,
        source_batch_id: selectedBatchId,
      });
      setResult(res.data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } }; message?: string })
        ?.response?.data?.message ?? (e as { message?: string })?.message ?? 'Eroare la taiere';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (result) onDone();
    else onClose();
  };

  if (!item) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <ContentCutIcon color="primary" />
          <span>Taiere produs — {item.product_sku}</span>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {/* Linie informații */}
        <Box sx={{ mb: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="body2"><b>SKU:</b> {item.product_sku}</Typography>
          {item.lot_label && <Typography variant="body2"><b>Lot:</b> {item.lot_label}</Typography>}
          <Typography variant="body2"><b>Cantitate solicitată:</b> {item.requested_qty} {item.uom}</Typography>
          <Typography variant="body2"><b>Status linie:</b> <Chip size="small" label={item.status} /></Typography>
        </Box>

        {result ? (
          /* Rezultat tăiere */
          <Box>
            <Alert icon={<CheckCircleIcon />} severity="success" sx={{ mb: 2 }}>
              Tăierea a fost înregistrată cu succes!
            </Alert>
            <Stack spacing={1}>
              <Typography variant="body2"><b>Batch sursă:</b> {result.source_batch_number} → EMPTY</Typography>
              <Typography variant="body2"><b>Cantitate tăiată (livrată):</b> {result.cut_qty} {item.uom}</Typography>
              <Typography variant="body2"><b>Transformare:</b> {result.transformation.transformation_number}</Typography>
              {result.remainder_batch ? (
                <Alert severity="info">
                  <b>Batch rest creat:</b> {result.remainder_batch.batch_number}<br />
                  Cantitate rest: {result.remainder_qty} {item.uom}<br />
                  <Typography variant="caption" color="text.secondary">
                    Depuneți restul la locația originală sau mutați-l manual.
                  </Typography>
                </Alert>
              ) : (
                <Alert severity="warning">Nu există rest (cablu consumat integral).</Alert>
              )}
            </Stack>
          </Box>
        ) : (
          /* Formular tăiere */
          <Stack spacing={2} sx={{ mt: 1 }}>
            {loadingBatches && <LinearProgress />}

            {/* Selecție batch sursă */}
            <FormControl fullWidth size="small" disabled={loadingBatches || busy}>
              <InputLabel>Batch / Rolă fizică</InputLabel>
              <Select
                value={selectedBatchId}
                label="Batch / Rolă fizică"
                onChange={e => setSelectedBatchId(e.target.value)}
              >
                {batches.map(b => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.batch_number} — {b.current_quantity} {item.uom}
                    {b.location_id ? ` (${b.location_id})` : ''}
                    {b.weight_kg ? ` · ${b.weight_kg} kg` : ''}
                  </MenuItem>
                ))}
                {batches.length === 0 && !loadingBatches && (
                  <MenuItem disabled>Nu există batch-uri INTACT pentru acest produs</MenuItem>
                )}
              </Select>
            </FormControl>

            {/* Info batch selectat */}
            {selectedBatch && (
              <Box sx={{ p: 1.5, bgcolor: 'primary.50', borderRadius: 1, border: '1px solid', borderColor: 'primary.200' }}>
                <Typography variant="body2"><b>Disponibil pe rolă:</b> {selectedBatch.current_quantity} {item.uom}</Typography>
                {selectedBatch.weight_kg && (
                  <Typography variant="body2"><b>Greutate totală rolă:</b> {selectedBatch.weight_kg} kg</Typography>
                )}
                {selectedBatch.location_id && (
                  <Typography variant="body2"><b>Locație:</b> {selectedBatch.location_id}</Typography>
                )}
              </Box>
            )}

            <Divider />

            {/* Cantitate tăiată */}
            <TextField
              label={`Cantitate tăiată (${item.uom || 'unitate'})`}
              value={cutQty}
              onChange={e => setCutQty(e.target.value)}
              size="small"
              fullWidth
              disabled={!selectedBatchId || busy}
              helperText={
                selectedBatch && cutQtyNum > 0 && cutQtyValid
                  ? `Rest care revine în stoc: ${remainder?.toFixed(3)} ${item.uom}`
                  : selectedBatch && cutQtyNum > Number(selectedBatch.current_quantity)
                    ? '⚠️ Depășești cantitatea disponibilă pe rolă!'
                    : 'Introduceți cantitatea fizică tăiată pentru clientul acestei comenzi'
              }
              error={!!cutQty && (!cutQtyValid || cutQtyNum <= 0)}
              inputProps={{ inputMode: 'decimal' }}
            />

            {/* Preview rest */}
            {selectedBatch && cutQtyNum > 0 && cutQtyValid && (
              <Alert
                severity={(remainder ?? 0) > 0.001 ? 'info' : 'warning'}
                icon={(remainder ?? 0) > 0.001 ? undefined : <WarningAmberIcon />}
              >
                {(remainder ?? 0) > 0.001 ? (
                  <>
                    <b>Rest ce va fi creat în stoc:</b> {remainder!.toFixed(3)} {item.uom}
                    {selectedBatch.weight_kg && (
                      <span> · {(Number(selectedBatch.weight_kg) * (remainder! / Number(selectedBatch.current_quantity))).toFixed(2)} kg</span>
                    )}
                    <br />
                    <Typography variant="caption">Restul va primi un nou număr de batch și va rămâne la aceeași locație.</Typography>
                  </>
                ) : (
                  <>Cantitatea acoperă tot batch-ul — nu va rămâne rest.</>
                )}
              </Alert>
            )}

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        {result ? (
          <Button variant="contained" onClick={handleClose}>Inchide</Button>
        ) : (
          <>
            <Button onClick={handleClose} disabled={busy}>Anuleaza</Button>
            <Button
              variant="contained"
              startIcon={<ContentCutIcon />}
              onClick={() => void handleConfirm()}
              disabled={!selectedBatchId || !cutQtyValid || busy || !!result}
            >
              {busy ? 'Se proceseaza...' : 'Confirma Taierea'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CutItemDialog;
