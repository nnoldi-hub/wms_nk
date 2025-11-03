import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Stack,
  Collapse,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { productsService } from '../services/products.service';
import type { AxiosError } from 'axios';

interface ProductImportDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportRow {
  row_number: number;
  sku: string;
  name: string;
  lot_number?: string;
  quantity?: number;
  uom?: string;
  weight_kg?: number;
  status: 'pending' | 'success' | 'error' | 'warning';
  error?: string;
}

interface ImportResult {
  total: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; sku: string; error: string }>;
}

export const ProductImportDialog = ({ open, onClose, onSuccess }: ProductImportDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [showErrors, setShowErrors] = useState(true);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.csv')) {
      setError('Invalid file type. Please upload CSV or Excel file.');
      return;
    }

    setFile(selectedFile);
    setError('');
    setResult(null);
    parseFilePreview(selectedFile);
  };

  const parseFilePreview = async (file: File) => {
    try {
      setLoading(true);
      
      // Check if file is Excel format
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      
      if (isExcel) {
        // For Excel files, show warning and suggest CSV
        setError('⚠️ Excel files may have compatibility issues. For best results, please save as CSV format: File → Save As → CSV (Comma delimited)');
        setLoading(false);
        return;
      }
      
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length < 1) {
        setError('File is empty or has no data rows');
        setLoading(false);
        return;
      }

      // Parse header (first line)
      const header = lines[0].split(/[,;\t]/).map(h => h.trim().toLowerCase());
      
      // Detect if first line is header or data
      // If first column looks like data (e.g., "ACBYCY"), assume no header row
      const firstColumn = header[0];
      const hasHeader = firstColumn.includes('produs') || firstColumn.includes('sku') || firstColumn.includes('cod');
      
      // Find column indexes (flexible matching)
      let skuIndex = -1;
      let nameIndex = -1;
      let lotIndex = -1;
      let qtyIndex = -1;
      
      if (hasHeader) {
        // CSV has header row - use column names
        skuIndex = header.findIndex(h => 
          h.includes('cod') || h.includes('sku') || h.includes('code')
        );
        nameIndex = header.findIndex(h => 
          (h.includes('produs') || h.includes('product') || h.includes('name')) && !h.includes('cod')
        );
        lotIndex = header.findIndex(h => h.includes('lot'));
        qtyIndex = header.findIndex(h => h.includes('cantitate') || h.includes('quantity') || h.includes('qty'));
      } else {
        // No header - assume column order: SKU (col 0), Name (col 1), Lot (col 2), Quantity (col 3)
        skuIndex = 0;
        nameIndex = header.length > 1 ? 1 : -1;
        lotIndex = header.length > 2 ? 2 : -1;
        qtyIndex = header.length > 3 ? 3 : -1;
      }

      // Validate that we found at least SKU column
      if (skuIndex === -1) {
        setError('Cannot detect SKU/Product Code column. Please check file format.');
        setLoading(false);
        return;
      }

      // Parse data rows (max 10 for preview)
      const startRow = hasHeader ? 1 : 0; // Skip header if present
      const previewRows: ImportRow[] = lines.slice(startRow, Math.min(startRow + 10, lines.length)).map((line, idx) => {
        const values = line.split(/[,;\t]/).map(v => v.trim());
        
        return {
          row_number: startRow + idx + 1,
          sku: skuIndex >= 0 && values[skuIndex] ? values[skuIndex] : '',
          name: nameIndex >= 0 && values[nameIndex] ? values[nameIndex] : values[skuIndex] || '', // Fallback to SKU if no name
          lot_number: lotIndex >= 0 && values[lotIndex] ? values[lotIndex] : undefined,
          quantity: qtyIndex >= 0 && values[qtyIndex] ? parseFloat(values[qtyIndex].replace(',', '.')) : undefined,
          uom: 'pcs', // Default unit
          status: 'pending' as const,
        };
      });

      setPreview(previewRows);
      setLoading(false);
    } catch (err) {
      setError(`Failed to parse file: ${err instanceof Error ? err.message : String(err)}`);
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    try {
      setLoading(true);
      setError('');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('update_existing', 'true'); // Update if SKU exists

      const response = await productsService.importProducts(formData);

      setResult({
        total: response.total,
        imported: response.imported,
        updated: response.updated,
        skipped: response.skipped,
        errors: response.errors,
      });

      if (response.errors.length === 0) {
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 2000);
      }
    } catch (err) {
      let message = 'Import failed';
  const axiosErr = err as AxiosError<unknown>;
      const status = axiosErr?.response?.status;
      if (status === 404) {
        message = 'Import endpoint not found (404). Please rebuild/restart the Inventory service and ensure route POST /api/v1/products/import exists.';
      } else if (status === 401) {
        message = 'Unauthorized (401). Please log in again.';
      } else if (status === 403) {
        message = 'Forbidden (403). You need admin or manager role to import products.';
      } else if (axiosErr?.response?.data !== undefined) {
        const data: unknown = axiosErr.response.data;
        if (data && typeof data === 'object') {
          const obj = data as Record<string, unknown>;
          const errMsg = (obj.error ?? obj.message);
          if (typeof errMsg === 'string') {
            message = errMsg;
          }
        }
      } else if (axiosErr?.message) {
        message = axiosErr.message;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview([]);
    setResult(null);
    setError('');
    setShowErrors(true);
    onClose();
  };

  const renderPreviewTable = () => (
    <TableContainer component={Paper} sx={{ maxHeight: 400, mt: 2 }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell>Row</TableCell>
            <TableCell>SKU</TableCell>
            <TableCell>Product Name</TableCell>
            <TableCell>Lot Number</TableCell>
            <TableCell align="right">Quantity</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {preview.map((row) => (
            <TableRow key={row.row_number}>
              <TableCell>{row.row_number}</TableCell>
              <TableCell>
                <Typography variant="body2" fontWeight="bold">
                  {row.sku}
                </Typography>
              </TableCell>
              <TableCell>{row.name}</TableCell>
              <TableCell>
                {row.lot_number && (
                  <Chip label={row.lot_number} size="small" variant="outlined" />
                )}
              </TableCell>
              <TableCell align="right">
                {row.quantity ? `${row.quantity} ${row.uom}` : '-'}
              </TableCell>
              <TableCell>
                <Chip
                  icon={<CheckCircleIcon />}
                  label="Ready"
                  size="small"
                  color="success"
                  variant="outlined"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const renderResults = () => {
    if (!result) return null;

    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity={result.errors.length === 0 ? 'success' : 'warning'} sx={{ mb: 2 }}>
          <Stack spacing={1}>
            <Typography variant="subtitle2">Import Complete!</Typography>
            <Box>
              <Chip
                icon={<CheckCircleIcon />}
                label={`Imported: ${result.imported}`}
                size="small"
                color="success"
                sx={{ mr: 1 }}
              />
              {result.updated > 0 && (
                <Chip
                  icon={<WarningIcon />}
                  label={`Updated: ${result.updated}`}
                  size="small"
                  color="warning"
                  sx={{ mr: 1 }}
                />
              )}
              {result.skipped > 0 && (
                <Chip
                  label={`Skipped: ${result.skipped}`}
                  size="small"
                  sx={{ mr: 1 }}
                />
              )}
              {result.errors.length > 0 && (
                <Chip
                  icon={<ErrorIcon />}
                  label={`Errors: ${result.errors.length}`}
                  size="small"
                  color="error"
                />
              )}
            </Box>
          </Stack>
        </Alert>

        {result.errors.length > 0 && (
          <Box>
            <Button
              size="small"
              onClick={() => setShowErrors(!showErrors)}
              endIcon={showErrors ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            >
              {showErrors ? 'Hide' : 'Show'} Errors
            </Button>
            <Collapse in={showErrors}>
              <TableContainer component={Paper} sx={{ mt: 1, maxHeight: 200 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Row</TableCell>
                      <TableCell>SKU</TableCell>
                      <TableCell>Error</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.errors.map((err, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{err.row}</TableCell>
                        <TableCell>{err.sku}</TableCell>
                        <TableCell>
                          <Typography variant="caption" color="error">
                            {err.error}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Collapse>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Import Products from CSV/Excel
        <Typography variant="caption" display="block" color="text.secondary">
          Upload file with columns: Cod produs, Produs, Lot intrare (optional), Cantitate (optional)
        </Typography>
      </DialogTitle>

      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {!file && !result && (
          <Box
            sx={{
              border: '2px dashed',
              borderColor: 'primary.main',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              cursor: 'pointer',
              '&:hover': { bgcolor: 'action.hover' },
            }}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <input
              id="file-upload"
              type="file"
              accept=".csv,.xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <CloudUploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Click to upload or drag and drop
            </Typography>
            <Typography variant="body2" color="text.secondary">
              CSV or Excel files (max 10MB)
            </Typography>
          </Box>
        )}

        {loading && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress />
            <Typography variant="body2" sx={{ mt: 1 }} align="center">
              {result ? 'Importing products...' : 'Parsing file...'}
            </Typography>
          </Box>
        )}

        {file && !result && preview.length > 0 && (
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="subtitle2">
                Preview (first 10 rows of {file.name})
              </Typography>
              <Typography variant="caption">
                Review the data before importing. You can update existing products by SKU.
              </Typography>
            </Alert>
            {renderPreviewTable()}
          </Box>
        )}

        {renderResults()}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {result ? 'Close' : 'Cancel'}
        </Button>
        {file && !result && (
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={loading || preview.length === 0}
            startIcon={<CloudUploadIcon />}
          >
            Import {preview.length > 0 ? `(~${preview.length}+ products)` : ''}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
