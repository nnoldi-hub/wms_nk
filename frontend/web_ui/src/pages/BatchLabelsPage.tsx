/**
 * BatchLabelsPage — Căutare și printare etichete loturi (product batches)
 *
 * Funcționalitate:
 *  - Căutare batch după SKU produs, lot, status, locație
 *  - Tabel cu resultate: batch_number, SKU, cantitate, greutate, lot, locație, status
 *  - Buton "Etichetă PDF" → deschide PDF A6 cu QR code în tab nou
 *  - Buton "Print toate" → deschide PDF-uri pe rând pentru lista curentă (max 20)
 */

import { useState } from 'react';
import {
  Box, Typography, Stack, TextField, Button, Chip,
  Table, TableHead, TableRow, TableCell, TableBody,
  Alert, LinearProgress, Tooltip, IconButton, MenuItem, Select,
  FormControl, InputLabel, Paper,
} from '@mui/material';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import PrintIcon from '@mui/icons-material/Print';
import SearchIcon from '@mui/icons-material/Search';
import axios from 'axios';

const INVENTORY_API = 'http://localhost:3011/api/v1';
const apiClient = axios.create({ baseURL: INVENTORY_API });
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    const headers = (config.headers ?? {}) as Record<string, string>;
    headers.Authorization = `Bearer ${token}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config.headers = headers as any;
  }
  return config;
});

interface Batch {
  id: string;
  batch_number: string;
  product_sku: string;
  product_name?: string;
  current_quantity: number;
  initial_quantity: number;
  weight_kg?: number;
  length_meters?: number;
  lot_number?: string;
  status: string;
  unit_code?: string;
  unit_name?: string;
  location_id?: string;
  zone?: string;
  rack?: string;
  position?: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  INTACT: 'success',
  CUT: 'warning',
  REPACKED: 'info',
  EMPTY: 'default',
  DAMAGED: 'error',
  QUARANTINE: 'error',
};

function openLabelPdf(batchId: string) {
  const token = localStorage.getItem('accessToken') ?? '';
  // Open in new tab — browser will show inline PDF or download
  const url = `${INVENTORY_API}/batches/${batchId}/label.pdf`;
  // Fetch with auth then open blob URL
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.blob())
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    })
    .catch(() => alert('Eroare la generarea etichetei PDF'));
}

export function BatchLabelsPage() {
  const [sku, setSku] = useState('');
  const [status, setStatus] = useState('INTACT');
  const [lotFilter, setLotFilter] = useState('');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { limit: '50' };
      if (sku.trim()) params.product_sku = sku.trim().toUpperCase();
      if (status) params.status = status;
      const res = await apiClient.get<{ data: Batch[] }>('/batches', { params });
      let data = res.data?.data ?? [];
      if (lotFilter.trim()) {
        const q = lotFilter.trim().toLowerCase();
        data = data.filter(b => b.lot_number?.toLowerCase().includes(q) || b.batch_number?.toLowerCase().includes(q));
      }
      setBatches(data);
      setSearched(true);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Eroare la căutare');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintAll = async () => {
    const slice = batches.slice(0, 20);
    for (const b of slice) {
      openLabelPdf(b.id);
      await new Promise(r => setTimeout(r, 400)); // slight delay between tabs
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" mb={3}>
        <QrCode2Icon color="primary" fontSize="large" />
        <Typography variant="h5" fontWeight={700}>Etichete Loturi (Batches)</Typography>
      </Stack>

      {/* Search panel */}
      <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-end">
          <TextField
            label="SKU Produs"
            size="small"
            value={sku}
            onChange={e => setSku(e.target.value)}
            placeholder="ex: CAB001"
            sx={{ minWidth: 160 }}
            onKeyDown={e => e.key === 'Enter' && void handleSearch()}
          />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select label="Status" value={status} onChange={e => setStatus(e.target.value)}>
              <MenuItem value="">Toate</MenuItem>
              <MenuItem value="INTACT">INTACT</MenuItem>
              <MenuItem value="CUT">CUT</MenuItem>
              <MenuItem value="REPACKED">REPACKED</MenuItem>
              <MenuItem value="EMPTY">EMPTY</MenuItem>
              <MenuItem value="DAMAGED">DAMAGED</MenuItem>
              <MenuItem value="QUARANTINE">QUARANTINE</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Filtru lot / batch nr."
            size="small"
            value={lotFilter}
            onChange={e => setLotFilter(e.target.value)}
            placeholder="ex: LOT-2025"
            sx={{ minWidth: 180 }}
            onKeyDown={e => e.key === 'Enter' && void handleSearch()}
          />
          <Button
            variant="contained"
            startIcon={<SearchIcon />}
            onClick={() => void handleSearch()}
            disabled={loading}
          >
            Caută
          </Button>
          {batches.length > 0 && (
            <Button
              variant="outlined"
              startIcon={<PrintIcon />}
              onClick={() => void handlePrintAll()}
              disabled={loading}
            >
              Print toate ({Math.min(batches.length, 20)})
            </Button>
          )}
        </Stack>
      </Paper>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {searched && batches.length === 0 && !loading && (
        <Alert severity="info">Nu s-au găsit loturi cu criteriile selectate.</Alert>
      )}

      {batches.length > 0 && (
        <>
          <Typography variant="body2" color="text.secondary" mb={1}>
            {batches.length} loturi găsite
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Batch #</TableCell>
                <TableCell>SKU</TableCell>
                <TableCell>Produs</TableCell>
                <TableCell>Cantitate</TableCell>
                <TableCell>Greutate</TableCell>
                <TableCell>Lot</TableCell>
                <TableCell>Locație</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Etichetă</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {batches.map(b => {
                const uom = b.unit_code || b.unit_name || 'm';
                const loc = [b.zone, b.rack, b.position].filter(Boolean).join('/');
                return (
                  <TableRow key={b.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                        {b.batch_number}
                      </Typography>
                    </TableCell>
                    <TableCell>{b.product_sku}</TableCell>
                    <TableCell sx={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.product_name ?? '—'}
                    </TableCell>
                    <TableCell>
                      {Number(b.current_quantity).toFixed(2)} {uom}
                    </TableCell>
                    <TableCell>
                      {b.weight_kg ? `${Number(b.weight_kg).toFixed(2)} kg` : '—'}
                    </TableCell>
                    <TableCell>{b.lot_number ?? '—'}</TableCell>
                    <TableCell>{loc || '—'}</TableCell>
                    <TableCell>
                      <Chip
                        label={b.status}
                        size="small"
                        color={STATUS_COLORS[b.status] ?? 'default'}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={`Etichetă PDF pentru ${b.batch_number}`}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => openLabelPdf(b.id)}
                        >
                          <QrCode2Icon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </>
      )}
    </Box>
  );
}

export default BatchLabelsPage;
