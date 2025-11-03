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
  Tooltip,
} from '@mui/material';
import { DataGrid, type GridColDef, type GridRowsProp, type GridPaginationModel } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import PlaceIcon from '@mui/icons-material/Place';
import VisibilityIcon from '@mui/icons-material/Visibility';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { productsService, type Product, type CreateProductDto } from '../services/products.service';
import { LocationAssignmentDialog } from '../components/LocationAssignmentDialog';
import { ProductInventoryDialog } from '../components/ProductInventoryDialog';
import { ProductImportDialog } from '../components/ProductImportDialog';

export const ProductsPage = () => {
  const [products, setProducts] = useState<GridRowsProp>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  
  // Location assignment dialog state
  const [openLocationDialog, setOpenLocationDialog] = useState(false);
  const [selectedProductForLocation, setSelectedProductForLocation] = useState<{
    sku: string;
    name: string;
    uom: string;
  } | null>(null);

  // Import dialog state
  const [openImportDialog, setOpenImportDialog] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 25 });
  const [openInventoryDialog, setOpenInventoryDialog] = useState(false);

  const [formData, setFormData] = useState<CreateProductDto>({
    sku: '',
    name: '',
    description: '',
    uom: 'm',
    lot_control: false,
    weight_kg: undefined,
    length_cm: undefined,
    width_cm: undefined,
    height_cm: undefined,
  });

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Server-side pagination request
      const res = await productsService.list({
        search,
        category,
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
      });
      const items: Product[] = res.data || res; // fallback if backend returns only array
      const productsWithId = items.map((p: Product) => ({ ...p, id: p.sku }));
      setProducts(productsWithId);
      if (res.pagination?.total !== undefined) setRowCount(res.pagination.total);
    } catch {
      showSnackbar('Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await productsService.getCategories();
      setCategories(data);
    } catch {
      console.error('Failed to load categories');
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, paginationModel.page, paginationModel.pageSize]);

  // Reset to first page when filters change
  useEffect(() => {
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  }, [search, category]);

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleOpenDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        sku: product.sku,
        name: product.name,
        description: product.description || '',
        uom: product.uom,
        lot_control: product.lot_control,
        weight_kg: product.weight_kg,
        length_cm: product.length_cm,
        width_cm: product.width_cm,
        height_cm: product.height_cm,
      });
    } else {
      setEditingProduct(null);
      setFormData({
        sku: '',
        name: '',
        description: '',
        uom: 'm',
        lot_control: false,
        weight_kg: undefined,
        length_cm: undefined,
        width_cm: undefined,
        height_cm: undefined,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingProduct(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingProduct) {
        await productsService.update(editingProduct.sku, formData);
        showSnackbar('Product updated successfully', 'success');
        handleCloseDialog();
        fetchProducts();
      } else {
        await productsService.create(formData);
        showSnackbar('Product created successfully', 'success');
        handleCloseDialog();
        fetchProducts();
        
        // Open location assignment dialog after creating product
        setSelectedProductForLocation({
          sku: formData.sku,
          name: formData.name,
          uom: formData.uom || 'm',
        });
        setOpenLocationDialog(true);
      }
    } catch {
      showSnackbar('Operation failed', 'error');
    }
  };

  const handleDelete = async (sku: string) => {
    try {
      await productsService.delete(sku);
      showSnackbar('Product deleted successfully', 'success');
      setDeleteConfirm(null);
      fetchProducts();
    } catch {
      showSnackbar('Delete failed', 'error');
    }
  };

  const handleOpenLocationAssignment = (product: Product) => {
    setSelectedProductForLocation({
      sku: product.sku,
      name: product.name,
      uom: product.uom,
    });
    setOpenLocationDialog(true);
  };

  const handleLocationAssignmentSuccess = () => {
    showSnackbar('Product assigned to location successfully!', 'success');
    fetchProducts();
  };

  const columns: GridColDef[] = [
    { field: 'sku', headerName: 'SKU', width: 130 },
    { field: 'name', headerName: 'Name', width: 250 },
    { field: 'uom', headerName: 'Unit', width: 80 },
    { field: 'weight_kg', headerName: 'Weight (kg)', width: 120, type: 'number' },
    { field: 'total_quantity', headerName: 'Stock', width: 100, type: 'number' },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <Tooltip title="Vezi stoc pe locații">
            <IconButton
              size="small"
              onClick={() => { setSelectedProductForLocation({ sku: params.row.sku, name: params.row.name, uom: params.row.uom }); setOpenInventoryDialog(true); }}
              color="primary"
            >
              <VisibilityIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Assign Location">
            <IconButton
              size="small"
              onClick={() => handleOpenLocationAssignment(params.row)}
              color="primary"
            >
              <PlaceIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton
              size="small"
              onClick={() => handleOpenDialog(params.row)}
              color="primary"
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={() => setDeleteConfirm(params.row.sku)}
              color="error"
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Products Management
      </Typography>

      <Box display="flex" gap={2} mb={3}>
        <TextField
          placeholder="Search products..."
          variant="outlined"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
          sx={{ width: 300 }}
        />
        <FormControl size="small" sx={{ width: 200 }}>
          <InputLabel>Category</InputLabel>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} label="Category">
            <MenuItem value="">All Categories</MenuItem>
            {categories.map((cat) => (
              <MenuItem key={cat} value={cat}>
                {cat}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
          Add Product
        </Button>
        <Button
          variant="outlined"
          startIcon={<UploadFileIcon />}
          onClick={() => setOpenImportDialog(true)}
        >
          Import CSV/Excel
        </Button>
      </Box>

      <Box sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={products}
          columns={columns}
          loading={loading}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 25, 50, 100, 200]}
          rowCount={rowCount}
          paginationMode="server"
          disableRowSelectionOnClick
        />
      </Box>

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingProduct ? 'Edit Product' : 'Create Product'}</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="SKU"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              required
              disabled={!!editingProduct}
              fullWidth
            />
            <TextField
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Unit</InputLabel>
              <Select
                value={formData.uom}
                onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                label="Unit"
              >
                <MenuItem value="pcs">Pieces</MenuItem>
                <MenuItem value="kg">Kilograms</MenuItem>
                <MenuItem value="m">Meters</MenuItem>
                <MenuItem value="box">Box</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Weight (kg)"
              type="number"
              value={formData.weight_kg || ''}
              onChange={(e) => setFormData({ ...formData, weight_kg: e.target.value ? Number(e.target.value) : undefined })}
              fullWidth
            />
            <TextField
              label="Length (cm)"
              type="number"
              value={formData.length_cm || ''}
              onChange={(e) => setFormData({ ...formData, length_cm: e.target.value ? Number(e.target.value) : undefined })}
              fullWidth
            />
            <TextField
              label="Width (cm)"
              type="number"
              value={formData.width_cm || ''}
              onChange={(e) => setFormData({ ...formData, width_cm: e.target.value ? Number(e.target.value) : undefined })}
              fullWidth
            />
            <TextField
              label="Height (cm)"
              type="number"
              value={formData.height_cm || ''}
              onChange={(e) => setFormData({ ...formData, height_cm: e.target.value ? Number(e.target.value) : undefined })}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingProduct ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this product?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button onClick={() => deleteConfirm && handleDelete(deleteConfirm)} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
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

      {/* Location Assignment Dialog */}
      {selectedProductForLocation && (
        <LocationAssignmentDialog
          open={openLocationDialog}
          onClose={() => setOpenLocationDialog(false)}
          productSku={selectedProductForLocation.sku}
          productName={selectedProductForLocation.name}
          productUom={selectedProductForLocation.uom}
          onSuccess={handleLocationAssignmentSuccess}
        />
      )}

      {/* Product Import Dialog */}
      <ProductImportDialog
        open={openImportDialog}
        onClose={() => setOpenImportDialog(false)}
        onSuccess={() => {
          // Refresh list after successful import
          fetchProducts();
          setSnackbar({ open: true, message: 'Products imported successfully!', severity: 'success' });
        }}
      />

      {/* Product Inventory Dialog */}
      {selectedProductForLocation && (
        <ProductInventoryDialog
          open={openInventoryDialog}
          onClose={() => setOpenInventoryDialog(false)}
          productSku={selectedProductForLocation.sku}
          productName={selectedProductForLocation.name}
        />
      )}
    </Box>
  );
};
