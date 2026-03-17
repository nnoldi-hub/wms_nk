/**
 * Pagina Tipuri Ambalaje — Admin
 * Gestionează ambalajele fizice ale produselor din depozit:
 * COLAC (coil), TAMBUR (drum), REST (remnant), etc.
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
import warehouseConfigService from '../services/warehouseConfig.service';

interface PackagingType {
  id: string;
  code: string;
  name: string;
  category?: string;
  max_product_length_meters?: number;
  max_product_weight_kg?: number;
  width_cm?: number;
  depth_cm?: number;
  height_cm?: number;
  requires_forklift?: boolean;
  is_stackable?: boolean;
  max_stack_height?: number;
  is_reusable?: boolean;
  is_active?: boolean;
}

const CATEGORIES = ['PRIMARY', 'SECONDARY', 'TERTIARY'];

// Tipuri standard pentru un depozit de cabluri
const DEFAULTS_CABLURI: Omit<PackagingType, 'id'>[] = [
  { code: 'COLAC', name: 'Colac Cablu (Coil)', category: 'PRIMARY', requires_forklift: false, is_stackable: true, max_stack_height: 3, is_reusable: false },
  { code: 'COLAC_100M', name: 'Colac 100m', category: 'PRIMARY', max_product_length_meters: 100, requires_forklift: false, is_stackable: true, max_stack_height: 3, is_reusable: false },
  { code: 'COLAC_200M', name: 'Colac 200m', category: 'PRIMARY', max_product_length_meters: 200, requires_forklift: false, is_stackable: true, max_stack_height: 2, is_reusable: false },
  { code: 'TAMBUR_MIC', name: 'Tambur Mic (<300m)', category: 'PRIMARY', max_product_length_meters: 300, max_product_weight_kg: 300, requires_forklift: false, is_stackable: false, is_reusable: true },
  { code: 'TAMBUR_MEDIU', name: 'Tambur Mediu (300-1000m)', category: 'PRIMARY', max_product_length_meters: 1000, max_product_weight_kg: 800, requires_forklift: true, is_stackable: false, is_reusable: true },
  { code: 'TAMBUR_MARE', name: 'Tambur Mare (>1000m)', category: 'PRIMARY', max_product_length_meters: 5000, max_product_weight_kg: 3000, requires_forklift: true, is_stackable: false, is_reusable: true },
  { code: 'REST', name: 'Rest/Remnant Cablu', category: 'PRIMARY', requires_forklift: false, is_stackable: true, max_stack_height: 5, is_reusable: false },
  { code: 'PALET', name: 'Palet cu Cabluri', category: 'SECONDARY', requires_forklift: true, is_stackable: false, is_reusable: true },
];

const CATEGORY_COLOR: Record<string, 'default' | 'primary' | 'secondary' | 'success'> = {
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
  TERTIARY: 'success',
};

type FormData = {
  code: string; name: string; category: string;
  max_product_length_meters: string; max_product_weight_kg: string;
  width_cm: string; depth_cm: string; height_cm: string;
  requires_forklift: boolean; is_stackable: boolean;
  max_stack_height: string; is_reusable: boolean;
};

const emptyForm = (): FormData => ({
  code: '', name: '', category: 'PRIMARY',
  max_product_length_meters: '', max_product_weight_kg: '',
  width_cm: '', depth_cm: '', height_cm: '',
  requires_forklift: false, is_stackable: false, max_stack_height: '1', is_reusable: false,
});

export default function PackagingTypesPage() {
  const [types, setTypes] = useState<PackagingType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialog, setDialog] = useState<{ open: boolean; editing: PackagingType | null }>({ open: false, editing: null });
  const [form, setForm] = useState<FormData>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await warehouseConfigService.listPackagingTypes({ limit: 100 });
      setTypes(res.data || []);
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Eroare la încărcare');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm(emptyForm()); setDialog({ open: true, editing: null }); };
  const openEdit = (t: PackagingType) => {
    setForm({
      code: t.code, name: t.name, category: t.category || 'PRIMARY',
      max_product_length_meters: t.max_product_length_meters?.toString() || '',
      max_product_weight_kg: t.max_product_weight_kg?.toString() || '',
      width_cm: t.width_cm?.toString() || '',
      depth_cm: t.depth_cm?.toString() || '',
      height_cm: t.height_cm?.toString() || '',
      requires_forklift: t.requires_forklift ?? false,
      is_stackable: t.is_stackable ?? false,
      max_stack_height: t.max_stack_height?.toString() || '1',
      is_reusable: t.is_reusable ?? false,
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
        category: form.category || undefined,
        max_product_length_meters: form.max_product_length_meters ? parseFloat(form.max_product_length_meters) : undefined,
        max_product_weight_kg: form.max_product_weight_kg ? parseFloat(form.max_product_weight_kg) : undefined,
        width_cm: form.width_cm ? parseFloat(form.width_cm) : undefined,
        depth_cm: form.depth_cm ? parseFloat(form.depth_cm) : undefined,
        height_cm: form.height_cm ? parseFloat(form.height_cm) : undefined,
        requires_forklift: form.requires_forklift,
        is_stackable: form.is_stackable,
        max_stack_height: form.max_stack_height ? parseInt(form.max_stack_height) : 1,
        is_reusable: form.is_reusable,
      };
      if (dialog.editing) {
        await warehouseConfigService.updatePackagingType(dialog.editing.id, payload);
        setSuccess('Tip ambalaj actualizat');
      } else {
        await warehouseConfigService.createPackagingType(payload);
        setSuccess('Tip ambalaj creat');
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
        await warehouseConfigService.createPackagingType(def as Parameters<typeof warehouseConfigService.createPackagingType>[0]);
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
          <Typography variant="h5" fontWeight={700}>Tipuri Ambalaje / Loturi</Typography>
          <Typography variant="body2" color="text.secondary">
            Definiți formele fizice în care vin produsele: COLAC, TAMBUR, REST, PALET etc.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Instalează tipurile standard pentru un depozit de cabluri (COLAC, TAMBUR, REST)">
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
                {['Cod', 'Denumire', 'Categorie', 'Lungime max (m)', 'Greutate max (kg)', 'Caracteristici', 'Acțiuni'].map(h => (
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
                  </TableCell>
                  <TableCell>{t.name}</TableCell>
                  <TableCell>
                    {t.category && (
                      <Chip label={t.category} size="small" color={CATEGORY_COLOR[t.category] || 'default'} />
                    )}
                  </TableCell>
                  <TableCell>{t.max_product_length_meters ? `${t.max_product_length_meters} m` : '—'}</TableCell>
                  <TableCell>{t.max_product_weight_kg ? `${t.max_product_weight_kg} kg` : '—'}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap">
                      {t.requires_forklift && <Chip label="Stivuitor" size="small" color="warning" variant="outlined" />}
                      {t.is_stackable && <Chip label={`Stivuibil ×${t.max_stack_height || 1}`} size="small" color="primary" variant="outlined" />}
                      {t.is_reusable && <Chip label="Reutilizabil" size="small" color="success" variant="outlined" />}
                      {!t.is_active && <Chip label="Inactiv" size="small" color="error" variant="outlined" />}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => openEdit(t)}>
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
        <DialogTitle>{dialog.editing ? `Editare: ${dialog.editing.code}` : 'Tip Ambalaj Nou'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Cod *" value={form.code} onChange={e => f('code', e.target.value.toUpperCase())}
                fullWidth inputProps={{ style: { fontFamily: 'monospace' } }}
                helperText="Ex: COLAC_100M, TAMBUR_MIC, REST"
              />
              <TextField label="Denumire *" value={form.name} onChange={e => f('name', e.target.value)} fullWidth />
            </Stack>

            <TextField
              label="Categorie" value={form.category}
              onChange={e => f('category', e.target.value)}
              select SelectProps={{ native: true }} fullWidth
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </TextField>

            <Divider textAlign="left"><Typography variant="caption">Limite produs (opțional)</Typography></Divider>
            <Stack direction="row" spacing={2}>
              <TextField label="Lungime max (m)" value={form.max_product_length_meters} onChange={e => f('max_product_length_meters', e.target.value)} type="number" fullWidth helperText="Ex: 100, 500, 1000" />
              <TextField label="Greutate max (kg)" value={form.max_product_weight_kg} onChange={e => f('max_product_weight_kg', e.target.value)} type="number" fullWidth />
            </Stack>

            <Divider textAlign="left"><Typography variant="caption">Dimensiuni ambalaj (opțional)</Typography></Divider>
            <Stack direction="row" spacing={2}>
              <TextField label="Lățime (cm)" value={form.width_cm} onChange={e => f('width_cm', e.target.value)} type="number" fullWidth />
              <TextField label="Adâncime (cm)" value={form.depth_cm} onChange={e => f('depth_cm', e.target.value)} type="number" fullWidth />
              <TextField label="Înălțime (cm)" value={form.height_cm} onChange={e => f('height_cm', e.target.value)} type="number" fullWidth />
            </Stack>

            <Divider textAlign="left"><Typography variant="caption">Caracteristici</Typography></Divider>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <FormControlLabel control={<Switch checked={form.requires_forklift} onChange={e => f('requires_forklift', e.target.checked)} />} label="Necesită stivuitor" />
              <FormControlLabel control={<Switch checked={form.is_stackable} onChange={e => f('is_stackable', e.target.checked)} />} label="Stivuibil" />
              <FormControlLabel control={<Switch checked={form.is_reusable} onChange={e => f('is_reusable', e.target.checked)} />} label="Reutilizabil" />
            </Stack>
            {form.is_stackable && (
              <TextField label="Înălțime stivă max" value={form.max_stack_height} onChange={e => f('max_stack_height', e.target.value)} type="number" sx={{ width: 200 }} />
            )}
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
