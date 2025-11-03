import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Chip,
  Card,
  CardContent,
  Link,
  TextField,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import RefreshIcon from '@mui/icons-material/Refresh';
import { transformationService, type Transformation, type TransformationStatistics } from '../services/transformation.service';
import { productsService } from '../services/products.service';
import { batchService } from '../services/batch.service';
import { locationsService, type Location } from '../services/locations.service';

export const TransformationsPage = () => {
  const [transformations, setTransformations] = useState<Transformation[]>([]);
  const [products, setProducts] = useState<Array<{ sku: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [statistics, setStatistics] = useState<TransformationStatistics | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [currentTr, setCurrentTr] = useState<Transformation | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [form, setForm] = useState({
    product_sku: '',
    unit_id: 'DRUM',
    quantity: 0,
    location_id: '',
    notes: '',
  });

  const fetchTransformations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await transformationService.getAll(typeFilter, productFilter);
      setTransformations(data);
    } catch (error) {
      console.error('Failed to load transformations:', error);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, productFilter]);

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
      const data = await transformationService.getStatistics();
      setStatistics(data);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  }, []);

  const fetchLocations = useCallback(async () => {
    try {
      const data = await locationsService.getAll('true');
      setLocations(data);
    } catch (error) {
      console.error('Failed to load locations:', error);
    }
  }, []);

  useEffect(() => {
    fetchTransformations();
    fetchProducts();
    fetchStatistics();
    fetchLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, productFilter]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'CUT': return 'info';
      case 'REPACK': return 'warning';
      case 'CONVERT': return 'secondary';
      case 'SPLIT': return 'primary';
      case 'MERGE': return 'success';
      default: return 'default';
    }
  };

  const columns: GridColDef[] = [
    { field: 'transformation_number', headerName: 'Transformation #', width: 180 },
    {
      field: 'transformation_type',
      headerName: 'Type',
      width: 120,
      renderCell: (params) => (
        <Chip 
          label={params.value} 
          color={getTypeColor(params.value)}
          size="small"
        />
      ),
    },
    {
      field: 'source_batch_number',
      headerName: 'Source Batch',
      width: 180,
      renderCell: (params) => (
        <Link href={`/batches?id=${params.row.source_batch_id}`} underline="hover">
          {params.value || params.row.source_batch_id}
        </Link>
      ),
    },
    { field: 'source_product_sku', headerName: 'Source Product', width: 150 },
    { 
      field: 'source_quantity_used', 
      headerName: 'Quantity Used', 
      width: 120, 
      type: 'number',
      valueFormatter: (value: number) => value ? value.toFixed(2) : '-',
    },
    {
      field: 'result_batch_number',
      headerName: 'Result Batch',
      width: 180,
      renderCell: (params) => params.value ? (
        <Link href={`/batches?id=${params.row.result_batch_id}`} underline="hover">
          {params.value}
        </Link>
      ) : (
        <Button size="small" variant="outlined" onClick={() => handleOpenCreate(params.row as Transformation)}>
          Create Result
        </Button>
      ),
    },
    { 
      field: 'result_quantity', 
      headerName: 'Result Quantity', 
      width: 120, 
      type: 'number',
      valueFormatter: (value: number) => value ? value.toFixed(2) : '-',
    },
    {
      field: 'waste_percent',
      headerName: 'Waste %',
      width: 100,
      type: 'number',
      valueFormatter: (value: number) => value ? `${value.toFixed(2)}%` : '-',
      renderCell: (params) => {
        const value = params.value;
        if (!value) return '-';
        const color = value > 50 ? 'error' : value > 20 ? 'warning' : 'success';
        return (
          <Chip 
            label={`${value.toFixed(1)}%`} 
            color={color}
            size="small"
          />
        );
      },
    },
    {
      field: 'created_at',
      headerName: 'Created At',
      width: 160,
      valueFormatter: (value) => value ? new Date(value).toLocaleString() : '-',
    },
  ];

  const handleOpenCreate = (tr: Transformation) => {
    setCurrentTr(tr);
    const dyn = tr as unknown as Record<string, unknown>;
    setForm({
      product_sku: (dyn.source_product_sku as string) || (dyn.source_product as string) || '',
      unit_id: 'DRUM',
      quantity: tr.result_quantity || 0,
      location_id: locations[0]?.id || '',
      notes: `Created from ${tr.transformation_number}`,
    });
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!currentTr) return;
    try {
      // 1) Create batch
      const created = await batchService.create({
        product_sku: form.product_sku,
        unit_id: form.unit_id,
        initial_quantity: form.quantity,
        current_quantity: form.quantity,
        location_id: form.location_id,
        notes: form.notes,
      });
      // 2) Link to transformation
      await transformationService.setResult(currentTr.id, created.id, form.quantity, form.notes);
      setCreateOpen(false);
      setCurrentTr(null);
      await fetchTransformations();
      await fetchStatistics();
    } catch (error) {
      console.error('Failed to create result batch:', error);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Transformations</Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => { fetchTransformations(); fetchStatistics(); }}
        >
          REFRESH
        </Button>
      </Box>

      {/* Statistics Cards */}
      {statistics && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Transformations
              </Typography>
              <Typography variant="h4">
                {statistics.total_transformations || 0}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Waste Quantity
              </Typography>
              <Typography variant="h4" color="error.main">
                {statistics.total_waste_quantity?.toFixed(2) || 0}
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Avg Waste %
              </Typography>
              <Typography variant="h4" color="warning.main">
                {statistics.average_waste_percent?.toFixed(1) || 0}%
              </Typography>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                By Type
              </Typography>
              <Box sx={{ mt: 1 }}>
                {statistics.by_type?.map((item) => (
                  <Chip
                    key={item.transformation_type}
                    label={`${item.transformation_type}: ${item.count}`}
                    color={getTypeColor(item.transformation_type)}
                    size="small"
                    sx={{ mr: 0.5, mb: 0.5 }}
                  />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={typeFilter}
            label="Type"
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {transformationService.getTypes().map((type) => (
              <MenuItem key={type} value={type}>{type}</MenuItem>
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
        rows={transformations}
        columns={columns}
        loading={loading}
        pageSizeOptions={[10, 25, 50]}
        initialState={{
          pagination: { paginationModel: { pageSize: 25 } },
        }}
        disableRowSelectionOnClick
        autoHeight
      />

      {/* Create Result Batch Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create Result Batch</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
            <TextField
              label="Product SKU"
              value={form.product_sku}
              onChange={(e) => setForm((f) => ({ ...f, product_sku: e.target.value }))}
            />
            <FormControl>
              <InputLabel>Unit</InputLabel>
              <Select
                label="Unit"
                value={form.unit_id}
                onChange={(e) => setForm((f) => ({ ...f, unit_id: e.target.value as string }))}
              >
                {['DRUM','ROLL','PALLET','BOX','METER','KG','PIECE'].map((u) => (
                  <MenuItem key={u} value={u}>{u}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Quantity"
              type="number"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
            />
            <FormControl>
              <InputLabel>Location</InputLabel>
              <Select
                label="Location"
                value={form.location_id}
                onChange={(e) => setForm((f) => ({ ...f, location_id: e.target.value as string }))}
              >
                {locations.map((l) => (
                  <MenuItem key={l.id} value={l.id}>{`${l.id} (${l.zone}-${l.rack}${l.position})`}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <TextField
            fullWidth
            multiline
            minRows={2}
            sx={{ mt: 2 }}
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!form.product_sku || !form.unit_id || !form.quantity}>
            Create & Link
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TransformationsPage;
