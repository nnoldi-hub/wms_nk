/**
 * SimulatorPage.tsx — Faza 4.2: Simulator Putaway / Picking / Comparatie strategii
 *
 * Tab 1: Simulator Putaway  — alegi produs + cantitate → sistemul arata unde il pune, ce reguli s-au aplicat
 * Tab 2: Simulator Picking  — alegi produs + cantitate → sistemul arata de unde culege, ce loturi, traseu
 * Tab 3: Comparatie         — compara FIFO vs MIN_WASTE side-by-side pentru acelasi produs
 */

import { useState } from 'react';
import Grid from '@mui/material/Grid';
import {
  Box, Typography, Tabs, Tab, Paper, TextField, Button, Stack,
  CircularProgress, Alert, Chip, Divider, Card, CardContent, CardHeader,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  FormControl, InputLabel, Select, MenuItem, LinearProgress, Tooltip,
  List, ListItem, ListItemIcon, ListItemText,
  Badge, Stepper, Step, StepLabel, StepContent,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import InventoryIcon from '@mui/icons-material/Inventory';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StarIcon from '@mui/icons-material/Star';
import RuleIcon from '@mui/icons-material/Rule';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import warehouseConfigService from '../services/warehouseConfig.service';

// ─── Tipuri ───────────────────────────────────────────────────────────────────

interface PutawaySuggestion {
  rank: number;
  location_id: string;
  location_code: string;
  zone_name: string;
  zone_code: string;
  type_name: string;
  current_occupancy_percent: number;
  suggestion_label?: string;
  score: number;
  is_recommended: boolean;
}

interface PutawayResult {
  suggestions: PutawaySuggestion[];
  matchedRules: { id: string; name: string; scope: string; priority: number }[];
  actions: { type: string; value: string }[];
  strategy_source: string;
  context: {
    product_category?: string;
    packaging_type?: string;
    suggested_zone?: string;
    suggested_location_type?: string;
  };
}

interface AllocationItem {
  inventory_item_id: string;
  lot_number: string;
  location_code: string;
  zone_name?: string;
  zone_code?: string;
  allocated_qty: number;
  uom: string;
}

interface PickingResult {
  product_sku: string;
  requested_qty: number;
  uom: string;
  strategy: string;
  strategy_source: string;
  allow_multi_lot: boolean;
  matchedRules: { id: string; name: string; scope: string; priority: number }[];
  actions: { type: string; value: string }[];
  allocation: AllocationItem[];
  available_stock: {
    inventory_item_id: string;
    lot_number: string;
    location_code: string;
    zone_name?: string;
    zone_code?: string;
    available_qty: number;
    lot_status?: string;
    received_at?: string;
  }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function OccupancyBar({ value }: { value: number }) {
  const color = value >= 75 ? 'error' : value >= 40 ? 'warning' : 'success';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 120 }}>
      <LinearProgress
        variant="determinate"
        value={Math.min(value, 100)}
        color={color}
        sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 35 }}>
        {value.toFixed(0)}%
      </Typography>
    </Box>
  );
}

function RuleChip({ rule }: { rule: { name: string; scope: string; priority: number } }) {
  return (
    <Chip
      icon={<RuleIcon fontSize="small" />}
      label={`${rule.name} (P${rule.priority})`}
      size="small"
      color={rule.scope === 'PUTAWAY' ? 'primary' : 'secondary'}
      variant="outlined"
    />
  );
}

function StrategyBadge({ source }: { source: string }) {
  return (
    <Chip
      label={source === 'rules' ? 'Reguli WMS aplicate' : 'Strategie implicita'}
      color={source === 'rules' ? 'success' : 'default'}
      size="small"
      icon={source === 'rules' ? <CheckCircleIcon fontSize="small" /> : <InfoIcon fontSize="small" />}
    />
  );
}

// ─── Tab 1: Simulator Putaway ─────────────────────────────────────────────────

function PutawaySimulator() {
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('');
  const [packagingType, setPackagingType] = useState('');
  const [quantity, setQuantity] = useState('100');
  const [warehouseId, setWarehouseId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PutawayResult | null>(null);

  const run = async () => {
    if (!sku.trim()) { setError('Introduceți SKU-ul produsului'); return; }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payload: Record<string, unknown> = {
        product_sku: sku.trim(),
        quantity: parseFloat(quantity) || 1,
        product: {
          sku: sku.trim(),
          category: category || undefined,
        },
        stock: {
          packaging_type: packagingType || undefined,
          quantity: parseFloat(quantity) || 1,
          status: 'GOOD',
        },
      };
      if (warehouseId.trim()) payload.warehouse_id = warehouseId.trim();

      const data = await warehouseConfigService.suggestPutaway(payload as Parameters<typeof warehouseConfigService.suggestPutaway>[0]);
      setResult(data?.data || data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (e as Error)?.message || 'Eroare necunoscuta';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LocationOnIcon color="primary" />
        Simulator Putaway — Unde se depozitează produsul?
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Introduce datele produsului și sistemul va simula decizia motorului de reguli WMS — ce locații ar fi selectate și de ce.
      </Typography>

      {/* Form */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="flex-end">
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth size="small" label="SKU Produs *"
              value={sku} onChange={e => setSku(e.target.value)}
              placeholder="ex: CAB-NYY-3X25"
              onKeyDown={e => e.key === 'Enter' && run()}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Categorie</InputLabel>
              <Select value={category} label="Categorie" onChange={e => setCategory(e.target.value)}>
                <MenuItem value="">— Orice —</MenuItem>
                <MenuItem value="CABLE">Cabluri</MenuItem>
                <MenuItem value="REEL">Tamburi</MenuItem>
                <MenuItem value="EQUIPMENT">Echipamente</MenuItem>
                <MenuItem value="COMPONENT">Componente</MenuItem>
                <MenuItem value="BULK">Vrac</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Tip ambalaj</InputLabel>
              <Select value={packagingType} label="Tip ambalaj" onChange={e => setPackagingType(e.target.value)}>
                <MenuItem value="">— Orice —</MenuItem>
                <MenuItem value="REEL">Tambur (bobina)</MenuItem>
                <MenuItem value="COIL">Colac</MenuItem>
                <MenuItem value="CUT">Bucata taiata</MenuItem>
                <MenuItem value="PALLET">Palet</MenuItem>
                <MenuItem value="BOX">Cutie</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField
              fullWidth size="small" label="Cantitate" type="number"
              value={quantity} onChange={e => setQuantity(e.target.value)}
              inputProps={{ min: 0.1 }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField
              fullWidth size="small" label="Warehouse ID (opțional)"
              value={warehouseId} onChange={e => setWarehouseId(e.target.value)}
              placeholder="UUID depozit"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 1 }}>
            <Button
              fullWidth variant="contained" color="primary"
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
              onClick={run} disabled={loading}
            >
              Run
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Rezultate */}
      {result && (
        <Box>
          {/* Header */}
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <StrategyBadge source={result.strategy_source} />
            {result.context.suggested_zone && (
              <Chip label={`Zona recomandată: ${result.context.suggested_zone}`} size="small" color="primary" variant="outlined" />
            )}
            {result.context.suggested_location_type && (
              <Chip label={`Tip locatie: ${result.context.suggested_location_type}`} size="small" variant="outlined" />
            )}
          </Stack>

          <Grid container spacing={3}>
            {/* Reguli aplicate */}
            {result.matchedRules.length > 0 && (
              <Grid size={{ xs: 12, md: 4 }}>
                <Card variant="outlined">
                  <CardHeader
                    title="Reguli aplicate"
                    titleTypographyProps={{ variant: 'subtitle2' }}
                    avatar={<RuleIcon color="primary" />}
                    subheader={`${result.matchedRules.length} reguli au decis putaway-ul`}
                  />
                  <CardContent sx={{ pt: 0 }}>
                    <Stack spacing={1}>
                      {result.matchedRules.map(r => <RuleChip key={r.id} rule={r} />)}
                    </Stack>
                    {result.actions.length > 0 && (
                      <>
                        <Divider sx={{ my: 1.5 }} />
                        <Typography variant="caption" color="text.secondary">Acțiuni generate:</Typography>
                        <List dense>
                          {result.actions.map((a, i) => (
                            <ListItem key={i} sx={{ py: 0.5 }}>
                              <ListItemIcon sx={{ minWidth: 28 }}><TrendingFlatIcon fontSize="small" /></ListItemIcon>
                              <ListItemText primary={`${a.type}: ${a.value}`} primaryTypographyProps={{ variant: 'body2' }} />
                            </ListItem>
                          ))}
                        </List>
                      </>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            )}

            {/* Sugestii locatii */}
            <Grid size={{ xs: 12, md: result.matchedRules.length > 0 ? 8 : 12 }}>
              <Card variant="outlined">
                <CardHeader
                  title={`${result.suggestions.length} locații sugerate`}
                  titleTypographyProps={{ variant: 'subtitle2' }}
                  avatar={<LocationOnIcon color="success" />}
                  subheader="Ordonate după scorul de potrivire — prima locație este recomandarea principală"
                />
                <CardContent sx={{ p: 0 }}>
                  {result.suggestions.length === 0 ? (
                    <Alert severity="warning" sx={{ m: 2 }}>
                      Nicio locație disponibilă nu corespunde criteriilor. Verifică stocul sau regulile WMS.
                    </Alert>
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>#</TableCell>
                            <TableCell>Locație</TableCell>
                            <TableCell>Zonă</TableCell>
                            <TableCell>Tip</TableCell>
                            <TableCell>Ocupare</TableCell>
                            <TableCell align="right">Scor</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {result.suggestions.map(s => (
                            <TableRow
                              key={s.location_id}
                              sx={{
                                bgcolor: s.is_recommended ? 'success.dark' : 'transparent',
                                '&:hover': { bgcolor: 'action.hover' },
                              }}
                            >
                              <TableCell>
                                {s.is_recommended
                                  ? <Badge badgeContent={<StarIcon sx={{ fontSize: 10 }} />}><Typography variant="body2" fontWeight="bold">{s.rank}</Typography></Badge>
                                  : s.rank}
                              </TableCell>
                              <TableCell>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  {s.is_recommended && <StarIcon fontSize="small" sx={{ color: 'warning.main' }} />}
                                  <Typography variant="body2" fontWeight={s.is_recommended ? 'bold' : 'normal'}>
                                    {s.location_code}
                                  </Typography>
                                </Stack>
                              </TableCell>
                              <TableCell>
                                <Chip label={s.zone_code || s.zone_name} size="small" variant="outlined" />
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption">{s.type_name || '—'}</Typography>
                              </TableCell>
                              <TableCell>
                                <OccupancyBar value={s.current_occupancy_percent || 0} />
                              </TableCell>
                              <TableCell align="right">
                                <Chip label={s.score} size="small" color={s.is_recommended ? 'success' : 'default'} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
}

// ─── Tab 2: Simulator Picking ─────────────────────────────────────────────────

function PickingSimulator() {
  const [sku, setSku] = useState('');
  const [requestedQty, setRequestedQty] = useState('100');
  const [uom, setUom] = useState('m');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PickingResult | null>(null);

  const run = async () => {
    if (!sku.trim()) { setError('Introduceți SKU-ul produsului'); return; }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await warehouseConfigService.suggestPicking({
        product_sku: sku.trim(),
        requested_qty: parseFloat(requestedQty) || 1,
        uom,
        product: { sku: sku.trim() },
      });
      setResult(data?.data || data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (e as Error)?.message || 'Eroare necunoscuta';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const totalAllocated = result?.allocation?.reduce((s, a) => s + a.allocated_qty, 0) ?? 0;
  const fulfilled = result ? totalAllocated >= (result.requested_qty || 0) : false;

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <InventoryIcon color="secondary" />
        Simulator Picking — De unde se ia marfa?
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Introduce produsul și cantitatea dorită — sistemul arată ce loturi sunt alocate,
        din ce locații, în ce ordine (FIFO / MIN_WASTE etc.) și dacă stocul acoperă comanda.
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="flex-end">
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth size="small" label="SKU Produs *"
              value={sku} onChange={e => setSku(e.target.value)}
              placeholder="ex: CAB-NYY-3X25"
              onKeyDown={e => e.key === 'Enter' && run()}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField
              fullWidth size="small" label="Cantitate necesară" type="number"
              value={requestedQty} onChange={e => setRequestedQty(e.target.value)}
              inputProps={{ min: 0.1 }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>UM</InputLabel>
              <Select value={uom} label="UM" onChange={e => setUom(e.target.value)}>
                <MenuItem value="m">m (metri)</MenuItem>
                <MenuItem value="kg">kg</MenuItem>
                <MenuItem value="buc">buc</MenuItem>
                <MenuItem value="ml">ml</MenuItem>
                <MenuItem value="rola">rolă</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <Button
              fullWidth variant="contained" color="secondary"
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
              onClick={run} disabled={loading}
            >
              Simulează
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {result && (
        <Box>
          {/* Status general */}
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Stack direction="row" spacing={3} flexWrap="wrap" alignItems="center">
              <StrategyBadge source={result.strategy_source} />
              <Chip
                label={`Strategie: ${result.strategy}`}
                size="small"
                color="info"
                variant="outlined"
              />
              <Chip
                label={result.allow_multi_lot ? 'Multi-lot permis' : 'Un singur lot'}
                size="small"
                variant="outlined"
              />
              {fulfilled
                ? <Chip icon={<CheckCircleIcon />} label="Comandă acoperită complet ✓" color="success" />
                : <Chip icon={<WarningIcon />} label={`Stoc insuficient — ${totalAllocated.toFixed(2)} / ${result.requested_qty} ${result.uom}`} color="warning" />
              }
            </Stack>
          </Paper>

          <Grid container spacing={3}>
            {/* Alocare pas cu pas */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined">
                <CardHeader
                  title="Plan de alocare (pas cu pas)"
                  titleTypographyProps={{ variant: 'subtitle2' }}
                  avatar={<EmojiEventsIcon color={fulfilled ? 'success' : 'warning'} />}
                  subheader={`${result.allocation.length} loturi selectate — total ${totalAllocated.toFixed(2)} ${result.uom}`}
                />
                <CardContent sx={{ p: 0 }}>
                  {result.allocation.length === 0 ? (
                    <Alert severity="error" sx={{ m: 2 }}>Niciun stoc disponibil pentru acest produs.</Alert>
                  ) : (
                    <Stepper orientation="vertical" sx={{ p: 2 }}>
                      {result.allocation.map((item, idx) => (
                        <Step key={idx} active completed>
                          <StepLabel
                            StepIconProps={{ icon: idx + 1 }}
                          >
                            <Typography variant="body2" fontWeight="medium">
                              {item.location_code} — Lot: {item.lot_number || '—'}
                            </Typography>
                          </StepLabel>
                          <StepContent>
                            <Stack spacing={0.5}>
                              <Typography variant="caption" color="text.secondary">
                                Cantitate alocată: <strong>{item.allocated_qty.toFixed(2)} {item.uom}</strong>
                              </Typography>
                              {item.zone_name && (
                                <Typography variant="caption" color="text.secondary">
                                  Zonă: {item.zone_name} ({item.zone_code})
                                </Typography>
                              )}
                            </Stack>
                          </StepContent>
                        </Step>
                      ))}
                    </Stepper>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Stoc disponibil */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined">
                <CardHeader
                  title="Stoc disponibil în depozit"
                  titleTypographyProps={{ variant: 'subtitle2' }}
                  subheader={`${result.available_stock.length} înregistrări — ordinea afișată respectă strategia ${result.strategy}`}
                />
                <CardContent sx={{ p: 0 }}>
                  <TableContainer sx={{ maxHeight: 300 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Lot</TableCell>
                          <TableCell>Locație</TableCell>
                          <TableCell>Zonă</TableCell>
                          <TableCell align="right">Disponibil</TableCell>
                          <TableCell>Status lot</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {result.available_stock.map((s, i) => {
                          const isAllocated = result.allocation.some(a => a.lot_number === s.lot_number && a.location_code === s.location_code);
                          return (
                            <TableRow
                              key={i}
                              sx={{ bgcolor: isAllocated ? 'success.dark' : 'transparent', opacity: isAllocated ? 1 : 0.5 }}
                            >
                              <TableCell>
                                <Stack direction="row" spacing={0.5} alignItems="center">
                                  {isAllocated && <CheckCircleIcon fontSize="small" color="success" />}
                                  <Typography variant="body2">{s.lot_number || '—'}</Typography>
                                </Stack>
                              </TableCell>
                              <TableCell>{s.location_code || '—'}</TableCell>
                              <TableCell>
                                <Chip label={s.zone_code || '—'} size="small" variant="outlined" />
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" fontWeight={isAllocated ? 'bold' : 'normal'}>
                                  {s.available_qty.toFixed(2)}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={s.lot_status || 'AVAILABLE'}
                                  size="small"
                                  color={s.lot_status === 'QUARANTINE' ? 'error' : 'default'}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>

              {/* Reguli aplicate */}
              {result.matchedRules.length > 0 && (
                <Card variant="outlined" sx={{ mt: 2 }}>
                  <CardHeader
                    title="Reguli aplicate (picking)"
                    titleTypographyProps={{ variant: 'subtitle2' }}
                    avatar={<RuleIcon color="secondary" />}
                  />
                  <CardContent sx={{ pt: 0 }}>
                    <Stack spacing={1} flexWrap="wrap" direction="row">
                      {result.matchedRules.map(r => <RuleChip key={r.id} rule={r} />)}
                    </Stack>
                  </CardContent>
                </Card>
              )}
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
}

// ─── Tab 3: Comparatie strategii ─────────────────────────────────────────────

const STRATEGIES = [
  { value: 'FIFO', label: 'FIFO (primul intrat, primul ieșit)' },
  { value: 'MIN_WASTE', label: 'Min Waste (risipă minimă)' },
  { value: 'PREFER_REMNANTS', label: 'Prefer Remnants (resturi mai întâi)' },
  { value: 'PROXIMITY', label: 'Proximity (lângă expediere)' },
];

function CompareStrategies() {
  const [sku, setSku] = useState('');
  const [requestedQty, setRequestedQty] = useState('100');
  const [uom, setUom] = useState('m');
  const [stratA, setStratA] = useState('FIFO');
  const [stratB, setStratB] = useState('MIN_WASTE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultA, setResultA] = useState<PickingResult | null>(null);
  const [resultB, setResultB] = useState<PickingResult | null>(null);

  const run = async () => {
    if (!sku.trim()) { setError('Introduceți SKU-ul produsului'); return; }
    setLoading(true);
    setError(null);
    setResultA(null);
    setResultB(null);
    try {
      const [a, b] = await Promise.all([
        warehouseConfigService.suggestPicking({ product_sku: sku.trim(), requested_qty: parseFloat(requestedQty) || 1, uom, product: { sku: sku.trim(), preferred_strategy: stratA } }),
        warehouseConfigService.suggestPicking({ product_sku: sku.trim(), requested_qty: parseFloat(requestedQty) || 1, uom, product: { sku: sku.trim(), preferred_strategy: stratB } }),
      ]);
      setResultA(a?.data || a);
      setResultB(b?.data || b);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (e as Error)?.message || 'Eroare necunoscuta';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const renderSide = (res: PickingResult | null, _label: string, stratLabel: string, color: 'primary' | 'secondary') => {
    const totalAlloc = res?.allocation?.reduce((s, a) => s + a.allocated_qty, 0) ?? 0;
    const fulfilled = res ? totalAlloc >= (res.requested_qty || 0) : false;
    return (
      <Card variant="outlined" sx={{ height: '100%', borderColor: color + '.main', borderWidth: 2 }}>
        <CardHeader
          title={stratLabel}
          titleTypographyProps={{ variant: 'subtitle1', fontWeight: 'bold', color: color + '.main' }}
          subheader={res ? `${res.matchedRules.length} reguli aplicate` : 'În așteptare...'}
          action={
            res && (
              <Chip
                label={fulfilled ? '✓ Acoperit' : '⚠ Insuficient'}
                color={fulfilled ? 'success' : 'warning'}
                size="small"
                sx={{ mr: 1 }}
              />
            )
          }
        />
        <Divider />
        <CardContent>
          {!res ? (
            <Typography variant="body2" color="text.secondary">Apasă „Compară" pentru a vedea rezultatele.</Typography>
          ) : (
            <>
              {/* KPIs */}
              <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap">
                <Box>
                  <Typography variant="caption" color="text.secondary">Strategie efectivă</Typography>
                  <Typography variant="body2" fontWeight="medium">{res.strategy}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Loturi folosite</Typography>
                  <Typography variant="body2" fontWeight="medium">{res.allocation.length}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Total alocat</Typography>
                  <Typography variant="body2" fontWeight="medium" color={fulfilled ? 'success.main' : 'warning.main'}>
                    {totalAlloc.toFixed(2)} {res.uom}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Sursă</Typography>
                  <Typography variant="body2" fontWeight="medium">{res.strategy_source}</Typography>
                </Box>
              </Stack>

              {/* Alocare */}
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Loturi selectate:
              </Typography>
              {res.allocation.length === 0 ? (
                <Alert severity="error" sx={{ mb: 1 }}>Stoc indisponibil</Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Lot</TableCell>
                        <TableCell>Locație</TableCell>
                        <TableCell align="right">Qty</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {res.allocation.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell>{item.lot_number || '—'}</TableCell>
                          <TableCell>{item.location_code}</TableCell>
                          <TableCell align="right">{item.allocated_qty.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Reguli aplicate */}
              {res.matchedRules.length > 0 && (
                <>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Reguli activate:
                  </Typography>
                  <Stack spacing={0.5} flexWrap="wrap" direction="row">
                    {res.matchedRules.map(r => (
                      <Chip key={r.id} label={r.name} size="small" color={color} variant="outlined" sx={{ mb: 0.5 }} />
                    ))}
                  </Stack>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CompareArrowsIcon color="warning" />
        Comparație strategii — FIFO vs MIN_WASTE (sau alt mix)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Rulează aceeași comandă cu două strategii diferite și compară rezultatele side-by-side.
        Aceasta te ajută să alegi strategia optimă pentru tipul tău de marfă.
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="flex-end">
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth size="small" label="SKU Produs *"
              value={sku} onChange={e => setSku(e.target.value)}
              placeholder="ex: CAB-NYY-3X25"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <TextField
              fullWidth size="small" label="Cantitate" type="number"
              value={requestedQty} onChange={e => setRequestedQty(e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>UM</InputLabel>
              <Select value={uom} label="UM" onChange={e => setUom(e.target.value)}>
                <MenuItem value="m">m</MenuItem>
                <MenuItem value="kg">kg</MenuItem>
                <MenuItem value="buc">buc</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Strategie A</InputLabel>
              <Select value={stratA} label="Strategie A" onChange={e => setStratA(e.target.value)}>
                {STRATEGIES.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Strategie B</InputLabel>
              <Select value={stratB} label="Strategie B" onChange={e => setStratB(e.target.value)}>
                {STRATEGIES.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <Button
              fullWidth variant="contained" color="warning"
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <CompareArrowsIcon />}
              onClick={run} disabled={loading}
            >
              Compară
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {(resultA || resultB || loading) && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            {loading && !resultA ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
            ) : renderSide(resultA, 'A', STRATEGIES.find(s => s.value === stratA)?.label || stratA, 'primary')}
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            {loading && !resultB ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
            ) : renderSide(resultB, 'B', STRATEGIES.find(s => s.value === stratB)?.label || stratB, 'secondary')}
          </Grid>

          {/* Concluzie */}
          {resultA && resultB && (
            <Grid size={{ xs: 12 }}>
              <Paper variant="outlined" sx={{ p: 2, borderColor: 'info.main' }}>
                <Typography variant="subtitle2" gutterBottom>📊 Concluzie Comparație</Typography>
                <Grid container spacing={2}>
                  {[
                    {
                      label: 'Loturi folosite',
                      a: resultA.allocation.length,
                      b: resultB.allocation.length,
                      better: resultA.allocation.length <= resultB.allocation.length ? 'A' : 'B',
                      note: 'Mai puține loturi = operațiune mai simplă',
                    },
                    {
                      label: 'Total alocat',
                      a: resultA.allocation.reduce((s, x) => s + x.allocated_qty, 0).toFixed(2),
                      b: resultB.allocation.reduce((s, x) => s + x.allocated_qty, 0).toFixed(2),
                      better: null,
                      note: '',
                    },
                    {
                      label: 'Reguli aplicate',
                      a: resultA.matchedRules.length,
                      b: resultB.matchedRules.length,
                      better: null,
                      note: '',
                    },
                  ].map((row, i) => (
                    <Grid size={{ xs: 12, md: 4 }} key={i}>
                      <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary">{row.label}</Typography>
                        <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 0.5 }}>
                          <Tooltip title="Strategie A">
                            <Chip label={String(row.a)} size="small" color={row.better === 'A' ? 'success' : 'primary'} variant={row.better === 'A' ? 'filled' : 'outlined'} />
                          </Tooltip>
                          <Typography variant="caption" color="text.secondary">vs</Typography>
                          <Tooltip title="Strategie B">
                            <Chip label={String(row.b)} size="small" color={row.better === 'B' ? 'success' : 'secondary'} variant={row.better === 'B' ? 'filled' : 'outlined'} />
                          </Tooltip>
                        </Stack>
                        {row.note && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{row.note}</Typography>}
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  );
}

// ─── Pagina principala ────────────────────────────────────────────────────────

export default function SimulatorPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Simulator WMS
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Testează comportamentul motorului de reguli WMS fără a afecta operațiunile reale.
        Simulează putaway, picking și compară strategii side-by-side.
      </Typography>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
          <Tab
            label="Simulator Putaway"
            icon={<LocationOnIcon />}
            iconPosition="start"
          />
          <Tab
            label="Simulator Picking"
            icon={<InventoryIcon />}
            iconPosition="start"
          />
          <Tab
            label="Comparaţie Strategii"
            icon={<CompareArrowsIcon />}
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      <Box>
        {tab === 0 && <PutawaySimulator />}
        {tab === 1 && <PickingSimulator />}
        {tab === 2 && <CompareStrategies />}
      </Box>
    </Box>
  );
}
