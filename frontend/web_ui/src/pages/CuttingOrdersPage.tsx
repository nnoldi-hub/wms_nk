import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  IconButton,
  Alert,
  Snackbar,
  Chip,
  Autocomplete,
} from '@mui/material';
import { DataGrid, type GridColDef, type GridRowsProp } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { cuttingService, type CuttingOrder, type CreateCuttingOrderDto, type UpdateCuttingOrderDto } from '../services/cutting.service';
import { productsService, type Product } from '../services/products.service';

export const CuttingOrdersPage = () => {
  const [orders, setOrders] = useState<GridRowsProp>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingOrder, setEditingOrder] = useState<CuttingOrder | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const [formData, setFormData] = useState<CreateCuttingOrderDto>({
    product_sku: '',
    quantity: 0,
    pattern_id: '',
    priority: 'NORMAL',
    notes: '',
  });

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await cuttingService.getAll(statusFilter);
      setOrders(data.map(o => ({ ...o, id: o.id })));
    } catch {
      showSnackbar('Failed to load orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
  const data = await productsService.getAll(undefined, undefined, 2000);
      setProducts(data);
    } catch {
      showSnackbar('Failed to load products', 'error');
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleOpenDialog = (order?: CuttingOrder) => {
    if (order) {
      setEditingOrder(order);
      setFormData({
        product_sku: order.product_sku,
        quantity: order.quantity,
        pattern_id: order.pattern_id || '',
        priority: order.priority,
        notes: order.notes || '',
      });
    } else {
      setEditingOrder(null);
      setFormData({
        product_sku: '',
        quantity: 0,
        pattern_id: '',
        priority: 'NORMAL',
        notes: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingOrder(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingOrder) {
        const updateData: UpdateCuttingOrderDto = {
          notes: formData.notes,
        };
        await cuttingService.update(editingOrder.id, updateData);
        showSnackbar('Order updated successfully', 'success');
      } else {
        await cuttingService.create(formData);
        showSnackbar('Order created successfully', 'success');
      }
      handleCloseDialog();
      fetchOrders();
    } catch {
      showSnackbar('Operation failed', 'error');
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await cuttingService.complete(id);
      showSnackbar('Order completed successfully', 'success');
      fetchOrders();
    } catch {
      showSnackbar('Failed to complete order', 'error');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'warning';
      case 'IN_PROGRESS': return 'info';
      case 'COMPLETED': return 'success';
      case 'CANCELLED': return 'error';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'error';
      case 'HIGH': return 'warning';
      case 'NORMAL': return 'info';
      case 'LOW': return 'default';
      default: return 'default';
    }
  };

  const columns: GridColDef[] = [
    { field: 'order_number', headerName: 'Order Number', width: 180 },
    { field: 'product_sku', headerName: 'Product SKU', width: 150 },
    { field: 'quantity', headerName: 'Quantity', width: 100, type: 'number' },
    {
      field: 'status',
      headerName: 'Status',
      width: 140,
      renderCell: (params) => (
        <Chip label={params.value} color={getStatusColor(params.value)} size="small" />
      ),
    },
    {
      field: 'priority',
      headerName: 'Priority',
      width: 120,
      renderCell: (params) => (
        <Chip label={params.value} color={getPriorityColor(params.value)} size="small" />
      ),
    },
    { 
      field: 'source_batch_id', 
      headerName: 'Source Batch', 
      width: 150,
      valueGetter: (_value, row) => row.source_batch_id ? row.source_batch_id.substring(0, 8) + '...' : '-',
    },
    { 
      field: 'selection_method', 
      headerName: 'Selection', 
      width: 120,
      renderCell: (params) => params.value ? (
        <Chip label={params.value} size="small" variant="outlined" />
      ) : null,
    },
    {
      field: 'created_at',
      headerName: 'Created',
      width: 180,
      valueFormatter: (value) => new Date(value).toLocaleString(),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <IconButton size="small" onClick={() => handleOpenDialog(params.row as CuttingOrder)}>
            <EditIcon fontSize="small" />
          </IconButton>
          {params.row.status !== 'COMPLETED' && (
            <IconButton size="small" onClick={() => handleComplete(params.row.id)} color="success">
              <CheckCircleIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Cutting Orders
      </Typography>

      <Box display="flex" gap={2} mb={3}>
        <FormControl size="small" sx={{ width: 200 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} label="Status">
            <MenuItem value="">All Statuses</MenuItem>
            <MenuItem value="PENDING">Pending</MenuItem>
            <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
            <MenuItem value="COMPLETED">Completed</MenuItem>
            <MenuItem value="CANCELLED">Cancelled</MenuItem>
          </Select>
        </FormControl>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
          Create Order
        </Button>
      </Box>

      <Box sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={orders}
          columns={columns}
          loading={loading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
          }}
          disableRowSelectionOnClick
        />
      </Box>

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingOrder ? 'Edit Cutting Order' : 'Create Cutting Order'}</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <Autocomplete
              options={products}
              getOptionLabel={(option) => `${option.sku} - ${option.name}`}
              value={products.find(p => p.sku === formData.product_sku) || null}
              onChange={(_, newValue) => setFormData({ ...formData, product_sku: newValue?.sku || '' })}
              disabled={!!editingOrder}
              renderInput={(params) => <TextField {...params} label="Product" required />}
            />
            <TextField
              label="Quantity"
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
              required
              disabled={!!editingOrder}
              fullWidth
            />
            <TextField
              label="Pattern ID"
              value={formData.pattern_id}
              onChange={(e) => setFormData({ ...formData, pattern_id: e.target.value })}
              disabled={!!editingOrder}
              fullWidth
            />
            <FormControl fullWidth disabled={!!editingOrder}>
              <InputLabel>Priority</InputLabel>
              <Select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' })}
                label="Priority"
              >
                <MenuItem value="LOW">Low</MenuItem>
                <MenuItem value="NORMAL">Normal</MenuItem>
                <MenuItem value="HIGH">High</MenuItem>
                <MenuItem value="URGENT">Urgent</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Notes"
              multiline
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingOrder ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
