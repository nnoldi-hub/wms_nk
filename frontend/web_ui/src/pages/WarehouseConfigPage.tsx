import { useEffect, useMemo, useState, useCallback } from 'react';
import { Box, Button, Card, CardContent, Divider, Stack, Typography, Alert, List, ListItem, ListItemText, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Select, FormControl, InputLabel, Snackbar, Switch, FormControlLabel, IconButton, Tooltip } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridPaginationModel, GridRowId, GridRowSelectionModel, GridSortModel } from '@mui/x-data-grid';
import QRCode from 'qrcode';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import warehouseConfigService from '../services/warehouseConfig.service';

interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
  uptime?: number;
}

interface WarehouseItem { id: string | number; name?: string; address?: string; warehouse_name?: string }
interface ZoneItem { id: string | number; code?: string; name?: string; warehouse_id?: string | number; zone_name?: string }
interface LocationItem { id?: string; location_code: string; aisle?: string; rack?: string; shelf_level?: number; bin_position?: string; type_name?: string }

export function WarehouseConfigPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [token, setToken] = useState<string | null>(warehouseConfigService.getToken());
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsTotal, setLocationsTotal] = useState(0);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });
  const [sortModel, setSortModel] = useState<GridSortModel>([{ field: 'aisle', sort: 'asc' }]);
  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>([] as unknown as GridRowSelectionModel);
  const [locationTypes, setLocationTypes] = useState<{ id: string; code: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [openWh, setOpenWh] = useState(false);
  const [openZone, setOpenZone] = useState(false);
  const [openBulk, setOpenBulk] = useState(false);
  const [openAddType, setOpenAddType] = useState(false);
  const [openEditWh, setOpenEditWh] = useState(false);
  const [openEditZone, setOpenEditZone] = useState(false);
  const [openViewLocation, setOpenViewLocation] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationItem | null>(null);
  const [locationQRUrl, setLocationQRUrl] = useState<string>('');
  const [openEditLocation, setOpenEditLocation] = useState(false);
  const [locationEditForm, setLocationEditForm] = useState({
    location_code: '',
    aisle: '',
    rack: '',
    shelf_level: 1,
    bin_position: '',
    location_type_id: '',
    status: 'AVAILABLE' as const
  });
  const [openViewWarehouse, setOpenViewWarehouse] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseItem | null>(null);
  const [openViewZone, setOpenViewZone] = useState(false);
  const [selectedZone, setSelectedZone] = useState<ZoneItem | null>(null);
  const [testMode, setTestMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('wcTestMode') === 'true';
  });
  const [openSecret, setOpenSecret] = useState(false);
  const [devSecret, setDevSecret] = useState<string>(() => (typeof window !== 'undefined' ? (localStorage.getItem('wcDevSecret') || '') : ''));
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | ''>('');
  const [selectedZoneId, setSelectedZoneId] = useState<string | ''>('');

  const [whForm, setWhForm] = useState({ warehouse_code: '', warehouse_name: '', company_name: '' });
  const [zoneForm, setZoneForm] = useState({ zone_code: '', zone_name: '', zone_type: 'STORAGE' as const });
  const [bulkForm, setBulkForm] = useState({ location_type_id: '', zone_prefix: 'Z', aisle_start: 'A', aisle_end: 'C', rack_start: 1, rack_end: 3, shelf_levels: '1,2', bins_per_shelf: 2 });
  const [newTypeForm, setNewTypeForm] = useState({ code: '', name: '' });

  const checkHealth = async () => {
    setError(null);
    try {
      const h = await warehouseConfigService.health();
      setHealth(h as HealthResponse);
    } catch (e) {
      setError((e as Error)?.message || 'Health check failed');
    }
  };

  const getDevToken = async () => {
    setError(null);
    try {
      const t = await warehouseConfigService.mintDevToken('admin');
      setToken(t);
    } catch (e) {
      setError((e as Error)?.message || 'Failed to get dev token');
      // If missing secret is likely, hint the user to set it
      setOpenSecret(true);
    }
  };

  const loadWarehouses = useCallback(async () => {
    setError(null);
    try {
      const resp = await warehouseConfigService.listWarehouses();
      const list = resp?.data || resp?.items || [];
      setWarehouses(list as WarehouseItem[]);
      if (testMode && !selectedWarehouseId && list.length) {
        setSelectedWarehouseId(String(list[0].id));
      }
    } catch (e) {
      setError((e as Error)?.message || 'Failed to load warehouses');
    }
  }, [testMode, selectedWarehouseId]);

  const loadZones = useCallback(async (warehouseId?: string) => {
    setError(null);
    try {
      const wid = warehouseId || warehouses[0]?.id;
      if (!wid) {
        setError('No warehouse available to load zones');
        return;
      }
      const resp = await warehouseConfigService.listZones(String(wid));
      const list = resp?.data || resp?.items || [];
      setZones(list as ZoneItem[]);
      if (testMode && !selectedZoneId && list.length) {
        setSelectedZoneId(String(list[0].id));
      }
    } catch (e) {
      setError((e as Error)?.message || 'Failed to load zones');
    }
  }, [warehouses, testMode, selectedZoneId]);

  const loadLocationTypes = async () => {
    setError(null);
    try {
  const resp = await warehouseConfigService.listLocationTypes({ limit: 100 });
  const list = (resp?.data || resp?.items || []) as Array<{ id: string; code: string; name: string }>;
  setLocationTypes(list);
    } catch (e) {
      setError((e as Error)?.message || 'Failed to load location types');
    }
  };

  const loadLocations = useCallback(async (zoneId?: string) => {
    setError(null);
    const zid = zoneId || selectedZoneId || zones[0]?.id;
    if (!zid) { setError('No zone selected'); return; }
    const page = paginationModel.page + 1; // backend uses 1-based pages
    const limit = paginationModel.pageSize;
    const sortBy = sortModel[0]?.field || 'aisle';
    const sortDir = (sortModel[0]?.sort || 'asc').toLowerCase(); // backend expects lowercase
    try {
      setLocationsLoading(true);
      const resp = await warehouseConfigService.listLocations(String(zid), { page, limit, sortBy, sortDir });
      const list = (resp?.data || resp?.items || []) as LocationItem[];
      const total = resp?.pagination?.total ?? list.length;
      setLocations(list);
      setLocationsTotal(total);
    } catch (e) {
      setError((e as Error)?.message || 'Failed to load locations');
    } finally {
      setLocationsLoading(false);
    }
  }, [selectedZoneId, zones, paginationModel.page, paginationModel.pageSize, sortModel]);

  const handleViewLocation = useCallback(async (location: LocationItem) => {
    setSelectedLocation(location);
    setOpenViewLocation(true);
    
    // Generate QR code for this location
    try {
      const code = location.location_code || (location as unknown as { id?: string }).id || 'UNKNOWN';
      const url = await QRCode.toDataURL(code, { width: 300, margin: 2 });
      setLocationQRUrl(url);
    } catch (e) {
      console.error('Failed to generate QR:', e);
      setLocationQRUrl('');
    }
  }, []);

  const handleDeleteLocation = useCallback(async (location: LocationItem) => {
    const confirmed = window.confirm(`Sigur doresti sa stergi locatia ${location.location_code}?`);
    if (!confirmed) return;

    try {
      const locationId = (location as unknown as { id?: string }).id;
      if (!locationId) {
        setError('ID locatie lipsa');
        return;
      }
      
      await warehouseConfigService.deleteLocation(locationId);
      setSuccessMsg(`Locatie ${location.location_code} stearsa cu succes!`);
      
      // Reload locations
      await loadLocations();
    } catch (e) {
      setError((e as Error)?.message || 'Eroare la stergerea locatiei');
    }
  }, [loadLocations]);

  const handleEditLocation = useCallback((location: LocationItem) => {
    setSelectedLocation(location);
    
    // Populate form with current location data
    setLocationEditForm({
      location_code: location.location_code || '',
      aisle: location.aisle || '',
      rack: location.rack || '',
      shelf_level: location.shelf_level ?? 1,
      bin_position: location.bin_position || '',
      location_type_id: (location as LocationItem & { location_type_id?: string }).location_type_id || '',
      status: (location as LocationItem & { status?: string }).status as 'AVAILABLE' || 'AVAILABLE'
    });
    
    setOpenEditLocation(true);
  }, []);

  const handleSaveLocation = useCallback(async () => {
    try {
      if (!selectedLocation) return;
      
      const locationId = (selectedLocation as unknown as { id?: string }).id;
      if (!locationId) {
        setError('ID locatie lipsa');
        return;
      }

      // Prepare update payload
      const payload = {
        location_code: locationEditForm.location_code,
        aisle: locationEditForm.aisle,
        rack: locationEditForm.rack,
        shelf_level: locationEditForm.shelf_level,
        bin_position: locationEditForm.bin_position,
        location_type_id: locationEditForm.location_type_id,
        status: locationEditForm.status
      };

      await warehouseConfigService.updateLocation(locationId, payload);
      setSuccessMsg(`Locatie ${locationEditForm.location_code} actualizata cu succes!`);
      
      // Close dialogs and reload
      setOpenEditLocation(false);
      setOpenViewLocation(false);
      await loadLocations();
    } catch (e) {
      setError((e as Error)?.message || 'Eroare la actualizarea locatiei');
    }
  }, [selectedLocation, locationEditForm, loadLocations]);

  // Warehouse handlers
  const handleViewWarehouse = useCallback((warehouse: WarehouseItem) => {
    setSelectedWarehouse(warehouse);
    setOpenViewWarehouse(true);
  }, []);

  const handleDeleteWarehouse = useCallback(async (warehouse: WarehouseItem) => {
    // Check if warehouse has zones
    try {
      const resp = await warehouseConfigService.listZones(String(warehouse.id));
      const zonesList = resp?.data || resp?.items || [];
      
      if (zonesList.length > 0) {
        setError(`Nu poti sterge depozitul "${warehouse.warehouse_name || warehouse.name}". Sterge mai intai toate zonele (${zonesList.length} zone existente).`);
        return;
      }

      const confirmed = window.confirm(`Sigur doresti sa stergi depozitul ${warehouse.warehouse_name || warehouse.name}?`);
      if (!confirmed) return;

      await warehouseConfigService.deleteWarehouse(String(warehouse.id));
      setSuccessMsg(`Depozit ${warehouse.warehouse_name || warehouse.name} sters cu succes!`);
      
      // Reload warehouses
      await loadWarehouses();
      if (selectedWarehouseId === String(warehouse.id)) {
        setSelectedWarehouseId('');
        setZones([]);
      }
    } catch (e) {
      setError((e as Error)?.message || 'Eroare la stergerea depozitului');
    }
  }, [selectedWarehouseId, loadWarehouses]);

  // Zone handlers
  const handleViewZone = useCallback((zone: ZoneItem) => {
    setSelectedZone(zone);
    setOpenViewZone(true);
  }, []);

  const handleDeleteZone = useCallback(async (zone: ZoneItem) => {
    // Check if zone has locations
    try {
      const resp = await warehouseConfigService.listLocations(String(zone.id), { limit: 1 });
      const locationsList = resp?.data || resp?.items || [];
      const total = resp?.pagination?.total ?? locationsList.length;
      
      if (total > 0) {
        setError(`Nu poti sterge zona "${zone.zone_name || zone.name}". Sterge mai intai toate locatiile (${total} locatii existente).`);
        return;
      }

      const confirmed = window.confirm(`Sigur doresti sa stergi zona ${zone.zone_name || zone.name}?`);
      if (!confirmed) return;

      await warehouseConfigService.deleteZone(String(zone.id));
      setSuccessMsg(`Zona ${zone.zone_name || zone.name} stearsa cu succes!`);
      
      // Reload zones
      if (selectedWarehouseId) {
        await loadZones(selectedWarehouseId);
      }
      if (selectedZoneId === String(zone.id)) {
        setSelectedZoneId('');
        setLocations([]);
      }
    } catch (e) {
      setError((e as Error)?.message || 'Eroare la stergerea zonei');
    }
  }, [selectedWarehouseId, selectedZoneId, loadZones]);

  const exportLocationsCsv = () => {
  const headers = ['location_code','aisle','rack','shelf_level','bin_position','type_name'];
  const rows = locations.map((l) => [l.location_code,l.aisle,l.rack,l.shelf_level,l.bin_position,l.type_name]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => (v ?? '')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'locations_preview.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const printSelectedQRCodes = async () => {
    try {
      // Handle MUI DataGrid selection model which can be:
      // 1. Array of IDs
      // 2. Object with {type: 'include', ids: Set} - individual selections
      // 3. Object with {type: 'exclude', ids: Set} - select-all with exclusions
      let selectedIdsArray: GridRowId[] = [];
      
      if (Array.isArray(selectionModel)) {
        selectedIdsArray = selectionModel;
      } else if (selectionModel && typeof selectionModel === 'object' && 'type' in selectionModel) {
        const selModel = selectionModel as { type: string; ids: Set<GridRowId> };
        
        if (selModel.type === 'include') {
          // Individual selections: use the IDs in the Set directly
          selectedIdsArray = Array.from(selModel.ids || []);
        } else if (selModel.type === 'exclude') {
          // Select-all case: get all location IDs and exclude the ones in the Set
          const excludeIds = new Set(selModel.ids || []);
          selectedIdsArray = locations
            .map(l => (l as unknown as { id?: string }).id ?? l.location_code ?? '')
            .filter(id => !excludeIds.has(id));
        }
      } else {
        // Try to convert to array as fallback
        try {
          selectedIdsArray = Array.from(selectionModel as unknown as Iterable<GridRowId>);
        } catch {
          selectedIdsArray = [];
        }
      }
      
      if (selectedIdsArray.length === 0) {
        setError('Selecteaza cel putin o locatie pentru a genera QR codes');
        return;
      }
      
      // Map locations with their computed row IDs
      const locationsWithIds = locations.map(l => {
        const computedId = (l as unknown as { id?: string }).id ?? l.location_code;
        return { location: l, computedId };
      });
      
      const selectedIds = new Set(selectedIdsArray);
      const targets = locationsWithIds
        .filter(item => selectedIds.has(item.computedId))
        .map(item => item.location);
      
      if (targets.length === 0) {
        setError('Nu s-au gasit locatii selectate');
        return;
      }
      
      const images = await Promise.all(targets.map(async (l) => {
        // Use location_code for QR if available, otherwise use id
        const code = l.location_code || (l as unknown as { id?: string }).id || 'UNKNOWN';
        const url = await QRCode.toDataURL(code, { width: 200, margin: 1 });
        return { code, url };
      }));
      
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>QR Labels</title>
        <style>
          body{font-family:Arial;padding:16px}
          .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
          .item{border:1px solid #ccc;padding:8px;text-align:center}
          img{width:200px;height:200px}
          .code{margin-top:8px;font-weight:bold}
        </style>
      </head><body>
        <div class="grid">
          ${images.map(i => `<div class="item"><img src="${i.url}" alt="${i.code}"/><div class="code">${i.code}</div></div>`).join('')}
        </div>
        <script>window.onload=()=>window.print();</script>
      </body></html>`;
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.write(html);
      w.document.close();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    if (openBulk) loadLocationTypes();
  }, [openBulk]);

  useEffect(() => {
    if (openEditLocation) loadLocationTypes();
  }, [openEditLocation]);

  // Auto-setup for Test Mode: mint token and preselect first warehouse/zone
  useEffect(() => {
    if (!testMode) return;
    (async () => {
      try {
        if (!token) {
          const t = await warehouseConfigService.mintDevToken('admin');
          setToken(t);
        }
        if (!warehouses.length) {
          await loadWarehouses();
        }
        const wid = selectedWarehouseId || (warehouses[0] && String(warehouses[0].id));
        if (wid && !zones.length) {
          await loadZones(wid);
        }
      } catch (e) {
        setError((e as Error).message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testMode]);

  // Persist Test Mode for other parts (e.g., AuthProvider) to detect and avoid auth verify
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('wcTestMode', testMode ? 'true' : 'false');
  }, [testMode]);

  // Auto-load zones when warehouse is selected
  useEffect(() => {
    if (selectedWarehouseId && token) {
      loadZones(selectedWarehouseId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWarehouseId]);

  useEffect(() => {
    if (selectedZoneId) {
      loadLocations(selectedZoneId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedZoneId, paginationModel.page, paginationModel.pageSize, JSON.stringify(sortModel)]);

  const locationColumns = useMemo<GridColDef[]>(() => [
    { field: 'location_code', headerName: 'Locatie', flex: 1, minWidth: 160 },
    { field: 'aisle', headerName: 'Culoar', width: 90 },
    { field: 'rack', headerName: 'Raft', width: 90 },
    { field: 'shelf_level', headerName: 'Nivel', width: 90, type: 'number' },
    { field: 'bin_position', headerName: 'Cutie', width: 90 },
    { field: 'type_name', headerName: 'Tip', flex: 1, minWidth: 160 },
    {
      field: 'actions',
      headerName: 'Actiuni',
      width: 140,
      sortable: false,
      renderCell: (params) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Vizualizeaza">
            <IconButton 
              size="small" 
              color="primary"
              onClick={() => handleViewLocation(params.row as LocationItem)}
            >
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Sterge">
            <IconButton 
              size="small" 
              color="error"
              onClick={() => handleDeleteLocation(params.row as LocationItem)}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ], [handleViewLocation, handleDeleteLocation]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Configurare Depozit – Test Backend
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Tool de verificare rapidă pentru serviciul warehouse-config: health, token dev și listări de bază.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <FormControlLabel control={<Switch checked={testMode} onChange={(e) => setTestMode(e.target.checked)} />} label="Mod Test" />
        <Button variant="text" onClick={() => setOpenSecret(true)}>Seteaza Secret Dev</Button>
        <Button variant="outlined" onClick={checkHealth}>Verifica Sanatate</Button>
        <Button variant="contained" color="secondary" onClick={getDevToken}>Obtine Token Dev</Button>
        <Button variant="contained" onClick={loadWarehouses} disabled={!token && !testMode}>Lista Depozite</Button>
        <Button variant="contained" onClick={() => loadZones()} disabled={(!token || warehouses.length === 0) && !testMode}>Lista Zone (primul DEP)</Button>
        <Button variant="outlined" onClick={async () => {
          if (!token && testMode) {
            try {
              const t = await warehouseConfigService.mintDevToken('admin');
              setToken(t);
            } catch (e) {
              setError((e as Error).message);
              setOpenSecret(true);
              return;
            }
          }
          setOpenWh(true);
        }} disabled={!token && !testMode}>Adauga Depozit</Button>
        <Button variant="outlined" color="success" onClick={async () => {
          if (!selectedWarehouseId) { setError('Selecteaza un depozit mai intai'); return; }
          try {
            if (!token && testMode) {
              const t = await warehouseConfigService.mintDevToken('admin');
              setToken(t);
            }
            await warehouseConfigService.completeSetup(selectedWarehouseId);
            await loadWarehouses();
          }
          catch (e) { setError((e as Error).message); }
        }} disabled={(!token || !selectedWarehouseId) && !testMode}>Finalizeaza Setup</Button>
        <Button variant="outlined" onClick={() => setOpenZone(true)} disabled={(!token || !selectedWarehouseId) && !testMode}>Adauga Zona</Button>
        <Button variant="outlined" color="info" onClick={() => setOpenEditWh(true)} disabled={(!token || !selectedWarehouseId) && !testMode}>Editeaza Depozit</Button>
        <Button variant="outlined" color="info" onClick={() => setOpenEditZone(true)} disabled={(!token || !selectedZoneId) && !testMode}>Editeaza Zona</Button>
        <Button variant="outlined" onClick={() => setOpenBulk(true)} disabled={(!token || !selectedZoneId) && !testMode}>Generare Locatii</Button>
        <Button variant="contained" onClick={async () => {
          if (!selectedZoneId) { setError('Selecteaza o zona mai intai'); return; }
          if (!token && testMode) {
            const t = await warehouseConfigService.mintDevToken('admin');
            setToken(t);
          }
          await loadLocations();
        }} disabled={(!token || !selectedZoneId) && !testMode}>Incarca Locatii</Button>
        <Button variant="contained" onClick={exportLocationsCsv} disabled={!locations.length && !testMode}>Exporta CSV</Button>
        <Button variant="contained" color="secondary" onClick={printSelectedQRCodes} disabled={((selectionModel as unknown as GridRowId[]).length === 0) && !testMode}>Tipareste QR (selectie)</Button>
      </Stack>      {health && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1">Sanatate Serviciu</Typography>
            <Divider sx={{ my: 1 }} />
            <pre style={{ margin: 0 }}>{JSON.stringify(health, null, 2)}</pre>
          </CardContent>
        </Card>
      )}

      {!!token && (
        <Alert severity="success" sx={{ mb: 2 }}>Token incarcat in memorie (dev). Apelurile vor include header-ul Authorization.</Alert>
      )}

      {!!warehouses.length && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1">Depozite</Typography>
            <Divider sx={{ my: 1 }} />
            <List>
              {warehouses.map((w) => (
                <ListItem 
                  key={w.id} 
                  disableGutters 
                  sx={{ 
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                    borderRadius: 1,
                    px: 1,
                    py: 0.5
                  }}
                  secondaryAction={
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Vizualizeaza">
                        <IconButton 
                          edge="end" 
                          size="small" 
                          color="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewWarehouse(w);
                          }}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Sterge">
                        <IconButton 
                          edge="end" 
                          size="small" 
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteWarehouse(w);
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  }
                >
                  <ListItemText 
                    primary={`${w.name || w.warehouse_name || 'Depozit'} (id: ${w.id})`} 
                    secondary={w.address || ''} 
                    onClick={() => { 
                      setSelectedWarehouseId(String(w.id)); 
                      setSelectedZoneId(''); // Reset selected zone
                      setLocations([]); // Clear locations
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {!!zones.length && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1">Zone</Typography>
            <Divider sx={{ my: 1 }} />
            <List>
              {zones.map((z) => (
                <ListItem 
                  key={z.id} 
                  disableGutters 
                  sx={{ 
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                    borderRadius: 1,
                    px: 1,
                    py: 0.5
                  }}
                  secondaryAction={
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Vizualizeaza">
                        <IconButton 
                          edge="end" 
                          size="small" 
                          color="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewZone(z);
                          }}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Sterge">
                        <IconButton 
                          edge="end" 
                          size="small" 
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteZone(z);
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  }
                >
                  <ListItemText 
                    primary={`${z.code || z.name || z.zone_name || 'Zona'} (id: ${z.id})`} 
                    secondary={`Depozit: ${z.warehouse_id || ''}`} 
                    onClick={() => setSelectedZoneId(String(z.id))}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="subtitle1">Locatii</Typography>
          <Divider sx={{ my: 1 }} />
          <div style={{ width: '100%' }}>
            <DataGrid
              autoHeight
              rows={locations.map((l, idx) => {
                const rowId = (l as unknown as { id?: string }).id ?? l.location_code ?? `row-${idx}`;
                return { ...l, id: rowId };
              })}
              columns={locationColumns}
              paginationMode="server"
              sortingMode="server"
              rowCount={locationsTotal}
              paginationModel={paginationModel}
              onPaginationModelChange={setPaginationModel}
              sortModel={sortModel}
              onSortModelChange={setSortModel}
              checkboxSelection
              disableRowSelectionOnClick
              onRowSelectionModelChange={setSelectionModel}
              loading={locationsLoading}
              pageSizeOptions={[10, 25, 50, 100]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Dialog: Set Dev Secret */}
      <Dialog open={openSecret} onClose={() => setOpenSecret(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Seteaza Secret Dev</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label="DEV_TOOL_SECRET" value={devSecret} onChange={(e) => setDevSecret(e.target.value)} fullWidth />
            <Typography variant="body2" color="text.secondary">
              Acest secret este necesar de backend cand genereaza un token dev. Va fi stocat in localStorage ca "wcDevSecret".
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSecret(false)}>Anuleaza</Button>
          <Button variant="contained" onClick={async () => {
            if (typeof window !== 'undefined') {
              localStorage.setItem('wcDevSecret', devSecret || '');
            }
            setOpenSecret(false);
            // If in Test Mode and no token yet, try minting now
            try {
              if (testMode && !token) {
                const t = await warehouseConfigService.mintDevToken('admin');
                setToken(t);
              }
            } catch (e) { setError((e as Error).message); }
          }}>Salveaza</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Add Warehouse */}
      <Dialog open={openWh} onClose={() => setOpenWh(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Adauga Depozit</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label="Cod Depozit" value={whForm.warehouse_code} onChange={(e) => setWhForm({ ...whForm, warehouse_code: e.target.value })} required />
            <TextField label="Nume Depozit" value={whForm.warehouse_name} onChange={(e) => setWhForm({ ...whForm, warehouse_name: e.target.value })} required />
            <TextField label="Nume Companie" value={whForm.company_name} onChange={(e) => setWhForm({ ...whForm, company_name: e.target.value })} required />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenWh(false)}>Anuleaza</Button>
          <Button variant="contained" onClick={async () => {
            try {
              if (!token && testMode) {
                const t = await warehouseConfigService.mintDevToken('admin');
                setToken(t);
              }
              await warehouseConfigService.createWarehouse(whForm);
              setOpenWh(false);
              setWhForm({ warehouse_code: '', warehouse_name: '', company_name: '' });
              await loadWarehouses();
              setSuccessMsg('Depozit creat');
            } catch (e) { setError((e as Error).message); }
          }}>Creaza</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Add Zone */}
      <Dialog open={openZone} onClose={() => setOpenZone(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Adauga Zona</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <FormControl fullWidth>
              <InputLabel>Depozit</InputLabel>
              <Select
                label="Depozit"
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value as string)}
              >
                {warehouses.map(w => (
                  <MenuItem key={w.id} value={String(w.id)}>{w.name || w.warehouse_name || w.id}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="Cod Zona" value={zoneForm.zone_code} onChange={(e) => setZoneForm({ ...zoneForm, zone_code: e.target.value })} required />
            <TextField label="Nume Zona" value={zoneForm.zone_name} onChange={(e) => setZoneForm({ ...zoneForm, zone_name: e.target.value })} required />
            <FormControl fullWidth>
              <InputLabel>Tip Zona</InputLabel>
              <Select label="Tip Zona" value={zoneForm.zone_type} onChange={(e) => setZoneForm({ ...zoneForm, zone_type: e.target.value as typeof zoneForm.zone_type })}>
                {['RECEIVING','QC','STORAGE','PICKING','PACKING','SHIPPING','RETURNS','QUARANTINE','PRODUCTION','STAGING'].map(t => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenZone(false)}>Anuleaza</Button>
          <Button variant="contained" onClick={async () => {
            try {
              if (!selectedWarehouseId) return;
              if (!token && testMode) {
                const t = await warehouseConfigService.mintDevToken('admin');
                setToken(t);
              }
              await warehouseConfigService.createZone({
                warehouse_id: selectedWarehouseId,
                zone_code: zoneForm.zone_code,
                zone_name: zoneForm.zone_name,
                zone_type: zoneForm.zone_type,
              });
              setOpenZone(false);
              await loadZones(selectedWarehouseId);
            } catch (e) { setError((e as Error).message); }
          }}>Creaza</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Bulk Locations */}
      <Dialog open={openBulk} onClose={() => setOpenBulk(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Generare Locatii in Masa</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <FormControl fullWidth>
                <InputLabel>Tip Locatie</InputLabel>
                <Select label="Tip Locatie" value={bulkForm.location_type_id} onChange={(e) => setBulkForm({ ...bulkForm, location_type_id: e.target.value as string })}>
                  {locationTypes.map(lt => (
                    <MenuItem key={lt.id} value={lt.id}>{lt.code} — {lt.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button onClick={() => setOpenAddType(true)}>Adauga Tip</Button>
            </Stack>
            <TextField label="Prefix Zona" value={bulkForm.zone_prefix} onChange={(e) => setBulkForm({ ...bulkForm, zone_prefix: e.target.value })} />
            <TextField label="Culoar Start" value={bulkForm.aisle_start} onChange={(e) => setBulkForm({ ...bulkForm, aisle_start: e.target.value })} />
            <TextField label="Culoar End" value={bulkForm.aisle_end} onChange={(e) => setBulkForm({ ...bulkForm, aisle_end: e.target.value })} />
            <TextField label="Raft Start" type="number" value={bulkForm.rack_start} onChange={(e) => setBulkForm({ ...bulkForm, rack_start: parseInt(e.target.value) || 1 })} />
            <TextField label="Raft End" type="number" value={bulkForm.rack_end} onChange={(e) => setBulkForm({ ...bulkForm, rack_end: parseInt(e.target.value) || 1 })} />
            <TextField label="Niveluri Rafturi (virgula)" value={bulkForm.shelf_levels} onChange={(e) => setBulkForm({ ...bulkForm, shelf_levels: e.target.value })} />
            <TextField label="Cutii per Raft" type="number" value={bulkForm.bins_per_shelf} onChange={(e) => setBulkForm({ ...bulkForm, bins_per_shelf: parseInt(e.target.value) || 1 })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenBulk(false)}>Anuleaza</Button>
          <Button variant="contained" onClick={async () => {
            try {
              if (!selectedWarehouseId || !selectedZoneId) { setError('Selecteaza depozit si zona mai intai'); return; }
              if (!token && testMode) {
                const t = await warehouseConfigService.mintDevToken('admin');
                setToken(t);
              }
              await warehouseConfigService.bulkCreateLocations({
                warehouse_id: selectedWarehouseId,
                zone_id: selectedZoneId,
                location_type_id: bulkForm.location_type_id,
                naming_pattern: {
                  zone_prefix: bulkForm.zone_prefix,
                  aisle_start: bulkForm.aisle_start,
                  aisle_end: bulkForm.aisle_end,
                  rack_start: bulkForm.rack_start,
                  rack_end: bulkForm.rack_end,
                  shelf_levels: bulkForm.shelf_levels.split(',').map(s => s.trim()).filter(Boolean),
                  bins_per_shelf: bulkForm.bins_per_shelf,
                },
              });
              setOpenBulk(false);
              // optionally reload locations list here
            } catch (e) { setError((e as Error).message); }
          }}>Genereaza</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Add Location Type */}
      <Dialog open={openAddType} onClose={() => setOpenAddType(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Adauga Tip Locatie</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label="Cod Tip" value={newTypeForm.code} onChange={(e) => setNewTypeForm({ ...newTypeForm, code: e.target.value })} required />
            <TextField label="Nume Tip" value={newTypeForm.name} onChange={(e) => setNewTypeForm({ ...newTypeForm, name: e.target.value })} required />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddType(false)}>Anuleaza</Button>
          <Button variant="contained" onClick={async () => {
            try {
              await warehouseConfigService.createLocationType(newTypeForm);
              setOpenAddType(false);
              setNewTypeForm({ code: '', name: '' });
              await loadLocationTypes();
            } catch (e) { setError((e as Error).message); }
          }}>Creaza</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Edit Warehouse */}
      <Dialog open={openEditWh} onClose={() => setOpenEditWh(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Editeaza Depozit</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label="Nume" value={whForm.warehouse_name} onChange={(e) => setWhForm({ ...whForm, warehouse_name: e.target.value })} />
            <TextField label="Nume Companie" value={whForm.company_name} onChange={(e) => setWhForm({ ...whForm, company_name: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditWh(false)}>Anuleaza</Button>
          <Button variant="contained" onClick={async () => {
            try {
              if (!selectedWarehouseId) return;
              await warehouseConfigService.updateWarehouse(selectedWarehouseId, { warehouse_name: whForm.warehouse_name });
              setOpenEditWh(false);
              await loadWarehouses();
              setSuccessMsg('Depozit actualizat');
            } catch (e) { setError((e as Error).message); }
          }}>Salveaza</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: View Warehouse Details */}
      <Dialog open={openViewWarehouse} onClose={() => setOpenViewWarehouse(false)} maxWidth="md" fullWidth>
        <DialogTitle>Detalii Depozit</DialogTitle>
        <DialogContent>
          {selectedWarehouse && (
            <Stack spacing={3} mt={2}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Cod Depozit</Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {(selectedWarehouse as WarehouseItem & { warehouse_code?: string }).warehouse_code || '-'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Nume Depozit</Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {selectedWarehouse.warehouse_name || selectedWarehouse.name || '-'}
                  </Typography>
                </Box>
                <Box sx={{ gridColumn: '1 / -1' }}>
                  <Typography variant="subtitle2" color="text.secondary">Adresa</Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {(selectedWarehouse as WarehouseItem & { address?: string }).address || '-'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">ID</Typography>
                  <Typography variant="body1" fontWeight="medium">{selectedWarehouse.id}</Typography>
                </Box>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenViewWarehouse(false)}>Inchide</Button>
          <Button 
            variant="contained" 
            color="primary"
            startIcon={<EditIcon />}
            onClick={() => {
              setOpenViewWarehouse(false);
              setOpenEditWh(true);
            }}
          >
            Modifica
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: View Zone Details */}
      <Dialog open={openViewZone} onClose={() => setOpenViewZone(false)} maxWidth="md" fullWidth>
        <DialogTitle>Detalii Zona</DialogTitle>
        <DialogContent>
          {selectedZone && (
            <Stack spacing={3} mt={2}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Cod Zona</Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {(selectedZone as ZoneItem & { zone_code?: string }).zone_code || selectedZone.code || '-'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Nume Zona</Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {selectedZone.zone_name || selectedZone.name || '-'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Tip Zona</Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {(selectedZone as ZoneItem & { zone_type?: string }).zone_type || '-'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">ID Depozit</Typography>
                  <Typography variant="body1" fontWeight="medium">{selectedZone.warehouse_id || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">ID Zona</Typography>
                  <Typography variant="body1" fontWeight="medium">{selectedZone.id}</Typography>
                </Box>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenViewZone(false)}>Inchide</Button>
          <Button 
            variant="contained" 
            color="primary"
            startIcon={<EditIcon />}
            onClick={() => {
              setOpenViewZone(false);
              setOpenEditZone(true);
            }}
          >
            Modifica
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: View Location Details */}
      <Dialog open={openViewLocation} onClose={() => setOpenViewLocation(false)} maxWidth="md" fullWidth>
        <DialogTitle>Detalii Locatie</DialogTitle>
        <DialogContent>
          {selectedLocation && (
            <Stack spacing={3} mt={2}>
              {/* QR Code Section */}
              {locationQRUrl && (
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
                  <img src={locationQRUrl} alt="QR Code" style={{ maxWidth: '300px', height: 'auto' }} />
                  <Typography variant="caption" display="block" mt={1}>
                    Cod QR: {selectedLocation.location_code}
                  </Typography>
                </Box>
              )}
              
              {/* Location Details */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Cod Locatie</Typography>
                  <Typography variant="body1" fontWeight="medium">{selectedLocation.location_code || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Tip Locatie</Typography>
                  <Typography variant="body1" fontWeight="medium">{selectedLocation.type_name || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Culoar</Typography>
                  <Typography variant="body1" fontWeight="medium">{selectedLocation.aisle || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Raft</Typography>
                  <Typography variant="body1" fontWeight="medium">{selectedLocation.rack || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Nivel</Typography>
                  <Typography variant="body1" fontWeight="medium">{selectedLocation.shelf_level ?? '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">Pozitie Cutie</Typography>
                  <Typography variant="body1" fontWeight="medium">{selectedLocation.bin_position || '-'}</Typography>
                </Box>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenViewLocation(false)}>Inchide</Button>
          <Button 
            variant="contained" 
            color="primary"
            startIcon={<EditIcon />}
            onClick={() => {
              setOpenViewLocation(false);
              if (selectedLocation) handleEditLocation(selectedLocation);
            }}
          >
            Modifica
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Edit Location */}
      <Dialog open={openEditLocation} onClose={() => setOpenEditLocation(false)} maxWidth="md" fullWidth>
        <DialogTitle>Modifica Locatie</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={2}>
            <TextField 
              label="Cod Locatie" 
              value={locationEditForm.location_code} 
              onChange={(e) => setLocationEditForm({ ...locationEditForm, location_code: e.target.value })}
              required
              fullWidth
            />
            
            <Stack direction="row" spacing={2}>
              <TextField 
                label="Culoar" 
                value={locationEditForm.aisle} 
                onChange={(e) => setLocationEditForm({ ...locationEditForm, aisle: e.target.value })}
                fullWidth
              />
              <TextField 
                label="Raft" 
                value={locationEditForm.rack} 
                onChange={(e) => setLocationEditForm({ ...locationEditForm, rack: e.target.value })}
                fullWidth
              />
            </Stack>

            <Stack direction="row" spacing={2}>
              <TextField 
                label="Nivel" 
                type="number"
                value={locationEditForm.shelf_level} 
                onChange={(e) => setLocationEditForm({ ...locationEditForm, shelf_level: parseInt(e.target.value) || 1 })}
                fullWidth
              />
              <TextField 
                label="Pozitie Cutie" 
                value={locationEditForm.bin_position} 
                onChange={(e) => setLocationEditForm({ ...locationEditForm, bin_position: e.target.value })}
                fullWidth
              />
            </Stack>

            <FormControl fullWidth>
              <InputLabel>Tip Locatie</InputLabel>
              <Select 
                label="Tip Locatie"
                value={locationEditForm.location_type_id} 
                onChange={(e) => setLocationEditForm({ ...locationEditForm, location_type_id: e.target.value as string })}
              >
                {locationTypes.map(lt => (
                  <MenuItem key={lt.id} value={lt.id}>{lt.code} — {lt.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select 
                label="Status"
                value={locationEditForm.status} 
                onChange={(e) => setLocationEditForm({ ...locationEditForm, status: e.target.value as 'AVAILABLE' })}
              >
                <MenuItem value="AVAILABLE">Disponibil</MenuItem>
                <MenuItem value="OCCUPIED">Ocupat</MenuItem>
                <MenuItem value="BLOCKED">Blocat</MenuItem>
                <MenuItem value="MAINTENANCE">Mentenanta</MenuItem>
                <MenuItem value="RESERVED">Rezervat</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditLocation(false)}>Anuleaza</Button>
          <Button 
            variant="contained" 
            color="primary"
            onClick={handleSaveLocation}
          >
            Salveaza
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Edit Zone */}
      <Dialog open={openEditZone} onClose={() => setOpenEditZone(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Editeaza Zona</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label="Nume Zona" value={zoneForm.zone_name} onChange={(e) => setZoneForm({ ...zoneForm, zone_name: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditZone(false)}>Anuleaza</Button>
          <Button variant="contained" onClick={async () => {
            try {
              if (!selectedZoneId) return;
              await warehouseConfigService.updateZone(selectedZoneId, { zone_name: zoneForm.zone_name });
              setOpenEditZone(false);
              await loadZones(selectedWarehouseId);
              setSuccessMsg('Zona actualizata');
            } catch (e) { setError((e as Error).message); }
          }}>Salveaza</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!error}
        autoHideDuration={4000}
        onClose={() => setError(null)}
        message={error || ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      />
      <Snackbar
        open={!!successMsg}
        autoHideDuration={2500}
        onClose={() => setSuccessMsg(null)}
        message={successMsg || ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        ContentProps={{ style: { backgroundColor: '#2e7d32' } }}
      />
    </Box>
  );
}

export default WarehouseConfigPage;
