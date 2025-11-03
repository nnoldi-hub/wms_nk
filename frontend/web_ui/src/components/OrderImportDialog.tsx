import { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, LinearProgress, Alert } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { ordersService } from '../services/orders.service';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const OrderImportDialog = ({ open, onClose, onSuccess }: Props) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setError(null);
  };

  const handleImport = async () => {
    if (!file) return setError('Please select a CSV file');
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await ordersService.importCsv(fd);
      // If backend returns summary inside data
      onSuccess();
      onClose();
    } catch (err) {
      let msg = 'Import failed';
      if (err && typeof err === 'object') {
  const r = err as { response?: { data?: unknown }; message?: string };
  if (r?.message) msg = r.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setError(null);
    setLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Import Sales Orders (CSV)</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box
          sx={{ border: '2px dashed', borderRadius: 1, p: 3, textAlign: 'center', cursor: 'pointer' }}
          onClick={() => document.getElementById('order-file')?.click()}
        >
          <input id="order-file" type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileChange} />
          <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main' }} />
          <Typography sx={{ mt: 1 }}>
            {file ? file.name : 'Click to select CSV file (columns: sku, description, requested_qty, uom, weight)'}
          </Typography>
        </Box>
        {loading && <LinearProgress sx={{ mt: 2 }} />}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>Cancel</Button>
        <Button variant="contained" onClick={handleImport} disabled={loading || !file} startIcon={<CloudUploadIcon />}>Import</Button>
      </DialogActions>
    </Dialog>
  );
};
