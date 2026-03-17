import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Alert, CircularProgress, Stack, TextField, Autocomplete,
  Tooltip, IconButton, Divider, Card, CardContent, LinearProgress,
  Collapse,
} from '@mui/material';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import EditIcon from '@mui/icons-material/Edit';

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

// ─── Tipuri pentru Auto-Repartizare ────────────────────────
interface PlanBatch {
  batch_id: string;
  batch_number: string;
  product_sku: string;
  product_name: string;
  quantity: number;
  unit: string;
}

interface PlanGroup {
  plan_index: number;
  type: 'EXISTING_PALLET' | 'NEW_PALLET';
  pallet_id: string | null;
  pallet_code: string;
  location_id: string | null;
  location_code: string;
  zone: string | null;
  score?: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  batches: PlanBatch[];
  // editare interactivă:
  edited_location_id?: string | null;
  edited_location_code?: string | null;
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

  // ─── State Auto-Repartizare ───────────────────────────────
  const [autoDialogOpen, setAutoDialogOpen] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoError, setAutoError] = useState('');
  const [autoPlan, setAutoPlan] = useState<PlanGroup[]>([]);
  const [autoBulkSaving, setAutoBulkSaving] = useState(false);
  const [autoBulkProgress, setAutoBulkProgress] = useState(0);
  const [autoEditIdx, setAutoEditIdx] = useState<number | null>(null);
  const [autoEditLocation, setAutoEditLocation] = useState<LocationOption | null>(null);

  const token = localStorage.getItem('accessToken');
  const hdrs = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const wcToken = localStorage.getItem('wcAccessToken') || token;
  const wcHdrs = { Authorization: `Bearer ${wcToken}`, 'Content-Type': 'application/json' };

  // ─── Inferă tipul de ambalaj din datele batch-ului ──────────────────────────
  const inferPackagingType = (batch: PendingBatch): string | null => {
    const bn = (batch.batch_number || '').toUpperCase();
    const notes = (batch.notes || '').toLowerCase();
    if (bn.startsWith('REST-') || notes.includes('rest după') || notes.includes('rest dupa')) return 'REST';
    if (bn.includes('COLAC')) return 'COLAC_100M';
    if (bn.includes('TAMBUR')) {
      const qty = batch.current_quantity || batch.cant_received || 0;
      if (qty > 1200) return 'TAMBUR_MARE';
      if (qty > 600)  return 'TAMBUR_MEDIU';
      return 'TAMBUR_MIC';
    }
    // default: colac / bobina standard
    return 'COLAC_100M';
  };

  const loadBatches = useCallback(async () => {
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

    // ── Sugestii bazate pe Reguli Putaway (S2.2) ──────────────────────────
    try {
      const packagingCode = inferPackagingType(batch);

      if (packagingCode) {
        // 1. Obține tipurile de locație recomandate, ordonate pe prioritate
        const rulesResp = await fetch(
          `${WH_API}/putaway-rules/suggest?packaging_type_code=${encodeURIComponent(packagingCode)}`,
          { headers: wcHdrs }
        );
        const rulesJson = await rulesResp.json();
        const rules: Array<{ location_type_code: string; location_type_name: string; priority: number }> =
          rulesJson.data ?? [];

        if (rules.length > 0) {
          // 2. Pentru primele 3 tipuri de locație (prio 1, 2, 3), caută locații libere
          const suggestions: LocationOption[] = [];
          for (const rule of rules.slice(0, 3)) {
            const locResp = await fetch(
              `${WH_API}/locations/available?location_type_code=${encodeURIComponent(rule.location_type_code)}&limit=5`,
              { headers: wcHdrs }
            );
            const locJson = await locResp.json();
            const locs: Array<{
              id: string; location_code: string; zone_code: string;
              zone_name: string; type_name: string; type_code: string;
            }> = locJson.data ?? [];
            for (const loc of locs) {
              suggestions.push({
                id: loc.id,
                location_code: loc.location_code,
                zone: `${loc.zone_code} — ${rule.location_type_name} (prio ${rule.priority})`,
                rack: loc.zone_name,
                score: 1 - (rule.priority - 1) * 0.2,  // scor din prioritate
              });
            }
          }
          setSuggestedLocations(suggestions);
          return; // am sugerat cu reguli → nu mai facem fallback
        }
      }
    } catch { /* suggestiile sunt opționale */ }
  };


  const handleConfirmPutaway = async () => {
    if (!selectedBatch || !selectedLocation) return;
    setSaving(true);
    setSaveError('');
    try {
      const r = await fetch(`${API}/batches/${selectedBatch.id}/confirm-putaway`, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({ location_id: selectedLocation.id }),
      });
      const j = await r.json();
      if (!j.success) {
        setSaveError(j.error || j.message || 'Eroare la confirmare putaway');
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

  // ─── Auto-Repartizare: calculează planul optim ────────────
  const handleOpenAutoPlan = async () => {
    setAutoDialogOpen(true);
    setAutoLoading(true);
    setAutoError('');
    setAutoPlan([]);
    setAutoBulkProgress(0);

    try {
      // Preia primul goods_receipt_id din lista de batches (dacă toate sunt din același NIR)
      const nirIds = [...new Set(batches.map(b => b.goods_receipt_id).filter(Boolean))];
      const body: Record<string, unknown> = nirIds.length === 1
        ? { goods_receipt_id: nirIds[0] }
        : { batch_ids: batches.map(b => b.id) };

      const r = await fetch(`${API}/batches/auto-plan`, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!j.success) {
        setAutoError(j.message || 'Eroare la calculul planului');
        return;
      }
      setAutoPlan((j.plan || []).map((g: PlanGroup) => ({
        ...g,
        edited_location_id: g.location_id,
        edited_location_code: g.location_code,
      })));
    } catch {
      setAutoError('Nu s-a putut calcula planul — verificați serverul.');
    } finally {
      setAutoLoading(false);
    }
  };

  // Editare locație pentru un grup din plan
  const applyEditToGroup = (idx: number) => {
    if (!autoEditLocation) return;
    setAutoPlan(prev => prev.map((g, i) =>
      i === idx
        ? { ...g, edited_location_id: autoEditLocation.id, edited_location_code: autoEditLocation.location_code }
        : g
    ));
    setAutoEditIdx(null);
    setAutoEditLocation(null);
  };

  // Confirmare plan în masă
  const handleBulkConfirm = async () => {
    setAutoBulkSaving(true);
    setAutoBulkProgress(0);

    const assignments = autoPlan.flatMap(group =>
      group.batches.map(b => ({
        batch_id: b.batch_id,
        location_id: group.edited_location_id || group.location_id || undefined,
        pallet_id: group.pallet_id || undefined,
      }))
    ).filter(a => a.location_id || a.pallet_id);

    if (assignments.length === 0) {
      setAutoError('Nicio asignare validă — verificați că toate grupurile au o locație sau un palet.');
      setAutoBulkSaving(false);
      return;
    }

    try {
      const r = await fetch(`${API}/batches/bulk-assign`, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({ assignments }),
      });
      const j = await r.json();
      if (!j.success) {
        setAutoError(j.message || 'Eroare la asignarea în masă');
        return;
      }
      setAutoBulkProgress(100);
      setDoneCount(c => c + (j.assigned_count || 0));
      // Elimină din lista principală batchurile asignate
      const assignedIds = new Set(assignments.map(a => a.batch_id));
      setBatches(prev => prev.filter(b => !assignedIds.has(b.id)));
      setAutoDialogOpen(false);
      setAutoPlan([]);
    } catch {
      setAutoError('Eroare de rețea la confirmare.');
    } finally {
      setAutoBulkSaving(false);
    }
  };

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
          {batches.length > 0 && (
            <Button
              variant="contained"
              color="secondary"
              startIcon={<AutoFixHighIcon />}
              onClick={handleOpenAutoPlan}
            >
              Auto-Repartizare ({batches.length})
            </Button>
          )}
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
                    Locații Sugerate de Reguli WMS
                    {selectedBatch && (
                      <Chip
                        label={inferPackagingType(selectedBatch) ?? '?'}
                        size="small"
                        color="info"
                        sx={{ ml: 1, fontFamily: 'monospace', fontWeight: 700 }}
                      />
                    )}
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

              {/* QR Code batch */}
              {selectedBatch && (() => {
                const qrData = JSON.stringify({
                  t: 'BATCH',
                  bn: selectedBatch.batch_number,
                  mat: selectedBatch.product_name,
                  qty: selectedBatch.length_meters
                    ? selectedBatch.length_meters / 1000
                    : selectedBatch.cant_received,
                  unit: selectedBatch.length_meters ? 'Km' : selectedBatch.unit,
                  nir: selectedBatch.nir_number,
                });
                return (
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                    <QRCodeSVG value={qrData} size={88} level="M" />
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block">Cod QR Batch</Typography>
                      <Typography fontFamily="monospace" fontSize="0.75rem" fontWeight={700} color="primary.main">
                        {selectedBatch.batch_number}
                      </Typography>
                      {selectedBatch.notes && (
                        <Typography fontSize="0.72rem" color="text.secondary" mt={0.5}>
                          {selectedBatch.notes.split(' | ')[0]}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              })()}
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

      {/* ═══════════════════════════════════════════════════
          Modal Auto-Repartizare NIR
          ═══════════════════════════════════════════════════ */}
      <Dialog open={autoDialogOpen} onClose={() => !autoBulkSaving && setAutoDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <AutoFixHighIcon color="secondary" />
            <span>Auto-Repartizare Putaway</span>
            {autoPlan.length > 0 && (
              <Chip
                size="small"
                label={`${autoPlan.reduce((s, g) => s + g.batches.length, 0)} batches · ${autoPlan.length} grupe`}
                color="info"
              />
            )}
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          {/* Loading */}
          {autoLoading && (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <CircularProgress size={48} />
              <Typography variant="body2" color="text.secondary" mt={2}>
                Se calculează planul optim de depozitare...
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Se verifică paleți existenți și se calculează locații optime
              </Typography>
            </Box>
          )}

          {/* Eroare */}
          {autoError && !autoLoading && (
            <Box sx={{ p: 3 }}>
              <Alert severity="error">{autoError}</Alert>
            </Box>
          )}

          {/* Plan propus */}
          {!autoLoading && autoPlan.length > 0 && (
            <Box>
              <Box sx={{ px: 3, pt: 2, pb: 1 }}>
                <Alert severity="info" sx={{ mb: 1 }}>
                  WMS a creat un plan de repartizare. Verificați locațiile și apăsați <strong>Confirmă Planul</strong>.
                  Puteți modifica locația oricărui grup înainte de confirmare.
                </Alert>
              </Box>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Palet</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Locație</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Produs</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Nr. Batches</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Tip</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Confidență</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Acțiuni</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {autoPlan.map((group, idx) => (
                      <>
                        <TableRow
                          key={group.plan_index}
                          sx={{
                            bgcolor: group.type === 'EXISTING_PALLET' ? 'success.50' : 'warning.50',
                            '&:hover': { opacity: 0.9 },
                          }}
                        >
                          <TableCell>{group.plan_index}</TableCell>
                          <TableCell>
                            <Typography fontFamily="monospace" fontWeight={700} fontSize="0.85rem">
                              {group.pallet_code}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {group.edited_location_code && group.edited_location_code !== 'NEALOCAT' ? (
                              <Chip
                                label={group.edited_location_code}
                                size="small"
                                color={group.edited_location_id !== group.location_id ? 'warning' : 'default'}
                                icon={<LocationOnIcon />}
                              />
                            ) : (
                              <Chip label="NEALOCAT" size="small" color="error" variant="outlined" />
                            )}
                            {group.zone && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                {group.zone}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography fontSize="0.82rem">
                              {group.batches[0]?.product_name || group.batches[0]?.product_sku}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={`${group.batches.length} batches`} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={group.type === 'EXISTING_PALLET' ? 'Palet existent' : 'Palet nou'}
                              size="small"
                              color={group.type === 'EXISTING_PALLET' ? 'success' : 'warning'}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={group.confidence}
                              size="small"
                              color={group.confidence === 'HIGH' ? 'success' : group.confidence === 'MEDIUM' ? 'warning' : 'error'}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Tooltip title="Modifică locația">
                              <IconButton size="small" onClick={() => {
                                setAutoEditIdx(idx);
                                setAutoEditLocation(null);
                              }}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>

                        {/* Panou editare locație pentru grup */}
                        {autoEditIdx === idx && (
                          <TableRow key={`edit-${group.plan_index}`}>
                            <TableCell colSpan={8} sx={{ bgcolor: 'primary.50', p: 2 }}>
                              <Stack direction="row" spacing={2} alignItems="center">
                                <Autocomplete
                                  sx={{ flex: 1 }}
                                  options={locations}
                                  getOptionLabel={l => `${l.location_code} — ${l.zone}${l.rack ? ` / ${l.rack}` : ''}`}
                                  value={autoEditLocation}
                                  onChange={(_, v) => setAutoEditLocation(v)}
                                  renderInput={p => (
                                    <TextField {...p} size="small" label="Selectați locație nouă" />
                                  )}
                                  isOptionEqualToValue={(o, v) => o.id === v.id}
                                />
                                <Button
                                  variant="contained"
                                  size="small"
                                  disabled={!autoEditLocation}
                                  onClick={() => applyEditToGroup(idx)}
                                >
                                  Aplică
                                </Button>
                                <Button size="small" onClick={() => setAutoEditIdx(null)}>
                                  Anulează
                                </Button>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        )}

                        {/* Batches din grup (colapsabil) */}
                        <TableRow key={`batches-${group.plan_index}`}>
                          <TableCell colSpan={8} sx={{ py: 0, bgcolor: 'grey.50' }}>
                            <Collapse in={true}>
                              <Box sx={{ pl: 6, py: 0.5 }}>
                                {group.batches.map(b => (
                                  <Typography key={b.batch_id} variant="caption" color="text.secondary" display="block" fontFamily="monospace">
                                    {b.batch_number} · {b.quantity} {b.unit}
                                  </Typography>
                                ))}
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Progress bar la salvare */}
              {autoBulkSaving && (
                <Box sx={{ px: 3, py: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Se salvează asignările...
                  </Typography>
                  <LinearProgress variant={autoBulkProgress > 0 ? 'determinate' : 'indeterminate'} value={autoBulkProgress} />
                </Box>
              )}
            </Box>
          )}

          {/* Plan gol */}
          {!autoLoading && !autoError && autoPlan.length === 0 && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">Niciun batch de repartizat.</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setAutoDialogOpen(false)} disabled={autoBulkSaving}>
            Anulează
          </Button>
          {autoPlan.length > 0 && (
            <Button
              variant="contained"
              color="success"
              onClick={handleBulkConfirm}
              disabled={autoBulkSaving || autoPlan.some(g => !g.edited_location_id && !g.location_id)}
              startIcon={autoBulkSaving ? <CircularProgress size={16} /> : <CheckCircleIcon />}
            >
              {autoBulkSaving
                ? 'Se salvează...'
                : `Confirmă Planul (${autoPlan.reduce((s, g) => s + g.batches.length, 0)} batches)`}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
