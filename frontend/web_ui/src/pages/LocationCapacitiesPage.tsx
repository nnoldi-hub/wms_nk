/**
 * Faza 2.4 — Capacitati Locatii
 *
 * Permite vizualizarea si editarea constrangerilor de capacitate per locatie:
 *  - Greutate maxima (kg)
 *  - Volum maxim (m³)
 *  - Lungime minima/maxima cablu (m)
 *  - Categorii marfa permise
 *  - Tipuri ambalaj permise
 *  - Nota restrictie
 *  - Label sugestie afisat operatorilor
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, Chip, Stack, Alert,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Checkbox, FormControlLabel, FormGroup, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tooltip, IconButton, Select, MenuItem, FormControl, InputLabel,
  InputAdornment,
} from '@mui/material';
import {
  Edit as EditIcon,
  FitnessCenter as WeightIcon,
  Straighten as LengthIcon,
  Inventory as PackagingIcon,
  Category as CategoryIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import warehouseConfigService from '../services/warehouseConfig.service';

// ─── Tipuri ──────────────────────────────────────────────────────────────────

interface Constraints {
  max_weight_kg?: number;
  max_volume_m3?: number;
  min_length_m?: number;
  max_length_m?: number;
  restriction_note?: string;
}

interface Location {
  id: string;
  location_code: string;
  aisle: string;
  rack: string;
  shelf_level: number;
  bin_position: string;
  status: string;
  zone_name: string;
  zone_code: string;
  warehouse_name: string;
  constraints: Constraints | null;
  allowed_categories: string[] | null;
  allowed_packaging: string[] | null;
  suggestion_label: string | null;
}

interface Zone {
  id: string;
  zone_code: string;
  zone_name: string;
  zone_type: string;
}

interface Warehouse {
  id: string;
  warehouse_code: string;
  warehouse_name: string;
}

// ─── Categorii si ambalaje disponibile ────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: 'cable', label: 'Cabluri' },
  { value: 'equipment', label: 'Echipamente' },
  { value: 'consumable', label: 'Consumabile' },
  { value: 'packaging', label: 'Ambalaje' },
  { value: 'hazardous', label: 'Materiale periculoase' },
  { value: 'fragile', label: 'Fragile' },
  { value: 'cold', label: 'Lanț frig' },
];

const PACKAGING_OPTIONS = [
  { value: 'DRUM', label: 'Tambur (DRUM)' },
  { value: 'ROLL', label: 'Rolă (ROLL)' },
  { value: 'BOX', label: 'Cutie (BOX)' },
  { value: 'PALLET', label: 'Palet (PALLET)' },
  { value: 'BAG', label: 'Sac (BAG)' },
  { value: 'PIECE', label: 'Bucată (PIECE)' },
  { value: 'REEL', label: 'Bobină (REEL)' },
];

// ─── Dialog editare capacitate ────────────────────────────────────────────────

interface CapacityDialogProps {
  location: Location | null;
  open: boolean;
  onClose: () => void;
  onSave: (id: string, data: Record<string, unknown>) => Promise<void>;
}

function CapacityDialog({ location, open, onClose, onSave }: CapacityDialogProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [maxWeight, setMaxWeight] = useState('');
  const [maxVolume, setMaxVolume] = useState('');
  const [minLength, setMinLength] = useState('');
  const [maxLength, setMaxLength] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedPackaging, setSelectedPackaging] = useState<string[]>([]);
  const [suggestionLabel, setSuggestionLabel] = useState('');
  const [restrictionNote, setRestrictionNote] = useState('');

  // Initializeaza atunci cand se deschide cu o locatie noua
  useEffect(() => {
    if (location && open) {
      const c = location.constraints || {};
      setMaxWeight(c.max_weight_kg != null ? String(c.max_weight_kg) : '');
      setMaxVolume(c.max_volume_m3 != null ? String(c.max_volume_m3) : '');
      setMinLength(c.min_length_m != null ? String(c.min_length_m) : '');
      setMaxLength(c.max_length_m != null ? String(c.max_length_m) : '');
      setSelectedCategories(location.allowed_categories || []);
      setSelectedPackaging(location.allowed_packaging || []);
      setSuggestionLabel(location.suggestion_label || '');
      setRestrictionNote(c.restriction_note || '');
      setError(null);
    }
  }, [location, open]);

  const toggleCategory = (val: string) => {
    setSelectedCategories(prev =>
      prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]
    );
  };
  const togglePackaging = (val: string) => {
    setSelectedPackaging(prev =>
      prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]
    );
  };

  const handleSave = async () => {
    if (!location) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(location.id, {
        max_weight_kg: maxWeight !== '' ? parseFloat(maxWeight) : null,
        max_volume_m3: maxVolume !== '' ? parseFloat(maxVolume) : null,
        min_length_m: minLength !== '' ? parseFloat(minLength) : null,
        max_length_m: maxLength !== '' ? parseFloat(maxLength) : null,
        allowed_categories: selectedCategories.length > 0 ? selectedCategories : null,
        allowed_packaging: selectedPackaging.length > 0 ? selectedPackaging : null,
        suggestion_label: suggestionLabel || null,
        restriction_note: restrictionNote || null,
      });
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err?.response?.data?.error || err?.message || 'Eroare la salvare');
    } finally {
      setSaving(false);
    }
  };

  if (!location) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Typography variant="h6" fontWeight={700}>
          Capacitate locatie: <code>{location.location_code}</code>
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {location.warehouse_name} &rsaquo; {location.zone_name} ({location.zone_code})
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Typography variant="subtitle2" fontWeight={700} mb={1} color="primary">
          Limite fizice
        </Typography>
        <Stack direction="row" spacing={2} mb={2} flexWrap="wrap">
          <TextField
            label="Greutate maxima (kg)"
            type="number"
            value={maxWeight}
            onChange={e => setMaxWeight(e.target.value)}
            size="small"
            sx={{ width: 200 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><WeightIcon fontSize="small" /></InputAdornment>,
            }}
            helperText="Gol = fara limita"
          />
          <TextField
            label="Volum maxim (m³)"
            type="number"
            value={maxVolume}
            onChange={e => setMaxVolume(e.target.value)}
            size="small"
            sx={{ width: 200 }}
            helperText="Gol = fara limita"
          />
          <TextField
            label="Lungime minima cablu (m)"
            type="number"
            value={minLength}
            onChange={e => setMinLength(e.target.value)}
            size="small"
            sx={{ width: 200 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><LengthIcon fontSize="small" /></InputAdornment>,
            }}
          />
          <TextField
            label="Lungime maxima cablu (m)"
            type="number"
            value={maxLength}
            onChange={e => setMaxLength(e.target.value)}
            size="small"
            sx={{ width: 200 }}
          />
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" fontWeight={700} mb={1} color="primary">
          Categorii marfa permise <Typography component="span" variant="caption" color="text.secondary">(gol = orice)</Typography>
        </Typography>
        <FormGroup row sx={{ mb: 2, gap: 0.5 }}>
          {CATEGORY_OPTIONS.map(opt => (
            <FormControlLabel
              key={opt.value}
              control={
                <Checkbox
                  checked={selectedCategories.includes(opt.value)}
                  onChange={() => toggleCategory(opt.value)}
                  size="small"
                />
              }
              label={opt.label}
              sx={{ mr: 2 }}
            />
          ))}
        </FormGroup>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" fontWeight={700} mb={1} color="primary">
          Tipuri ambalaj permise <Typography component="span" variant="caption" color="text.secondary">(gol = orice)</Typography>
        </Typography>
        <FormGroup row sx={{ mb: 2 }}>
          {PACKAGING_OPTIONS.map(opt => (
            <FormControlLabel
              key={opt.value}
              control={
                <Checkbox
                  checked={selectedPackaging.includes(opt.value)}
                  onChange={() => togglePackaging(opt.value)}
                  size="small"
                />
              }
              label={opt.label}
              sx={{ mr: 2 }}
            />
          ))}
        </FormGroup>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" fontWeight={700} mb={1} color="primary">
          Etichete si note
        </Typography>
        <Stack spacing={2}>
          <TextField
            label="Label sugestie (afisat operatorului pe mobil)"
            value={suggestionLabel}
            onChange={e => setSuggestionLabel(e.target.value)}
            fullWidth
            size="small"
            placeholder="ex: Zona tamburi — doar tamburi > 100m"
          />
          <TextField
            label="Nota restrictie (interna)"
            value={restrictionNote}
            onChange={e => setRestrictionNote(e.target.value)}
            fullWidth
            size="small"
            multiline
            rows={2}
            placeholder="ex: Nu permite marfa umeda sau chimica"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Anuleaza</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : undefined}
        >
          {saving ? 'Se salveaza...' : 'Salveaza'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Badge capacitate ────────────────────────────────────────────────────────

function CapacityBadge({ location }: { location: Location }) {
  const hasConstraints = location.constraints &&
    Object.keys(location.constraints).some(k =>
      k !== 'restriction_note' && location.constraints![k as keyof Constraints] != null
    );
  const hasCategories = location.allowed_categories && location.allowed_categories.length > 0;
  const hasPackaging = location.allowed_packaging && location.allowed_packaging.length > 0;

  if (!hasConstraints && !hasCategories && !hasPackaging) {
    return <Chip label="Nelimitat" size="small" sx={{ bgcolor: '#f5f5f5', color: '#999', fontSize: '0.7rem' }} />;
  }
  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap">
      {hasConstraints && (
        <Chip icon={<WeightIcon sx={{ fontSize: '0.85rem !important' }} />} label="Fizic" size="small" color="warning" variant="outlined" sx={{ fontSize: '0.7rem' }} />
      )}
      {hasCategories && (
        <Chip icon={<CategoryIcon sx={{ fontSize: '0.85rem !important' }} />} label={`Cat: ${location.allowed_categories!.join(', ')}`} size="small" color="info" variant="outlined" sx={{ fontSize: '0.7rem' }} />
      )}
      {hasPackaging && (
        <Chip icon={<PackagingIcon sx={{ fontSize: '0.85rem !important' }} />} label={`Amb: ${location.allowed_packaging!.join(', ')}`} size="small" color="secondary" variant="outlined" sx={{ fontSize: '0.7rem' }} />
      )}
    </Stack>
  );
}

// ─── Celula constrangeri ────────────────────────────────────────────────────

function ConstraintsCell({ c }: { c: Constraints | null }) {
  if (!c) return <Typography variant="caption" color="text.secondary">—</Typography>;
  const parts: string[] = [];
  if (c.max_weight_kg != null) parts.push(`≤${c.max_weight_kg}kg`);
  if (c.max_volume_m3 != null) parts.push(`≤${c.max_volume_m3}m³`);
  if (c.min_length_m != null) parts.push(`≥${c.min_length_m}m`);
  if (c.max_length_m != null) parts.push(`≤${c.max_length_m}m`);
  if (parts.length === 0) return <Typography variant="caption" color="text.secondary">—</Typography>;
  return <Typography variant="caption">{parts.join(' | ')}</Typography>;
}

// ─── Pagina principala ────────────────────────────────────────────────────────

const LocationCapacitiesPage: React.FC = () => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editLoc, setEditLoc] = useState<Location | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Incarcam depozitele la mount
  useEffect(() => {
    warehouseConfigService.listWarehouses()
      .then((resp) => {
        const whs = resp?.data || resp || [];
        setWarehouses(Array.isArray(whs) ? whs : []);
        if (whs.length === 1) setSelectedWarehouse(whs[0].id);
      })
      .catch(() => {/* ignore */});
  }, []);

  // Incarcam zonele cand se schimba depozitul
  useEffect(() => {
    if (!selectedWarehouse) { setZones([]); setSelectedZone(''); return; }
    warehouseConfigService.listZones(selectedWarehouse, { limit: 200 })
      .then((resp) => {
        const zs = resp?.data?.zones || resp?.data || resp || [];
        setZones(Array.isArray(zs) ? zs : []);
        setSelectedZone('');
      })
      .catch(() => setZones([]));
  }, [selectedWarehouse]);

  const loadLocations = useCallback(async () => {
    const zoneId = selectedZone;
    if (!zoneId) { setLocations([]); return; }
    setLoading(true);
    setError(null);
    try {
      const resp = await warehouseConfigService.listLocations(zoneId, { limit: 500 });
      const locs = resp?.data?.locations || resp?.data || resp || [];
      setLocations(Array.isArray(locs) ? locs : []);
    } catch {
      setError('Eroare la incarcarea locatiilor');
    } finally {
      setLoading(false);
    }
  }, [selectedZone]);

  useEffect(() => { loadLocations(); }, [loadLocations]);

  const handleSaveCapacity = async (locationId: string, payload: Record<string, unknown>) => {
    await warehouseConfigService.updateLocationCapacity(locationId, payload as Parameters<typeof warehouseConfigService.updateLocationCapacity>[1]);
    setSuccess('Capacitate salvata cu succes');
    setTimeout(() => setSuccess(null), 3500);
    // Actualizeaza local fara reload complet
    setLocations(prev => prev.map(l => {
      if (l.id !== locationId) return l;
      const c = l.constraints || {};
      const newConstraints = {
        ...c,
        ...(payload.max_weight_kg != null ? { max_weight_kg: payload.max_weight_kg as number } : {}),
        ...(payload.max_volume_m3 != null ? { max_volume_m3: payload.max_volume_m3 as number } : {}),
        ...(payload.min_length_m != null ? { min_length_m: payload.min_length_m as number } : {}),
        ...(payload.max_length_m != null ? { max_length_m: payload.max_length_m as number } : {}),
        ...(payload.restriction_note != null ? { restriction_note: payload.restriction_note as string } : {}),
      };
      return {
        ...l,
        constraints: newConstraints,
        allowed_categories: payload.allowed_categories as string[] | null ?? l.allowed_categories,
        allowed_packaging: payload.allowed_packaging as string[] | null ?? l.allowed_packaging,
        suggestion_label: payload.suggestion_label as string | null ?? l.suggestion_label,
      };
    }));
  };

  const withConstraints = locations.filter(l =>
    (l.constraints && Object.keys(l.constraints).some(k => l.constraints![k as keyof Constraints] != null)) ||
    (l.allowed_categories && l.allowed_categories.length > 0) ||
    (l.allowed_packaging && l.allowed_packaging.length > 0)
  ).length;

  return (
    <Box sx={{ p: 3, maxWidth: 1300, mx: 'auto' }}>
      {/* Header */}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" fontWeight={800} color="primary">
            Capacitati Locatii
          </Typography>
          <Typography color="text.secondary" mt={0.5}>
            Defineste limite fizice, tipuri marfa permise si restrictii per locatie de depozit
          </Typography>
        </Box>
        {selectedZone && (
          <Button startIcon={<RefreshIcon />} onClick={loadLocations} disabled={loading}>
            Refresh
          </Button>
        )}
      </Stack>

      {/* Filtre depozit / zona */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <FilterIcon color="action" />
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Depozit</InputLabel>
            <Select
              value={selectedWarehouse}
              label="Depozit"
              onChange={e => setSelectedWarehouse(e.target.value)}
            >
              {warehouses.map(w => (
                <MenuItem key={w.id} value={w.id}>{w.warehouse_name} ({w.warehouse_code})</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 220 }} disabled={!selectedWarehouse || zones.length === 0}>
            <InputLabel>Zona</InputLabel>
            <Select
              value={selectedZone}
              label="Zona"
              onChange={e => setSelectedZone(e.target.value)}
            >
              {zones.map(z => (
                <MenuItem key={z.id} value={z.id}>{z.zone_name} ({z.zone_code}) — {z.zone_type}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {locations.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              {locations.length} locatii | {withConstraints} cu limite configurate
            </Typography>
          )}
        </Stack>
      </Paper>

      {/* Mesaje */}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Stare initiala */}
      {!selectedZone && !loading && (
        <Paper sx={{ p: 5, textAlign: 'center', bgcolor: '#f8f9fa', borderRadius: 3 }}>
          <WeightIcon sx={{ fontSize: 64, color: 'primary.light', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            Selecteaza un depozit si o zona pentru a vedea locatiile
          </Typography>
        </Paper>
      )}

      {/* Loading */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Tabel locatii */}
      {!loading && selectedZone && locations.length === 0 && (
        <Alert severity="info">Nicio locatie gasita in aceasta zona.</Alert>
      )}

      {!loading && locations.length > 0 && (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Cod locatie</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Culoar / Raft / Nivel</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Limite fizice</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Restrictii</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Label sugestie</TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Actiuni</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {locations.map(loc => (
                <TableRow key={loc.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600} fontFamily="monospace">
                      {loc.location_code}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {loc.aisle} / {loc.rack} / Niv. {loc.shelf_level}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={loc.status}
                      size="small"
                      color={loc.status === 'AVAILABLE' ? 'success' : loc.status === 'OCCUPIED' ? 'error' : 'default'}
                      sx={{ fontSize: '0.7rem' }}
                    />
                  </TableCell>
                  <TableCell>
                    <ConstraintsCell c={loc.constraints} />
                  </TableCell>
                  <TableCell>
                    <CapacityBadge location={loc} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: loc.suggestion_label ? 'normal' : 'italic' }}>
                      {loc.suggestion_label || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Editeaza capacitate">
                      <IconButton size="small" onClick={() => setEditLoc(loc)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Dialog editare */}
      <CapacityDialog
        location={editLoc}
        open={editLoc !== null}
        onClose={() => setEditLoc(null)}
        onSave={handleSaveCapacity}
      />
    </Box>
  );
};

export default LocationCapacitiesPage;
