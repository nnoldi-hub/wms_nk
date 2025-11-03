import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Autocomplete,
  IconButton,
  Tooltip
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import qcService, { type QCInspection, type CreateQCInspectionDto, type UpdateQCInspectionDto } from '../services/qc.service';
import { sewingService, type SewingOrder } from '../services/sewing.service';

const QCInspectionsPage: React.FC = () => {
  const [inspections, setInspections] = useState<QCInspection[]>([]);
  const [sewingOrders, setSewingOrders] = useState<SewingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingInspection, setEditingInspection] = useState<QCInspection | null>(null);
  const [formData, setFormData] = useState<CreateQCInspectionDto>({
    sewing_order_id: '',
    defects_found: 0,
    severity: 'NONE',
    inspection_notes: '',
    notes: ''
  });

  const fetchInspections = useCallback(async () => {
    try {
      setLoading(true);
      const data = await qcService.getAll(statusFilter || undefined);
      setInspections(data);
    } catch (error) {
      console.error('Error fetching inspections:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchSewingOrders = useCallback(async () => {
    try {
      const data = await sewingService.getAll();
      setSewingOrders(data);
    } catch (error) {
      console.error('Error fetching sewing orders:', error);
    }
  }, []);

  useEffect(() => {
    fetchInspections();
    fetchSewingOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);  const handleCreateOpen = () => {
    setEditingInspection(null);
    setFormData({
      sewing_order_id: '',
      defects_found: 0,
      severity: 'NONE',
      inspection_notes: '',
      notes: ''
    });
    setOpenDialog(true);
  };

  const handleEditOpen = (inspection: QCInspection) => {
    setEditingInspection(inspection);
    setFormData({
      sewing_order_id: inspection.sewing_order_id,
      defects_found: inspection.defects_found,
      severity: inspection.severity || 'NONE',
      inspection_notes: inspection.inspection_notes || '',
      notes: inspection.notes || ''
    });
    setOpenDialog(true);
  };

  const handleClose = () => {
    setOpenDialog(false);
    setEditingInspection(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingInspection) {
        const updateData: UpdateQCInspectionDto = {
          defects_found: formData.defects_found,
          severity: formData.severity,
          inspection_notes: formData.inspection_notes,
          notes: formData.notes
        };
        await qcService.update(editingInspection.id, updateData);
      } else {
        await qcService.create(formData);
      }
      fetchInspections();
      handleClose();
    } catch (error) {
      console.error('Error saving inspection:', error);
    }
  };

  const handlePass = async (id: string) => {
    try {
      await qcService.pass(id);
      fetchInspections();
    } catch (error) {
      console.error('Error passing inspection:', error);
    }
  };

  const handleFail = async (id: string) => {
    try {
      await qcService.fail(id);
      fetchInspections();
    } catch (error) {
      console.error('Error failing inspection:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'warning';
      case 'IN_PROGRESS': return 'info';
      case 'PASSED': return 'success';
      case 'FAILED': return 'error';
      case 'RECHECK': return 'warning';
      default: return 'default';
    }
  };

  const getSeverityColor = (severity: string | null) => {
    if (!severity) return 'default';
    switch (severity) {
      case 'NONE': return 'success';
      case 'MINOR': return 'info';
      case 'MAJOR': return 'warning';
      case 'CRITICAL': return 'error';
      default: return 'default';
    }
  };

  const columns: GridColDef[] = [
    { field: 'inspection_number', headerName: 'Inspection Number', width: 200 },
    { 
      field: 'sewing_order_id', 
      headerName: 'Sewing Order', 
      width: 200,
      valueGetter: (_value, row) => {
        const order = sewingOrders.find(o => o.id === row.sewing_order_id);
        return order?.order_number || row.sewing_order_id;
      }
    },
    { field: 'defects_found', headerName: 'Defects', width: 100 },
    {
      field: 'severity',
      headerName: 'Severity',
      width: 130,
      renderCell: (params) => (
        <Chip 
          label={params.value || 'NONE'} 
          color={getSeverityColor(params.value)}
          size="small"
        />
      )
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 150,
      renderCell: (params) => (
        <Chip 
          label={params.value} 
          color={getStatusColor(params.value)}
          size="small"
        />
      )
    },
    {
      field: 'created_at',
      headerName: 'Created',
      width: 180,
      valueFormatter: (value) => new Date(value).toLocaleString()
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 200,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => handleEditOpen(params.row)}>
              <EditIcon />
            </IconButton>
          </Tooltip>
          {params.row.status !== 'PASSED' && params.row.status !== 'FAILED' && (
            <>
              <Tooltip title="Pass">
                <IconButton 
                  size="small" 
                  color="success" 
                  onClick={() => handlePass(params.row.id)}
                >
                  <CheckCircleIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Fail">
                <IconButton 
                  size="small" 
                  color="error" 
                  onClick={() => handleFail(params.row.id)}
                >
                  <CancelIcon />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      )
    }
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">QC Inspections</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateOpen}
        >
          CREATE INSPECTION
        </Button>
      </Box>

      <Box sx={{ mb: 2 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="PENDING">Pending</MenuItem>
            <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
            <MenuItem value="PASSED">Passed</MenuItem>
            <MenuItem value="FAILED">Failed</MenuItem>
            <MenuItem value="RECHECK">Recheck</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <DataGrid
        rows={inspections}
        columns={columns}
        loading={loading}
        pageSizeOptions={[10, 25, 50]}
        initialState={{
          pagination: { paginationModel: { pageSize: 25 } }
        }}
        disableRowSelectionOnClick
        autoHeight
      />

      <Dialog open={openDialog} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingInspection ? 'Edit Inspection' : 'Create Inspection'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <Autocomplete
              options={sewingOrders}
              getOptionLabel={(option) => option.order_number}
              value={sewingOrders.find(o => o.id === formData.sewing_order_id) || null}
              onChange={(_, newValue) => {
                setFormData({ ...formData, sewing_order_id: newValue?.id || '' });
              }}
              renderInput={(params) => (
                <TextField {...params} label="Sewing Order" required />
              )}
              disabled={!!editingInspection}
            />

            <TextField
              label="Defects Found"
              type="number"
              value={formData.defects_found}
              onChange={(e) => setFormData({ ...formData, defects_found: parseInt(e.target.value) || 0 })}
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel>Severity</InputLabel>
              <Select
                value={formData.severity}
                label="Severity"
                onChange={(e) => setFormData({ ...formData, severity: e.target.value as 'NONE' | 'MINOR' | 'MAJOR' | 'CRITICAL' })}
              >
                <MenuItem value="NONE">None</MenuItem>
                <MenuItem value="MINOR">Minor</MenuItem>
                <MenuItem value="MAJOR">Major</MenuItem>
                <MenuItem value="CRITICAL">Critical</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Inspection Notes"
              multiline
              rows={3}
              value={formData.inspection_notes}
              onChange={(e) => setFormData({ ...formData, inspection_notes: e.target.value })}
              fullWidth
            />

            <TextField
              label="Notes"
              multiline
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingInspection ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QCInspectionsPage;
