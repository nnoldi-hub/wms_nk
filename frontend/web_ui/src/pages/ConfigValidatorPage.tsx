/**
 * ConfigValidatorPage.tsx — Faza 3.2: Validator Configurare Wizard
 *
 * Verifică completitudinea și corectitudinea configurației depozitului:
 *  - Cel puțin 1 zonă din fiecare tip esențial (RECEIVING, STORAGE, SHIPPING)
 *  - Tipuri locații asociate zonelor
 *  - Cel puțin 1 regulă PUTAWAY + 1 PICKING activă
 *  - Coduri duplicate (zone, tipuri locații)
 *  - Compatibilitate reguli ↔ tipuri locații
 *
 * Route: /validator-configurare
 */

import { useState, useEffect, useCallback } from 'react';
import Grid from '@mui/material/Grid';
import {
  Box, Typography, Paper, Button, Stack, CircularProgress, Chip,
  LinearProgress, Alert, List, ListItem, ListItemIcon, ListItemText,
  Divider, FormControl, InputLabel, Select, MenuItem, Tooltip, Card, CardContent,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import VerifiedIcon from '@mui/icons-material/Verified';
import warehouseConfigService from '../services/warehouseConfig.service';

// ─── Tipuri ───────────────────────────────────────────────────────────────────

interface ValidationItem {
  code: string;
  message: string;
  warehouse_id?: string;
}

interface CheckResult {
  valid: boolean;
  score: number;
  errors: ValidationItem[];
  warnings: ValidationItem[];
  info: ValidationItem[];
  stats: {
    total_rules: number;
    putaway_rules: number;
    picking_rules: number;
    total_zones: number;
    warehouses_count: number;
  };
  checked_at: string;
}

interface Warehouse {
  id: string;
  warehouse_name: string;
  warehouse_code: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 80) return '#2e7d32'; // green
  if (score >= 50) return '#f57c00'; // orange
  return '#c62828';                  // red
}

function ItemRow({ item, severity }: { item: ValidationItem; severity: 'error' | 'warning' | 'info' }) {
  const Icon = severity === 'error' ? ErrorIcon : severity === 'warning' ? WarningAmberIcon : InfoOutlinedIcon;
  const color = severity === 'error' ? 'error.main' : severity === 'warning' ? 'warning.main' : 'info.main';
  return (
    <ListItem disableGutters sx={{ alignItems: 'flex-start', py: 0.5 }}>
      <ListItemIcon sx={{ minWidth: 32, mt: 0.4 }}>
        <Icon sx={{ color, fontSize: 18 }} />
      </ListItemIcon>
      <ListItemText
        primary={<Typography variant="body2">{item.message}</Typography>}
        secondary={<Typography variant="caption" fontFamily="monospace" color="text.disabled">{item.code}</Typography>}
      />
    </ListItem>
  );
}

// ─── Pagina ───────────────────────────────────────────────────────────────────

export default function ConfigValidatorPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Încarcare depozite disponibile
  useEffect(() => {
    warehouseConfigService.listWarehouses({ limit: 100 })
      .then(res => {
        const rows: Warehouse[] = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
        setWarehouses(rows);
      })
      .catch(() => {});
  }, []);

  const runCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: { warehouse_id?: string } = {};
      if (selectedWarehouse) params.warehouse_id = selectedWarehouse;
      const res = await warehouseConfigService.validateSetupCheck(params);
      if (res.success) setResult(res.data);
      else setError('Eroare la validare.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Eroare necunoscută.');
    } finally {
      setLoading(false);
    }
  }, [selectedWarehouse]);

  // Rulăm check-ul automat la inițializare
  useEffect(() => {
    runCheck();
  }, [runCheck]);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <VerifiedIcon color="primary" />
            <Typography variant="h4" fontWeight="bold">Validator Configurare</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Verifică dacă configurația depozitului este completă și compatibilă cu regulile WMS.
            Faza 3.2 — Wizard Setup Check.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="flex-end">
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Depozit</InputLabel>
            <Select
              value={selectedWarehouse}
              label="Depozit"
              onChange={e => setSelectedWarehouse(e.target.value)}
            >
              <MenuItem value="">— Toate depozitele —</MenuItem>
              {warehouses.map(w => (
                <MenuItem key={w.id} value={w.id}>{w.warehouse_name} ({w.warehouse_code})</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
            onClick={runCheck}
            disabled={loading}
          >
            Verifică
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {result && (
        <>
          {/* Score + Status */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 3 }}>
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">Scor configurare</Typography>
                  <Typography variant="h2" fontWeight="bold" sx={{ color: scoreColor(result.score) }}>
                    {result.score}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">din 100</Typography>
                  <LinearProgress
                    variant="determinate"
                    value={result.score}
                    sx={{ mt: 1, '& .MuiLinearProgress-bar': { bgcolor: scoreColor(result.score) } }}
                  />
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Box sx={{ mt: 0.5 }}>
                    {result.valid
                      ? <Chip icon={<CheckCircleIcon />} label="VALID" color="success" />
                      : <Chip icon={<ErrorIcon />} label="ERORI" color="error" />
                    }
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    {new Date(result.checked_at).toLocaleTimeString('ro-RO')}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">Erori</Typography>
                  <Typography variant="h4" fontWeight="bold" color="error.main">{result.errors.length}</Typography>
                  <Typography variant="caption" color="text.secondary">blocante</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">Avertismente</Typography>
                  <Typography variant="h4" fontWeight="bold" color="warning.main">{result.warnings.length}</Typography>
                  <Typography variant="caption" color="text.secondary">de atenționat</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">Statistici</Typography>
                  <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                    <Typography variant="body2">
                      Reguli active: <strong>{result.stats.total_rules}</strong>
                      &nbsp;({result.stats.putaway_rules} PUTAWAY / {result.stats.picking_rules} PICKING)
                    </Typography>
                    <Typography variant="body2">
                      Zone: <strong>{result.stats.total_zones}</strong>
                      &nbsp;în <strong>{result.stats.warehouses_count}</strong> depozit(e)
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            {/* Erori */}
            <Grid size={{ xs: 12, md: result.errors.length > 0 ? 6 : 12 }}>
              {result.errors.length > 0 && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <ErrorIcon color="error" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight="bold" color="error.main">
                      Erori blocante ({result.errors.length})
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Trebuie rezolvate înainte de a opera depozitul.
                  </Typography>
                  <Divider sx={{ mb: 1 }} />
                  <List dense disablePadding>
                    {result.errors.map((e, i) => <ItemRow key={i} item={e} severity="error" />)}
                  </List>
                </Paper>
              )}
              {result.errors.length === 0 && (
                <Alert severity="success" icon={<CheckCircleIcon />}>
                  <Typography fontWeight="bold">Nicio eroare blocantă detectată!</Typography>
                  <Typography variant="body2">Configurația de bază este completă și corectă.</Typography>
                </Alert>
              )}
            </Grid>

            {/* Avertismente */}
            {result.warnings.length > 0 && (
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <WarningAmberIcon color="warning" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight="bold" color="warning.main">
                      Avertismente ({result.warnings.length})
                    </Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Nu blochează operarea, dar pot cauza probleme.
                  </Typography>
                  <Divider sx={{ mb: 1 }} />
                  <List dense disablePadding>
                    {result.warnings.map((w, i) => <ItemRow key={i} item={w} severity="warning" />)}
                  </List>
                </Paper>
              </Grid>
            )}

            {/* Info */}
            {result.info.length > 0 && (
              <Grid size={{ xs: 12 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <InfoOutlinedIcon color="info" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight="bold" color="info.main">
                      Informații
                    </Typography>
                  </Stack>
                  <List dense disablePadding>
                    {result.info.map((item, i) => <ItemRow key={i} item={item} severity="info" />)}
                  </List>
                </Paper>
              </Grid>
            )}

            {/* Legenda check-uri */}
            <Grid size={{ xs: 12 }}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Ce verifică acest validator (Faza 3.2)?</Typography>
                <Grid container spacing={1}>
                  {[
                    ['✅ Zone esențiale', 'RECEIVING, STORAGE, SHIPPING există în fiecare depozit'],
                    ['✅ Reguli minime', 'Cel puțin 1 regulă PUTAWAY activă + 1 PICKING activă'],
                    ['✅ Coduri duplicate', 'Zone și tipuri de locații fără coduri duplicate'],
                    ['✅ Locații cu tip', 'Zonele operaționale au locații cu tipuri asociate'],
                    ['✅ Compatibilitate reguli', 'Regulile nu referențiază tipuri de locații inexistente'],
                  ].map(([title, desc]) => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={title}>
                      <Tooltip title={desc}>
                        <Chip label={title} size="small" variant="outlined" color="primary" sx={{ cursor: 'default' }} />
                      </Tooltip>
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
}
