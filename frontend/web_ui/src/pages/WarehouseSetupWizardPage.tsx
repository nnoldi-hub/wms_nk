/**
 * Faza 3.1 — Setup Wizard: Configurare Depozit (7 pasi)
 *
 * Pas 1: Date generale depozit
 * Pas 2: Zone depozit
 * Pas 3: Tipuri locatii
 * Pas 4: Reguli putaway
 * Pas 5: Reguli picking
 * Pas 6: Generare locatii bulk (preview)
 * Pas 7: Validare + Finalizare
 */

import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, Stepper, Step, StepLabel,
  TextField, Stack, Alert, CircularProgress, Chip, Divider,
  Select, MenuItem, FormControl, InputLabel, IconButton, Tooltip,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  Dialog, DialogTitle, DialogContent, DialogActions,
  List, ListItem, ListItemIcon, ListItemText, LinearProgress,
} from '@mui/material';
import {
  Warehouse as WarehouseIcon,
  Map as MapIcon,
  LocationOn as LocationIcon,
  Rule as RuleIcon,
  PlaylistAdd as PickIcon,
  ViewModule as BulkIcon,
  CheckCircle as CheckIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Lightbulb as TipIcon,
} from '@mui/icons-material';
import warehouseConfigService from '../services/warehouseConfig.service';

// ─── Tipuri Wizard ─────────────────────────────────────────────────────────

type ZoneType =
  | 'RECEIVING' | 'QC' | 'STORAGE' | 'PICKING'
  | 'PACKING' | 'SHIPPING' | 'RETURNS' | 'QUARANTINE'
  | 'PRODUCTION' | 'STAGING';

interface WizardWarehouse {
  warehouse_code: string;
  warehouse_name: string;
  company_name: string;
  city: string;
  total_area_sqm: string;
}

interface WizardZone {
  zone_code: string;
  zone_name: string;
  zone_type: ZoneType;
}

interface WizardLocationType {
  code: string;
  name: string;
  aisles: string;
  racks_per_aisle: string;
  levels_per_rack: string;
  bins_per_level: string;
  zone_code: string; // zona careia ii apartine
}

interface WizardRule {
  name: string;
  rule_type: string;
  scope: 'PUTAWAY' | 'PICKING';
}

interface WizardResult {
  warehouse_id?: string;
  zones_created: number;
  location_types_created: number;
  rules_created: number;
  locations_created: number;
  errors: string[];
}

// ─── Date implicite ────────────────────────────────────────────────────────

const ZONE_TYPE_OPTIONS: { value: ZoneType; label: string; description: string }[] = [
  { value: 'RECEIVING', label: 'Receptie', description: 'Zona primire marfa' },
  { value: 'QC', label: 'Control Calitate', description: 'Inspectie si aprobare' },
  { value: 'STORAGE', label: 'Stocare', description: 'Depozitare principala' },
  { value: 'PICKING', label: 'Picking', description: 'Pregatire comenzi' },
  { value: 'PACKING', label: 'Ambalare', description: 'Ambalare si etichetare' },
  { value: 'SHIPPING', label: 'Expediere', description: 'Zona livrare' },
  { value: 'RETURNS', label: 'Retururi', description: 'Marfa returnata' },
  { value: 'QUARANTINE', label: 'Carantina', description: 'Marfa blocat' },
  { value: 'PRODUCTION', label: 'Productie', description: 'Zona de productie' },
  { value: 'STAGING', label: 'Staging', description: 'Pregatire transfer' },
];

const PUTAWAY_RULE_PRESETS: WizardRule[] = [
  { name: 'FIFO Putaway', rule_type: 'FIFO', scope: 'PUTAWAY' },
  { name: 'Minimizeaza Resturi Putaway', rule_type: 'MIN_WASTE', scope: 'PUTAWAY' },
  { name: 'Prioritate Resturi', rule_type: 'USE_REMAINS_FIRST', scope: 'PUTAWAY' },
];
const PICKING_RULE_PRESETS: WizardRule[] = [
  { name: 'FIFO Picking', rule_type: 'FIFO', scope: 'PICKING' },
  { name: 'Minimizeaza Resturi Picking', rule_type: 'MIN_WASTE', scope: 'PICKING' },
  { name: 'Proximitate Locatie', rule_type: 'LOCATION_PROXIMITY', scope: 'PICKING' },
];

// ─── Sub-componentele pasilor ───────────────────────────────────────────────

// ——— PAS 1: Date generale ——————————————————————————————————————————————————
function Step1General({ data, onChange }: {
  data: WizardWarehouse;
  onChange: (d: WizardWarehouse) => void;
}) {
  const set = (field: keyof WizardWarehouse, val: string) => onChange({ ...data, [field]: val });
  return (
    <Box>
      <Alert severity="info" icon={<TipIcon />} sx={{ mb: 2 }}>
        Completeaza datele de baza ale depozitului. Codul trebuie sa fie unic si scurt (ex: DEP01).
      </Alert>
      <Stack spacing={2.5}>
        <Stack direction="row" spacing={2}>
          <TextField
            label="Cod depozit *"
            value={data.warehouse_code}
            onChange={e => set('warehouse_code', e.target.value.toUpperCase())}
            size="small"
            sx={{ width: 180 }}
            placeholder="ex: DEP01"
            inputProps={{ maxLength: 20 }}
          />
          <TextField
            label="Nume depozit *"
            value={data.warehouse_name}
            onChange={e => set('warehouse_name', e.target.value)}
            size="small"
            fullWidth
            placeholder="ex: Depozit Central Brasov"
          />
        </Stack>
        <TextField
          label="Companie *"
          value={data.company_name}
          onChange={e => set('company_name', e.target.value)}
          size="small"
          fullWidth
          placeholder="ex: NK Cabluri SRL"
        />
        <Stack direction="row" spacing={2}>
          <TextField
            label="Oras"
            value={data.city}
            onChange={e => set('city', e.target.value)}
            size="small"
            sx={{ flex: 1 }}
          />
          <TextField
            label="Suprafata totala (m²)"
            type="number"
            value={data.total_area_sqm}
            onChange={e => set('total_area_sqm', e.target.value)}
            size="small"
            sx={{ width: 200 }}
          />
        </Stack>
      </Stack>
    </Box>
  );
}

// ——— PAS 2: Zone ——————————————————————————————————————————————————————————
function Step2Zones({ zones, onChange }: {
  zones: WizardZone[];
  onChange: (z: WizardZone[]) => void;
}) {
  const addZone = () => onChange([...zones, { zone_code: '', zone_name: '', zone_type: 'STORAGE' }]);
  const removeZone = (idx: number) => onChange(zones.filter((_, i) => i !== idx));
  const updateZone = (idx: number, field: keyof WizardZone, val: string) => {
    const updated = [...zones];
    (updated[idx] as unknown as Record<string, string>)[field] = val;
    onChange(updated);
  };

  const essentials: ZoneType[] = ['RECEIVING', 'STORAGE', 'SHIPPING'];
  const missingEssentials = essentials.filter(e => !zones.some(z => z.zone_type === e));

  return (
    <Box>
      {missingEssentials.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Lipsesc zone esentiale: {missingEssentials.join(', ')}
        </Alert>
      )}
      <Stack spacing={1.5} mb={2}>
        {zones.map((z, idx) => (
          <Paper key={idx} variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TextField
                label="Cod zona"
                value={z.zone_code}
                onChange={e => updateZone(idx, 'zone_code', e.target.value.toUpperCase())}
                size="small"
                sx={{ width: 130 }}
                inputProps={{ maxLength: 10 }}
              />
              <TextField
                label="Nume zona"
                value={z.zone_name}
                onChange={e => updateZone(idx, 'zone_name', e.target.value)}
                size="small"
                sx={{ flex: 1 }}
              />
              <FormControl size="small" sx={{ width: 180 }}>
                <InputLabel>Tip zona</InputLabel>
                <Select
                  value={z.zone_type}
                  label="Tip zona"
                  onChange={e => updateZone(idx, 'zone_type', e.target.value)}
                >
                  {ZONE_TYPE_OPTIONS.map(o => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Tooltip title="Sterge zona">
                <IconButton size="small" color="error" onClick={() => removeZone(idx)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Paper>
        ))}
      </Stack>
      <Button startIcon={<AddIcon />} onClick={addZone} variant="outlined" size="small">
        Adauga zona
      </Button>
    </Box>
  );
}

// ——— PAS 3: Tipuri locatii ————————————————————————————————————————————————
function Step3LocationTypes({ types, zones, onChange }: {
  types: WizardLocationType[];
  zones: WizardZone[];
  onChange: (t: WizardLocationType[]) => void;
}) {
  const addType = () => onChange([...types, {
    code: '', name: '', aisles: '2', racks_per_aisle: '5', levels_per_rack: '3', bins_per_level: '4', zone_code: zones[0]?.zone_code || '',
  }]);
  const removeType = (idx: number) => onChange(types.filter((_, i) => i !== idx));
  const update = (idx: number, field: keyof WizardLocationType, val: string) => {
    const updated = [...types];
    (updated[idx] as unknown as Record<string, string>)[field] = val;
    onChange(updated);
  };

  const preview = (t: WizardLocationType) => {
    const a = parseInt(t.aisles) || 0;
    const r = parseInt(t.racks_per_aisle) || 0;
    const l = parseInt(t.levels_per_rack) || 0;
    const b = parseInt(t.bins_per_level) || 0;
    return a * r * l * b;
  };

  return (
    <Box>
      <Alert severity="info" icon={<TipIcon />} sx={{ mb: 2 }}>
        Defineste tipurile de locatii si dimensiunile grilei. Numarul de locatii generate = culoar × raft × nivel × bin.
      </Alert>
      <Stack spacing={2} mb={2}>
        {types.map((t, idx) => (
          <Paper key={idx} variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start" flexWrap="wrap" gap={1}>
              <TextField label="Cod tip" value={t.code} onChange={e => update(idx, 'code', e.target.value.toUpperCase())} size="small" sx={{ width: 120 }} />
              <TextField label="Nume tip" value={t.name} onChange={e => update(idx, 'name', e.target.value)} size="small" sx={{ width: 160 }} />
              <FormControl size="small" sx={{ width: 160 }}>
                <InputLabel>Zona</InputLabel>
                <Select value={t.zone_code} label="Zona" onChange={e => update(idx, 'zone_code', e.target.value)}>
                  {zones.map(z => <MenuItem key={z.zone_code} value={z.zone_code}>{z.zone_code} — {z.zone_name}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField label="Culoar" type="number" value={t.aisles} onChange={e => update(idx, 'aisles', e.target.value)} size="small" sx={{ width: 90 }} />
              <TextField label="Rafturi/culoar" type="number" value={t.racks_per_aisle} onChange={e => update(idx, 'racks_per_aisle', e.target.value)} size="small" sx={{ width: 120 }} />
              <TextField label="Niveluri/raft" type="number" value={t.levels_per_rack} onChange={e => update(idx, 'levels_per_rack', e.target.value)} size="small" sx={{ width: 110 }} />
              <TextField label="Bin-uri/nivel" type="number" value={t.bins_per_level} onChange={e => update(idx, 'bins_per_level', e.target.value)} size="small" sx={{ width: 110 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip label={`${preview(t)} locatii`} size="small" color={preview(t) > 0 ? 'success' : 'default'} />
                <Tooltip title="Sterge tip">
                  <IconButton size="small" color="error" onClick={() => removeType(idx)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Stack>
          </Paper>
        ))}
      </Stack>
      <Button startIcon={<AddIcon />} onClick={addType} variant="outlined" size="small">
        Adauga tip locatie
      </Button>
    </Box>
  );
}

// ——— PAS 4 & 5: Reguli ———————————————————————————————————————————————————
function StepRules({ scope, rules, onChange, presets }: {
  scope: 'PUTAWAY' | 'PICKING';
  rules: WizardRule[];
  onChange: (r: WizardRule[]) => void;
  presets: WizardRule[];
}) {
  const toggle = (preset: WizardRule) => {
    const exists = rules.some(r => r.rule_type === preset.rule_type && r.scope === preset.scope);
    if (exists) {
      onChange(rules.filter(r => !(r.rule_type === preset.rule_type && r.scope === preset.scope)));
    } else {
      onChange([...rules, { ...preset }]);
    }
  };

  const label = scope === 'PUTAWAY' ? 'Putaway' : 'Picking';
  const description = scope === 'PUTAWAY'
    ? 'Regulile PUTAWAY determina unde este depus stocul la receptie.'
    : 'Regulile PICKING determina ordinea de selectie a stocului la culegere.';

  return (
    <Box>
      <Alert severity="info" icon={<TipIcon />} sx={{ mb: 2 }}>{description}</Alert>
      <Typography variant="subtitle2" fontWeight={700} mb={1.5} color="text.secondary">
        Selecteaza regulile {label} dorite:
      </Typography>
      <Stack spacing={1.5}>
        {presets.map((preset, idx) => {
          const active = rules.some(r => r.rule_type === preset.rule_type && r.scope === preset.scope);
          return (
            <Paper
              key={idx}
              variant="outlined"
              onClick={() => toggle(preset)}
              sx={{
                p: 2, cursor: 'pointer',
                borderColor: active ? 'primary.main' : undefined,
                bgcolor: active ? 'primary.50' : undefined,
                transition: 'all 0.15s',
                '&:hover': { borderColor: 'primary.main', boxShadow: 1 },
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography fontWeight={active ? 700 : 400}>{preset.name}</Typography>
                  <Typography variant="caption" color="text.secondary">Tip: {preset.rule_type}</Typography>
                </Box>
                {active && <CheckIcon color="primary" />}
              </Stack>
            </Paper>
          );
        })}
      </Stack>
      {rules.length === 0 && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Nu ai selectat nicio regula {label}. Sistemul nu va putea procesa automat stocul.
        </Alert>
      )}
    </Box>
  );
}

// ——— PAS 6: Preview locatii ——————————————————————————————————————————————
function Step6Preview({ types }: { types: WizardLocationType[] }) {
  const totalLocations = types.reduce((s, t) => {
    const a = parseInt(t.aisles) || 0;
    const r = parseInt(t.racks_per_aisle) || 0;
    const l = parseInt(t.levels_per_rack) || 0;
    const b = parseInt(t.bins_per_level) || 0;
    return s + a * r * l * b;
  }, 0);

  return (
    <Box>
      <Alert severity="success" sx={{ mb: 2 }}>
        Se vor genera <strong>{totalLocations} locatii</strong> distribuite pe {types.length} tipuri.
        Aceasta operatiune poate dura cateva secunde.
      </Alert>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Tip locatie</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Zona</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Culoar×Raft×Nivel×Bin</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Total locatii</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {types.map((t, idx) => {
              const a = parseInt(t.aisles) || 0;
              const r = parseInt(t.racks_per_aisle) || 0;
              const l = parseInt(t.levels_per_rack) || 0;
              const b = parseInt(t.bins_per_level) || 0;
              return (
                <TableRow key={idx}>
                  <TableCell><strong>{t.code}</strong> — {t.name}</TableCell>
                  <TableCell>{t.zone_code}</TableCell>
                  <TableCell>{a} × {r} × {l} × {b}</TableCell>
                  <TableCell align="right">
                    <Chip label={a * r * l * b} size="small" color="primary" />
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow>
              <TableCell colSpan={3} sx={{ fontWeight: 700 }}>TOTAL</TableCell>
              <TableCell align="right">
                <Chip label={totalLocations} size="small" color="success" />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ——— PAS 7: Validare + Rezultat —————————————————————————————————————————
function Step7Validation({ warehouse, zones, types, putawayRules, pickingRules }: {
  warehouse: WizardWarehouse;
  zones: WizardZone[];
  types: WizardLocationType[];
  putawayRules: WizardRule[];
  pickingRules: WizardRule[];
}) {
  const issues: { type: 'error' | 'warning'; message: string }[] = [];

  if (!warehouse.warehouse_code) issues.push({ type: 'error', message: 'Cod depozit lipsa' });
  if (!warehouse.warehouse_name) issues.push({ type: 'error', message: 'Nume depozit lipsa' });
  if (!warehouse.company_name) issues.push({ type: 'error', message: 'Companie lipsa' });
  if (zones.length === 0) issues.push({ type: 'error', message: 'Nicio zona configurata' });
  if (!zones.some(z => z.zone_type === 'RECEIVING')) issues.push({ type: 'warning', message: 'Lipseste zona RECEIVING' });
  if (!zones.some(z => z.zone_type === 'STORAGE')) issues.push({ type: 'warning', message: 'Lipseste zona STORAGE' });
  if (!zones.some(z => z.zone_type === 'SHIPPING')) issues.push({ type: 'warning', message: 'Lipseste zona SHIPPING' });
  if (types.length === 0) issues.push({ type: 'warning', message: 'Niciun tip de locatie configurat — locatiile nu se vor genera' });
  zones.forEach(z => {
    if (!z.zone_code) issues.push({ type: 'error', message: `Zona fara cod (${z.zone_name || 'necunoscuta'})` });
    if (!z.zone_name) issues.push({ type: 'error', message: `Zona fara nume (${z.zone_code || 'necunoscuta'})` });
  });
  if (putawayRules.length === 0) issues.push({ type: 'warning', message: 'Nicio regula PUTAWAY selectata' });
  if (pickingRules.length === 0) issues.push({ type: 'warning', message: 'Nicio regula PICKING selectata' });

  const errors = issues.filter(i => i.type === 'error');
  const warnings = issues.filter(i => i.type === 'warning');

  return (
    <Box>
      {errors.length === 0 && warnings.length === 0 ? (
        <Alert severity="success" icon={<CheckIcon />} sx={{ mb: 2 }}>
          Configuratia este valida! Apasa "Finalizeaza" pentru a crea depozitul.
        </Alert>
      ) : (
        <>
          {errors.length > 0 && (
            <Alert severity="error" sx={{ mb: 1 }}>
              Sunt {errors.length} erori blocante. Rezolva-le inainte de a finaliza.
            </Alert>
          )}
          {warnings.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Sunt {warnings.length} avertismente. Poti continua dar configuratia va fi incompleta.
            </Alert>
          )}
        </>
      )}

      <List dense>
        {issues.map((issue, idx) => (
          <ListItem key={idx} sx={{ py: 0.5 }}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              {issue.type === 'error'
                ? <ErrorIcon color="error" fontSize="small" />
                : <WarningIcon color="warning" fontSize="small" />}
            </ListItemIcon>
            <ListItemText primary={issue.message} />
          </ListItem>
        ))}
      </List>

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" fontWeight={700} mb={1}>Rezumat configuratie</Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
        <Chip label={`Depozit: ${warehouse.warehouse_name || '—'}`} icon={<WarehouseIcon />} />
        <Chip label={`${zones.length} zone`} icon={<MapIcon />} color="primary" />
        <Chip label={`${types.length} tipuri locatii`} icon={<LocationIcon />} color="secondary" />
        <Chip label={`${putawayRules.length} reguli PUTAWAY`} icon={<RuleIcon />} color="info" />
        <Chip label={`${pickingRules.length} reguli PICKING`} icon={<PickIcon />} color="success" />
      </Stack>
    </Box>
  );
}

// ─── Pagina Wizard ────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Date depozit', icon: <WarehouseIcon /> },
  { label: 'Zone depozit', icon: <MapIcon /> },
  { label: 'Tipuri locatii', icon: <LocationIcon /> },
  { label: 'Reguli Putaway', icon: <RuleIcon /> },
  { label: 'Reguli Picking', icon: <PickIcon /> },
  { label: 'Preview locatii', icon: <BulkIcon /> },
  { label: 'Validare & Finalizare', icon: <CheckIcon /> },
];

interface FinishDialogProps {
  open: boolean;
  result: WizardResult | null;
  onClose: () => void;
}

function FinishDialog({ open, result, onClose }: FinishDialogProps) {
  if (!result) return null;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {result.errors.length === 0 ? '✅ Depozit configurat cu succes!' : '⚠️ Configurare partiala'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
            <Chip label={`${result.zones_created} zone create`} color="primary" />
            <Chip label={`${result.location_types_created} tipuri locatii`} color="secondary" />
            <Chip label={`${result.rules_created} reguli`} color="info" />
            <Chip label={`${result.locations_created} locatii generate`} color="success" />
          </Stack>
          {result.errors.length > 0 && (
            <Alert severity="warning">
              <Typography variant="subtitle2" mb={0.5}>Erori aparute:</Typography>
              {result.errors.map((e, i) => (
                <Typography key={i} variant="caption" display="block">• {e}</Typography>
              ))}
            </Alert>
          )}
          {result.errors.length === 0 && (
            <Alert severity="success">
              Merge la pagina "Configurare Depozit" pentru a vizualiza si ajusta configuratia.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>Inchide</Button>
      </DialogActions>
    </Dialog>
  );
}

const WarehouseSetupWizardPage: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [finishResult, setFinishResult] = useState<WizardResult | null>(null);
  const [showFinish, setShowFinish] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  // State wizard
  const [warehouse, setWarehouse] = useState<WizardWarehouse>({
    warehouse_code: '', warehouse_name: '', company_name: '', city: '', total_area_sqm: '',
  });
  const [zones, setZones] = useState<WizardZone[]>([
    { zone_code: 'RECV', zone_name: 'Receptie', zone_type: 'RECEIVING' },
    { zone_code: 'STOR', zone_name: 'Stocare', zone_type: 'STORAGE' },
    { zone_code: 'SHIP', zone_name: 'Expediere', zone_type: 'SHIPPING' },
  ]);
  const [locationTypes, setLocationTypes] = useState<WizardLocationType[]>([
    { code: 'RACK', name: 'Raft Standard', aisles: '3', racks_per_aisle: '5', levels_per_rack: '4', bins_per_level: '4', zone_code: 'STOR' },
  ]);
  const [putawayRules, setPutawayRules] = useState<WizardRule[]>([PUTAWAY_RULE_PRESETS[0]]);
  const [pickingRules, setPickingRules] = useState<WizardRule[]>([PICKING_RULE_PRESETS[0]]);

  const canProceed = useCallback((step: number): boolean => {
    switch (step) {
      case 0: return !!(warehouse.warehouse_code && warehouse.warehouse_name && warehouse.company_name);
      case 1: return zones.length > 0 && zones.every(z => z.zone_code && z.zone_name);
      case 2: return true; // optional
      case 3: return true; // reguli optional
      case 4: return true;
      case 5: return true;
      case 6: return !!(warehouse.warehouse_code && warehouse.warehouse_name && zones.length > 0);
      default: return true;
    }
  }, [warehouse, zones]);

  const handleFinalize = async () => {
    setCompleting(true);
    setStepError(null);
    setProgress(0);
    const result: WizardResult = {
      zones_created: 0,
      location_types_created: 0,
      rules_created: 0,
      locations_created: 0,
      errors: [],
    };

    try {
      // 1. Creeaza depozitul
      setProgress(5);
      const whPayload = {
        warehouse_code: warehouse.warehouse_code,
        warehouse_name: warehouse.warehouse_name,
        company_name: warehouse.company_name,
        city: warehouse.city || undefined,
        total_area_sqm: warehouse.total_area_sqm ? parseFloat(warehouse.total_area_sqm) : undefined,
        measurement_system: 'METRIC' as const,
      };
      const whResp = await warehouseConfigService.createWarehouse(whPayload);
      const warehouseId = whResp?.data?.id || whResp?.id;
      result.warehouse_id = warehouseId;
      setProgress(15);

      // 2. Creeaza zonele
      const zoneIdMap: Record<string, string> = {};
      let zonesDone = 0;
      for (const zone of zones) {
        try {
          const zResp = await warehouseConfigService.createZone({
            warehouse_id: warehouseId,
            zone_code: zone.zone_code,
            zone_name: zone.zone_name,
            zone_type: zone.zone_type,
          });
          const zoneId = zResp?.data?.id || zResp?.id;
          if (zoneId) {
            zoneIdMap[zone.zone_code] = zoneId;
            result.zones_created++;
          }
        } catch (e: unknown) {
          const err = e as { message?: string };
          result.errors.push(`Zona ${zone.zone_code}: ${err?.message || 'eroare'}`);
        }
        zonesDone++;
        setProgress(15 + Math.round((zonesDone / zones.length) * 20));
      }

      // 3. Creeaza tipuri locatii + genereaza locatii
      let typesDone = 0;
      for (const lt of locationTypes) {
        try {
          // Inregistreaza tipul
          const ltResp = await warehouseConfigService.createLocationType({
            code: lt.code,
            name: lt.name,
          });
          result.location_types_created++;

          // Genereaza locatii bulk daca avem zona
          const zoneId = zoneIdMap[lt.zone_code];
          if (zoneId) {
            const ltId = ltResp?.data?.id || ltResp?.id;
            const aisles = parseInt(lt.aisles) || 1;
            const levels = parseInt(lt.levels_per_rack) || 1;
            const bulkPayload = {
              warehouse_id: warehouseId,
              zone_id: zoneId,
              location_type_id: ltId as string,
              naming_pattern: {
                zone_prefix: lt.zone_code || lt.code.substring(0, 4),
                aisle_start: 'A',
                aisle_end: String.fromCharCode(64 + aisles),
                rack_start: 1,
                rack_end: parseInt(lt.racks_per_aisle) || 1,
                shelf_levels: Array.from({ length: levels }, (_, i) => String(i + 1)),
                bins_per_shelf: parseInt(lt.bins_per_level) || 1,
              },
            };
            const bulkResp = await warehouseConfigService.bulkCreateLocations(bulkPayload);
            const created = bulkResp?.data?.created || bulkResp?.created || 0;
            result.locations_created += Number(created);
          }
        } catch (e: unknown) {
          const err = e as { message?: string };
          result.errors.push(`Tip locatie ${lt.code}: ${err?.message || 'eroare'}`);
        }
        typesDone++;
        setProgress(35 + Math.round((typesDone / Math.max(locationTypes.length, 1)) * 35));
      }

      // 4. Creeaza regulile
      const allRules = [...putawayRules, ...pickingRules];
      let rulesDone = 0;
      for (const rule of allRules) {
        try {
          await warehouseConfigService.createRule({
            name: rule.name,
            rule_type: rule.rule_type,
            scope: rule.scope,
            is_active: true,
            conditions: [],
            actions: [],
          });
          result.rules_created++;
        } catch (e: unknown) {
          const err = e as { message?: string };
          result.errors.push(`Regula ${rule.name}: ${err?.message || 'eroare'}`);
        }
        rulesDone++;
        setProgress(70 + Math.round((rulesDone / Math.max(allRules.length, 1)) * 25));
      }

      setProgress(100);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setStepError(err?.response?.data?.message || err?.message || 'Eroare la creare depozit');
      setCompleting(false);
      return;
    }

    setCompleting(false);
    setFinishResult(result);
    setShowFinish(true);
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
      {/* Header */}
      <Box mb={3}>
        <Typography variant="h4" fontWeight={800} color="primary">
          Wizard Configurare Depozit
        </Typography>
        <Typography color="text.secondary" mt={0.5}>
          Configureaza un depozit nou in {STEPS.length} pasi simpli
        </Typography>
      </Box>

      {/* Stepper orizontal */}
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
        {STEPS.map((step, idx) => (
          <Step key={step.label} completed={activeStep > idx}>
            <StepLabel
              onClick={() => { if (activeStep > idx) setActiveStep(idx); }}
              sx={{ cursor: activeStep > idx ? 'pointer' : 'default' }}
            >
              <Typography variant="caption">{step.label}</Typography>
            </StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Continut pas curent */}
      <Paper sx={{ p: 3, borderRadius: 2, minHeight: 300, mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={2.5}>
          {STEPS[activeStep].icon}
          <Typography variant="h6" fontWeight={700}>
            Pasul {activeStep + 1}: {STEPS[activeStep].label}
          </Typography>
        </Stack>
        <Divider sx={{ mb: 2.5 }} />

        {activeStep === 0 && (
          <Step1General data={warehouse} onChange={setWarehouse} />
        )}
        {activeStep === 1 && (
          <Step2Zones zones={zones} onChange={setZones} />
        )}
        {activeStep === 2 && (
          <Step3LocationTypes types={locationTypes} zones={zones} onChange={setLocationTypes} />
        )}
        {activeStep === 3 && (
          <StepRules scope="PUTAWAY" rules={putawayRules} onChange={setPutawayRules} presets={PUTAWAY_RULE_PRESETS} />
        )}
        {activeStep === 4 && (
          <StepRules scope="PICKING" rules={pickingRules} onChange={setPickingRules} presets={PICKING_RULE_PRESETS} />
        )}
        {activeStep === 5 && (
          <Step6Preview types={locationTypes} />
        )}
        {activeStep === 6 && (
          <Step7Validation
            warehouse={warehouse}
            zones={zones}
            types={locationTypes}
            putawayRules={putawayRules}
            pickingRules={pickingRules}
          />
        )}
      </Paper>

      {/* Eroare pas */}
      {stepError && <Alert severity="error" sx={{ mb: 2 }}>{stepError}</Alert>}

      {/* Progress finalizare */}
      {completing && (
        <Box mb={2}>
          <Typography variant="caption" color="text.secondary" mb={0.5} display="block">
            Se configureaza depozitul... {progress}%
          </Typography>
          <LinearProgress variant="determinate" value={progress} sx={{ borderRadius: 1, height: 8 }} />
        </Box>
      )}

      {/* Navigare */}
      <Stack direction="row" justifyContent="space-between">
        <Button
          disabled={activeStep === 0 || completing}
          onClick={() => setActiveStep(s => s - 1)}
          variant="outlined"
        >
          Inapoi
        </Button>
        {activeStep < STEPS.length - 1 ? (
          <Button
            variant="contained"
            onClick={() => setActiveStep(s => s + 1)}
            disabled={!canProceed(activeStep)}
          >
            Pasul urmator
          </Button>
        ) : (
          <Button
            variant="contained"
            color="success"
            onClick={handleFinalize}
            disabled={completing || !canProceed(activeStep)}
            startIcon={completing ? <CircularProgress size={18} color="inherit" /> : <CheckIcon />}
            size="large"
          >
            {completing ? 'Se configureaza...' : 'Finalizeaza si creeaza depozitul'}
          </Button>
        )}
      </Stack>

      {/* Dialog rezultat final */}
      <FinishDialog open={showFinish} result={finishResult} onClose={() => setShowFinish(false)} />
    </Box>
  );
};

export default WarehouseSetupWizardPage;
