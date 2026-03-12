/**
 * StocImportPage — Import stoc inițial cabluri
 * Format CSV așteptat: Produs, Lot intrare, Cantitate (km)
 */

import { useState, useRef } from 'react';
import {
  Box, Button, Typography, Alert, CircularProgress, Stack, Divider,
  Chip, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, LinearProgress, Accordion, AccordionSummary,
  AccordionDetails, Tooltip,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import axios from 'axios';

const INVENTORY_API = 'http://localhost:3011';

const TYPE_COLOR: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  MT: 'error',
  LEA: 'warning',
  JT_ARMAT: 'primary',
  JT_NEARMAT: 'info',
  ALARMA: 'secondary',
  COAXIAL: 'secondary',
  SOLAR: 'success',
  SEMNALIZARE: 'default',
  CABLU_GENERIC: 'default',
};

interface LotData {
  lot_number: string | null;
  packaging_type: string | null;
  manufacturer: string | null;
  length: number | null;
  tambur_code: string | null;
  marking_start: number | null;
  marking_end: number | null;
}

interface PreviewRow {
  row: number;
  sku: string;
  name: string;
  lot_raw: string;
  lot: LotData;
  cantitate_km: number;
  meters: number;
  product_type: string;
}

interface ProductSummary {
  name: string;
  sku: string;
  type: string;
  total_meters: number;
  batches: number;
}

interface PreviewResult {
  total_rows: number;
  unique_products: number;
  product_summary: ProductSummary[];
  rows: PreviewRow[];
}

interface ImportStats {
  total_rows: number;
  created_products: number;
  updated_products: number;
  created_batches: number;
  errors: number;
}

// ─── Parse CSV în browser (simplu, fără lib extern) ───────────────────────────
function parseCsvBrowser(text: string): { produs: string; lot_intrare: string; cantitate: string }[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Detectare separator: dacă primul rând are ';' → semicolon, altfel comma
  const sep = lines[0].includes(';') ? ';' : ',';

  // Ignoră header (prima linie)
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(sep);
    if (parts.length < 2) continue;
    // Format: Produs, Lot intrare, Cantitate
    // Lot intrare poate conține virgule? Nu în datele noastre — e safe
    const produs = (parts[0] || '').trim();
    const lot_intrare = (parts.slice(1, parts.length - 1).join(sep)).trim();
    const cantitate = (parts[parts.length - 1] || '0').trim().replace(',', '.');
    if (produs) result.push({ produs, lot_intrare, cantitate });
  }
  return result;
}

// ─── Pagina ───────────────────────────────────────────────────────────────────

export function StocImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<{ stats: ImportStats; errors: { row: number; sku: string; error: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllRows, setShowAllRows] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(f: File) {
    setFile(f);
    setPreview(null);
    setImported(null);
    setError(null);
    setLoading(true);

    try {
      const text = await f.text();
      const rows = parseCsvBrowser(text);
      if (rows.length === 0) throw new Error('CSV gol sau format nerecunoscut');

      // Trimite la backend pentru parsare lot + SKU
      const token = localStorage.getItem('accessToken');
      const { data } = await axios.post(
        `${INVENTORY_API}/api/v1/import-stoc-cabluri/preview`,
        { rows },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPreview(data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error
        ?? (e as { message?: string })?.message
        ?? 'Eroare preview';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  async function doImport() {
    if (!file) return;
    setImporting(true);
    setError(null);
    try {
      const token = localStorage.getItem('accessToken');
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await axios.post(
        `${INVENTORY_API}/api/v1/import-stoc-cabluri`,
        formData,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
      );
      setImported({ stats: data.stats, errors: data.errors || [] });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error
        ?? (e as { message?: string })?.message
        ?? 'Import eșuat';
      setError(msg);
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setImported(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  const displayRows = preview ? (showAllRows ? preview.rows : preview.rows.slice(0, 50)) : [];

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h5" fontWeight={700} mb={0.5}>
        📦 Import Stoc Inițial Cabluri
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Format CSV acceptat: <code>Produs, Lot intrare, Cantitate</code> (cantitate în km)
      </Typography>

      {/* ── Drop zone ── */}
      {!preview && !imported && (
        <Paper
          variant="outlined"
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          sx={{
            p: 5, textAlign: 'center', cursor: 'pointer', mb: 3,
            borderColor: dragOver ? 'primary.main' : 'divider',
            bgcolor: dragOver ? 'primary.50' : 'grey.50',
            borderStyle: 'dashed',
            transition: 'all 0.2s',
          }}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".csv" hidden onChange={onFileInputChange} />
          <UploadFileIcon sx={{ fontSize: 56, color: 'text.secondary', mb: 1 }} />
          <Typography variant="h6">Trage CSV-ul aici sau click pentru selectare</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Fișier CSV cu coloanele: <strong>Produs, Lot intrare, Cantitate</strong>
          </Typography>
        </Paper>
      )}

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* ── Rezultat import ── */}
      {imported && (
        <Alert
          severity={imported.stats.errors > 0 ? 'warning' : 'success'}
          icon={<CheckCircleIcon />}
          action={<Button size="small" onClick={reset}>Import nou</Button>}
          sx={{ mb: 3 }}
        >
          <Typography fontWeight={600}>Import complet!</Typography>
          <Stack direction="row" spacing={2} mt={0.5} flexWrap="wrap">
            <Chip size="small" color="success" label={`${imported.stats.created_products} produse noi`} />
            <Chip size="small" color="info" label={`${imported.stats.updated_products} updatate`} />
            <Chip size="small" color="primary" label={`${imported.stats.created_batches} batches`} />
            {imported.stats.errors > 0 && <Chip size="small" color="error" label={`${imported.stats.errors} erori`} icon={<WarningAmberIcon />} />}
          </Stack>
          {imported.errors.length > 0 && (
            <Box mt={1}>
              {imported.errors.map((e, i) => (
                <Typography key={i} variant="caption" display="block" color="error.main">
                  Rând {e.row}: {e.sku} — {e.error}
                </Typography>
              ))}
            </Box>
          )}
        </Alert>
      )}

      {/* ── Preview ── */}
      {preview && !imported && (
        <>
          {/* Sumar global */}
          <Stack direction="row" spacing={2} alignItems="center" mb={2} flexWrap="wrap">
            <Typography variant="h6">Preview: {file?.name}</Typography>
            <Chip label={`${preview.total_rows} rânduri CSV`} size="small" />
            <Chip label={`${preview.unique_products} produse unice`} size="small" color="primary" />
            <Box sx={{ flexGrow: 1 }} />
            <Button variant="outlined" color="inherit" size="small" onClick={reset}>Altă Selecție</Button>
            <Button
              variant="contained"
              onClick={doImport}
              disabled={importing}
              startIcon={importing ? <CircularProgress size={16} /> : <UploadFileIcon />}
            >
              {importing ? 'Se importă...' : `Importă ${preview.total_rows} înregistrări`}
            </Button>
          </Stack>

          {/* Sumar pe produse */}
          <Accordion defaultExpanded sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={600}>📊 Sumar pe produse ({preview.unique_products})</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell>Produs</TableCell>
                      <TableCell>Tip</TableCell>
                      <TableCell align="right">Total (m)</TableCell>
                      <TableCell align="right">Total (km)</TableCell>
                      <TableCell align="right">Loturi</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {preview.product_summary.map((p) => (
                      <TableRow key={p.sku} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>{p.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{p.sku}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={p.type} color={TYPE_COLOR[p.type] ?? 'default'} />
                        </TableCell>
                        <TableCell align="right">{p.total_meters.toFixed(1)}</TableCell>
                        <TableCell align="right">{(p.total_meters / 1000).toFixed(3)}</TableCell>
                        <TableCell align="right">{p.batches}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>

          {/* Toate rândurile */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={600}>🔍 Detaliu loturi ({preview.total_rows} rânduri)</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <TableContainer sx={{ maxHeight: 500 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>Produs</TableCell>
                      <TableCell>Lot raw</TableCell>
                      <TableCell>Tip ambalaj</TableCell>
                      <TableCell>Tambur</TableCell>
                      <TableCell>Producător</TableCell>
                      <TableCell align="right">Cant. CSV (km)</TableCell>
                      <TableCell align="right">Importat (m)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {displayRows.map((r) => (
                      <TableRow key={r.row} hover sx={{ bgcolor: r.meters === 0 ? 'warning.50' : 'inherit' }}>
                        <TableCell>{r.row}</TableCell>
                        <TableCell sx={{ maxWidth: 220 }}>
                          <Tooltip title={r.sku}>
                            <Typography variant="body2" noWrap>{r.name}</Typography>
                          </Tooltip>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 200 }}>
                          <Typography variant="caption" fontFamily="monospace" noWrap title={r.lot_raw}>
                            {r.lot_raw || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {r.lot.packaging_type
                            ? <Chip size="small" label={r.lot.packaging_type} />
                            : <Typography variant="caption" color="text.disabled">—</Typography>}
                        </TableCell>
                        <TableCell>{r.lot.tambur_code ?? '—'}</TableCell>
                        <TableCell>{r.lot.manufacturer ?? '—'}</TableCell>
                        <TableCell align="right">{r.cantitate_km.toFixed(3)}</TableCell>
                        <TableCell align="right" sx={{ color: r.meters === 0 ? 'warning.main' : 'inherit' }}>
                          {r.meters === 0 ? '⚠ 0' : r.meters.toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {preview.rows.length > 50 && (
                <Box sx={{ p: 1.5, textAlign: 'center' }}>
                  <Button size="small" onClick={() => setShowAllRows(!showAllRows)}>
                    {showAllRows ? `Arată mai puțin` : `Arată toate ${preview.rows.length} rânduri`}
                  </Button>
                </Box>
              )}
            </AccordionDetails>
          </Accordion>

          <Divider sx={{ my: 2 }} />
          <Stack direction="row" justifyContent="flex-end" spacing={2}>
            <Button variant="outlined" onClick={reset}>Anulează</Button>
            <Button
              variant="contained"
              size="large"
              onClick={doImport}
              disabled={importing}
              startIcon={importing ? <CircularProgress size={18} /> : <UploadFileIcon />}
            >
              {importing ? 'Import în curs...' : `✅ Confirmă Import (${preview.total_rows} loturi)`}
            </Button>
          </Stack>
        </>
      )}
    </Box>
  );
}
