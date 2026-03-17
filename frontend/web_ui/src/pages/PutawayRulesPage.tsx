import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Button, CircularProgress,
  Alert, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Select, FormControl, InputLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import { warehouseConfigService } from '../services/warehouseConfig.service';

interface PutawayRule {
  id: string;
  packaging_type_code: string;
  packaging_type_name: string;
  packaging_category: string;
  location_type_code: string;
  location_type_name: string;
  priority: number;
  notes: string | null;
}

interface PackagingType {
  code: string;
  name: string;
  category: string;
}

interface LocationType {
  code: string;
  name: string;
}

function priorityColor(p: number): 'success' | 'warning' | 'error' | 'default' {
  if (p <= 2) return 'success';
  if (p <= 5) return 'warning';
  return 'error';
}

export default function PutawayRulesPage() {
  const [rules, setRules] = useState<PutawayRule[]>([]);
  const [packagingTypes, setPackagingTypes] = useState<PackagingType[]>([]);
  const [locationTypes, setLocationTypes] = useState<LocationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRule, setEditRule] = useState<PutawayRule | null>(null);
  const [form, setForm] = useState({ packaging_type_code: '', location_type_code: '', priority: 5, notes: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await warehouseConfigService.mintDevToken('admin');
      const [rulesRes, pkgRes, locRes] = await Promise.all([
        warehouseConfigService.listPutawayRules(),
        warehouseConfigService.listPackagingTypes(),
        warehouseConfigService.listLocationTypes(),
      ]);
      setRules(rulesRes.data || []);
      setPackagingTypes(pkgRes.data || []);
      setLocationTypes(locRes.data || []);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || 'Eroare la încărcare');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditRule(null);
    setForm({ packaging_type_code: '', location_type_code: '', priority: 5, notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (rule: PutawayRule) => {
    setEditRule(rule);
    setForm({
      packaging_type_code: rule.packaging_type_code,
      location_type_code: rule.location_type_code,
      priority: rule.priority,
      notes: rule.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (editRule) {
        await warehouseConfigService.updatePutawayRule(editRule.id, { priority: form.priority, notes: form.notes || undefined });
      } else {
        await warehouseConfigService.createPutawayRule({
          packaging_type_code: form.packaging_type_code,
          location_type_code: form.location_type_code,
          priority: form.priority,
          notes: form.notes || undefined,
        });
      }
      setSuccess(editRule ? 'Regulă actualizată' : 'Regulă adăugată');
      setDialogOpen(false);
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || 'Eroare la salvare');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Ștergi această regulă?')) return;
    try {
      await warehouseConfigService.deletePutawayRule(id);
      setSuccess('Regulă ștearsă');
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || 'Eroare la ștergere');
    }
  };

  // Group rules by packaging type for a matrix-style view
  const grouped = packagingTypes.reduce<Record<string, PutawayRule[]>>((acc, pt) => {
    acc[pt.code] = rules.filter(r => r.packaging_type_code === pt.code).sort((a, b) => a.priority - b.priority);
    return acc;
  }, {});

  // Location types that have at least one rule (for column headers)
  const usedLocationTypes = locationTypes.filter(lt =>
    rules.some(r => r.location_type_code === lt.code)
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <Typography variant="h5" fontWeight={700}>Reguli Depozitare (Putaway)</Typography>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Adaugă Regulă
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        Prioritate 1 = prima alegere. Când un lot ajunge în zona RECV, sistemul sugerează locația cu prioritatea cea mai mică pentru tipul de ambalaj.
      </Alert>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Matrix view */}
          <Typography variant="h6" sx={{ mb: 1 }}>Matrice Ambalaj → Tip Locație</Typography>
          <TableContainer component={Paper} sx={{ mb: 4, overflow: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 700, minWidth: 160 }}>Tip Ambalaj</TableCell>
                  {usedLocationTypes.map(lt => (
                    <TableCell key={lt.code} align="center" sx={{ color: 'white', fontWeight: 700, minWidth: 120 }}>
                      {lt.name}
                      <Typography variant="caption" display="block" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                        {lt.code}
                      </Typography>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {packagingTypes.map(pt => {
                  const ptRules = grouped[pt.code] || [];
                  const hasRules = ptRules.length > 0;
                  return (
                    <TableRow key={pt.code} hover sx={{ opacity: hasRules ? 1 : 0.4 }}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{pt.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{pt.code}</Typography>
                      </TableCell>
                      {usedLocationTypes.map(lt => {
                        const rule = ptRules.find(r => r.location_type_code === lt.code);
                        return (
                          <TableCell key={lt.code} align="center">
                            {rule ? (
                              <Chip
                                label={`P${rule.priority}`}
                                size="small"
                                color={priorityColor(rule.priority)}
                                title={rule.notes || ''}
                              />
                            ) : (
                              <Typography color="text.disabled" variant="caption">—</Typography>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Detailed list */}
          <Typography variant="h6" sx={{ mb: 1 }}>Lista Regulilor</Typography>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Tip Ambalaj</TableCell>
                  <TableCell>Tip Locație</TableCell>
                  <TableCell align="center">Prioritate</TableCell>
                  <TableCell>Note</TableCell>
                  <TableCell align="right">Acțiuni</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rules.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography color="text.secondary" sx={{ py: 3 }}>
                        Nu există reguli. Adaugă prima regulă.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {rules.sort((a, b) => a.packaging_type_code.localeCompare(b.packaging_type_code) || a.priority - b.priority).map(rule => (
                  <TableRow key={rule.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{rule.packaging_type_name || rule.packaging_type_code}</Typography>
                      <Typography variant="caption" color="text.secondary">{rule.packaging_type_code}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{rule.location_type_name || rule.location_type_code}</Typography>
                      <Typography variant="caption" color="text.secondary">{rule.location_type_code}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={rule.priority} size="small" color={priorityColor(rule.priority)} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{rule.notes || '—'}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Editează">
                        <IconButton size="small" onClick={() => openEdit(rule)}><EditIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Șterge">
                        <IconButton size="small" color="error" onClick={() => handleDelete(rule.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editRule ? 'Editează Regulă' : 'Adaugă Regulă Putaway'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <FormControl fullWidth disabled={!!editRule}>
            <InputLabel>Tip Ambalaj</InputLabel>
            <Select
              value={form.packaging_type_code}
              label="Tip Ambalaj"
              onChange={e => setForm(f => ({ ...f, packaging_type_code: e.target.value }))}
            >
              {packagingTypes.map(pt => (
                <MenuItem key={pt.code} value={pt.code}>{pt.name} ({pt.code})</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth disabled={!!editRule}>
            <InputLabel>Tip Locație</InputLabel>
            <Select
              value={form.location_type_code}
              label="Tip Locație"
              onChange={e => setForm(f => ({ ...f, location_type_code: e.target.value }))}
            >
              {locationTypes.map(lt => (
                <MenuItem key={lt.code} value={lt.code}>{lt.name} ({lt.code})</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Prioritate (1 = prima alegere)"
            type="number"
            value={form.priority}
            onChange={e => setForm(f => ({ ...f, priority: Math.max(1, Math.min(100, Number(e.target.value))) }))}
            inputProps={{ min: 1, max: 100 }}
            fullWidth
          />

          <TextField
            label="Note (opțional)"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            multiline
            rows={2}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Anulează</Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || !form.packaging_type_code || !form.location_type_code}
          >
            {saving ? 'Se salvează...' : 'Salvează'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
