import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  Stack,
  CircularProgress,
} from '@mui/material';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import axios from 'axios';

const INVENTORY_API = 'http://localhost:3011';

interface Props {
  open: boolean;
  onClose: () => void;
  productSku: string;
  defaultBatchId?: string; // optional: when launched from a specific batch row
  defaultQuantity?: number; // current quantity hint
  onSuccess: () => void;
}

interface BatchSuggestion {
  id: string;
  batch_number: string;
  current_quantity: number;
  location?: string;
  waste_quantity: number;
  waste_percent: number;
}

export const CutSimulatorDialog = ({ open, onClose, productSku, defaultBatchId, defaultQuantity, onSuccess }: Props) => {
  const [quantity, setQuantity] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestion, setSuggestion] = useState<BatchSuggestion | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | undefined>(defaultBatchId);

  useEffect(() => {
    if (!open) return;
    setError('');
    setSuggestion(null);
    setQuantity('');
    setSelectedBatchId(defaultBatchId);
  }, [open, defaultBatchId]);

  const canSimulate = useMemo(() => {
    const q = parseFloat(quantity);
    return open && !isNaN(q) && q > 0;
  }, [open, quantity]);

  const simulate = async () => {
    if (!canSimulate) return;
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({
        product_sku: productSku,
        required_quantity: String(parseFloat(quantity)),
        method: 'MIN_WASTE',
      });
      const res = await axios.get(`${INVENTORY_API}/api/v1/batches/select?${params.toString()}`);
      const data = res.data;
      if (data?.success && data.selectedBatch) {
        setSuggestion({
          id: data.selectedBatch.id,
          batch_number: data.selectedBatch.batch_number,
          current_quantity: Number(data.selectedBatch.current_quantity),
          location: data.selectedBatch.location,
          waste_quantity: Number(data.selectedBatch.waste_quantity),
          waste_percent: Number(data.selectedBatch.waste_percent),
        });
        setSelectedBatchId(data.selectedBatch.id);
      } else {
        setError('Nu am găsit un tambur disponibil pentru această cantitate.');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Eroare la simulare';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const performCut = async () => {
    if (!selectedBatchId) {
      setError('Nu există un tambur selectat.');
      return;
    }
    const q = parseFloat(quantity);
    if (!q || q <= 0) {
      setError('Cantitatea trebuie să fie > 0');
      return;
    }
    try {
      setLoading(true);
      setError('');
      await axios.post(`${INVENTORY_API}/api/v1/transformations`, {
        type: 'CUT',
        source_batch_id: selectedBatchId,
        source_quantity: q,
        selection_method: 'MIN_WASTE',
        notes: 'Cut via Web UI',
      });
      onSuccess();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Eroare la înregistrarea tăierii';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ContentCutIcon fontSize="small" /> Simulare Tăiere — {productSku}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {!!error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Cantitate de tăiat (m)"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            helperText={defaultQuantity ? `Cantitate disponibilă exemplar curent ~ ${defaultQuantity}` : undefined}
            inputProps={{ min: 0, step: 'any' }}
            fullWidth
          />

          <Box>
            <Button variant="outlined" onClick={simulate} disabled={!canSimulate || loading}>
              Simulează tambur optim
            </Button>
          </Box>

          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={22} />
            </Box>
          )}

          {suggestion && (
            <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="subtitle2">Tambur sugerat</Typography>
              <Typography variant="body2">
                #{suggestion.batch_number} — {suggestion.current_quantity} m disponibili
              </Typography>
              {suggestion.location && (
                <Typography variant="caption" color="text.secondary">
                  Locație: {suggestion.location}
                </Typography>
              )}
              <Typography variant="caption" display="block">
                Risipă estimată: {suggestion.waste_quantity} m ({suggestion.waste_percent}%)
              </Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Anulează</Button>
        <Button onClick={performCut} variant="contained" disabled={!suggestion || loading}>
          Confirmă tăierea
        </Button>
      </DialogActions>
    </Dialog>
  );
}
