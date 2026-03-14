import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Alert, CircularProgress, Stack, TextField, Autocomplete,
  Tooltip, IconButton, Divider, Card, CardContent,
} from '@mui/material';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';

const API = 'http://localhost:3011/api/v1';
const WH_API = 'http://localhost:3020/api/v1';

interface PendingBatch {
  id: string;
  batch_number: string;
  product_sku: string;
  product_name: string;
  current_quantity: number;
  length_meters: number | null;
  unit: string;
  cant_received: number;
  status: string;
  notes: string;
  nir_number: string;
  supplier_name: string;
  receipt_date: string;
  goods_receipt_id: string;
  created_at: string;
}

interface LocationOption {
  id: string;
  location_code: string;
  zone: string;
  rack?: string;
  position?: string;
  score?: number;
}

export default function PutawayTasksPage() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState<PendingBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<PendingBatch | null>(null);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [suggestedLocations, setSuggestedLocations] = useState<LocationOption[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(null);
  const [confirmationType, setConfirmationType] = useState<'NORMAL' | 'TEMP' | 'CARANTINA'>('NORMAL');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [doneCount, setDoneCount] = useState(0);

  const token = localStorage.getItem('accessToken');
  const hdrs = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const loadPendingBatches = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${API}/batches/pending-putaway?limit=200`, { headers: hdrs });
      const j = await r.json();
      if (j.success) {
        setBatches(j.data);
      } else {
        setError(j.message || 'Eroare la încărcare sarcini putaway');
      }
    } catch {
      setError('Nu s-a putut contacta serverul. Verificați serviciul de inventar.');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadLocations = useCallback(async () => {
    try {
      const r = await fetch(`${API}/locations?limit=500&is_active=true`, { headers: hdrs });
      const j = await r.json();
      const list = (j.data || j.locations || j || []) as Array<{
        id: string; location_code: string; zone: string; rack?: string; position?: string;
      }>;
      setLocations(list.map(l => ({
        id: l.id,
        location_code: l.location_code,
        zone: l.zone,
        rack: l.rack,
        position: l.position,
      })));
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    loadPendingBatches();
    loadLocations();
  }, [loadPendingBatches, loadLocations]);

  const openPutawayDialog = async (batch: PendingBatch) => {
    setSelectedBatch(batch);
    setSelectedLocation(null);
    setConfirmationType('NORMAL');
    setSaveError('');
    setSuggestedLocations([]);
    setDialogOpen(true);

    // Sugereaza locatii automat
    try {
      const locResp = await fetch(`${API}/locations?is_active=true&limit=1`, { headers: hdrs });
      const locJ = await locResp.json();
      const locs = (locJ.data || locJ.locations || locJ || []) as Array<{ warehouse_id?: string }>;
      const warehouseId = locs[0]?.warehouse_id ?? '00000000-0000-0000-0000-000000000001';

      const r = await fetch(`${WH_API}/suggest/putaway`, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({
          warehouse_id: warehouseId,
          product_sku: batch.product_sku,
          quantity: batch.cant_received || batch.current_quantity,
          uom: batch.unit || 'Km',
          product: { name: batch.product_name, category: 'CABLU' },
          limit: 5,
        }),
      });
      const j = await r.json();
      const suggestions = (j.suggestions || j.data || []) as Array<{
        location?: { id?: string; location_code?: string; zone?: string; rack?: string; position?: string };
        id?: string; location_code?: string; zone?: string; rack?: string; position?: string; score?: number;
      }>;
      setSuggestedLocations(suggestions.map(s => ({
        id: s.location?.id ?? s.id ?? '',
        location_code: s.location?.location_code ?? s.location_code ?? '',
        zone: s.location?.zone ?? s.zone ?? '',
        rack: s.location?.rack ?? s.rack,
        position: s.location?.position ?? s.position,
        score: s.score,
      })));
    } catch { /* suggestiile sunt optionale */ }
  };

  const handleConfirmPutaway = async () => {
    if (!selectedBatch || !selectedLocation) return;
    setSaving(true);
    setSaveError('');
    try {
      // Actualizeaza batch cu locatia selectata
      const r = await fetch(`${API}/batches/${selectedBatch.id}`, {
        method: 'PUT',
        headers: hdrs,
        body: JSON.stringify({
          location_id: selectedLocation.id,
          notes: [
            selectedBatch.notes,
            `Putaway: ${selectedLocation.location_code}`,
            confirmationType !== 'NORMAL' ? `Tip: ${confirmationType}` : '',
          ].filter(Boolean).join(' | '),
        }),
      });
      const j = await r.json();
      if (!j.success) {
        setSaveError(j.message || 'Eroare la confirmare putaway');
        return;
      }
      setDoneCount(c => c + 1);
      setDialogOpen(false);
      setBatches(prev => prev.filter(b => b.id !== selectedBatch.id));
    } finally {
      setSaving(false);
    }
  };

  const typeColor = (t: string) =>
    t === 'CARANTINA' ? 'error' : t === 'TEMP' ? 'warning' : 'success';

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <WarehouseIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Box>
              <Typography variant="h4">Sarcini Putaway</Typography>
              <Typography variant="body2" color="text.secondary">
                Batches receptionate care așteaptă asignarea unei locații în depozit
              </Typography>
            </Box>
          </Stack>
        </Box>
        <Stack direction="row" spacing={1}>
          {doneCount > 0 && (
            <Chip
              icon={<CheckCircleIcon />}
              label={`${doneCount} confirmate în această sesiune`}
              color="success"
              variant="outlined"
            />
          )}
          <Tooltip title="Reîncarcă lista">
            <IconButton onClick={loadPendingBatches} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<ReceiptLongIcon />}
            onClick={() => navigate('/receptie-nir')}
          >
            NIR Nou
          </Button>
          <Button
            variant="outlined"
            startIcon={<QrCodeScannerIcon />}
            onClick={() => navigate('/scan')}
          >
            Scanare
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CircularProgress size={48} />
          <Typography variant="body2" color="text.secondary" mt={2}>
            Se încarcă sarcinile putaway...
          </Typography>
        </Box>
      ) : batches.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', border: '2px dashed', borderColor: 'success.main' }}>
          <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" color="success.main" gutterBottom>
            Toate batches-urile sunt depozitate!
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Nu există batch-uri care să aștepte asignarea unei locații.
          </Typography>
          <Button
            variant="contained"
            sx={{ mt: 3 }}
            onClick={() => navigate('/receptie-nir')}
            startIcon={<ReceiptLongIcon />}
          >
            Crează NIR Nou
          </Button>
        </Paper>
      ) : (
        <>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <strong>{batches.length} batch-uri</strong> așteaptă asignarea unei locații de depozitare.
            Apasă <strong>„Asignează Locație"</strong> pentru fiecare pentru a finaliza putaway-ul.
          </Alert>

          <TableContainer component={Paper} elevation={2}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  {['Batch / Lot', 'Produs', 'Cantitate', 'NIR', 'Furnizor', 'Data Receptie', 'Acțiuni'].map(h => (
                    <TableCell key={h} sx={{ color: 'white', fontWeight: 700 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {batches.map(b => (
                  <TableRow key={b.id} hover>
                    <TableCell>
                      <Typography fontFamily="monospace" fontSize="0.85rem" fontWeight={700} color="primary.main">
                        {b.batch_number}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography fontSize="0.85rem" fontWeight={500}>{b.product_name}</Typography>
                      <Typography fontSize="0.75rem" color="text.secondary" fontFamily="monospace">
                        {b.product_sku}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={600}>
                        {b.length_meters
                          ? `${(b.length_meters / 1000).toFixed(3)} Km`
                          : `${b.cant_received} ${b.unit}`}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={b.nir_number}
                        size="small"
                        color="info"
                        variant="outlined"
                        onClick={() => navigate(`/receptie-nir`)}
                        sx={{ fontFamily: 'monospace', cursor: 'pointer' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography fontSize="0.85rem">{b.supplier_name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography fontSize="0.85rem">
                        {b.receipt_date ? new Date(b.receipt_date).toLocaleDateString('ro-RO') : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="contained"
                        size="small"
                        color="primary"
                        startIcon={<LocationOnIcon />}
                        onClick={() => openPutawayDialog(b)}
                      >
                        Asignează Locație
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* Dialog Asignare Locație */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <LocationOnIcon color="primary" />
            <span>Asignare Locație Putaway</span>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {selectedBatch && (
            <Stack spacing={3}>
              {/* Info batch */}
              <Card variant="outlined" sx={{ bgcolor: 'grey.50' }}>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="subtitle2" color="primary" fontFamily="monospace" fontWeight={700}>
                    {selectedBatch.batch_number}
                  </Typography>
                  <Typography variant="body2">{selectedBatch.product_name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedBatch.length_meters
                      ? `${(selectedBatch.length_meters / 1000).toFixed(3)} Km`
                      : `${selectedBatch.cant_received} ${selectedBatch.unit}`}
                    {' · NIR: '}{selectedBatch.nir_number}
                    {' · '}{selectedBatch.supplier_name}
                  </Typography>
                </CardContent>
              </Card>

              {/* Tip destinatie */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>Tip Destinație</Typography>
                <Stack direction="row" spacing={1}>
                  {(['NORMAL', 'TEMP', 'CARANTINA'] as const).map(t => (
                    <Chip
                      key={t}
                      label={t === 'NORMAL' ? '✅ Normal' : t === 'TEMP' ? '⏱ Temporar' : '🚫 Carantină'}
                      color={typeColor(t)}
                      variant={confirmationType === t ? 'filled' : 'outlined'}
                      onClick={() => setConfirmationType(t)}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Stack>
              </Box>

              <Divider />

              {/* Locatii sugerate */}
              {suggestedLocations.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Locații Sugerate de WMS
                  </Typography>
                  <Stack spacing={1}>
                    {suggestedLocations.map(loc => (
                      <Paper
                        key={loc.id}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          cursor: 'pointer',
                          border: selectedLocation?.id === loc.id ? '2px solid' : '1px solid',
                          borderColor: selectedLocation?.id === loc.id ? 'primary.main' : 'divider',
                          bgcolor: selectedLocation?.id === loc.id ? 'primary.50' : 'transparent',
                          '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.50' },
                        }}
                        onClick={() => setSelectedLocation(loc)}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Typography fontFamily="monospace" fontWeight={700} fontSize="0.9rem">
                              {loc.location_code}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Zonă: {loc.zone}{loc.rack ? ` · Raft: ${loc.rack}` : ''}{loc.position ? ` · Pos: ${loc.position}` : ''}
                            </Typography>
                          </Box>
                          {loc.score !== undefined && (
                            <Chip
                              label={`Scor: ${Math.round((loc.score ?? 0) * 100)}%`}
                              size="small"
                              color="success"
                              variant="outlined"
                            />
                          )}
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              )}

              {/* Selectare manuala locatie */}
              <Autocomplete
                options={locations}
                getOptionLabel={loc => `${loc.location_code} — ${loc.zone}${loc.rack ? ` / ${loc.rack}` : ''}`}
                value={selectedLocation}
                onChange={(_, v) => setSelectedLocation(v)}
                renderInput={params => (
                  <TextField
                    {...params}
                    label="Sau caută locație manual"
                    placeholder="ex: A-01-B-05"
                  />
                )}
                isOptionEqualToValue={(o, v) => o.id === v.id}
              />

              {saveError && <Alert severity="error">{saveError}</Alert>}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>
            Anulează
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleConfirmPutaway}
            disabled={!selectedLocation || saving}
            startIcon={saving ? <CircularProgress size={16} /> : <CheckCircleIcon />}
          >
            {saving ? 'Se salvează...' : 'Confirmă Putaway'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
