/**
 * StockAlertsPage.tsx — Faza 6.3: Alerte Live WebSocket
 *
 * Pagina dedicată pentru vizualizarea alertelor WMS în timp real.
 * Date primite prin WebSocket (fără polling HTTP).
 * Permite filtrare, acknowledge și navigare către detalii.
 */

import { useState, useMemo } from 'react';
import {
  Box, Typography, Paper, Stack, Chip, Card, CardContent, CardHeader,
  CardActions, Button, IconButton, Tooltip, Alert, AlertTitle,
  ToggleButton, ToggleButtonGroup, LinearProgress,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import ErrorIcon from '@mui/icons-material/Error';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import InventoryIcon from '@mui/icons-material/Inventory';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import TuneIcon from '@mui/icons-material/Tune';
import { useNavigate } from 'react-router-dom';
import { useWebSocket, type WsAlert } from '../hooks/useWebSocket';

// ─── Tipuri & constante ───────────────────────────────────────────────────────

type FilterSeverity = 'ALL' | 'CRITICAL' | 'WARNING' | 'INFO';
type FilterType = 'ALL' | string;

const SEV_COLOR = {
  CRITICAL: 'error' as const,
  WARNING: 'warning' as const,
  INFO: 'info' as const,
};

const SEV_ICON: Record<string, React.ReactNode> = {
  CRITICAL: <ErrorIcon />,
  WARNING: <WarningAmberIcon />,
  INFO: <InfoOutlinedIcon />,
};

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  ZONE_FULL_FALLBACK:     { label: 'Zonă Plină',    icon: <WarehouseIcon />,  color: '#e65100' },
  LOT_EXPIRED_QUARANTINE: { label: 'Lot Expirare',  icon: <AccessTimeIcon />, color: '#b71c1c' },
  REEL_DEPLETES:          { label: 'Rest Mic',       icon: <InventoryIcon />,  color: '#1565c0' },
};

// ─── Card alertă individuală ──────────────────────────────────────────────────

function AlertLiveCard({ alert, onAck }: { alert: WsAlert; onAck: (id: string) => void }) {
  const meta = TYPE_META[alert.type] ?? { label: alert.type, icon: <InfoOutlinedIcon />, color: '#555' };
  const sev = SEV_COLOR[alert.severity] ?? 'default';

  return (
    <Card
      variant="outlined"
      sx={{
        borderLeft: '4px solid',
        borderLeftColor: `${sev}.main`,
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: 4 },
      }}
    >
      <CardHeader
        sx={{ pb: 0.5 }}
        avatar={
          <Box sx={{ color: meta.color, display: 'flex', alignItems: 'center' }}>
            {meta.icon}
          </Box>
        }
        title={
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="subtitle2" fontWeight="bold">
              {alert.title}
            </Typography>
            <Chip
              icon={SEV_ICON[alert.severity] as React.ReactElement}
              label={alert.severity}
              size="small"
              color={sev}
              variant="filled"
            />
            <Chip label={meta.label} size="small" variant="outlined" />
          </Stack>
        }
        action={
          <Tooltip title="Marchează ca rezolvat (local)">
            <IconButton size="small" color="success" onClick={() => onAck(alert.id)}>
              <CheckCircleIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        }
      />
      <CardContent sx={{ pt: 0.5, pb: '8px !important' }}>
        <Typography variant="body2" color="text.secondary">
          {alert.message}
        </Typography>
        {alert.recommendation && (
          <Paper variant="outlined" sx={{ px: 1.5, py: 1, mt: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="caption" color="text.primary">
              💡 {alert.recommendation}
            </Typography>
          </Paper>
        )}
      </CardContent>
      {alert.data && Object.keys(alert.data).length > 0 && (
        <CardActions sx={{ pt: 0, flexWrap: 'wrap', gap: 0.5 }}>
          {Object.entries(alert.data)
            .filter(([k]) => !['zone_id', 'batch_id'].includes(k))
            .slice(0, 4)
            .map(([k, v]) => (
              <Chip
                key={k}
                label={`${k.replace(/_/g, ' ')}: ${String(v)}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.65rem', height: 20 }}
              />
            ))}
        </CardActions>
      )}
    </Card>
  );
}

// ─── Pagina principală ────────────────────────────────────────────────────────

export default function StockAlertsPage() {
  const { alerts, connected, lastUpdate, reconnectCount } = useWebSocket();
  const navigate = useNavigate();

  const [filterSev, setFilterSev] = useState<FilterSeverity>('ALL');
  const [filterType, setFilterType] = useState<FilterType>('ALL');
  const [acked, setAcked] = useState<Set<string>>(new Set());

  // Tipuri unice din alertele curente (pentru filtrul dropdown)
  const alertTypes = useMemo(() => {
    const types = new Set(alerts.map(a => a.type));
    return Array.from(types);
  }, [alerts]);

  const handleAck = (id: string) => {
    setAcked(prev => new Set([...prev, id]));
  };

  const displayed = useMemo(() => {
    return alerts
      .filter(a => !acked.has(a.id))
      .filter(a => filterSev === 'ALL' || a.severity === filterSev)
      .filter(a => filterType === 'ALL' || a.type === filterType);
  }, [alerts, acked, filterSev, filterType]);

  const criticalCount = alerts.filter(a => !acked.has(a.id) && a.severity === 'CRITICAL').length;
  const warningCount  = alerts.filter(a => !acked.has(a.id) && a.severity === 'WARNING').length;
  const infoCount     = alerts.filter(a => !acked.has(a.id) && a.severity === 'INFO').length;
  const ackedCount    = acked.size;

  return (
    <Box sx={{ p: 3 }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight="bold">Alerte Live WMS</Typography>
          <Typography variant="body2" color="text.secondary">
            Monitorizare în timp real prin WebSocket — date actualizate automat la 30 secunde
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {/* Status conexiune */}
          <Chip
            icon={connected ? <WifiIcon /> : <WifiOffIcon />}
            label={connected
              ? `Conectat${lastUpdate ? ` · ${lastUpdate.toLocaleTimeString('ro-RO')}` : ''}`
              : `Reconectare... (${reconnectCount})`}
            color={connected ? 'success' : 'default'}
            variant={connected ? 'filled' : 'outlined'}
            size="small"
          />
          <Tooltip title="Configurare praguri alerte">
            <Button
              variant="outlined"
              size="small"
              startIcon={<TuneIcon />}
              onClick={() => navigate('/reguli-dinamice')}
            >
              Praguri
            </Button>
          </Tooltip>
        </Stack>
      </Stack>

      {/* ── KPI carduri ─────────────────────────────────────────────────── */}
      <Grid container spacing={2} mb={3}>
        {[
          { label: 'CRITICAL', count: criticalCount, color: 'error.main', icon: <ErrorIcon /> },
          { label: 'WARNING',  count: warningCount,  color: 'warning.main', icon: <WarningAmberIcon /> },
          { label: 'INFO',     count: infoCount,     color: 'info.main',   icon: <InfoOutlinedIcon /> },
          { label: 'Rezolvate', count: ackedCount,   color: 'success.main', icon: <CheckCircleIcon /> },
        ].map(({ label, count, color, icon }) => (
          <Grid key={label} size={{ xs: 6, sm: 3 }}>
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderColor: color }}>
              <Box sx={{ color, display: 'flex', justifyContent: 'center', mb: 0.5 }}>{icon}</Box>
              <Typography variant="h4" fontWeight="bold" sx={{ color }}>{count}</Typography>
              <Typography variant="caption" color="text.secondary">{label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* ── Bare progres alertă live ─────────────────────────────────────── */}
      {!connected && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Conexiune WebSocket întreruptă</AlertTitle>
          Se încearcă reconectarea automată ({reconnectCount} încercări). Alertele afișate pot fi depășite.
        </Alert>
      )}

      {connected && alerts.length === 0 && (
        <Alert severity="success" sx={{ mb: 3 }}>
          <AlertTitle>Depozitul funcționează normal</AlertTitle>
          Nicio alertă activă detectată. Sistemul monitorizează continuu starea depozitului.
        </Alert>
      )}

      {/* ── Filtre ───────────────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <Stack direction="row" spacing={2} mb={3} flexWrap="wrap" alignItems="center">
          <ToggleButtonGroup
            size="small"
            value={filterSev}
            exclusive
            onChange={(_, v) => v && setFilterSev(v)}
          >
            <ToggleButton value="ALL">Toate</ToggleButton>
            <ToggleButton value="CRITICAL" sx={{ color: 'error.main' }}>Critical</ToggleButton>
            <ToggleButton value="WARNING" sx={{ color: 'warning.main' }}>Warning</ToggleButton>
            <ToggleButton value="INFO" sx={{ color: 'info.main' }}>Info</ToggleButton>
          </ToggleButtonGroup>

          {alertTypes.length > 1 && (
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Tip alertă</InputLabel>
              <Select
                label="Tip alertă"
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
              >
                <MenuItem value="ALL">Toate tipurile</MenuItem>
                {alertTypes.map(t => (
                  <MenuItem key={t} value={t}>
                    {TYPE_META[t]?.label ?? t}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {acked.size > 0 && (
            <Button size="small" color="inherit" onClick={() => setAcked(new Set())}>
              Resetează ({acked.size} rezolvate)
            </Button>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            {displayed.length} din {alerts.length - ackedCount} alerte afișate
          </Typography>
        </Stack>
      )}

      {/* ── Grid alerte ──────────────────────────────────────────────────── */}
      {displayed.length === 0 && alerts.length > 0 && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <NotificationsNoneIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">
            Nicio alertă cu filtrul selectat
          </Typography>
        </Paper>
      )}

      <Grid container spacing={2}>
        {/* CRITICAL primele */}
        {displayed
          .sort((a, b) => {
            const order = { CRITICAL: 0, WARNING: 1, INFO: 2 };
            return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
          })
          .map(alert => (
            <Grid key={alert.id} size={{ xs: 12, md: 6, xl: 4 }}>
              <AlertLiveCard alert={alert} onAck={handleAck} />
            </Grid>
          ))}
      </Grid>

      {/* ── Loader la prima conectare ─────────────────────────────────────── */}
      {!connected && alerts.length === 0 && (
        <Box sx={{ mt: 4 }}>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
            Conectare la serverul de notificări...
          </Typography>
        </Box>
      )}
    </Box>
  );
}
