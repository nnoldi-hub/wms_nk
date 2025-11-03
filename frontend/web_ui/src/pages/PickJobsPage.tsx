import { useEffect, useState } from 'react';
import { Box, Button, Snackbar, Alert, Tooltip, IconButton, ToggleButtonGroup, ToggleButton, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import { DataGrid, type GridColDef, type GridPaginationModel, type GridRowsProp } from '@mui/x-data-grid';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import QrCodeIcon from '@mui/icons-material/QrCode';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { pickingService, type PickJob } from '../services/picking.service';
import { PickJobDetailsDialog } from '../components/PickJobDetailsDialog';

export const PickJobsPage = () => {
  const [rows, setRows] = useState<GridRowsProp>([]);
  const [loading, setLoading] = useState(false);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });
  const [rowCount, setRowCount] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [filter, setFilter] = useState<'all' | 'mine' | 'new'>('all');
  const [openDetails, setOpenDetails] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [openMyItems, setOpenMyItems] = useState(false);
  const [myItems, setMyItems] = useState<Array<{ id: string; job_id: string; job_number: string; product_sku: string; lot_label?: string; uom?: string; requested_qty: number; picked_qty: number; status: string; assigned_to?: string | null }>>([]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const resp = await pickingService.list({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
        mine: filter === 'mine',
        status: filter === 'new' ? 'NEW' : undefined,
      });
      const data: PickJob[] = resp.data || [];
      setRows(data.map(j => ({ ...j, id: j.id })));
      if (typeof resp.pagination?.total === 'number') setRowCount(resp.pagination.total);
    } catch {
      setSnackbar({ open: true, message: 'Nu am putut încărca joburile', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadMyItems = async () => {
    try {
      const res = await pickingService.listMyItems({ limit: 100 });
      setMyItems(res.data || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginationModel.page, paginationModel.pageSize, filter]);

  const handleAccept = async (id: string) => {
    try {
      await pickingService.accept(id);
      setSnackbar({ open: true, message: 'Job acceptat', severity: 'success' });
      fetchJobs();
    } catch {
      setSnackbar({ open: true, message: 'Eroare la acceptare', severity: 'error' });
    }
  };

  const handleComplete = async (id: string) => {
    if (!confirm('Finalizezi jobul?')) return;
    try {
      await pickingService.complete(id);
      setSnackbar({ open: true, message: 'Job finalizat', severity: 'success' });
      fetchJobs();
    } catch {
      setSnackbar({ open: true, message: 'Eroare la finalizare', severity: 'error' });
    }
  };

  const columns: GridColDef[] = [
    { field: 'number', headerName: 'Job', width: 140 },
    { field: 'order_id', headerName: 'Comanda', width: 140 },
    { field: 'status', headerName: 'Status', width: 140 },
    { field: 'assigned_to', headerName: 'Asignat', width: 180 },
    { field: 'created_at', headerName: 'Creat', width: 180 },
    { field: 'started_at', headerName: 'Start', width: 180 },
    { field: 'completed_at', headerName: 'Finalizat', width: 180 },
    {
      field: 'actions', headerName: 'Acțiuni', width: 220, sortable: false, renderCell: (params) => (
        <Box>
          <Tooltip title="Detalii">
            <IconButton size="small" onClick={() => { setSelectedJobId(params.row.id as string); setOpenDetails(true); }}>
              <VisibilityIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Etichete">
            <IconButton size="small" onClick={() => pickingService.openLabels(params.row.id as string)}>
              <QrCode2Icon />
            </IconButton>
          </Tooltip>
            <Tooltip title="Etichete (rezervări)">
              <IconButton size="small" onClick={() => pickingService.openReservedLabels(params.row.id as string)}>
                <QrCodeIcon />
              </IconButton>
            </Tooltip>
          <Tooltip title="Acceptă">
            <span>
              <IconButton size="small" onClick={() => handleAccept(params.row.id as string)} disabled={params.row.status !== 'NEW'}>
                <PersonAddAlt1Icon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Finalizează">
            <span>
              <IconButton size="small" onClick={() => handleComplete(params.row.id as string)} disabled={params.row.status === 'COMPLETED'}>
                <CheckCircleIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Pick Jobs</Typography>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v) => v && setFilter(v)}>
          <ToggleButton value="all">Toate</ToggleButton>
          <ToggleButton value="mine">Ale mele</ToggleButton>
          <ToggleButton value="new">Noi</ToggleButton>
        </ToggleButtonGroup>
        <Box display="flex" gap={1}>
          <Button variant="outlined" onClick={fetchJobs}>Reîncarcă</Button>
          <Button variant="outlined" onClick={() => { setOpenMyItems(true); loadMyItems(); }}>Liniile mele</Button>
        </Box>
      </Box>

      <Box sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 25, 50, 100]}
          rowCount={rowCount}
          paginationMode="server"
          disableRowSelectionOnClick
        />
      </Box>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
      <PickJobDetailsDialog open={openDetails} jobId={selectedJobId} onClose={() => setOpenDetails(false)} onChanged={fetchJobs} />

      <Dialog open={openMyItems} onClose={() => setOpenMyItems(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Liniile mele</DialogTitle>
        <DialogContent>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Job</TableCell>
                <TableCell>SKU</TableCell>
                <TableCell>Lot</TableCell>
                <TableCell>UM</TableCell>
                <TableCell align="right">Solicitat</TableCell>
                <TableCell align="right">Cules</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {myItems.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{it.job_number}</TableCell>
                  <TableCell>{it.product_sku}</TableCell>
                  <TableCell>{it.lot_label || ''}</TableCell>
                  <TableCell>{it.uom || ''}</TableCell>
                  <TableCell align="right">{it.requested_qty}</TableCell>
                  <TableCell align="right">{it.picked_qty}</TableCell>
                  <TableCell>{it.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => loadMyItems()}>Reîncarcă</Button>
          <Button variant="contained" onClick={() => setOpenMyItems(false)}>Închide</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PickJobsPage;
