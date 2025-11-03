import { useState, useEffect } from 'react';
import { Box, Typography, Button, Snackbar, Alert, IconButton, Tooltip } from '@mui/material';
import { DataGrid, type GridColDef, type GridRowsProp, type GridPaginationModel } from '@mui/x-data-grid';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import PrintIcon from '@mui/icons-material/Print';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AddTaskIcon from '@mui/icons-material/AddTask';
import { ordersService, type Order } from '../services/orders.service';
import { OrderImportDialog } from '../components/OrderImportDialog';
import { OrderDetailsDialog } from '../components/OrderDetailsDialog';

export const OrdersPage = () => {
  const [rows, setRows] = useState<GridRowsProp>([]);
  const [loading, setLoading] = useState(false);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });
  const [rowCount, setRowCount] = useState(0);
  const [openImport, setOpenImport] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [openDetails, setOpenDetails] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const resp = await ordersService.list({ page: paginationModel.page + 1, limit: paginationModel.pageSize });
      const data: Order[] = resp.data;
      const mapped = data.map((o) => ({ ...o, id: o.id }));
      setRows(mapped);
      if (typeof resp.pagination?.total === 'number') setRowCount(resp.pagination.total);
    } catch {
      setSnackbar({ open: true, message: 'Failed to load orders', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginationModel.page, paginationModel.pageSize]);

  const handleImportSuccess = () => {
    setSnackbar({ open: true, message: 'Orders imported', severity: 'success' });
    // refresh
    fetchOrders();
  };

  const columns: GridColDef[] = [
    { field: 'number', headerName: 'CMD', width: 140 },
    { field: 'partner_name', headerName: 'Partner', width: 240 },
    { field: 'created_at', headerName: 'Created', width: 180 },
    { field: 'total_weight', headerName: 'Total Weight (kg)', width: 160, type: 'number' },
    { field: 'status', headerName: 'Status', width: 120 },
    {
      field: 'actions', headerName: 'Actions', width: 140, sortable: false, renderCell: (params) => (
        <Box>
          <Tooltip title="Generează job de culegere">
            <IconButton size="small" onClick={async () => {
              try {
                await ordersService.allocatePickingJob(params.row.id as string);
                setSnackbar({ open: true, message: 'Job de culegere generat', severity: 'success' });
              } catch {
                setSnackbar({ open: true, message: 'Eroare la generarea jobului', severity: 'error' });
              }
            }}>
              <AddTaskIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Vezi comanda">
            <IconButton size="small" onClick={() => { setSelectedOrderId(params.row.id); setOpenDetails(true); }}>
              <VisibilityIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Print pick note">
            <IconButton size="small" onClick={() => window.open(ordersService.getPickNoteUrl(params.row.id), '_blank')}>
              <PrintIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Sales Orders</Typography>

      <Box display="flex" gap={2} mb={2}>
        <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setOpenImport(true)}>Import CSV</Button>
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

  <OrderImportDialog open={openImport} onClose={() => setOpenImport(false)} onSuccess={handleImportSuccess} />
  <OrderDetailsDialog open={openDetails} orderId={selectedOrderId} onClose={() => setOpenDetails(false)} />

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default OrdersPage;
