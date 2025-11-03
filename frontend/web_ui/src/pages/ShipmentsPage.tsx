import { useCallback, useEffect, useState } from 'react';
import { Box, Button, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import RefreshIcon from '@mui/icons-material/Refresh';
import { shipmentsService, type Shipment } from '../services/shipments.service';

export function ShipmentsPage() {
  const [rows, setRows] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await shipmentsService.getAll(status || undefined);
      setRows(data);
    } catch (e) {
      console.error('Failed to load shipments', e);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns: GridColDef[] = [
    { field: 'shipment_number', headerName: 'Shipment #', width: 180 },
    { field: 'status', headerName: 'Status', width: 120 },
    { field: 'carrier', headerName: 'Carrier', width: 140 },
    { field: 'tracking_number', headerName: 'Tracking #', width: 180 },
    { field: 'created_at', headerName: 'Created', width: 180, valueFormatter: (v) => v ? new Date(v as string).toLocaleString() : '-' },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4">Expedieri</Typography>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchData}>REFRESH</Button>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Status</InputLabel>
          <Select value={status} label="Status" onChange={(e) => setStatus(e.target.value)}>
            <MenuItem value="">Toate</MenuItem>
            {['PLANNED','READY','SHIPPED','DELIVERED','CANCELLED'].map((s) => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <DataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        pageSizeOptions={[10,25,50]}
        initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        disableRowSelectionOnClick
        autoHeight
      />
    </Box>
  );
}

export default ShipmentsPage;
