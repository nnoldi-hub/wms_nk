import { useState, useEffect, useCallback } from 'react';
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
  Chip,
  Tooltip,
  Card,
  CardContent,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import { batchService, type Batch, type CreateBatchDto, type UpdateBatchDto, type BatchStatistics } from '../services/batch.service';
import { productsService } from '../services/products.service';
import { CutSimulatorDialog } from '../components/CutSimulatorDialog';

export const BatchesPage = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [products, setProducts] = useState<Array<{ sku: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [openDetailsDialog, setOpenDetailsDialog] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [viewingBatch, setViewingBatch] = useState<Batch | null>(null);
  const [statistics, setStatistics] = useState<BatchStatistics | null>(null);
  const [openCutDialog, setOpenCutDialog] = useState(false);

  const [formData, setFormData] = useState<CreateBatchDto>({
    product_sku: '',
    unit_id: '',
    initial_quantity: 0,
    current_quantity: 0,
    status: 'INTACT',
    notes: '',
  });

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const data = await batchService.getAll(statusFilter, productFilter);
      setBatches(data);
    } catch (error) {
      console.error('Failed to load batches:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, productFilter]);

  const fetchProducts = useCallback(async () => {
    try {
      const data = await productsService.getAll(undefined, undefined, 2000);
      setProducts(data);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  }, []);

  const fetchStatistics = useCallback(async () => {
    try {
      const data = await batchService.getStatistics();
      setStatistics(data);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
    fetchProducts();
    fetchStatistics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, productFilter]);

  const handleOpenDialog = (batch?: Batch) => {
    if (batch) {
      setEditingBatch(batch);
      setFormData({
        product_sku: batch.product_sku,
        unit_id: batch.unit_id,
        initial_quantity: batch.initial_quantity,
        current_quantity: batch.current_quantity,
        length_meters: batch.length_meters,
        weight_kg: batch.weight_kg,
        status: batch.status,
        location_id: batch.location_id,
        notes: batch.notes || '',
      });
    } else {
      setEditingBatch(null);
      setFormData({
        product_sku: '',
        unit_id: '',
        initial_quantity: 0,
        current_quantity: 0,
        status: 'INTACT',
        notes: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingBatch(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingBatch) {
        const updateData: UpdateBatchDto = {
          current_quantity: formData.current_quantity,
          status: formData.status,
          location_id: formData.location_id,
          notes: formData.notes,
        };
        await batchService.update(editingBatch.id, updateData);
      } else {
        await batchService.create(formData);
      }
      fetchBatches();
      fetchStatistics();
      handleCloseDialog();
    } catch (error) {
      console.error('Failed to save batch:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this batch?')) {
      try {
        await batchService.delete(id);
        fetchBatches();
        fetchStatistics();
      } catch (error) {
        console.error('Failed to delete batch:', error);
      }
    }
  };

  const handleViewDetails = (batch: Batch) => {
    setViewingBatch(batch);
    setOpenDetailsDialog(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'INTACT': return 'success';
      case 'CUT': return 'info';
      case 'REPACKED': return 'warning';
      case 'EMPTY': return 'default';
      case 'DAMAGED': return 'error';
      case 'QUARANTINE': return 'error';
      default: return 'default';
    }
  };

  const columns: GridColDef[] = [
    { field: 'batch_number', headerName: 'Batch Number', width: 180 },
    { field: 'product_sku', headerName: 'Product SKU', width: 150 },
    { field: 'product_name', headerName: 'Product', width: 200 },
    { field: 'current_quantity', headerName: 'Quantity', width: 100, type: 'number' },
    { field: 'unit_code', headerName: 'Unit', width: 80 },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (params) => (
        <Chip 
          label={params.value} 
          color={getStatusColor(params.value)}
          size="small"
        />
      ),
    },
    { field: 'location_code', headerName: 'Location', width: 120 },
    {
      field: 'received_at',
      headerName: 'Received',
      width: 150,
      valueFormatter: (value) => value ? new Date(value).toLocaleDateString() : '-',
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <Tooltip title="View Details">
            <IconButton size="small" onClick={() => handleViewDetails(params.row)}>
              <VisibilityIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Simulează tăiere">
            <IconButton size="small" onClick={() => { setViewingBatch(params.row); setOpenCutDialog(true); }}>
              <ContentCutIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => handleOpenDialog(params.row)}>
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => handleDelete(params.row.id)}>
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Batches</Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => { fetchBatches(); fetchStatistics(); }}
            sx={{ mr: 1 }}
          >
            REFRESH
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            CREATE BATCH
          </Button>
        </Box>
      </Box>

      {/* Statistics Cards */}
      {statistics && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Batches
              </Typography>
              <Typography variant="h4">
                {statistics.total_batches || 0}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Intact Batches
              </Typography>
              <Typography variant="h4" color="success.main">
                {statistics.intact_batches || 0}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Cut Batches
              </Typography>
              <Typography variant="h4" color="info.main">
                {statistics.cut_batches || 0}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Empty Batches
              </Typography>
              <Typography variant="h4" color="text.secondary">
                {statistics.empty_batches || 0}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {batchService.getStatuses().map((status) => (
              <MenuItem key={status} value={status}>{status}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Product</InputLabel>
          <Select
            value={productFilter}
            label="Product"
            onChange={(e) => setProductFilter(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {products.map((product) => (
              <MenuItem key={product.sku} value={product.sku}>
                {product.sku} - {product.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* DataGrid */}
      <DataGrid
        rows={batches}
        columns={columns}
        loading={loading}
        pageSizeOptions={[10, 25, 50]}
        initialState={{
          pagination: { paginationModel: { pageSize: 25 } },
        }}
        disableRowSelectionOnClick
        autoHeight
      />

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingBatch ? 'Edit Batch' : 'Create Batch'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <FormControl fullWidth disabled={!!editingBatch}>
              <InputLabel>Product</InputLabel>
              <Select
                value={formData.product_sku}
                label="Product"
                onChange={(e) => setFormData({ ...formData, product_sku: e.target.value })}
              >
                {products.map((product) => (
                  <MenuItem key={product.sku} value={product.sku}>
                    {product.sku} - {product.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Unit ID"
              value={formData.unit_id}
              onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
              disabled={!!editingBatch}
              required
            />

            <TextField
              label="Initial Quantity"
              type="number"
              value={formData.initial_quantity}
              onChange={(e) => setFormData({ ...formData, initial_quantity: parseFloat(e.target.value) || 0 })}
              disabled={!!editingBatch}
              required
            />

            <TextField
              label="Current Quantity"
              type="number"
              value={formData.current_quantity}
              onChange={(e) => setFormData({ ...formData, current_quantity: parseFloat(e.target.value) || 0 })}
              required
            />

            <TextField
              label="Length (meters)"
              type="number"
              value={formData.length_meters || ''}
              onChange={(e) => setFormData({ ...formData, length_meters: parseFloat(e.target.value) || undefined })}
            />

            <TextField
              label="Weight (kg)"
              type="number"
              value={formData.weight_kg || ''}
              onChange={(e) => setFormData({ ...formData, weight_kg: parseFloat(e.target.value) || undefined })}
            />

            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={formData.status}
                label="Status"
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'INTACT' | 'CUT' | 'REPACKED' | 'EMPTY' | 'DAMAGED' | 'QUARANTINE' })}
              >
                {batchService.getStatuses().map((status) => (
                  <MenuItem key={status} value={status}>{status}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Location ID"
              value={formData.location_id || ''}
              onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
            />

            <TextField
              label="Notes"
              multiline
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingBatch ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={openDetailsDialog} onClose={() => setOpenDetailsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Batch Details</DialogTitle>
        <DialogContent>
          {viewingBatch && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2" color="textSecondary">Batch Number</Typography>
                  <Typography variant="body1">{viewingBatch.batch_number}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="textSecondary">Status</Typography>
                  <Chip label={viewingBatch.status} color={getStatusColor(viewingBatch.status)} size="small" />
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="textSecondary">Product</Typography>
                  <Typography variant="body1">{viewingBatch.product_sku} - {viewingBatch.product_name}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="textSecondary">Unit</Typography>
                  <Typography variant="body1">{viewingBatch.unit_code} ({viewingBatch.unit_name})</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="textSecondary">Initial Quantity</Typography>
                  <Typography variant="body1">{viewingBatch.initial_quantity}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="textSecondary">Current Quantity</Typography>
                  <Typography variant="body1">{viewingBatch.current_quantity}</Typography>
                </Box>
                {viewingBatch.length_meters && (
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">Length</Typography>
                    <Typography variant="body1">{viewingBatch.length_meters} meters</Typography>
                  </Box>
                )}
                {viewingBatch.weight_kg && (
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">Weight</Typography>
                    <Typography variant="body1">{viewingBatch.weight_kg} kg</Typography>
                  </Box>
                )}
                <Box>
                  <Typography variant="subtitle2" color="textSecondary">Location</Typography>
                  <Typography variant="body1">{viewingBatch.location_code || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="textSecondary">Received At</Typography>
                  <Typography variant="body1">
                    {viewingBatch.received_at ? new Date(viewingBatch.received_at).toLocaleString() : '-'}
                  </Typography>
                </Box>
                {viewingBatch.notes && (
                  <Box sx={{ gridColumn: 'span 2' }}>
                    <Typography variant="subtitle2" color="textSecondary">Notes</Typography>
                    <Typography variant="body1">{viewingBatch.notes}</Typography>
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDetailsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Cut Simulator Dialog */}
      {openCutDialog && viewingBatch && (
        <CutSimulatorDialog
          open={openCutDialog}
          onClose={() => setOpenCutDialog(false)}
          productSku={viewingBatch.product_sku}
          defaultBatchId={viewingBatch.id}
          defaultQuantity={viewingBatch.current_quantity}
          onSuccess={() => { fetchBatches(); fetchStatistics(); }}
        />
      )}
    </Box>
  );
};

export default BatchesPage;
