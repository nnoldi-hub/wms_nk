'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box, Button, Stack, Typography, Alert, Chip, CircularProgress,
  Select, MenuItem, FormControl, InputLabel,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  ToggleButton, ToggleButtonGroup, Divider, Paper,
} from '@mui/material';
import GridViewIcon from '@mui/icons-material/GridView';
import EditLocationIcon from '@mui/icons-material/EditLocation';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import warehouseConfigService from '../services/warehouseConfig.service';

// ─── Tipuri ───────────────────────────────────────────────────────────────────

interface LocationMapItem {
  id: string;
  location_code: string;
  status: string;
  coord_x: number | null;
  coord_y: number | null;
  coord_z: number;
  path_cost: number;
  type_name?: string;
  zone_name?: string;
  zone_code?: string;
  aisle?: string;
  rack?: string;
  shelf_level?: number;
}

interface ZoneItem {
  id: string;
  zone_name: string;
  zone_code: string;
  zone_type?: string;
}

interface Props {
  warehouseId: string;
  zones: ZoneItem[];
}

// ─── Culori status ────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE:  '#2e7d32', // verde
  OCCUPIED:   '#e65100', // portocaliu
  RESERVED:   '#1565c0', // albastru
  BLOCKED:    '#b71c1c', // rosu
  MAINTENANCE:'#6a1b9a', // mov
};

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE:  'Liber',
  OCCUPIED:   'Ocupat',
  RESERVED:   'Rezervat',
  BLOCKED:    'Blocat',
  MAINTENANCE:'Mentenanță',
};

const CELL_SIZE = 40; // px
const CELL_GAP  =  2; // px

// ─── Componenta ───────────────────────────────────────────────────────────────

export function WarehouseMapTab({ zones }: Omit<Props, 'warehouseId'> & { warehouseId?: string }) {
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<number>(0);
  const [locations, setLocations] = useState<LocationMapItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  // Dialog coordonate
  const [coordDialog, setCoordDialog] = useState(false);
  const [coordTarget, setCoordTarget] = useState<LocationMapItem | null>(null);
  const [coordForm, setCoordForm] = useState({ coord_x: '', coord_y: '', coord_z: '0', path_cost: '1' });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Tooltip hover
  const [hovered, setHovered] = useState<LocationMapItem | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const loadLocations = useCallback(async () => {
    if (!selectedZoneId) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await warehouseConfigService.listLocations(selectedZoneId, { limit: 500, page: 1 });
      setLocations(resp.data || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selectedZoneId]);

  useEffect(() => {
    if (zones.length > 0 && !selectedZoneId) {
      setSelectedZoneId(zones[0].id);
    }
  }, [zones, selectedZoneId]);

  useEffect(() => { loadLocations(); }, [loadLocations]);

  // ── Calcul dimensiuni grid ──
  const placed = locations.filter(l => l.coord_x !== null && l.coord_y !== null && l.coord_z === levelFilter);
  const unplaced = locations.filter(l => l.coord_x === null || l.coord_y === null);

  const maxX = placed.length > 0 ? Math.max(...placed.map(l => l.coord_x!)) : 0;
  const maxY = placed.length > 0 ? Math.max(...placed.map(l => l.coord_y!)) : 0;
  const gridW = maxX + 1;
  const gridH = maxY + 1;

  // Map: "x,y" → location
  const cellMap: Record<string, LocationMapItem> = {};
  for (const loc of placed) {
    cellMap[`${loc.coord_x},${loc.coord_y}`] = loc;
  }

  const levels = [...new Set(locations.filter(l => l.coord_x !== null).map(l => l.coord_z ?? 0))].sort();

  // ── Deschide dialog editare coordonate ──
  const openCoordEdit = (loc: LocationMapItem) => {
    setCoordTarget(loc);
    setCoordForm({
      coord_x: loc.coord_x !== null ? String(loc.coord_x) : '',
      coord_y: loc.coord_y !== null ? String(loc.coord_y) : '',
      coord_z: String(loc.coord_z ?? 0),
      path_cost: String(loc.path_cost ?? 1),
    });
    setCoordDialog(true);
  };

  const openCoordNew = (x: number, y: number) => {
    // Click pe celulă goală în modul edit → atribuie prima locație nesetată
    if (mode !== 'edit') return;
    setCoordTarget(null);
    setCoordForm({ coord_x: String(x), coord_y: String(y), coord_z: String(levelFilter), path_cost: '1' });
    setCoordDialog(true);
  };

  const saveCoordinates = async () => {
    if (!coordTarget && !coordForm.coord_x) return;
    setSaving(true);
    try {
      const x = coordForm.coord_x !== '' ? parseInt(coordForm.coord_x) : null;
      const y = coordForm.coord_y !== '' ? parseInt(coordForm.coord_y) : null;

      if (coordTarget) {
        await warehouseConfigService.patchLocationCoordinates(coordTarget.id, {
          coord_x: x,
          coord_y: y,
          coord_z: parseInt(coordForm.coord_z) || 0,
          path_cost: parseInt(coordForm.path_cost) || 1,
        });
        setSuccess(`Coordonate salvate pentru ${coordTarget.location_code}`);
      }
      setCoordDialog(false);
      await loadLocations();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const clearCoordinates = async () => {
    if (!coordTarget) return;
    setSaving(true);
    try {
      await warehouseConfigService.patchLocationCoordinates(coordTarget.id, { coord_x: null, coord_y: null });
      setSuccess(`Coordonate șterse pentru ${coordTarget.location_code}`);
      setCoordDialog(false);
      await loadLocations();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // ── Legendă ──
  const statusCounts = Object.fromEntries(
    Object.keys(STATUS_COLOR).map(s => [s, locations.filter(l => l.status === s).length])
  );

  return (
    <Box>
      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>{success}</Alert>}

      {/* ── Toolbar ── */}
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Zonă</InputLabel>
          <Select
            value={selectedZoneId}
            label="Zonă"
            onChange={(e) => { setSelectedZoneId(e.target.value); setLevelFilter(0); }}
          >
            {zones.map(z => (
              <MenuItem key={z.id} value={z.id}>
                {z.zone_code} — {z.zone_name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {levels.length > 1 && (
          <ToggleButtonGroup
            size="small"
            value={levelFilter}
            exclusive
            onChange={(_, v) => v !== null && setLevelFilter(v)}
          >
            {levels.map(l => (
              <ToggleButton key={l} value={l}>Nivel {l}</ToggleButton>
            ))}
          </ToggleButtonGroup>
        )}

        <Box sx={{ flexGrow: 1 }} />

        <ToggleButtonGroup
          size="small"
          value={mode}
          exclusive
          onChange={(_, v) => v && setMode(v)}
        >
          <ToggleButton value="view"><GridViewIcon fontSize="small" sx={{ mr: 0.5 }} />Vizualizare</ToggleButton>
          <ToggleButton value="edit" color="warning"><EditLocationIcon fontSize="small" sx={{ mr: 0.5 }} />Editare</ToggleButton>
        </ToggleButtonGroup>

        <Button size="small" startIcon={<RefreshIcon />} onClick={loadLocations}>
          Reîncarcă
        </Button>
      </Stack>

      {mode === 'edit' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <strong>Modul editare activ.</strong> Click pe o locație plasată pentru a-i modifica coordonatele. Click pe celula goală pentru a plasa o locație din lista nesetată.
        </Alert>
      )}

      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}

      {!loading && selectedZoneId && (
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="flex-start">

          {/* ── Gridul hărții ── */}
          <Box sx={{ overflowX: 'auto', flexGrow: 1 }}>
            {placed.length === 0 ? (
              <Alert severity="info">
                Nicio locație nu are coordonate setate în această zonă.
                {mode === 'edit'
                  ? ' Editează locațiile din lista din dreapta pentru a le plasa pe hartă.'
                  : ' Activează modul Editare pentru a seta coordonate.'}
              </Alert>
            ) : (
              <Box ref={containerRef} sx={{ position: 'relative', display: 'inline-block' }}>
                {/* Axe */}
                <Box sx={{ display: 'flex', alignItems: 'flex-end', mb: 0.5, ml: `${CELL_SIZE + 4}px` }}>
                  {Array.from({ length: gridW }, (_, x) => (
                    <Box key={x} sx={{ width: CELL_SIZE, textAlign: 'center', fontSize: 10, color: 'text.secondary', flexShrink: 0, mr: `${CELL_GAP}px` }}>
                      {x}
                    </Box>
                  ))}
                </Box>

                <Box sx={{ display: 'flex' }}>
                  {/* Etichete Y */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', mr: `${CELL_GAP}px`, justifyContent: 'flex-start' }}>
                    {Array.from({ length: gridH }, (_, y) => (
                      <Box key={y} sx={{ height: CELL_SIZE, display: 'flex', alignItems: 'center', fontSize: 10, color: 'text.secondary', width: CELL_SIZE, justifyContent: 'center', mb: `${CELL_GAP}px` }}>
                        {y}
                      </Box>
                    ))}
                  </Box>

                  {/* Celule grid */}
                  <Box>
                    {Array.from({ length: gridH }, (_, y) => (
                      <Box key={y} sx={{ display: 'flex', mb: `${CELL_GAP}px` }}>
                        {Array.from({ length: gridW }, (_, x) => {
                          const loc = cellMap[`${x},${y}`];
                          const bg = loc ? (STATUS_COLOR[loc.status] || '#555') : (mode === 'edit' ? '#1a1a2e' : '#0d0d0d');
                          return (
                            <Box
                              key={x}
                              sx={{
                                width: CELL_SIZE, height: CELL_SIZE,
                                bgcolor: bg,
                                borderRadius: 0.5,
                                mr: `${CELL_GAP}px`,
                                cursor: loc ? 'pointer' : (mode === 'edit' ? 'crosshair' : 'default'),
                                border: '1px solid',
                                borderColor: loc ? 'transparent' : 'grey.800',
                                transition: 'opacity 0.15s, transform 0.1s',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                overflow: 'hidden',
                                '&:hover': loc || mode === 'edit' ? { opacity: 0.75, transform: 'scale(1.1)', zIndex: 10, position: 'relative' } : {},
                              }}
                              onClick={() => {
                                if (loc && mode === 'edit') openCoordEdit(loc);
                                else if (!loc && mode === 'edit') openCoordNew(x, y);
                              }}
                              onMouseEnter={(e) => {
                                if (loc) {
                                  setHovered(loc);
                                  const rect = containerRef.current?.getBoundingClientRect();
                                  if (rect) setTooltipPos({ x: e.clientX - rect.left + 10, y: e.clientY - rect.top + 10 });
                                }
                              }}
                              onMouseMove={(e) => {
                                if (loc) {
                                  const rect = containerRef.current?.getBoundingClientRect();
                                  if (rect) setTooltipPos({ x: e.clientX - rect.left + 10, y: e.clientY - rect.top + 10 });
                                }
                              }}
                              onMouseLeave={() => setHovered(null)}
                            >
                              {CELL_SIZE >= 36 && loc && (
                                <Typography sx={{ fontSize: 8, color: '#fff', textAlign: 'center', lineHeight: 1, px: 0.2, userSelect: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: CELL_SIZE - 4 }}>
                                  {loc.location_code.length > 7 ? loc.location_code.slice(-7) : loc.location_code}
                                </Typography>
                              )}
                            </Box>
                          );
                        })}
                      </Box>
                    ))}
                  </Box>
                </Box>

                {/* Tooltip plutitor */}
                {hovered && (
                  <Paper
                    elevation={6}
                    sx={{
                      position: 'absolute', top: tooltipPos.y, left: tooltipPos.x,
                      p: 1.5, zIndex: 100, pointerEvents: 'none',
                      minWidth: 180, maxWidth: 260,
                      bgcolor: 'grey.900', border: '1px solid', borderColor: 'grey.700',
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight={700} mb={0.5}>{hovered.location_code}</Typography>
                    <Typography variant="caption" display="block">
                      Status: <span style={{ color: STATUS_COLOR[hovered.status] || '#aaa', fontWeight: 600 }}>
                        {STATUS_LABEL[hovered.status] || hovered.status}
                      </span>
                    </Typography>
                    {hovered.type_name && <Typography variant="caption" display="block">Tip: {hovered.type_name}</Typography>}
                    <Typography variant="caption" display="block">
                      Coordonate: ({hovered.coord_x}, {hovered.coord_y}, z={hovered.coord_z ?? 0})
                    </Typography>
                    {hovered.path_cost && hovered.path_cost > 1 && (
                      <Typography variant="caption" display="block" color="warning.main">
                        ⚠ Cost traversare: {hovered.path_cost}x
                      </Typography>
                    )}
                    {(hovered.aisle || hovered.rack) && (
                      <Typography variant="caption" display="block" color="text.secondary">
                        Culoar {hovered.aisle} · Raft {hovered.rack} · Nivel {hovered.shelf_level}
                      </Typography>
                    )}
                    {mode === 'edit' && (
                      <Typography variant="caption" display="block" color="warning.main" mt={0.5}>Click pentru editare coordonate</Typography>
                    )}
                  </Paper>
                )}
              </Box>
            )}
          </Box>

          {/* ── Panou lateral ── */}
          <Box sx={{ minWidth: 220, flexShrink: 0 }}>
            {/* Legendă */}
            <Typography variant="overline" display="block" gutterBottom>Legendă</Typography>
            <Stack spacing={0.8} mb={2}>
              {Object.entries(STATUS_LABEL).map(([s, label]) => (
                <Stack key={s} direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 16, height: 16, bgcolor: STATUS_COLOR[s], borderRadius: 0.5, flexShrink: 0 }} />
                  <Typography variant="body2">{label}</Typography>
                  {statusCounts[s] > 0 && (
                    <Typography variant="caption" color="text.secondary">({statusCounts[s]})</Typography>
                  )}
                </Stack>
              ))}
            </Stack>

            <Divider sx={{ mb: 2 }} />

            {/* Statistici */}
            <Typography variant="overline" display="block" gutterBottom>Statistici zonă</Typography>
            <Stack spacing={0.5} mb={2}>
              <Typography variant="body2">Total locații: <strong>{locations.length}</strong></Typography>
              <Typography variant="body2">Plasate pe hartă: <strong>{placed.length}</strong></Typography>
              <Typography variant="body2" color={unplaced.length > 0 ? 'warning.main' : 'success.main'}>
                Fără coordonate: <strong>{unplaced.length}</strong>
              </Typography>
              <Typography variant="body2">
                Grid: <strong>{gridW} × {gridH}</strong> celule
              </Typography>
            </Stack>

            {/* Locații nesetate */}
            {unplaced.length > 0 && mode === 'edit' && (
              <>
                <Divider sx={{ mb: 1.5 }} />
                <Typography variant="overline" display="block" gutterBottom color="warning.main">
                  Fără poziție ({unplaced.length})
                </Typography>
                <Box sx={{ maxHeight: 260, overflowY: 'auto' }}>
                  <Stack spacing={0.5}>
                    {unplaced.slice(0, 50).map(loc => (
                      <Box
                        key={loc.id}
                        sx={{
                          p: 0.75, borderRadius: 1, border: '1px solid',
                          borderColor: 'grey.700', cursor: 'pointer',
                          bgcolor: 'background.paper',
                          '&:hover': { borderColor: 'warning.main', bgcolor: 'action.hover' },
                        }}
                        onClick={() => openCoordEdit(loc)}
                      >
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box sx={{ width: 8, height: 8, bgcolor: STATUS_COLOR[loc.status] || '#555', borderRadius: '50%', flexShrink: 0 }} />
                          <Typography variant="caption">{loc.location_code}</Typography>
                        </Stack>
                      </Box>
                    ))}
                    {unplaced.length > 50 && (
                      <Typography variant="caption" color="text.secondary">... și încă {unplaced.length - 50}</Typography>
                    )}
                  </Stack>
                </Box>
              </>
            )}
          </Box>
        </Stack>
      )}

      {/* ── Dialog editare coordonate ── */}
      <Dialog open={coordDialog} onClose={() => setCoordDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <EditLocationIcon color="warning" />
            <span>
              {coordTarget ? `Coordonate: ${coordTarget.location_code}` : 'Plasare locație'}
            </span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {coordTarget && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Status curent: <Chip size="small" label={STATUS_LABEL[coordTarget.status] || coordTarget.status}
                sx={{ bgcolor: STATUS_COLOR[coordTarget.status], color: '#fff', ml: 0.5, height: 20 }} />
            </Alert>
          )}
          <Stack spacing={2} mt={1}>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Coloană (X) *"
                type="number"
                fullWidth
                value={coordForm.coord_x}
                onChange={(e) => setCoordForm(f => ({ ...f, coord_x: e.target.value }))}
                inputProps={{ min: 0, max: 999 }}
              />
              <TextField
                label="Rând (Y) *"
                type="number"
                fullWidth
                value={coordForm.coord_y}
                onChange={(e) => setCoordForm(f => ({ ...f, coord_y: e.target.value }))}
                inputProps={{ min: 0, max: 999 }}
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Nivel (Z)"
                type="number"
                fullWidth
                value={coordForm.coord_z}
                onChange={(e) => setCoordForm(f => ({ ...f, coord_z: e.target.value }))}
                helperText="0=sol, 1=raft1..."
                inputProps={{ min: 0, max: 20 }}
              />
              <TextField
                label="Cost traversare"
                type="number"
                fullWidth
                value={coordForm.path_cost}
                onChange={(e) => setCoordForm(f => ({ ...f, path_cost: e.target.value }))}
                helperText="1=normal, 5=stivuitor"
                inputProps={{ min: 1, max: 10 }}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          {coordTarget && coordTarget.coord_x !== null && (
            <Button color="error" onClick={clearCoordinates} disabled={saving} sx={{ mr: 'auto' }}>
              Șterge poziție
            </Button>
          )}
          <Button onClick={() => setCoordDialog(false)}>Anulează</Button>
          <Button
            variant="contained"
            color="warning"
            startIcon={<SaveIcon />}
            onClick={saveCoordinates}
            disabled={saving || !coordTarget}
          >
            {saving ? 'Salvez...' : 'Salvează'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default WarehouseMapTab;
