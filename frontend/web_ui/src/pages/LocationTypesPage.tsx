/**
 * Pagina Tipuri Locații — Admin
 * Permite vizualizarea și editarea tipurilor de locații din depozit
 * (RACK_PALLET, DERULATOR, RACK_RESTURI, FLOOR_HEAVY etc.)
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, Stack, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Chip, Tooltip, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Switch, FormControlLabel, Alert, CircularProgress, Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ForkliftIcon from '@mui/icons-material/LocalShipping';
import warehouseConfigService from '../services/warehouseConfig.service';

interface LocationType {
  id: string;
  code: string;
  name: string;
  capacity_type?: string;
  default_max_weight_kg?: number;
  default_max_volume_cubic_meters?: number;
  default_width_cm?: number;
  default_depth_cm?: number;
  default_height_cm?: number;
  requires_forklift?: boolean;
  is_pickable?: boolean;
  is_stackable?: boolean;
  max_stack_height?: number;
  is_active?: boolean;
  is_system?: boolean;
}

const CAPACITY_TYPES = ['BOX', 'PALLET', 'DRUM', 'BULK', 'REEL', 'CONTAINER'];

const DEFAULTS_CABLURI: Omit<LocationType, 'id'>[] = [
  { code: 'RACK_STANDARD', name: 'Raft Standard', capacity_type: 'BOX', requires_forklift: false, is_pickable: true, is_stackable: false, max_stack_height: 1 },
  { code: 'RACK_PALLET', name: 'Raft Paleți', capacity_type: 'PALLET', default_max_weight_kg: 1500, requires_forklift: true, is_pickable: true, is_stackable: false, max_stack_height: 1 },
  { code: 'RACK_RESTURI', name: 'Raft Resturi Cabluri', capacity_type: 'BOX', requires_forklift: false, is_pickable: true, is_stackable: true, max_stack_height: 3 },
  { code: 'DERULATOR', name: 'Derulator Tambur', capacity_type: 'DRUM', default_max_weight_kg: 2000, requires_forklift: true, is_pickable: false, is_stackable: false, max_stack_height: 1 },
  { code: 'FLOOR_HEAVY', name: 'Podea Marfă Grea', capacity_type: 'BULK', default_max_weight_kg: 5000, requires_forklift: true, is_pickable: false, is_stackable: false, max_stack_height: 1 },
  { code: 'TAMBUR_PLATFORMA', name: 'Platformă Tamburi Exterior', capacity_type: 'DRUM', default_max_weight_kg: 10000, requires_forklift: true, is_pickable: false, is_stackable: false, max_stack_height: 1 },
  { code: 'LR', name: 'Locație Recepție (RECV)', capacity_type: 'PALLET', requires_forklift: false, is_pickable: false, is_stackable: true, max_stack_height: 2 },
  { code: 'ZA', name: 'Zonă Așteptare Livrare (SHIP)', capacity_type: 'PALLET', requires_forklift: false, is_pickable: true, is_stackable: true, max_stack_height: 2 },
];

const CAPACITY_COLOR: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'> = {
  BOX: 'default',
  PALLET: 'primary',
  DRUM: 'secondary',
  BULK: 'warning',
  REEL: 'success',
  CONTAINER: 'error',
};

type FormData = { code: string; name: string; capacity_type: string; default_max_weight_kg: string; default_max_volume_cubic_meters: string; default_width_cm: string; default_depth_cm: string; default_height_cm: string; requires_forklift: boolean; is_pickable: boolean; is_stackable: boolean; max_stack_height: string; };

const emptyForm = (): FormData => ({
  code: '', name: '', capacity_type: 'BOX', default_max_weight_kg: '',
  default_max_volume_cubic_meters: '', default_width_cm: '', default_depth_cm: '',
  default_height_cm: '', requires_forklift: false, is_pickable: true,
  is_stackable: false, max_stack_height: '1',
});

export default function LocationTypesPage() {
  const [types, setTypes] = useState<LocationType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialog, setDialog] = useState<{ open: boolean; editing: LocationType | null }>({ open: false, editing: null });
  const [form, setForm] = useState<FormData>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await warehouseConfigService.listLocationTypes({ limit: 100 });
      setTypes(res.data || []);
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Eroare la încărcare');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm(emptyForm()); setDialog({ open: true, editing: null }); };
  const openEdit = (t: LocationType) => {
    setForm({
      code: t.code, name: t.name, capacity_type: t.capacity_type || 'BOX',
      default_max_weight_kg: t.default_max_weight_kg?.toString() || '',
      default_max_volume_cubic_meters: t.default_max_volume_cubic_meters?.toString() || '',
      default_width_cm: t.default_width_cm?.toString() || '',
      default_depth_cm: t.default_depth_cm?.toString() || '',
      default_height_cm: t.default_height_cm?.toString() || '',
      requires_forklift: t.requires_forklift ?? false,
      is_pickable: t.is_pickable ?? true,
      is_stackable: t.is_stackable ?? false,
      max_stack_height: t.max_stack_height?.toString() || '1',
    });
    setDialog({ open: true, editing: t });
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      setError('Cod și Nume sunt obligatorii'); return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        code: form.code.toUpperCase().trim(),
        name: form.name.trim(),
        capacity_type: form.capacity_type || undefined,
        default_max_weight_kg: form.default_max_weight_kg ? parseFloat(form.default_max_weight_kg) : undefined,
        default_max_volume_cubic_meters: form.default_max_volume_cubic_meters ? parseFloat(form.default_max_volume_cubic_meters) : undefined,
        default_width_cm: form.default_width_cm ? parseFloat(form.default_width_cm) : undefined,
        default_depth_cm: form.default_depth_cm ? parseFloat(form.default_depth_cm) : undefined,
        default_height_cm: form.default_height_cm ? parseFloat(form.default_height_cm) : undefined,
        requires_forklift: form.requires_forklift,
        is_pickable: form.is_pickable,
        is_stackable: form.is_stackable,
        max_stack_height: form.max_stack_height ? parseInt(form.max_stack_height) : 1,
      };
      if (dialog.editing) {
        await warehouseConfigService.updateLocationType(dialog.editing.id, payload);
        setSuccess('Tip locație actualizat');
      } else {
        await warehouseConfigService.createLocationType(payload);
        setSuccess('Tip locație creat');
      }
      setDialog({ open: false, editing: null });
      load();
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Eroare la salvare');
    } finally {
      setSaving(false);
    }
  };

  const handleSeedDefaults = async () => {
    setSeeding(true);
    setError('');
    let created = 0;
    let skipped = 0;
    for (const def of DEFAULTS_CABLURI) {
      const exists = types.find(t => t.code === def.code);
      if (exists) { skipped++; continue; }
      try {
        await warehouseConfigService.createLocationType(def as Parameters<typeof warehouseConfigService.createLocationType>[0]);
        created++;
      } catch { skipped++; }
    }
    setSuccess(`Instalat: ${created} tipuri noi, ${skipped} deja existente / omise.`);
    setSeeding(false);
    load();
  };

  const f = (field: keyof FormData, val: string | boolean) => setForm(prev => ({ ...prev, [field]: val }));

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Tipuri Locații</Typography>
          <Typography variant="body2" color="text.secondary">
            Definiți categoriile de locații din depozit — rafturi, derulatoare, platforme, zone recepție/livrare
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Instalează tipurile standard pentru depozit cabluri">
            <Button
              variant="outlined"
              startIcon={seeding ? <CircularProgress size={16} /> : <AutoFixHighIcon />}
              onClick={handleSeedDefaults}
              disabled={seeding}
            >
              Tipuri Implicite Cabluri
            </Button>
          </Tooltip>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
            Reîncarcă
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
            Adaugă Tip
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                {['Cod', 'Denumire', 'Tip Capacitate', 'Greutate Max (kg)', 'Dimensiuni (l×a×h cm)', 'Caracteristici', 'Acțiuni'].map(h => (
                  <TableCell key={h} sx={{ color: '#fff', fontWeight: 700 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {types.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    Niciun tip configurat. Apasă "Tipuri Implicite Cabluri" pentru a începe.
                  </TableCell>
                </TableRow>
              )}
              {types.map(t => (
                <TableRow key={t.id} hover>
                  <TableCell>
                    <Typography variant="caption" fontFamily="monospace" fontWeight={700}>{t.code}</Typography>
                    {t.is_system && <Chip label="SISTEM" size="small" sx={{ ml: 1, fontSize: '0.65rem' }} />}
                  </TableCell>
                  <TableCell>{t.name}</TableCell>
                  <TableCell>
                    {t.capacity_type && (
                      <Chip
                        label={t.capacity_type}
                        size="small"
                        color={CAPACITY_COLOR[t.capacity_type] || 'default'}
                      />
                    )}
                  </TableCell>
                  <TableCell>{t.default_max_weight_kg ? `${t.default_max_weight_kg} kg` : '—'}</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                    {[t.default_width_cm, t.default_depth_cm, t.default_height_cm].some(Boolean)
                      ? `${t.default_width_cm || '?'} × ${t.default_depth_cm || '?'} × ${t.default_height_cm || '?'}`
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap">
                      {t.requires_forklift && (
                        <Tooltip title="Necesită stivuitor">
                          <Chip icon={<ForkliftIcon sx={{ fontSize: '0.8rem !important' }} />} label="Stivuitor" size="small" color="warning" variant="outlined" />
                        </Tooltip>
                      )}
                      {t.is_pickable && <Chip label="Pickabil" size="small" color="success" variant="outlined" />}
                      {t.is_stackable && <Chip label={`Stivuibil ×${t.max_stack_height || 1}`} size="small" color="primary" variant="outlined" />}
                      {!t.is_active && <Chip label="Inactiv" size="small" color="error" variant="outlined" />}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => openEdit(t)} disabled={t.is_system}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Dialog Add/Edit */}
      <Dialog open={dialog.open} onClose={() => setDialog({ open: false, editing: null })} maxWidth="sm" fullWidth>
        <DialogTitle>{dialog.editing ? `Editare: ${dialog.editing.code}` : 'Tip Locație Nou'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Cod *" value={form.code} onChange={e => f('code', e.target.value.toUpperCase())}
                fullWidth inputProps={{ style: { fontFamily: 'monospace' } }}
                helperText="Ex: RACK_PALLET, DERULATOR, FLOOR_HEAVY"
              />
              <TextField label="Denumire *" value={form.name} onChange={e => f('name', e.target.value)} fullWidth />
            </Stack>

            <TextField
              label="Tip Capacitate" value={form.capacity_type}
              onChange={e => f('capacity_type', e.target.value)}
              select SelectProps={{ native: true }} fullWidth
            >
              {CAPACITY_TYPES.map(ct => <option key={ct} value={ct}>{ct}</option>)}
            </TextField>

            <Divider textAlign="left"><Typography variant="caption">Dimensiuni implicite (opțional)</Typography></Divider>
            <Stack direction="row" spacing={2}>
              <TextField label="Lățime (cm)" value={form.default_width_cm} onChange={e => f('default_width_cm', e.target.value)} type="number" fullWidth />
              <TextField label="Adâncime (cm)" value={form.default_depth_cm} onChange={e => f('default_depth_cm', e.target.value)} type="number" fullWidth />
              <TextField label="Înălțime (cm)" value={form.default_height_cm} onChange={e => f('default_height_cm', e.target.value)} type="number" fullWidth />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField label="Greutate max (kg)" value={form.default_max_weight_kg} onChange={e => f('default_max_weight_kg', e.target.value)} type="number" fullWidth />
              <TextField label="Volum max (m³)" value={form.default_max_volume_cubic_meters} onChange={e => f('default_max_volume_cubic_meters', e.target.value)} type="number" fullWidth />
              <TextField label="Înălțime stivă" value={form.max_stack_height} onChange={e => f('max_stack_height', e.target.value)} type="number" fullWidth />
            </Stack>

            <Divider textAlign="left"><Typography variant="caption">Caracteristici operaționale</Typography></Divider>
            <Stack direction="row" spacing={3}>
              <FormControlLabel control={<Switch checked={form.requires_forklift} onChange={e => f('requires_forklift', e.target.checked)} />} label="Necesită stivuitor" />
              <FormControlLabel control={<Switch checked={form.is_pickable} onChange={e => f('is_pickable', e.target.checked)} />} label="Pickabil" />
              <FormControlLabel control={<Switch checked={form.is_stackable} onChange={e => f('is_stackable', e.target.checked)} />} label="Stivuibil" />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog({ open: false, editing: null })}>Anulează</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'Salvează'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
