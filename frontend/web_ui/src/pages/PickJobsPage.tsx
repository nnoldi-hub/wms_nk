import { useEffect, useState } from 'react';
import {
  Box, Button, Snackbar, Alert, Tooltip, IconButton,
  ToggleButtonGroup, ToggleButton, Typography,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableHead, TableRow, TableCell, TableBody,
  TextField, Chip, Stack,
} from '@mui/material';
import { DataGrid, type GridColDef, type GridPaginationModel, type GridRowsProp } from '@mui/x-data-grid';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import QrCodeIcon from '@mui/icons-material/QrCode';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { pickingService, type PickJob } from '../services/picking.service';
import { PickJobDetailsDialog } from '../components/PickJobDetailsDialog';

const STATUS_COLORS: Record<string, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  NEW: 'warning',
  ACCEPTED: 'info',
  PICKING: 'info',
  COMPLETED: 'success',
  DISPATCHED: 'default',
  CANCELLED: 'error',
};

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
  const [myItems, setMyItems] = useState<Array<{
    id: string; job_id: string; job_number: string; product_sku: string;
    lot_label?: string; uom?: string; requested_qty: number; picked_qty: number;
    status: string; assigned_to?: string | null;
  }>>([]);

  // Reassign state
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignJobId, setReassignJobId] = useState<string | null>(null);
  const [reassignJobNumber, setReassignJobNumber] = useState('');
  const [reassignTarget, setReassignTarget] = useState('');
  const [reassigning, setReassigning] = useState(false);

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
      setSnackbar({ open: true, message: 'Nu am putut incarca joburile', severity: 'error' });
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
    void fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginationModel.page, paginationModel.pageSize, filter]);

  const handleAccept = async (id: string) => {
    try {
      await pickingService.accept(id);
      setSnackbar({ open: true, message: 'Job acceptat', severity: 'success' });
      void fetchJobs();
    } catch {
      setSnackbar({ open: true, message: 'Eroare la acceptare', severity: 'error' });
    }
  };

  const handleComplete = async (id: string) => {
    if (!confirm('Finalizeaza jobul?')) return;
    try {
      await pickingService.complete(id);
      setSnackbar({ open: true, message: 'Job finalizat', severity: 'success' });
      void fetchJobs();
    } catch {
      setSnackbar({ open: true, message: 'Eroare la finalizare', severity: 'error' });
    }
  };

  const handleMoveToShipping = async (id: string) => {
    if (!confirm('Muta in zona expediere si seteaza comanda READY_FOR_LOADING?')) return;
    try {
      await pickingService.moveToShipping(id);
      setSnackbar({ open: true, message: 'Mutat in zona expediere', severity: 'success' });
      void fetchJobs();
    } catch {
      setSnackbar({ open: true, message: 'Eroare la mutare expediere', severity: 'error' });
    }
  };

  const openReassignDialog = (id: string, number: string) => {
    setReassignJobId(id);
    setReassignJobNumber(number);
    setReassignTarget('');
    setReassignOpen(true);
  };

  const handleReassign = async () => {
    if (!reassignJobId || !reassignTarget.trim()) return;
    setReassigning(true);
    try {
      await pickingService.reassign(reassignJobId, reassignTarget.trim());
      setSnackbar({ open: true, message: `Job reasignat catre ${reassignTarget}`, severity: 'success' });
      setReassignOpen(false);
      void fetchJobs();
    } catch {
      setSnackbar({ open: true, message: 'Eroare la reasignare', severity: 'error' });
    } finally {
      setReassigning(false);
    }
  };

  const columns: GridColDef[] = [
    { field: 'number', headerName: 'Job', width: 140 },
    { field: 'order_id', headerName: 'Comanda', width: 140 },
    {
      field: 'status', headerName: 'Status', width: 130,
      renderCell: (p) => <Chip size="small" label={String(p.value ?? '')} color={STATUS_COLORS[String(p.value ?? '')] ?? 'default'} />,
    },
    { field: 'assigned_to', headerName: 'Asignat', width: 160 },
    { field: 'created_at', headerName: 'Creat', width: 150,
      valueFormatter: (v) => v ? new Date(v as string).toLocaleDateString('ro-RO') : '—' },
    { field: 'started_at', headerName: 'Start', width: 140,
      valueFormatter: (v) => v ? new Date(v as string).toLocaleString('ro-RO') : '—' },
    { field: 'completed_at', headerName: 'Finalizat', width: 150,
      valueFormatter: (v) => v ? new Date(v as string).toLocaleString('ro-RO') : '—' },
    {
      field: 'actions', headerName: 'Actiuni', width: 290, sortable: false,
      renderCell: (params) => (
        <Box>
          <Tooltip title="Detalii">
            <IconButton size="small" onClick={() => { setSelectedJobId(params.row.id as string); setOpenDetails(true); }}>
              <VisibilityIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Etichete picked">
            <IconButton size="small" onClick={() => void pickingService.openLabels(params.row.id as string)}>
              <QrCode2Icon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Etichete rezervari">
            <IconButton size="small" onClick={() => void pickingService.openReservedLabels(params.row.id as string)}>
              <QrCodeIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Accepta job">
            <span>
              <IconButton size="small"
                onClick={() => void handleAccept(params.row.id as string)}
                disabled={params.row.status !== 'NEW'}>
                <PersonAddAlt1Icon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Reasigneaza lucrator (supervisor)">
            <span>
              <IconButton size="small"
                onClick={() => openReassignDialog(params.row.id as string, params.row.number as string)}
                disabled={['COMPLETED', 'CANCELLED'].includes(params.row.status as string)}>
                <SwapHorizIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Finalizeaza">
            <span>
              <IconButton size="small"
                onClick={() => void handleComplete(params.row.id as string)}
                disabled={params.row.status === 'COMPLETED'}>
                <CheckCircleIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Muta in zona expediere (READY_FOR_LOADING)">
            <span>
              <IconButton size="small" color="warning"
                onClick={() => void handleMoveToShipping(params.row.id as string)}
                disabled={params.row.status !== 'COMPLETED'}>
                <LocalShippingIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>Joburi Picking</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => void fetchJobs()}>Reincarca</Button>
          <Button variant="outlined" onClick={() => { setOpenMyItems(true); void loadMyItems(); }}>Liniile mele</Button>
        </Stack>
      </Stack>

      <Box mb={2}>
        <ToggleButtonGroup size="small" exclusive value={filter}
          onChange={(_, v: 'all' | 'mine' | 'new') => v && setFilter(v)}>
          <ToggleButton value="all">Toate</ToggleButton>
          <ToggleButton value="mine">Ale mele</ToggleButton>
          <ToggleButton value="new">Noi</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ height: 580, width: '100%' }}>
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

      <PickJobDetailsDialog open={openDetails} jobId={selectedJobId}
        onClose={() => setOpenDetails(false)} onChanged={() => void fetchJobs()} />

      {/* Liniile mele dialog */}
      <Dialog open={openMyItems} onClose={() => setOpenMyItems(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Liniile mele de picking</DialogTitle>
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
                  <TableCell>{it.lot_label ?? ''}</TableCell>
                  <TableCell>{it.uom ?? ''}</TableCell>
                  <TableCell align="right">{it.requested_qty}</TableCell>
                  <TableCell align="right">{it.picked_qty}</TableCell>
                  <TableCell><Chip size="small" label={it.status} color={STATUS_COLORS[it.status] ?? 'default'} /></TableCell>
                </TableRow>
              ))}
              {myItems.length === 0 && (
                <TableRow><TableCell colSpan={7} align="center">Nu ai linii asignate</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => void loadMyItems()}>Reincarca</Button>
          <Button variant="contained" onClick={() => setOpenMyItems(false)}>Inchide</Button>
        </DialogActions>
      </Dialog>

      {/* Reasignare lucrator dialog */}
      <Dialog open={reassignOpen} onClose={() => setReassignOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <SwapHorizIcon color="primary" />
            <span>Reasigneaza Job {reassignJobNumber}</span>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Introduceti username-ul sau email-ul lucratorului caruia ii atribuiti jobul.
            Toate liniile nefinalizate vor fi reasignate automat.
          </Alert>
          <TextField
            label="Lucrator (username / email)"
            fullWidth
            value={reassignTarget}
            onChange={e => setReassignTarget(e.target.value)}
            autoFocus
            onKeyDown={e => e.key === 'Enter' && void handleReassign()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReassignOpen(false)}>Anuleaza</Button>
          <Button
            variant="contained"
            startIcon={<SwapHorizIcon />}
            onClick={() => void handleReassign()}
            disabled={!reassignTarget.trim() || reassigning}
          >
            {reassigning ? 'Se reasigneaza...' : 'Reasigneaza'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PickJobsPage;