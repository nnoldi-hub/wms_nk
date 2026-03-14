import { useState } from 'react';
import Grid from '@mui/material/Grid';
import {
  Box, Typography, Card, CardContent, CardActions, Button, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, LinearProgress,
  Alert, Stepper, Step, StepLabel, List, ListItem, ListItemText,
  ListItemIcon,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CableIcon from '@mui/icons-material/Cable';
import BuildIcon from '@mui/icons-material/Build';
import CategoryIcon from '@mui/icons-material/Category';
import LandscapeIcon from '@mui/icons-material/Landscape';
import { warehouseConfigService } from '../services/warehouseConfig.service';

/* ─────────────────── Tipuri ─────────────────── */
interface ZoneDef { zone_code: string; zone_name: string; zone_type: string }
interface LocTypeDef { code: string; name: string }
interface BulkDef {
  naming_pattern: {
    zone_prefix: string; aisle_start: string; aisle_end: string;
    rack_start: number; rack_end: number; shelf_levels: string[]; bins_per_shelf: number;
  };
  properties?: { max_weight_kg?: number; accessibility?: 'GROUND' | 'LOW' | 'MEDIUM' | 'HIGH' };
}
interface RuleDef { name: string; rule_type: string; scope: 'PUTAWAY' | 'PICKING' }

interface Template {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  tags: string[];
  zones: ZoneDef[];
  locationTypes: Array<{ locType: LocTypeDef; bulk: BulkDef }>;
  rules: RuleDef[];
}

/* ─────────────────── Template-uri predefinite ─────────────────── */
const TEMPLATES: Template[] = [
  {
    id: 'cabluri',
    name: 'Depozit Cabluri & Tamburi',
    description: 'Optimizat pentru stocarea cablurilor pe tamburi mari, resturi de tambur și role. Include reguli MIN_WASTE pentru minimizarea resturilor.',
    icon: <CableIcon sx={{ fontSize: 48 }} />,
    color: '#1976d2',
    tags: ['cabluri', 'tamburi', 'MIN_WASTE', 'resturi'],
    zones: [
      { zone_code: 'RECV', zone_name: 'Receptie Cabluri', zone_type: 'RECEIVING' },
      { zone_code: 'QC01', zone_name: 'Control Calitate', zone_type: 'QC' },
      { zone_code: 'TAMB', zone_name: 'Zona Tamburi', zone_type: 'STORAGE' },
      { zone_code: 'REST', zone_name: 'Zona Resturi Tambur', zone_type: 'STORAGE' },
      { zone_code: 'ROLE', zone_name: 'Zona Role Mici', zone_type: 'STORAGE' },
      { zone_code: 'SHIP', zone_name: 'Expediere', zone_type: 'SHIPPING' },
    ],
    locationTypes: [
      {
        locType: { code: 'DRUM_STAND', name: 'Suport Tambur Mare' },
        bulk: {
          naming_pattern: { zone_prefix: 'TAMB', aisle_start: 'A', aisle_end: 'C', rack_start: 1, rack_end: 5, shelf_levels: ['1'], bins_per_shelf: 4 },
          properties: { max_weight_kg: 2000, accessibility: 'GROUND' },
        },
      },
      {
        locType: { code: 'REST_RACK', name: 'Raft Resturi Tambur' },
        bulk: {
          naming_pattern: { zone_prefix: 'REST', aisle_start: 'A', aisle_end: 'B', rack_start: 1, rack_end: 3, shelf_levels: ['1', '2', '3'], bins_per_shelf: 6 },
          properties: { max_weight_kg: 500, accessibility: 'LOW' },
        },
      },
      {
        locType: { code: 'REEL_RACK', name: 'Raft Role' },
        bulk: {
          naming_pattern: { zone_prefix: 'ROLE', aisle_start: 'A', aisle_end: 'A', rack_start: 1, rack_end: 4, shelf_levels: ['1', '2', '3', '4'], bins_per_shelf: 8 },
          properties: { max_weight_kg: 200, accessibility: 'MEDIUM' },
        },
      },
    ],
    rules: [
      { name: 'Putaway MIN_WASTE cabluri', rule_type: 'MIN_WASTE', scope: 'PUTAWAY' as const },
      { name: 'Picking USE_REMAINS_FIRST cabluri', rule_type: 'USE_REMAINS_FIRST', scope: 'PICKING' as const },
    ],
  },
  {
    id: 'echipamente',
    name: 'Depozit Echipamente Electrice',
    description: 'Configurat pentru echipamente grele și voluminoase. Raft înalt cu forklift, cu reguli FIFO standard și zonă de staging pentru pregătire livrări.',
    icon: <BuildIcon sx={{ fontSize: 48 }} />,
    color: '#388e3c',
    tags: ['echipamente', 'FIFO', 'forklift', 'staging'],
    zones: [
      { zone_code: 'RECV', zone_name: 'Receptie Echipamente', zone_type: 'RECEIVING' },
      { zone_code: 'QC01', zone_name: 'Control Calitate', zone_type: 'QC' },
      { zone_code: 'STOR', zone_name: 'Depozitare Principale', zone_type: 'STORAGE' },
      { zone_code: 'STAG', zone_name: 'Staging Livrari', zone_type: 'STAGING' },
      { zone_code: 'SHIP', zone_name: 'Expediere', zone_type: 'SHIPPING' },
    ],
    locationTypes: [
      {
        locType: { code: 'HEAVY_RACK', name: 'Raft Cantilever Greu' },
        bulk: {
          naming_pattern: { zone_prefix: 'STOR', aisle_start: 'A', aisle_end: 'D', rack_start: 1, rack_end: 8, shelf_levels: ['1', '2', '3'], bins_per_shelf: 2 },
          properties: { max_weight_kg: 5000, accessibility: 'GROUND' },
        },
      },
      {
        locType: { code: 'FLOOR_SPOT', name: 'Loc Podea Marcat' },
        bulk: {
          naming_pattern: { zone_prefix: 'STAG', aisle_start: 'A', aisle_end: 'B', rack_start: 1, rack_end: 6, shelf_levels: ['1'], bins_per_shelf: 1 },
          properties: { max_weight_kg: 10000, accessibility: 'GROUND' },
        },
      },
    ],
    rules: [
      { name: 'Putaway FIFO echipamente', rule_type: 'FIFO', scope: 'PUTAWAY' as const },
      { name: 'Picking FIFO echipamente', rule_type: 'FIFO', scope: 'PICKING' as const },
    ],
  },
  {
    id: 'mixt',
    name: 'Depozit Mixt General',
    description: 'Configurat pentru produse mixte: cabluri, accesorii, ambalaje. Include zone complete RECV → QC → STORAGE → PICKING → PACKING → SHIPPING.',
    icon: <CategoryIcon sx={{ fontSize: 48 }} />,
    color: '#f57c00',
    tags: ['mixt', 'general', 'picking', 'packing'],
    zones: [
      { zone_code: 'RECV', zone_name: 'Receptie', zone_type: 'RECEIVING' },
      { zone_code: 'QC01', zone_name: 'Calitate', zone_type: 'QC' },
      { zone_code: 'STOR', zone_name: 'Depozitare', zone_type: 'STORAGE' },
      { zone_code: 'PICK', zone_name: 'Picking', zone_type: 'PICKING' },
      { zone_code: 'PACK', zone_name: 'Ambalare', zone_type: 'PACKING' },
      { zone_code: 'SHIP', zone_name: 'Expediere', zone_type: 'SHIPPING' },
    ],
    locationTypes: [
      {
        locType: { code: 'STANDARD_RACK', name: 'Raft Standard' },
        bulk: {
          naming_pattern: { zone_prefix: 'STOR', aisle_start: 'A', aisle_end: 'E', rack_start: 1, rack_end: 10, shelf_levels: ['A', 'B', 'C', 'D'], bins_per_shelf: 4 },
          properties: { max_weight_kg: 800, accessibility: 'MEDIUM' },
        },
      },
      {
        locType: { code: 'PICK_BIN', name: 'Bin Picking Frontal' },
        bulk: {
          naming_pattern: { zone_prefix: 'PICK', aisle_start: 'A', aisle_end: 'C', rack_start: 1, rack_end: 5, shelf_levels: ['1', '2', '3'], bins_per_shelf: 8 },
          properties: { max_weight_kg: 50, accessibility: 'LOW' },
        },
      },
    ],
    rules: [
      { name: 'Putaway MIN_WASTE general', rule_type: 'MIN_WASTE', scope: 'PUTAWAY' as const },
      { name: 'Picking FIFO general', rule_type: 'FIFO', scope: 'PICKING' as const },
    ],
  },
  {
    id: 'exterior',
    name: 'Depozit Exterior / Semi-Acoperit',
    description: 'Pentru produse rezistente la exterior (tamburi, paleti, colaci). Zone rezistente la umiditate, fără QC intern. Acces direct cu forklift.',
    icon: <LandscapeIcon sx={{ fontSize: 48 }} />,
    color: '#6d4c41',
    tags: ['exterior', 'outdoor', 'forklift', 'paleti'],
    zones: [
      { zone_code: 'RECV', zone_name: 'Receptie Exterior', zone_type: 'RECEIVING' },
      { zone_code: 'OUT1', zone_name: 'Depozit Exterior A', zone_type: 'STORAGE' },
      { zone_code: 'OUT2', zone_name: 'Depozit Exterior B', zone_type: 'STORAGE' },
      { zone_code: 'STAG', zone_name: 'Staging Camioane', zone_type: 'STAGING' },
      { zone_code: 'SHIP', zone_name: 'Doc Expediere', zone_type: 'SHIPPING' },
    ],
    locationTypes: [
      {
        locType: { code: 'OUTDOOR_GROUND', name: 'Loc Podea Exterior' },
        bulk: {
          naming_pattern: { zone_prefix: 'OUT', aisle_start: 'A', aisle_end: 'F', rack_start: 1, rack_end: 10, shelf_levels: ['1'], bins_per_shelf: 2 },
          properties: { max_weight_kg: 8000, accessibility: 'GROUND' },
        },
      },
    ],
    rules: [
      { name: 'Putaway FIFO exterior', rule_type: 'FIFO', scope: 'PUTAWAY' as const },
      { name: 'Picking FIFO exterior', rule_type: 'FIFO', scope: 'PICKING' as const },
    ],
  },
];

/* ─────────────────── Util ─────────────────── */
interface StepResult { label: string; ok: boolean; detail?: string }

/* ─────────────────── Pagina principala ─────────────────── */
export default function WarehouseTemplatesPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [warehouseCode, setWarehouseCode] = useState('');
  const [warehouseName, setWarehouseName] = useState('');
  const [city, setCity] = useState('');

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<StepResult[]>([]);
  const [doneOpen, setDoneOpen] = useState(false);

  const addStep = (label: string, ok: boolean, detail?: string) =>
    setSteps(prev => [...prev, { label, ok, detail }]);

  const openDialog = (t: Template) => {
    setSelectedTemplate(t);
    setWarehouseCode('');
    setWarehouseName(t.name);
    setCity('');
    setSteps([]);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (!running) setDialogOpen(false);
  };

  const handleApply = async () => {
    if (!selectedTemplate || !warehouseCode.trim() || !warehouseName.trim()) return;
    const t = selectedTemplate;
    setRunning(true);
    setSteps([]);

    const totalSteps = 1 + t.zones.length + t.locationTypes.length + t.rules.length;
    let done = 0;
    const tick = () => { done++; setProgress(Math.round((done / totalSteps) * 100)); };

    try {
      // 1. Creare depozit
      let warehouseId: string;
      try {
        const whRes = await warehouseConfigService.createWarehouse({
          warehouse_code: warehouseCode.toUpperCase(),
          warehouse_name: warehouseName,
          company_name: 'NK',
          city: city || undefined,
          country: 'Romania',
          timezone: 'Europe/Bucharest',
          currency: 'RON',
          measurement_system: 'METRIC',
          layout_type: 'SINGLE_FLOOR',
        } as Parameters<typeof warehouseConfigService.createWarehouse>[0]);
        warehouseId = whRes.data?.id ?? whRes.id;
        tick();
        addStep(`Depozit creat: ${warehouseCode.toUpperCase()}`, true);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        addStep('Creare depozit', false, msg);
        setRunning(false);
        return;
      }

      // 2. Zone
      const zoneIds: Record<string, string> = {};
      for (const z of t.zones) {
        try {
          const zRes = await warehouseConfigService.createZone({
            warehouse_id: warehouseId,
            zone_code: z.zone_code,
            zone_name: z.zone_name,
            zone_type: z.zone_type as Parameters<typeof warehouseConfigService.createZone>[0]['zone_type'],
          });
          const zId = zRes.data?.id ?? zRes.id;
          zoneIds[z.zone_code] = zId;
          tick();
          addStep(`Zona creata: ${z.zone_code} (${z.zone_type})`, true);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          tick();
          addStep(`Zona ${z.zone_code}`, false, msg);
        }
      }

      // 3. Tipuri locatii + generare bulk locatii
      // Gaseste zona STORAGE principala (prima zona de tip STORAGE)
      const primaryStorageZoneCode = t.zones.find(z => z.zone_type === 'STORAGE')?.zone_code;
      const primaryZoneId = primaryStorageZoneCode ? zoneIds[primaryStorageZoneCode] : undefined;

      for (const lt of t.locationTypes) {
        try {
          // Creare tip locatie
          const ltRes = await warehouseConfigService.createLocationType({
            code: lt.locType.code,
            name: lt.locType.name,
          });
          const ltId = ltRes.data?.id ?? ltRes.id;

          // Determina zona potrivita pentru bulk
          const prefix = lt.bulk.naming_pattern.zone_prefix;
          const zoneForBulk = Object.entries(zoneIds).find(([code]) =>
            prefix.startsWith(code.substring(0, 3)) || code.startsWith(prefix.substring(0, 3))
          );
          const targetZoneId = zoneForBulk?.[1] ?? primaryZoneId;

          if (targetZoneId) {
            await warehouseConfigService.bulkCreateLocations({
              warehouse_id: warehouseId,
              zone_id: targetZoneId,
              location_type_id: ltId,
              naming_pattern: lt.bulk.naming_pattern,
              properties: lt.bulk.properties,
            });
          }
          tick();
          addStep(`Tip locatie + locatii generate: ${lt.locType.name}`, true);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          tick();
          addStep(`Tip locatie ${lt.locType.name}`, false, msg);
        }
      }

      // 4. Reguli
      for (const r of t.rules) {
        try {
          await warehouseConfigService.createRule({
            name: r.name,
            rule_type: r.rule_type,
            scope: r.scope,
            priority: 10,
            is_active: true,
          });
          tick();
          addStep(`Regula: ${r.rule_type} / ${r.name}`, true);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          tick();
          addStep(`Regula ${r.rule_type} ${r.name}`, false, msg);
        }
      }

      setDoneOpen(true);
    } finally {
      setRunning(false);
    }
  };

  const errCount = steps.filter(s => !s.ok).length;
  const okCount = steps.filter(s => s.ok).length;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Template-uri Depozit
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Alege un template predefinit pentru a configura rapid un depozit complet cu zone, locatii si reguli.
      </Typography>

      <Grid container spacing={3}>
        {TEMPLATES.map(t => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={t.id}>
            <Card
              elevation={3}
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderTop: `4px solid ${t.color}`,
                transition: 'transform 0.15s',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
              }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ color: t.color, mb: 1 }}>{t.icon}</Box>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  {t.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t.description}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                  {t.tags.map(tag => (
                    <Chip key={tag} label={tag} size="small" sx={{ bgcolor: t.color + '22', color: t.color, fontWeight: 600 }} />
                  ))}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {t.zones.length} zone · {t.locationTypes.length} tipuri locatii · {t.rules.length} reguli
                </Typography>
              </CardContent>
              <CardActions sx={{ p: 2, pt: 0 }}>
                <Button
                  variant="contained"
                  fullWidth
                  sx={{ bgcolor: t.color, '&:hover': { bgcolor: t.color + 'cc' } }}
                  onClick={() => openDialog(t)}
                >
                  Aplică Template
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Dialog configurare + rulare */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Aplică Template: {selectedTemplate?.name}
        </DialogTitle>
        <DialogContent dividers>
          {!running && steps.length === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Alert severity="info">
                Completează datele depozitului. Restul configuratiei va fi generat automat după template.
              </Alert>
              <TextField
                label="Cod Depozit *"
                value={warehouseCode}
                onChange={e => setWarehouseCode(e.target.value.toUpperCase())}
                inputProps={{ maxLength: 10 }}
                helperText="Cod unic, ex: DEP01"
                fullWidth
              />
              <TextField
                label="Nume Depozit *"
                value={warehouseName}
                onChange={e => setWarehouseName(e.target.value)}
                fullWidth
              />
              <TextField
                label="Oras (optional)"
                value={city}
                onChange={e => setCity(e.target.value)}
                fullWidth
              />

              {/* Preview template */}
              <Typography variant="subtitle2" sx={{ mt: 1 }}>Ce va fi creat:</Typography>
              <Stepper activeStep={-1} orientation="vertical" sx={{ '& .MuiStepLabel-label': { fontSize: '0.8rem' } }}>
                <Step expanded>
                  <StepLabel>
                    Depozit: <strong>{warehouseCode || '(cod)'}</strong> — {warehouseName}
                  </StepLabel>
                </Step>
                <Step expanded>
                  <StepLabel>
                    Zone ({selectedTemplate?.zones.length}): {selectedTemplate?.zones.map(z => z.zone_code).join(', ')}
                  </StepLabel>
                </Step>
                <Step expanded>
                  <StepLabel>
                    Tipuri locatii ({selectedTemplate?.locationTypes.length}): {selectedTemplate?.locationTypes.map(lt => lt.locType.code).join(', ')}
                  </StepLabel>
                </Step>
                <Step expanded>
                  <StepLabel>
                    Reguli ({selectedTemplate?.rules.length}): {selectedTemplate?.rules.map(r => `${r.rule_type}/${r.name}`).join(', ')}
                  </StepLabel>
                </Step>
              </Stepper>
            </Box>
          )}

          {(running || steps.length > 0) && (
            <Box sx={{ mt: 1 }}>
              {running && (
                <>
                  <Typography variant="body2" sx={{ mb: 1 }}>Se configurează depozitul...</Typography>
                  <LinearProgress variant="determinate" value={progress} sx={{ mb: 2, height: 8, borderRadius: 4 }} />
                </>
              )}
              <List dense>
                {steps.map((s, i) => (
                  <ListItem key={i} disableGutters>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      {s.ok
                        ? <CheckCircleIcon color="success" fontSize="small" />
                        : <ErrorIcon color="error" fontSize="small" />}
                    </ListItemIcon>
                    <ListItemText
                      primary={s.label}
                      secondary={s.detail}
                      primaryTypographyProps={{ variant: 'body2', fontWeight: s.ok ? 400 : 600 }}
                      secondaryTypographyProps={{ variant: 'caption', color: 'error' }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={running}>Anulare</Button>
          {steps.length === 0 && (
            <Button
              variant="contained"
              onClick={handleApply}
              disabled={running || !warehouseCode.trim() || !warehouseName.trim()}
            >
              Creare Depozit
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Dialog succes final */}
      <Dialog open={doneOpen} onClose={() => { setDoneOpen(false); setDialogOpen(false); }} maxWidth="xs" fullWidth>
        <DialogTitle>
          {errCount === 0 ? '✅ Depozit configurat complet!' : '⚠️ Configurare partiala'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 1 }}>
            <strong>{okCount}</strong> pasi finalizati cu succes
            {errCount > 0 && <>, <strong style={{ color: 'red' }}>{errCount}</strong> erori</>}.
          </Typography>
          {errCount === 0
            ? <Alert severity="success">Depozitul <strong>{warehouseCode.toUpperCase()}</strong> a fost creat. Acum il poti gestiona din Configurare Depozit.</Alert>
            : <Alert severity="warning">Unele elemente nu au putut fi create. Verifica mesajele de eroare si completeaza manual.</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDoneOpen(false); setDialogOpen(false); }} variant="contained">
            Inchide
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
