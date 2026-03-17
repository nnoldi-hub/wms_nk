import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Alert, CircularProgress, Stack, TextField, Autocomplete,
  Tooltip, IconButton, Card, CardContent, LinearProgress, Tabs, Tab,
  Switch, FormControlLabel, Divider,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import InventoryIcon from '@mui/icons-material/Inventory';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SettingsIcon from '@mui/icons-material/Settings';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { QRCodeSVG } from 'qrcode.react';

const API = 'http://localhost:3011/api/v1';

interface Pallet {
  id: string;
  pallet_code: string;
  location_id: string | null;
  location_code: string | null;
  zone: string | null;
  rack: string | null;
  warehouse_name: string;
  pallet_type: string;
  max_slots: number;
  current_slots: number;
  status: 'EMPTY' | 'IN_USE' | 'FULL' | 'IN_TRANSIT' | 'RETIRED';
  primary_product_sku: string | null;
  batch_count: number;
  created_at: string;
}

interface LocationOption {
  id: string;
  location_code: string;
  zone: string;
  rack?: string;
}

interface PalletConfig {
  id: string;
  product_sku: string;
  product_name?: string;
  pallet_type: string;
  units_per_pallet: number;
  max_weight_kg: number | null;
  max_volume_m3: number | null;
  unit_weight_kg: number | null;
  unit_volume_m3: number | null;
  stacking_allowed: boolean;
  notes: string | null;
  warehouse_id: string | null;
}

const statusColor = (s: string) => {
  switch (s) {
    case 'FULL': return 'error';
    case 'IN_USE': return 'warning';
    case 'EMPTY': return 'default';
    case 'IN_TRANSIT': return 'info';
    case 'RETIRED': return 'default';
    default: return 'default';
  }
};

const statusLabel = (s: string) => {
  switch (s) {
    case 'FULL': return 'Plin';
    case 'IN_USE': return 'În uz';
    case 'EMPTY': return 'Gol';
    case 'IN_TRANSIT': return 'Transit';
    case 'RETIRED': return 'Retras';
    default: return s;
  }
};

export default function PalletsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtre
  const [filterStatus, setFilterStatus] = useState('');

  // Dialog creare palet
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [newMaxSlots, setNewMaxSlots] = useState(10);
  const [newPalletType, setNewPalletType] = useState('EURO');

  // Dialog plasare palet la locație
  const [placeOpen, setPlaceOpen] = useState(false);
  const [placingPallet, setPlacingPallet] = useState<Pallet | null>(null);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [placeLocation, setPlaceLocation] = useState<LocationOption | null>(null);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState('');

  // Dialog QR
  const [qrOpen, setQrOpen] = useState(false);
  const [qrPallet, setQrPallet] = useState<Pallet | null>(null);

  // ---- Tab Capacitate Produse ----
  const [configs, setConfigs] = useState<PalletConfig[]>([]);
  const [configsLoading, setConfigsLoading] = useState(false);
  const [configError, setConfigError] = useState('');
  const [cfgOpen, setCfgOpen] = useState(false);
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgSaveError, setCfgSaveError] = useState('');
  const [editingConfig, setEditingConfig] = useState<PalletConfig | null>(null);
  // form fields
  const [cfgSku, setCfgSku] = useState('');
  const [cfgPalletType, setCfgPalletType] = useState('EURO');
  const [cfgUnits, setCfgUnits] = useState<number>(10);
  const [cfgMaxWeight, setCfgMaxWeight] = useState('');
  const [cfgUnitWeight, setCfgUnitWeight] = useState('');
  const [cfgMaxVolume, setCfgMaxVolume] = useState('');
  const [cfgUnitVolume, setCfgUnitVolume] = useState('');
  const [cfgStacking, setCfgStacking] = useState(true);
  const [cfgNotes, setCfgNotes] = useState('');

  const token = localStorage.getItem('accessToken');
  const hdrs = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const loadPallets = useCallback(async () => {    setLoading(true);
    setError('');
    try {
      const qs = filterStatus ? `?status=${filterStatus}` : '';
      const r = await fetch(`${API}/pallets${qs}`, { headers: hdrs });
      const j = await r.json();
      if (j.success) setPallets(j.data);
      else setError(j.message || 'Eroare la încărcare paleți');
    } catch {
      setError('Nu s-a putut contacta serverul.');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filterStatus]);

  const loadLocations = useCallback(async () => {
    try {
      const r = await fetch(`${API}/locations?is_active=true&limit=500`, { headers: hdrs });
      const j = await r.json();
      setLocations((j.data || j.locations || []).map((l: LocationOption) => ({
        id: l.id,
        location_code: l.location_code,
        zone: l.zone,
        rack: l.rack,
      })));
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadConfigs = useCallback(async () => {
    setConfigsLoading(true);
    setConfigError('');
    try {
      const r = await fetch(`${API}/pallets/config`, { headers: hdrs });
      const j = await r.json();
      if (j.success) setConfigs(j.data);
      else setConfigError(j.message || 'Eroare la încărcare configurații');
    } catch {
      setConfigError('Nu s-a putut contacta serverul.');
    } finally {
      setConfigsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    loadPallets();
    loadLocations();
    loadConfigs();
  }, [loadPallets, loadLocations, loadConfigs]);

  const openCfgDialog = (cfg?: PalletConfig) => {
    if (cfg) {
      setEditingConfig(cfg);
      setCfgSku(cfg.product_sku);
      setCfgPalletType(cfg.pallet_type);
      setCfgUnits(cfg.units_per_pallet);
      setCfgMaxWeight(cfg.max_weight_kg != null ? String(cfg.max_weight_kg) : '');
      setCfgUnitWeight(cfg.unit_weight_kg != null ? String(cfg.unit_weight_kg) : '');
      setCfgMaxVolume(cfg.max_volume_m3 != null ? String(cfg.max_volume_m3) : '');
      setCfgUnitVolume(cfg.unit_volume_m3 != null ? String(cfg.unit_volume_m3) : '');
      setCfgStacking(cfg.stacking_allowed);
      setCfgNotes(cfg.notes || '');
    } else {
      setEditingConfig(null);
      setCfgSku(''); setCfgPalletType('EURO'); setCfgUnits(10);
      setCfgMaxWeight(''); setCfgUnitWeight(''); setCfgMaxVolume(''); setCfgUnitVolume('');
      setCfgStacking(true); setCfgNotes('');
    }
    setCfgSaveError('');
    setCfgOpen(true);
  };

  const handleSaveConfig = async () => {
    if (!cfgSku.trim()) { setCfgSaveError('SKU-ul produsului este obligatoriu'); return; }
    if (cfgUnits < 1) { setCfgSaveError('Capacitatea trebuie să fie cel puțin 1'); return; }
    setCfgSaving(true);
    setCfgSaveError('');
    try {
      const r = await fetch(`${API}/pallets/config`, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({
          product_sku: cfgSku.trim().toUpperCase(),
          pallet_type: cfgPalletType,
          units_per_pallet: cfgUnits,
          max_weight_kg: cfgMaxWeight ? Number(cfgMaxWeight) : null,
          unit_weight_kg: cfgUnitWeight ? Number(cfgUnitWeight) : null,
          max_volume_m3: cfgMaxVolume ? Number(cfgMaxVolume) : null,
          unit_volume_m3: cfgUnitVolume ? Number(cfgUnitVolume) : null,
          stacking_allowed: cfgStacking,
          notes: cfgNotes || null,
        }),
      });
      const j = await r.json();
      if (!j.success) { setCfgSaveError(j.message || 'Eroare la salvare'); return; }
      setCfgOpen(false);
      loadConfigs();
    } catch {
      setCfgSaveError('Eroare de rețea.');
    } finally {
      setCfgSaving(false);
    }
  };

  const handleDeleteConfig = async (id: string) => {
    if (!window.confirm('Ștergeți această configurație?')) return;
    try {
      await fetch(`${API}/pallets/config/${id}`, { method: 'DELETE', headers: hdrs });
      loadConfigs();
    } catch { /* ignore */ }
  };

  const handleCreatePallet = async () => {
    setCreating(true);
    setCreateError('');
    try {
      // Obținem primul warehouse_id din locații
      const whR = await fetch(`${API}/locations?limit=1&is_active=true`, { headers: hdrs });
      const whJ = await whR.json();
      const warehouseId = (whJ.data || whJ.locations || [])[0]?.warehouse_id
        || '00000000-0000-0000-0000-000000000001';

      const r = await fetch(`${API}/pallets`, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({
          warehouse_id: warehouseId,
          pallet_type: newPalletType,
          max_slots: newMaxSlots,
        }),
      });
      const j = await r.json();
      if (!j.success) { setCreateError(j.message || 'Eroare la creare'); return; }
      setCreateOpen(false);
      loadPallets();
      // Deschide QR la paletul nou creat
      setQrPallet({ ...j.data, location_code: null, zone: null, rack: null, warehouse_name: '', batch_count: 0 });
      setQrOpen(true);
    } catch {
      setCreateError('Eroare de rețea.');
    } finally {
      setCreating(false);
    }
  };

  const handlePlacePallet = async () => {
    if (!placingPallet || !placeLocation) return;
    setPlacing(true);
    setPlaceError('');
    try {
      const r = await fetch(`${API}/pallets/${placingPallet.id}/place`, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({ location_id: placeLocation.id }),
      });
      const j = await r.json();
      if (!j.success) { setPlaceError(j.message || 'Eroare la plasare'); return; }
      setPlaceOpen(false);
      setPlaceLocation(null);
      loadPallets();
    } catch {
      setPlaceError('Eroare de rețea.');
    } finally {
      setPlacing(false);
    }
  };

  // Statistici sumare
  const stats = {
    total: pallets.length,
    empty: pallets.filter(p => p.status === 'EMPTY').length,
    inUse: pallets.filter(p => p.status === 'IN_USE').length,
    full: pallets.filter(p => p.status === 'FULL').length,
    totalSlots: pallets.reduce((s, p) => s + p.max_slots, 0),
    usedSlots: pallets.reduce((s, p) => s + p.current_slots, 0),
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <InventoryIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Box>
              <Typography variant="h4">Paleți Depozit</Typography>
              <Typography variant="body2" color="text.secondary">
                Gestionare paleți fizici — localizare, ocupare, configurare capacitate
              </Typography>
            </Box>
          </Stack>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Reîncarcă">
            <IconButton onClick={tab === 0 ? loadPallets : loadConfigs} color="primary"><RefreshIcon /></IconButton>
          </Tooltip>
          <Button variant="outlined" onClick={() => navigate('/putaway-tasks')}>
            Sarcini Putaway
          </Button>
          {tab === 0 ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => { setCreateError(''); setCreateOpen(true); }}
            >
              Palet Nou
            </Button>
          ) : (
            <Button
              variant="contained"
              startIcon={<SettingsIcon />}
              onClick={() => openCfgDialog()}
            >
              Adaugă Configurație
            </Button>
          )}
        </Stack>
      </Stack>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} indicatorColor="primary" textColor="primary">
          <Tab label="Paleți" icon={<InventoryIcon />} iconPosition="start" />
          <Tab label="Capacitate per Produs" icon={<SettingsIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* ===== TAB 0: PALEȚI ===== */}
      {tab === 0 && (<>
      {/* Statistici */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total Paleți', value: stats.total, color: 'primary.main' },
          { label: 'Goali', value: stats.empty, color: 'text.secondary' },
          { label: 'În Uz', value: stats.inUse, color: 'warning.main' },
          { label: 'Plini', value: stats.full, color: 'error.main' },
          { label: 'Sloturi Ocupate', value: `${stats.usedSlots}/${stats.totalSlots}`, color: 'info.main' },
        ].map(s => (
          <Grid key={s.label} size={{ xs: 6, sm: 4, md: 2.4 }}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="h4" fontWeight={700} color={s.color}>{s.value}</Typography>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Filtre */}
      <Stack direction="row" spacing={1} mb={2}>
        {['', 'EMPTY', 'IN_USE', 'FULL', 'IN_TRANSIT'].map(s => (
          <Chip
            key={s || 'ALL'}
            label={s ? statusLabel(s) : 'Toți'}
            onClick={() => setFilterStatus(s)}
            color={filterStatus === s ? 'primary' : 'default'}
            variant={filterStatus === s ? 'filled' : 'outlined'}
          />
        ))}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CircularProgress size={48} />
        </Box>
      ) : pallets.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', border: '2px dashed', borderColor: 'divider' }}>
          <InventoryIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">Nu există paleți</Typography>
          <Button variant="contained" sx={{ mt: 2 }} startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            Crează primul palet
          </Button>
        </Paper>
      ) : (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                {['Cod Palet', 'Tip', 'Locație', 'Produs Principal', 'Ocupare', 'Status', 'Acțiuni'].map(h => (
                  <TableCell key={h} sx={{ color: 'white', fontWeight: 700 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {pallets.map(p => {
                const occupancyPct = p.max_slots > 0
                  ? Math.round((p.current_slots / p.max_slots) * 100)
                  : 0;
                return (
                  <TableRow key={p.id} hover>
                    <TableCell>
                      <Typography fontFamily="monospace" fontWeight={700} color="primary.main" fontSize="0.9rem">
                        {p.pallet_code}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={p.pallet_type} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      {p.location_code ? (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <LocationOnIcon fontSize="small" color="action" />
                          <Box>
                            <Typography fontSize="0.85rem" fontFamily="monospace" fontWeight={600}>
                              {p.location_code}
                            </Typography>
                            {p.zone && (
                              <Typography variant="caption" color="text.secondary">
                                {p.zone}{p.rack ? ` · ${p.rack}` : ''}
                              </Typography>
                            )}
                          </Box>
                        </Stack>
                      ) : (
                        <Chip label="Neasignat" size="small" color="error" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography fontSize="0.82rem" fontFamily="monospace">
                        {p.primary_product_sku || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: 140 }}>
                      <Stack spacing={0.5}>
                        <Typography variant="caption" color="text.secondary">
                          {p.current_slots}/{p.max_slots} sloturi ({occupancyPct}%)
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={occupancyPct}
                          color={occupancyPct >= 100 ? 'error' : occupancyPct >= 70 ? 'warning' : 'success'}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={statusLabel(p.status)}
                        size="small"
                        color={statusColor(p.status) as 'error' | 'warning' | 'default' | 'info'}
                      />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Afișează QR">
                          <IconButton size="small" onClick={() => { setQrPallet(p); setQrOpen(true); }}>
                            <QrCode2Icon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Plasează la locație">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => { setPlacingPallet(p); setPlaceError(''); setPlaceLocation(null); setPlaceOpen(true); }}
                          >
                            <LocationOnIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      </>)}

      {/* ===== TAB 1: CAPACITATE PER PRODUS ===== */}
      {tab === 1 && (
        <Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            Configurați câte batches/unități dintr-un produs încap pe un palet.
            Aceasta setare este folosită automat la planificarea putaway-ului (Auto-Repartizare).
          </Alert>
          {configError && <Alert severity="error" sx={{ mb: 2 }}>{configError}</Alert>}
          {configsLoading ? (
            <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>
          ) : configs.length === 0 ? (
            <Paper sx={{ p: 6, textAlign: 'center', border: '2px dashed', borderColor: 'divider' }}>
              <SettingsIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                Nicio configurație de capacitate
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={1}>
                Adăugați configurații pentru a specifica câte produse încap pe un palet.
                Fără configurație, sistemul va folosi implicit 10 batches/palet.
              </Typography>
              <Button variant="contained" sx={{ mt: 2 }} startIcon={<SettingsIcon />} onClick={() => openCfgDialog()}>
                Adaugă Prima Configurație
              </Button>
            </Paper>
          ) : (
            <TableContainer component={Paper} elevation={2}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'primary.main' }}>
                    {['Produs (SKU)', 'Tip Palet', 'Buc/Palet', 'Gr. Max Palet (kg)', 'Gr. per Buc (kg)', 'Stivuire', 'Note', 'Acțiuni'].map(h => (
                      <TableCell key={h} sx={{ color: 'white', fontWeight: 700 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {configs.map(cfg => (
                    <TableRow key={cfg.id} hover>
                      <TableCell>
                        <Typography fontFamily="monospace" fontWeight={700} color="primary.main" fontSize="0.88rem">
                          {cfg.product_sku}
                        </Typography>
                        {cfg.product_name && cfg.product_name !== cfg.product_sku && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {cfg.product_name}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell><Chip label={cfg.pallet_type} size="small" variant="outlined" /></TableCell>
                      <TableCell>
                        <Typography fontWeight={700} color="success.main" fontSize="1rem">
                          {cfg.units_per_pallet}
                        </Typography>
                      </TableCell>
                      <TableCell>{cfg.max_weight_kg != null ? `${cfg.max_weight_kg} kg` : '—'}</TableCell>
                      <TableCell>{cfg.unit_weight_kg != null ? `${cfg.unit_weight_kg} kg` : '—'}</TableCell>
                      <TableCell>
                        <Chip
                          label={cfg.stacking_allowed ? 'Da' : 'Nu'}
                          size="small"
                          color={cfg.stacking_allowed ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">{cfg.notes || '—'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="Editează">
                            <IconButton size="small" color="primary" onClick={() => openCfgDialog(cfg)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Șterge">
                            <IconButton size="small" color="error" onClick={() => handleDeleteConfig(cfg.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Dialog Creare Palet */}
      <Dialog open={createOpen} onClose={() => !creating && setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <AddIcon color="primary" />
            <span>Palet Nou</span>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              select
              label="Tip Palet"
              value={newPalletType}
              onChange={e => setNewPalletType(e.target.value)}
              SelectProps={{ native: true }}
              fullWidth
            >
              {['EURO', 'INDUSTRIAL', 'SEMI', 'CUSTOM'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </TextField>
            <TextField
              label="Nr. maxim sloturi (colaci/tamburi)"
              type="number"
              value={newMaxSlots}
              onChange={e => setNewMaxSlots(Number(e.target.value))}
              inputProps={{ min: 1, max: 50 }}
              helperText="Câte colaci/tamburi încap fizic pe acest palet"
              fullWidth
            />
            {createError && <Alert severity="error">{createError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={creating}>Anulează</Button>
          <Button
            variant="contained"
            onClick={handleCreatePallet}
            disabled={creating}
            startIcon={creating ? <CircularProgress size={16} /> : <CheckCircleIcon />}
          >
            {creating ? 'Se creează...' : 'Creează Palet'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Plasare Palet la Locație */}
      <Dialog open={placeOpen} onClose={() => !placing && setPlaceOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <LocationOnIcon color="primary" />
            <span>Plasare Palet la Locație</span>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {placingPallet && (
              <Card variant="outlined" sx={{ bgcolor: 'grey.50' }}>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography fontFamily="monospace" fontWeight={700} color="primary.main">
                    {placingPallet.pallet_code}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {placingPallet.current_slots}/{placingPallet.max_slots} sloturi ocupate
                  </Typography>
                </CardContent>
              </Card>
            )}
            <Autocomplete
              options={locations}
              getOptionLabel={l => `${l.location_code} — ${l.zone}${l.rack ? ` / ${l.rack}` : ''}`}
              value={placeLocation}
              onChange={(_, v) => setPlaceLocation(v)}
              renderInput={p => <TextField {...p} label="Selectați locația de destinație" />}
              isOptionEqualToValue={(o, v) => o.id === v.id}
            />
            {placeError && <Alert severity="error">{placeError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPlaceOpen(false)} disabled={placing}>Anulează</Button>
          <Button
            variant="contained"
            onClick={handlePlacePallet}
            disabled={!placeLocation || placing}
            startIcon={placing ? <CircularProgress size={16} /> : <CheckCircleIcon />}
          >
            {placing ? 'Se plasează...' : 'Confirmă Plasare'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog QR Palet */}
      <Dialog open={qrOpen} onClose={() => setQrOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <QrCode2Icon color="primary" />
            <span>QR Palet</span>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {qrPallet && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <QRCodeSVG
                value={JSON.stringify({ type: 'PALLET', code: qrPallet.pallet_code, id: qrPallet.id })}
                size={220}
                level="M"
                includeMargin
              />
              <Typography variant="h6" fontFamily="monospace" fontWeight={700} mt={1}>
                {qrPallet.pallet_code}
              </Typography>
              {qrPallet.location_code && (
                <Chip
                  icon={<LocationOnIcon />}
                  label={qrPallet.location_code}
                  color="primary"
                  variant="outlined"
                  sx={{ mt: 1 }}
                />
              )}
              <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                Scanați cu aplicația WMS pentru a adăuga produse pe palet
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQrOpen(false)}>Închide</Button>
          <Button variant="outlined" onClick={() => window.print()}>Printează</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Configurare Capacitate Palet per Produs */}
      <Dialog open={cfgOpen} onClose={() => !cfgSaving && setCfgOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <SettingsIcon color="primary" />
            <span>{editingConfig ? 'Editează Configurație' : 'Configurație Nouă'}</span>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Alert severity="info" icon={false}>
              Specificați câte batches/colaci/tamburi dintr-un produs încap pe un palet.
              Sistemul va folosi automat această valoare la planificarea putaway-ului.
            </Alert>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 7 }}>
                <TextField
                  label="SKU Produs *"
                  value={cfgSku}
                  onChange={e => setCfgSku(e.target.value)}
                  helperText="Ex: MYYM 2X0.75 C100"
                  fullWidth
                  autoFocus={!editingConfig}
                  disabled={!!editingConfig}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 5 }}>
                <TextField
                  select
                  label="Tip Palet *"
                  value={cfgPalletType}
                  onChange={e => setCfgPalletType(e.target.value)}
                  SelectProps={{ native: true }}
                  fullWidth
                >
                  {['EURO', 'INDUSTRIAL', 'SEMI', 'CUSTOM'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </TextField>
              </Grid>
            </Grid>

            <TextField
              label="Capacitate (buc/colaci per palet) *"
              type="number"
              value={cfgUnits}
              onChange={e => setCfgUnits(Number(e.target.value))}
              inputProps={{ min: 1, max: 500 }}
              helperText="Câte unități/batches din acest produs pot fi puse pe un palet"
              fullWidth
            />

            <Divider><Typography variant="caption" color="text.secondary">Opțional — pentru calcul auto pe greutate/volum</Typography></Divider>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Greutate maximă palet (kg)"
                  type="number"
                  value={cfgMaxWeight}
                  onChange={e => setCfgMaxWeight(e.target.value)}
                  helperText="Limita de greutate per palet"
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Greutate per unitate (kg)"
                  type="number"
                  value={cfgUnitWeight}
                  onChange={e => setCfgUnitWeight(e.target.value)}
                  helperText="Greutatea unui colac/tambur"
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Volum maxim palet (m³)"
                  type="number"
                  value={cfgMaxVolume}
                  onChange={e => setCfgMaxVolume(e.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Volum per unitate (m³)"
                  type="number"
                  value={cfgUnitVolume}
                  onChange={e => setCfgUnitVolume(e.target.value)}
                  fullWidth
                />
              </Grid>
            </Grid>

            <FormControlLabel
              control={<Switch checked={cfgStacking} onChange={e => setCfgStacking(e.target.checked)} />}
              label="Stivuire permisă (se pot pune mai multe paleți unul deasupra altuia)"
            />

            <TextField
              label="Note / observații"
              value={cfgNotes}
              onChange={e => setCfgNotes(e.target.value)}
              multiline
              rows={2}
              fullWidth
            />

            {cfgSaveError && <Alert severity="error">{cfgSaveError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCfgOpen(false)} disabled={cfgSaving}>Anulează</Button>
          <Button
            variant="contained"
            onClick={handleSaveConfig}
            disabled={cfgSaving}
            startIcon={cfgSaving ? <CircularProgress size={16} /> : <CheckCircleIcon />}
          >
            {cfgSaving ? 'Se salvează...' : 'Salvează'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
