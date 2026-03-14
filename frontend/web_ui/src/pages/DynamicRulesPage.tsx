/**
 * DynamicRulesPage.tsx — Faza 4.1: Reguli Dinamice
 *
 * Dashboard de alerte automate generate de motorul de reguli dinamice WMS:
 *  - ZONE_FULL_FALLBACK   : Zona plina → sugereaza fallback
 *  - REEL_DEPLETES        : Rest mic → muta in zona resturi
 *  - HIGH_ROTATION_RELOCATE: Rotatie mare → reloca langa expediere
 *  - LOT_EXPIRED_QUARANTINE: Lot expirat → carantina automata
 */

import { useState, useEffect, useCallback } from 'react';
import Grid from '@mui/material/Grid';
import {
  Box, Typography, Paper, Button, Stack, CircularProgress, Alert,
  Chip, Card, CardContent, CardHeader, CardActions,
  Slider, Accordion, AccordionSummary, AccordionDetails,
  Divider, Badge, Tooltip, FormControl, InputLabel, Select, MenuItem,
  IconButton,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorIcon from '@mui/icons-material/Error';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import InventoryIcon from '@mui/icons-material/Inventory';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import MoveToInboxIcon from '@mui/icons-material/MoveToInbox';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import warehouseConfigService from '../services/warehouseConfig.service';

// ─── Tipuri ───────────────────────────────────────────────────────────────────

type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
type AlertType = 'ZONE_FULL_FALLBACK' | 'REEL_DEPLETES' | 'HIGH_ROTATION_RELOCATE' | 'LOT_EXPIRED_QUARANTINE';

interface DynamicAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  recommendation: string;
  action: string;
  data: Record<string, unknown>;
}

interface AlertsResponse {
  success: boolean;
  generated_at: string;
  stats: {
    total: number;
    critical: number;
    warning: number;
    info: number;
    by_type: Record<string, number>;
  };
  thresholds: Record<string, number>;
  alerts: DynamicAlert[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<AlertSeverity, 'error' | 'warning' | 'info'> = {
  CRITICAL: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

const SEVERITY_ICON: Record<AlertSeverity, React.ReactNode> = {
  CRITICAL: <ErrorIcon />,
  WARNING: <WarningAmberIcon />,
  INFO: <InfoOutlinedIcon />,
};

const TYPE_META: Record<AlertType, { label: string; icon: React.ReactNode; color: string }> = {
  ZONE_FULL_FALLBACK:      { label: 'Zonă Plină',      icon: <WarehouseIcon />,    color: '#e65100' },
  REEL_DEPLETES:           { label: 'Rest Mic',         icon: <InventoryIcon />,    color: '#1565c0' },
  HIGH_ROTATION_RELOCATE:  { label: 'Rotație Mare',     icon: <TrendingUpIcon />,   color: '#4a148c' },
  LOT_EXPIRED_QUARANTINE:  { label: 'Lot Expirare',     icon: <AccessTimeIcon />,   color: '#b71c1c' },
};

const ACTION_LABEL: Record<string, string> = {
  CONFIGURE_FALLBACK:  'Configurare Fallback',
  EXPAND_ZONE:         'Extinde Zona',
  MOVE_TO_REMNANTS:    'Muta în Resturi',
  SUGGEST_RELOCATION:  'Task Relocare',
  MOVE_TO_QUARANTINE:  'Pune în Carantină',
};

// ─── Card alerta ─────────────────────────────────────────────────────────────

function AlertCard({ alert, onDismiss }: { alert: DynamicAlert; onDismiss: (id: string) => void }) {
  const meta = TYPE_META[alert.type];
  const severityColor = SEVERITY_COLOR[alert.severity];
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <Card
      variant="outlined"
      sx={{
        borderLeft: '4px solid',
        borderLeftColor: `${severityColor}.main`,
        mb: 2,
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: 4 },
      }}
    >
      <CardHeader
        avatar={
          <Box sx={{ color: meta.color, display: 'flex', alignItems: 'center' }}>
            {meta.icon}
          </Box>
        }
        title={
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle2" fontWeight="bold">{alert.title}</Typography>
            <Chip
              icon={SEVERITY_ICON[alert.severity] as React.ReactElement}
              label={alert.severity}
              size="small"
              color={severityColor}
              variant="filled"
            />
            <Chip label={meta.label} size="small" variant="outlined" />
          </Stack>
        }
        action={
          <Tooltip title="Marchează ca rezolvat">
            <IconButton
              size="small"
              onClick={() => { setDismissed(true); onDismiss(alert.id); }}
              color="success"
            >
              <CheckCircleIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        }
      />
      <CardContent sx={{ pt: 0 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {alert.message}
        </Typography>
        <Paper variant="outlined" sx={{ p: 1.5, mt: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <MoveToInboxIcon fontSize="small" color="primary" sx={{ mt: 0.2, flexShrink: 0 }} />
            <Typography variant="body2" color="primary.main">
              <strong>Recomandare: </strong>{alert.recommendation}
            </Typography>
          </Stack>
        </Paper>

        {/* Date detaliu */}
        {Object.keys(alert.data).length > 0 && (
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
            {alert.type === 'ZONE_FULL_FALLBACK' && (
              <>
                <Chip label={`${alert.data.occupancy_pct}% ocupat`} size="small" color={severityColor} />
                <Chip label={`${alert.data.occupied_locations}/${alert.data.total_locations} locatii`} size="small" variant="outlined" />
                {alert.data.alternative_zone && <Chip label={`Alt: ${(alert.data.alternative_zone as { zone_code?: string }).zone_code}`} size="small" color="success" variant="outlined" />}
              </>
            )}
            {alert.type === 'REEL_DEPLETES' && (
              <>
                <Chip label={`${(alert.data.remaining_qty as number).toFixed(1)} ${alert.data.uom} ramas`} size="small" color={severityColor} />
                <Chip label={String(alert.data.location_code)} size="small" variant="outlined" />
              </>
            )}
            {alert.type === 'HIGH_ROTATION_RELOCATE' && (
              <>
                <Chip label={`${alert.data.pick_count} pick-uri / ${alert.data.days_analyzed} zile`} size="small" color="secondary" />
                <Chip label={`Zona actuala: ${alert.data.current_zone}`} size="small" variant="outlined" />
              </>
            )}
            {alert.type === 'LOT_EXPIRED_QUARANTINE' && (
              <>
                <Chip
                  label={
                    (alert.data.days_until_expiry as number) < 0
                      ? `Expirat acum ${Math.abs(alert.data.days_until_expiry as number)} zile`
                      : `Expira in ${alert.data.days_until_expiry} zile`
                  }
                  size="small"
                  color={severityColor}
                />
                <Chip label={`Lot: ${alert.data.batch_number}`} size="small" variant="outlined" />
                <Chip label={String(alert.data.location_code || 'locatie necunoscuta')} size="small" variant="outlined" />
              </>
            )}
          </Stack>
        )}
      </CardContent>
      <CardActions sx={{ pt: 0 }}>
        <Button size="small" variant="outlined" color={severityColor} startIcon={<MoveToInboxIcon />}>
          {ACTION_LABEL[alert.action] || alert.action}
        </Button>
      </CardActions>
    </Card>
  );
}

// ─── Pagina principala ────────────────────────────────────────────────────────

export default function DynamicRulesPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Parametri configurabili
  const [params, setParams] = useState({
    zone_full_threshold: 85,
    reel_low_threshold: 50,
    rotation_days: 7,
    high_rotation_picks: 5,
    expiry_warning_days: 30,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await warehouseConfigService.getDynamicAlerts(params);
      setData(result);
      setDismissed(new Set()); // Reset dismissed la fiecare refresh
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (e as Error)?.message || 'Eroare la incarcarea alertelor';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDismiss = (id: string) => {
    setDismissed(prev => new Set([...prev, id]));
  };

  const visibleAlerts = (data?.alerts || []).filter(a => {
    if (dismissed.has(a.id)) return false;
    if (filterType !== 'ALL' && a.type !== filterType) return false;
    if (filterSeverity !== 'ALL' && a.severity !== filterSeverity) return false;
    return true;
  });

  const activeCritical = visibleAlerts.filter(a => a.severity === 'CRITICAL').length;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ mb: 3 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Reguli Dinamice WMS
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Monitorizare automată a stării depozitului — alerte și recomandări în timp real
            bazate pe ocupare zone, resturi mici, rotație produse și expirare loturi.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => setSettingsOpen(!settingsOpen)}
            size="small"
          >
            Praguri
          </Button>
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
            onClick={load}
            disabled={loading}
          >
            Analizează
          </Button>
        </Stack>
      </Stack>

      {/* Setari praguri */}
      <Accordion expanded={settingsOpen} onChange={() => setSettingsOpen(!settingsOpen)} sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">⚙️ Configurare praguri de alertă</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={4}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="body2" gutterBottom>
                Zonă considerată plină: <strong>{params.zone_full_threshold}%</strong>
              </Typography>
              <Slider
                value={params.zone_full_threshold}
                onChange={(_, v) => setParams(p => ({ ...p, zone_full_threshold: v as number }))}
                min={50} max={100} step={5} marks
                valueLabelDisplay="auto"
                color="warning"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="body2" gutterBottom>
                Rest mic la: &lt; <strong>{params.reel_low_threshold} m</strong>
              </Typography>
              <Slider
                value={params.reel_low_threshold}
                onChange={(_, v) => setParams(p => ({ ...p, reel_low_threshold: v as number }))}
                min={5} max={200} step={5} marks={[{value:5},{value:50},{value:100},{value:200}].map(x => ({value: x.value, label: String(x.value)}))}
                valueLabelDisplay="auto"
                color="info"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="body2" gutterBottom>
                Interval analiză rotație: <strong>{params.rotation_days} zile</strong> cu min <strong>{params.high_rotation_picks} pick-uri</strong>
              </Typography>
              <Slider
                value={params.rotation_days}
                onChange={(_, v) => setParams(p => ({ ...p, rotation_days: v as number }))}
                min={1} max={30} step={1}
                valueLabelDisplay="auto"
                color="secondary"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="body2" gutterBottom>
                Avertisment expirare: cu <strong>{params.expiry_warning_days} zile</strong> înainte
              </Typography>
              <Slider
                value={params.expiry_warning_days}
                onChange={(_, v) => setParams(p => ({ ...p, expiry_warning_days: v as number }))}
                min={7} max={180} step={7}
                valueLabelDisplay="auto"
                color="error"
              />
            </Grid>
          </Grid>
          <Button variant="outlined" sx={{ mt: 2 }} onClick={load} disabled={loading}>
            Aplică și Reanalizeaza
          </Button>
        </AccordionDetails>
      </Accordion>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* KPI Cards */}
      {data && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {([
            { label: 'Total alerte', value: data.stats.total - dismissed.size, color: 'default' as const },
            { label: 'Critice', value: activeCritical, color: 'error' as const },
            { label: 'Avertismente', value: visibleAlerts.filter(a => a.severity === 'WARNING').length, color: 'warning' as const },
            { label: 'Informații', value: visibleAlerts.filter(a => a.severity === 'INFO').length, color: 'info' as const },
          ] as const).map(kpi => (
            <Grid size={{ xs: 6, md: 3 }} key={kpi.label}>
              <Card variant="outlined" sx={{ textAlign: 'center', py: 1.5 }}>
                <Typography variant="h3" fontWeight="bold" color={kpi.color === 'default' ? 'text.primary' : `${kpi.color}.main`}>
                  {kpi.value}
                </Typography>
                <Typography variant="caption" color="text.secondary">{kpi.label}</Typography>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Filtre */}
      {data && (
        <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Tip alertă</InputLabel>
            <Select value={filterType} label="Tip alertă" onChange={e => setFilterType(e.target.value)}>
              <MenuItem value="ALL">Toate tipurile</MenuItem>
              {Object.entries(TYPE_META).map(([k, v]) => (
                <MenuItem key={k} value={k}>{v.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Severitate</InputLabel>
            <Select value={filterSeverity} label="Severitate" onChange={e => setFilterSeverity(e.target.value)}>
              <MenuItem value="ALL">Toate</MenuItem>
              <MenuItem value="CRITICAL">Critice</MenuItem>
              <MenuItem value="WARNING">Avertismente</MenuItem>
              <MenuItem value="INFO">Informații</MenuItem>
            </Select>
          </FormControl>
          {data.generated_at && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AccessTimeIcon fontSize="small" />
              Ultima analiză: {new Date(data.generated_at).toLocaleTimeString('ro-RO')}
            </Typography>
          )}
        </Stack>
      )}

      {/* Rezumat per tip */}
      {data && Object.entries(data.stats.by_type).length > 0 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 3 }}>
          {Object.entries(TYPE_META).map(([type, meta]) => {
            const count = data.stats.by_type[type] || 0;
            if (!count) return null;
            return (
              <Badge key={type} badgeContent={count} color="error">
                <Chip
                  icon={meta.icon as React.ReactElement}
                  label={meta.label}
                  size="small"
                  onClick={() => setFilterType(filterType === type ? 'ALL' : type)}
                  variant={filterType === type ? 'filled' : 'outlined'}
                  sx={{ cursor: 'pointer' }}
                />
              </Badge>
            );
          })}
        </Stack>
      )}

      <Divider sx={{ mb: 3 }} />

      {/* Lista alerte */}
      {loading && !data && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {data && visibleAlerts.length === 0 && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
          <Typography variant="h6" gutterBottom>Niciun alert activ</Typography>
          <Typography variant="body2" color="text.secondary">
            {dismissed.size > 0
              ? `Ai marcat ${dismissed.size} alerte ca rezolvate. Depozitul funcționează normal.`
              : 'Depozitul funcționează în parametri normali conform pragurilor configurate.'}
          </Typography>
        </Paper>
      )}

      {visibleAlerts.map(alert => (
        <AlertCard key={alert.id} alert={alert} onDismiss={handleDismiss} />
      ))}
    </Box>
  );
}
