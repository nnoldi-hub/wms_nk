import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box, Typography, Button, Chip, CircularProgress, Alert, LinearProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Paper, Stack, TextField, Select, MenuItem, FormControl, InputLabel,
  IconButton, Tooltip, Divider, Tabs, Tab,
  Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CancelIcon from '@mui/icons-material/Cancel';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import SyncIcon from '@mui/icons-material/Sync';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import GroupIcon from '@mui/icons-material/Group';
import PersonIcon from '@mui/icons-material/Person';
import { useNavigate } from 'react-router-dom';
import { pickNotesService } from '../services/pickNotes.service';
import type { PickNote, PickNoteLine, ImportPayload } from '../services/pickNotes.service';
import { parsePdfPickNote } from '../utils/parsePdfPickNote';

// ─── types ───────────────────────────────────────────────────────────────────

type NoteStatus = PickNote['status'];
type LineStatus = PickNoteLine['status'];

const NOTE_STATUS_COLOR: Record<NoteStatus, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  PENDING: 'warning',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

const NOTE_STATUS_LABEL: Record<NoteStatus, string> = {
  PENDING: 'În așteptare',
  IN_PROGRESS: 'În lucru',
  COMPLETED: 'Finalizat',
  CANCELLED: 'Anulat',
};

const LINE_STATUS_COLOR: Record<LineStatus, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  PENDING: 'default',
  IN_PROGRESS: 'info',
  DONE: 'success',
  CANCELLED: 'error',
};

const SOURCE_LABEL: Record<string, string> = {
  ERP_AUTO: 'ERP Auto',
  ERP_WEBHOOK: 'ERP Webhook',
  MANUAL_UPLOAD: 'Manual',
  ERP_CSV: 'CSV',
};

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3011/api/v1';
const ERP_URL_KEY = 'wms_erp_pick_notes_url';

// ─── CSV Parser ───────────────────────────────────────────────────────────────
// Expected CSV columns (tab or comma separated):
// CMD, DataCmd, Partener, Persoana, Agent, TipLivrare, GreutateTotal,
// Articol, CodGest, LungimeDisp, CantDeTaiat, UM, Lot, CantRamasa, Greutate, LungSolicitate

function parsePickNoteCSV(text: string): { notes: ImportPayload[]; errors: string[] } {
  const errors: string[] = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  if (lines.length < 2) { errors.push('Fișier CSV gol sau fără date'); return { notes: [], errors }; }

  const sep = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, '_'));

  const col = (row: string[], names: string[]): string => {
    for (const n of names) {
      const idx = headers.findIndex(h => h.includes(n));
      if (idx >= 0 && row[idx]) return row[idx].trim().replace(/^"|"$/g, '');
    }
    return '';
  };

  const noteMap: Record<string, ImportPayload> = {};
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const row = lines[i].split(sep);
    const cmd = col(row, ['cmd', 'comanda', 'order', 'numar']);
    if (!cmd) { errors.push(`Linia ${i + 1}: CMD lipseste`); continue; }

    if (!noteMap[cmd]) {
      noteMap[cmd] = {
        erp_cmd_number: cmd,
        erp_date: col(row, ['data', 'datacmd', 'data_cmd', 'date']).slice(0, 10) || new Date().toISOString().slice(0, 10),
        partner_name: col(row, ['partener', 'client', 'partner', 'firma']),
        contact_person: col(row, ['persoana', 'contact', 'person']),
        agent_name: col(row, ['agent']),
        delivery_type: col(row, ['tip', 'livrare', 'delivery']),
        total_weight: parseFloat(col(row, ['greutate_total', 'greutate_totala', 'total_weight'])) || undefined,
        lines: [],
      };
    }

    const qty = parseFloat(col(row, ['cant_de_taiat', 'cantitate', 'cant', 'quantity', 'qty']));
    if (!qty && qty !== 0) { errors.push(`Linia ${i + 1}: cantitate invalida`); continue; }

    noteMap[cmd].lines.push({
      product_name: col(row, ['articol', 'produs', 'product', 'denumire']),
      stock_code: col(row, ['cod_gest', 'codgest', 'sku', 'cod']),
      length_available: parseFloat(col(row, ['lungime_disp', 'lungimedisp', 'disponibil'])) || undefined,
      quantity_to_pick: qty,
      uom: col(row, ['um', 'uom', 'unitate']) || 'Km',
      lot_number: col(row, ['lot', 'lot_number', 'lot_intrare']),
      quantity_remaining: parseFloat(col(row, ['cant_ramasa', 'ramasa', 'remaining'])) || undefined,
      weight: parseFloat(col(row, ['greutate', 'weight', 'kg'])) || undefined,
      requested_lengths: col(row, ['lung_solicitate', 'solicitate', 'lengths']),
    });
  }

  return { notes: Object.values(noteMap), errors };
}

// ─── GeneratePickingDialog ───────────────────────────────────────────────────
// Suportă generare pentru 1 sau mai mulți muncitori cu strategie de distribuire

type Worker = { username: string };
type GenerateResult = {
  picking_job_id: string;
  job_number: string;
  items_count: number;
  total_jobs: number;
  jobs: { job_number: string; assigned_to: string | null; items_count: number }[];
};

function GeneratePickingDialog({
  note, open, onClose, onDone,
}: { note: PickNote | null; open: boolean; onClose: () => void; onDone: () => void }) {
  const navigate = useNavigate();
  const [numWorkers, setNumWorkers] = useState(1);
  const [workers, setWorkers] = useState<Worker[]>([{ username: '' }]);
  const [strategy, setStrategy] = useState<'round_robin' | 'by_weight'>('round_robin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<GenerateResult | null>(null);

  const handleNumChange = (n: number) => {
    const clamped = Math.max(1, Math.min(10, n));
    setNumWorkers(clamped);
    setWorkers(prev => {
      const next = [...prev];
      while (next.length < clamped) next.push({ username: '' });
      return next.slice(0, clamped);
    });
  };

  const updateWorker = (idx: number, username: string) => {
    setWorkers(prev => prev.map((w, i) => i === idx ? { username } : w));
  };

  const handle = async () => {
    if (!note) return;
    setLoading(true); setError('');
    try {
      const options =
        numWorkers === 1
          ? { assigned_to: workers[0]?.username || undefined }
          : { workers: workers.map(w => ({ username: w.username || undefined })), strategy };
      const res = await pickNotesService.generatePicking(note.id, options);
      setResult(res.data);
      onDone();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error ?? err.message ?? 'Eroare necunoscută');
    }
    setLoading(false);
  };

  const handleClose = () => {
    setResult(null); setError('');
    setNumWorkers(1); setWorkers([{ username: '' }]); setStrategy('round_robin');
    onClose();
  };

  const lineCount = note?.line_count ?? 0;

  // Preview distribuire round-robin (estimat)
  const previewDistrib = Array.from({ length: numWorkers }, (_, i) => {
    const cnt = Math.floor(lineCount / numWorkers) + (i < lineCount % numWorkers ? 1 : 0);
    return cnt;
  });

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Generează Job(uri) de Picking
        {note && (
          <Typography variant="caption" display="block" color="text.secondary">
            {note.erp_cmd_number} — {note.partner_name} — {lineCount} linii
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        {result ? (
          <Stack spacing={1.5} mt={1}>
            <Alert severity="success" icon={<CheckCircleIcon />}>
              <Typography fontWeight={700}>
                {result.total_jobs === 1
                  ? `Job creat: ${result.jobs[0].job_number}`
                  : `${result.total_jobs} joburi de picking create!`}
              </Typography>
              <Typography variant="body2">{result.items_count} articole distribuite</Typography>
            </Alert>
            {result.total_jobs > 1 && (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell sx={{ fontWeight: 700 }}>Job</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Muncitor</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Articole</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.jobs.map(j => (
                      <TableRow key={j.job_number}>
                        <TableCell><Typography fontFamily="monospace" fontSize="0.8rem">{j.job_number}</Typography></TableCell>
                        <TableCell>{j.assigned_to || <Typography color="text.secondary" variant="body2">Neasignat</Typography>}</TableCell>
                        <TableCell align="right"><Chip label={j.items_count} size="small" color="primary" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Stack>
        ) : (
          <Stack spacing={2} mt={1}>
            <Alert severity="info">
              {numWorkers === 1
                ? 'Se va crea un job de picking cu toate liniile. Muncitorul alege sarcinile din secțiunea Picking.'
                : `Liniile vor fi distribuite la ${numWorkers} muncitori — câte un job separat per muncitor.`}
            </Alert>

            {error && <Alert severity="error">{error}</Alert>}

            {/* Număr muncitori */}
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              <GroupIcon color="action" />
              <Typography variant="body2" sx={{ minWidth: 130 }}>Număr muncitori:</Typography>
              <TextField
                type="number"
                size="small"
                value={numWorkers}
                onChange={e => handleNumChange(Number(e.target.value))}
                inputProps={{ min: 1, max: 10, step: 1 }}
                sx={{ width: 80 }}
              />
              {numWorkers > 1 && (
                <FormControl size="small" sx={{ minWidth: 210 }}>
                  <InputLabel>Strategie de distribuire</InputLabel>
                  <Select
                    value={strategy}
                    label="Strategie de distribuire"
                    onChange={e => setStrategy(e.target.value as 'round_robin' | 'by_weight')}
                  >
                    <MenuItem value="round_robin">Round-robin (linii alternative)</MenuItem>
                    <MenuItem value="by_weight">Echilibrat după greutate</MenuItem>
                  </Select>
                </FormControl>
              )}
            </Stack>

            {/* Câmpuri per muncitor */}
            {workers.map((w, i) => (
              <Stack key={i} direction="row" spacing={1} alignItems="center">
                <PersonIcon color="action" fontSize="small" />
                <Typography variant="body2" sx={{ minWidth: 90 }}>Muncitor {i + 1}:</Typography>
                <TextField
                  size="small"
                  placeholder="username (opțional)"
                  value={w.username}
                  onChange={e => updateWorker(i, e.target.value)}
                  fullWidth
                />
                {numWorkers > 1 && lineCount > 0 && (
                  <Chip
                    size="small"
                    label={`~${previewDistrib[i]} linii`}
                    color="primary"
                    variant="outlined"
                    sx={{ minWidth: 80 }}
                  />
                )}
              </Stack>
            ))}

            {numWorkers > 1 && lineCount > 0 && (
              <Alert severity="warning" icon={false} sx={{ py: 0.5 }}>
                <Typography variant="caption">
                  Preview distribuire ({strategy === 'round_robin' ? 'round-robin' : 'după greutate'}):
                  {previewDistrib.map((cnt, i) => ` M${i + 1}: ${cnt} linii`).join(' |')}
                </Typography>
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Închide</Button>
        {result ? (
          <Button variant="contained" startIcon={<OpenInNewIcon />} onClick={() => navigate('/pick-jobs')}>
            Vezi Picking Jobs
          </Button>
        ) : (
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={18} /> : <PlayArrowIcon />}
            onClick={handle}
            disabled={loading}
          >
            {numWorkers === 1 ? 'Generează Picking' : `Generează ${numWorkers} Joburi`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ─── DetailDialog ─────────────────────────────────────────────────────────────

function DetailDialog({ noteId, open, onClose, onGenerate, onCancel }: {
  noteId: string | null; open: boolean; onClose: () => void;
  onGenerate: (note: PickNote) => void; onCancel: (id: string) => void;
}) {
  const [note, setNote] = useState<PickNote | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!noteId || !open) return;
    setLoading(true);
    pickNotesService.getOne(noteId).then(r => { setNote(r.data); setLoading(false); });
  }, [noteId, open]);

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        {note ? (
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography fontWeight={700} fontSize="1.2rem">{note.erp_cmd_number}</Typography>
            <Chip label={NOTE_STATUS_LABEL[note.status]} color={NOTE_STATUS_COLOR[note.status]} size="small" />
            <Chip label={SOURCE_LABEL[note.source] ?? note.source} size="small" variant="outlined" />
          </Stack>
        ) : 'Detaliu notă'}
      </DialogTitle>
      <DialogContent dividers>
        {loading && <Box textAlign="center" py={4}><CircularProgress /></Box>}
        {note && (
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary">Partener</Typography>
                <Typography fontWeight={700}>{note.partner_name ?? '—'}</Typography>
                <Typography variant="body2">{note.contact_person}</Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="caption" color="text.secondary">Data ERP</Typography>
                <Typography fontWeight={700}>
                  {note.erp_date ? new Date(note.erp_date).toLocaleDateString('ro-RO') : '—'}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="caption" color="text.secondary">Greutate totală</Typography>
                <Typography fontWeight={700}>{note.total_weight ? `${note.total_weight} kg` : '—'}</Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 4 }}>
                <Typography variant="caption" color="text.secondary">Tip livrare</Typography>
                <Typography>{note.delivery_type ?? '—'}</Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 4 }}>
                <Typography variant="caption" color="text.secondary">Agent</Typography>
                <Typography>{note.agent_name ?? '—'}</Typography>
              </Grid>
              {note.picking_job_id && (
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">Picking Job generat</Typography>
                  <Typography fontFamily="monospace" color="primary.main">{note.picking_job_id.slice(0, 8)}…</Typography>
                </Grid>
              )}
            </Grid>
            <Divider />
            <Typography variant="h6" fontWeight={700}>Linii notă de culegere</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Articol</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Cod gest.</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: 'text.secondary' }}>Lot intrare</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Disp.</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.main' }}>De tăiat</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>UM</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Rămâne</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Greutate</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(note.lines ?? []).map(line => (
                    <TableRow key={line.id} hover>
                      <TableCell sx={{ color: 'text.secondary' }}>{line.line_number}</TableCell>
                      <TableCell><Typography variant="body2" fontWeight={700}>{line.product_name ?? '—'}</Typography></TableCell>
                      <TableCell><Typography variant="body2" fontFamily="monospace">{line.stock_code ?? '—'}</Typography></TableCell>
                      <TableCell><Typography variant="caption" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>{line.lot_number ?? '—'}</Typography></TableCell>
                      <TableCell align="right" sx={{ color: 'text.secondary' }}>{line.length_available ?? '—'}</TableCell>
                      <TableCell align="right"><Typography fontWeight={700} color="primary.main">{line.quantity_to_pick}</Typography></TableCell>
                      <TableCell align="right">{line.uom ?? 'Km'}</TableCell>
                      <TableCell align="right" sx={{ color: 'success.main' }}>{line.quantity_remaining ?? '—'}</TableCell>
                      <TableCell align="right">{line.weight ? `${line.weight} kg` : '—'}</TableCell>
                      <TableCell><Chip size="small" label={line.status} color={LINE_STATUS_COLOR[line.status]} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Închide</Button>
        {note && note.status !== 'CANCELLED' && note.status !== 'COMPLETED' && (
          <Button color="error" startIcon={<CancelIcon />} onClick={() => { onCancel(note.id); onClose(); }}>
            Anulează Nota
          </Button>
        )}
        {note && !note.picking_job_id && note.status !== 'CANCELLED' && (
          <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={() => onGenerate(note)}>
            Generează Picking
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ─── ImportDialog ─────────────────────────────────────────────────────────────

function ImportDialog({ open, onClose, onImported, initialTab = 0 }: {
  open: boolean; onClose: () => void; onImported: () => void; initialTab?: number;
}) {
  const [tab, setTab] = useState(initialTab);
  useEffect(() => { if (open) setTab(initialTab); }, [open, initialTab]);

  // CSV state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvPreview, setCsvPreview] = useState<ImportPayload[]>([]);
  const [csvError, setCsvError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);

  // ERP state
  const [erpUrl, setErpUrl] = useState(localStorage.getItem(ERP_URL_KEY) || '');
  const [erpApiKey, setErpApiKey] = useState('');
  const [erpPreview, setErpPreview] = useState<ImportPayload[]>([]);
  const [erpFetchLoading, setErpFetchLoading] = useState(false);
  const [erpError, setErpError] = useState('');

  // PDF state
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [pdfNote, setPdfNote] = useState<ImportPayload | null>(null);
  const [pdfErrors, setPdfErrors] = useState<string[]>([]);
  const [pdfWarnings, setPdfWarnings] = useState<string[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleClose = () => {
    setCsvPreview([]); setCsvError(''); setImportResult(null);
    setErpPreview([]); setErpError('');
    setPdfNote(null); setPdfErrors([]); setPdfWarnings([]);
    onClose();
  };

  // ── CSV ──
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError(''); setCsvPreview([]); setImportResult(null);
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const { notes, errors } = parsePickNoteCSV(text);
      if (errors.length) setCsvError(errors.join(' | '));
      setCsvPreview(notes);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const handleCsvImport = async () => {
    setImporting(true);
    const results = { imported: 0, errors: [] as string[] };
    for (const note of csvPreview) {
      try {
        await pickNotesService.importJson(note);
        results.imported++;
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string } }; message?: string };
        results.errors.push(`${note.erp_cmd_number}: ${err.response?.data?.error ?? err.message}`);
      }
    }
    setImportResult(results);
    setImporting(false);
    if (results.imported > 0) onImported();
  };

  // ── PDF ──
  const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfNote(null); setPdfErrors([]); setPdfWarnings([]); setImportResult(null);
    setPdfLoading(true);
    try {
      const { note, errors, warnings } = await parsePdfPickNote(file);
      setPdfNote(note);
      setPdfErrors(errors);
      setPdfWarnings(warnings);
    } catch (err) {
      setPdfErrors([(err as Error).message ?? 'Eroare la parsare PDF']);
    }
    setPdfLoading(false);
    e.target.value = '';
  };

  const handlePdfImport = async () => {
    if (!pdfNote) return;
    setImporting(true);
    try {
      await pickNotesService.importJson(pdfNote);
      setImportResult({ imported: 1, errors: [] });
      onImported();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setImportResult({ imported: 0, errors: [`${pdfNote.erp_cmd_number}: ${err.response?.data?.error ?? err.message}`] });
    }
    setImporting(false);
  };

  // ── ERP URL fetch ──
  const handleErpFetch = async () => {
    if (!erpUrl) return;
    localStorage.setItem(ERP_URL_KEY, erpUrl);
    setErpFetchLoading(true); setErpError(''); setErpPreview([]);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (erpApiKey) headers['Authorization'] = `Bearer ${erpApiKey}`;
      const r = await fetch(erpUrl, { headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const notes: ImportPayload[] = Array.isArray(data) ? data : data.data ?? [data];
      setErpPreview(notes);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setErpError(err.message ?? 'Eroare la fetch ERP');
    }
    setErpFetchLoading(false);
  };

  const handleErpImport = async () => {
    setImporting(true);
    const results = { imported: 0, errors: [] as string[] };
    for (const note of erpPreview) {
      try {
        await pickNotesService.importJson(note);
        results.imported++;
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string } }; message?: string };
        results.errors.push(`${note.erp_cmd_number}: ${err.response?.data?.error ?? err.message}`);
      }
    }
    setImportResult(results);
    setImporting(false);
    if (results.imported > 0) onImported();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Importă Note de Culegere</DialogTitle>
      <DialogContent dividers>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab icon={<UploadFileIcon />} label="Import CSV" />
          <Tab icon={<SyncIcon />} label="Import ERP" />
          <Tab icon={<PictureAsPdfIcon />} label="Import PDF" />
        </Tabs>

        {/* ── CSV TAB ── */}
        {tab === 0 && (
          <Stack spacing={2}>
            {importResult ? (
              <Stack spacing={1}>
                {importResult.imported > 0 && (
                  <Alert severity="success" icon={<CheckCircleIcon />}>
                    {importResult.imported} notă(e) importată(e) cu succes!
                  </Alert>
                )}
                {importResult.errors.map((e, i) => (
                  <Alert severity="error" icon={<ErrorIcon />} key={i}>{e}</Alert>
                ))}
              </Stack>
            ) : (
              <>
                <Alert severity="info">
                  Fișier CSV sau TSV cu coloanele: <strong>CMD, DataCmd, Partener, Agent, TipLivrare, GreutateTotal, Articol, CodGest, LungimeDisp, CantDeTaiat, UM, Lot, CantRamasa, Greutate</strong>
                </Alert>
                {csvError && <Alert severity="warning">{csvError}</Alert>}
                <Button variant="outlined" startIcon={<UploadFileIcon />}
                  onClick={() => fileInputRef.current?.click()}>
                  Alege fișier CSV
                </Button>
                <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt"
                  style={{ display: 'none' }} onChange={handleFileChange} />
                {csvPreview.length > 0 && (
                  <Alert severity="success">
                    {csvPreview.length} notă(e) detectată(e) cu {csvPreview.reduce((s, n) => s + n.lines.length, 0)} linii total
                  </Alert>
                )}
                {csvPreview.map(n => (
                  <Paper key={n.erp_cmd_number} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Typography fontFamily="monospace" fontWeight={700}>{n.erp_cmd_number}</Typography>
                      <Typography variant="body2" color="text.secondary">{n.partner_name}</Typography>
                      <Chip size="small" label={`${n.lines.length} linii`} />
                      {n.total_weight && <Chip size="small" label={`${n.total_weight} kg`} variant="outlined" />}
                    </Stack>
                  </Paper>
                ))}
              </>
            )}
            {importing && <LinearProgress />}
          </Stack>
        )}

        {/* ── ERP TAB ── */}
        {tab === 1 && (
          <Stack spacing={2}>
            {importResult ? (
              <Stack spacing={1}>
                {importResult.imported > 0 && (
                  <Alert severity="success" icon={<CheckCircleIcon />}>
                    {importResult.imported} notă(e) importată(e) cu succes!
                  </Alert>
                )}
                {importResult.errors.map((e, i) => (
                  <Alert severity="error" icon={<ErrorIcon />} key={i}>{e}</Alert>
                ))}
              </Stack>
            ) : (
              <>
                <Alert severity="info">
                  Introduceți URL-ul endpoint-ului ERP care returnează note de culegere în format JSON.
                </Alert>
                {erpError && <Alert severity="error">{erpError}</Alert>}
                <TextField label="URL ERP" placeholder="https://erp.firma.ro/api/pick-notes"
                  value={erpUrl} onChange={e => setErpUrl(e.target.value)} size="small" fullWidth />
                <TextField label="API Key / Token (opțional)" type="password"
                  value={erpApiKey} onChange={e => setErpApiKey(e.target.value)} size="small" fullWidth />
                <Button variant="outlined" startIcon={erpFetchLoading ? <CircularProgress size={18} /> : <SyncIcon />}
                  onClick={handleErpFetch} disabled={!erpUrl || erpFetchLoading}>
                  Preia din ERP
                </Button>
                {erpPreview.length > 0 && (
                  <Alert severity="success">{erpPreview.length} notă(e) preluată(e) din ERP</Alert>
                )}
                {erpPreview.map(n => (
                  <Paper key={n.erp_cmd_number} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Typography fontFamily="monospace" fontWeight={700}>{n.erp_cmd_number}</Typography>
                      <Typography variant="body2" color="text.secondary">{n.partner_name}</Typography>
                      <Chip size="small" label={`${n.lines.length} linii`} />
                    </Stack>
                  </Paper>
                ))}

                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography fontWeight={700}>Format JSON așteptat</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <TextField multiline rows={10} fullWidth
                      value={JSON.stringify({ erp_cmd_number: 'CMD_116731', erp_date: '2026-03-12', partner_name: 'CER ELECTRO AVG S.R.L.', agent_name: 'DOBRESCU DANIEL', total_weight: 331.40, lines: [{ product_name: 'CYY-F 5X2.5 NYY-FR', stock_code: 'VZCB_CMP', lot_number: '##E1000 POWERVINE 0-1012 1012 M', length_available: 0.812, quantity_to_pick: 0.500, quantity_remaining: 0.312, weight: 147.50, uom: 'Km' }] }, null, 2)}
                      inputProps={{ readOnly: true, style: { fontFamily: 'monospace', fontSize: '0.78rem' } }} />
                  </AccordionDetails>
                </Accordion>
              </>
            )}
            {importing && <LinearProgress />}
          </Stack>
        )}

        {/* ── PDF TAB ── */}
        {tab === 2 && (
          <Stack spacing={2}>
            {importResult ? (
              <Stack spacing={1}>
                {importResult.imported > 0 && (
                  <Alert severity="success" icon={<CheckCircleIcon />}>
                    Nota importată cu succes din PDF!
                  </Alert>
                )}
                {importResult.errors.map((e, i) => (
                  <Alert severity="error" icon={<ErrorIcon />} key={i}>{e}</Alert>
                ))}
              </Stack>
            ) : (
              <>
                <Alert severity="info">
                  Încărcați un PDF „Notă de culegere" generat de ERP-ul NK Smart Cables.
                  Sistemul extrage automat datele din tabel — CMD, partener, articole, loturi, cantități.
                </Alert>

                {pdfErrors.map((e, i) => <Alert severity="error" key={i}>{e}</Alert>)}
                {pdfWarnings.map((w, i) => <Alert severity="warning" key={i}>{w}</Alert>)}

                {pdfLoading && (
                  <Stack spacing={1} alignItems="center" py={2}>
                    <CircularProgress />
                    <Typography variant="body2" color="text.secondary">Se procesează PDF-ul…</Typography>
                  </Stack>
                )}

                {!pdfLoading && !pdfNote && (
                  <Button
                    variant="outlined"
                    size="large"
                    startIcon={<PictureAsPdfIcon />}
                    onClick={() => pdfInputRef.current?.click()}
                    sx={{ py: 2, borderStyle: 'dashed' }}
                  >
                    Alege fișier PDF (Notă de culegere NK)
                  </Button>
                )}
                <input ref={pdfInputRef} type="file" accept=".pdf"
                  style={{ display: 'none' }} onChange={handlePdfChange} />

                {pdfNote && !pdfLoading && (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                        <Typography fontFamily="monospace" fontWeight={700} fontSize="1rem">
                          {pdfNote.erp_cmd_number}
                        </Typography>
                        {pdfNote.erp_date && (
                          <Chip size="small" label={new Date(pdfNote.erp_date).toLocaleDateString('ro-RO')} variant="outlined" />
                        )}
                        <Chip size="small" label={`${pdfNote.lines.length} linii extrase`} color="success" />
                        {pdfNote.total_weight && (
                          <Chip size="small" label={`${pdfNote.total_weight} kg total`} variant="outlined" />
                        )}
                      </Stack>
                      {pdfNote.partner_name && (
                        <Typography variant="body2">
                          <strong>Partener:</strong> {pdfNote.partner_name}
                          {pdfNote.contact_person && ` — ${pdfNote.contact_person}`}
                        </Typography>
                      )}
                      {pdfNote.agent_name && (
                        <Typography variant="body2">
                          <strong>Agent:</strong> {pdfNote.agent_name}
                          {pdfNote.delivery_type && ` | ${pdfNote.delivery_type}`}
                        </Typography>
                      )}
                      <Divider />
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: 'grey.50' }}>
                              <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>Articol</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>Cod gest.</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>Disp.</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.main' }}>De tăiat</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>UM</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>Rămâne</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>Gr.</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>Lot intrare</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {pdfNote.lines.map((l, i) => (
                              <TableRow key={i} hover>
                                <TableCell sx={{ color: 'text.secondary' }}>{i + 1}</TableCell>
                                <TableCell><Typography variant="body2" fontWeight={600}>{l.product_name ?? '—'}</Typography></TableCell>
                                <TableCell><Typography variant="body2" fontFamily="monospace">{l.stock_code ?? '—'}</Typography></TableCell>
                                <TableCell align="right" sx={{ color: 'text.secondary' }}>{l.length_available ?? '—'}</TableCell>
                                <TableCell align="right"><Typography fontWeight={700} color="primary.main">{l.quantity_to_pick}</Typography></TableCell>
                                <TableCell align="right">{l.uom ?? 'Km'}</TableCell>
                                <TableCell align="right" sx={{ color: 'success.main' }}>{l.quantity_remaining ?? '—'}</TableCell>
                                <TableCell align="right">{l.weight ? `${l.weight}` : '—'}</TableCell>
                                <TableCell><Typography variant="caption" fontFamily="monospace" sx={{ wordBreak: 'break-all', fontSize: '0.7rem' }}>{l.lot_number ?? '—'}</Typography></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      <Button variant="text" size="small" startIcon={<PictureAsPdfIcon />}
                        onClick={() => pdfInputRef.current?.click()}>
                        Alege alt PDF
                      </Button>
                    </Stack>
                  </Paper>
                )}
              </>
            )}
            {importing && <LinearProgress />}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Închide</Button>
        {tab === 0 && !importResult && csvPreview.length > 0 && (
          <Button variant="contained" onClick={handleCsvImport} disabled={importing}
            startIcon={importing ? <CircularProgress size={18} /> : <UploadFileIcon />}>
            Importă {csvPreview.length} Notă(e)
          </Button>
        )}
        {tab === 1 && !importResult && erpPreview.length > 0 && (
          <Button variant="contained" onClick={handleErpImport} disabled={importing}
            startIcon={importing ? <CircularProgress size={18} /> : <SyncIcon />}>
            Importă {erpPreview.length} Notă(e)
          </Button>
        )}
        {tab === 2 && !importResult && pdfNote && !pdfLoading && pdfErrors.length === 0 && (
          <Button variant="contained" onClick={handlePdfImport} disabled={importing}
            startIcon={importing ? <CircularProgress size={18} /> : <PictureAsPdfIcon />}>
            Importă nota din PDF
          </Button>
        )}
        {importResult && (
          <Button variant="contained" onClick={handleClose} startIcon={<CheckCircleIcon />}>
            Gata
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PickNotesPage() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<PickNote[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPartner, setFilterPartner] = useState('');
  const [page] = useState(1);

  const [importOpen, setImportOpen] = useState(false);
  const [importTab, setImportTab] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [generateNote, setGenerateNote] = useState<PickNote | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await pickNotesService.list({
        status: filterStatus || undefined,
        partner: filterPartner || undefined,
        page, limit: 50,
      });
      setNotes(res.data);
      setTotal(res.total);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message ?? 'Eroare la încărcare');
    }
    setLoading(false);
  }, [filterStatus, filterPartner, page]);

  useEffect(() => { void load(); }, [load]);

  const handleCancel = async (id: string) => {
    try {
      await pickNotesService.cancel(id);
      void load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error ?? err.message ?? 'Eroare anulare');
    }
  };

  const pendingCount = notes.filter(n => n.status === 'PENDING').length;
  const inProgressCount = notes.filter(n => n.status === 'IN_PROGRESS').length;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header — identic cu Comenzi Furnizor */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4">Note de Culegere</Typography>
          <Typography variant="body2" color="text.secondary">
            Gestionare note culegere ERP — format CMD_XXXXXX / DD/MM/YYYY
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<SyncIcon />}
            onClick={() => { setImportTab(1); setImportOpen(true); }}>
            Import ERP
          </Button>
          <Button variant="outlined" startIcon={<UploadFileIcon />}
            onClick={() => { setImportTab(0); setImportOpen(true); }}>
            Import CSV
          </Button>
          <Button variant="outlined" color="error" startIcon={<PictureAsPdfIcon />}
            onClick={() => { setImportTab(2); setImportOpen(true); }}>
            Import PDF
          </Button>
        </Stack>
      </Stack>

      {/* Summary chips */}
      <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
        <Chip label={`Total: ${total}`} variant="outlined" />
        {pendingCount > 0 && <Chip label={`${pendingCount} în așteptare`} color="warning" />}
        {inProgressCount > 0 && <Chip label={`${inProgressCount} în lucru`} color="info" />}
      </Stack>

      {/* Filters */}
      <Stack direction="row" spacing={2} mb={2} flexWrap="wrap">
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Status</InputLabel>
          <Select value={filterStatus} label="Status" onChange={e => setFilterStatus(e.target.value)}>
            <MenuItem value="">Toate</MenuItem>
            <MenuItem value="PENDING">În așteptare</MenuItem>
            <MenuItem value="IN_PROGRESS">În lucru</MenuItem>
            <MenuItem value="COMPLETED">Finalizate</MenuItem>
            <MenuItem value="CANCELLED">Anulate</MenuItem>
          </Select>
        </FormControl>
        <TextField size="small" label="Partener" placeholder="Căutare…"
          value={filterPartner} onChange={e => setFilterPartner(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load()} sx={{ minWidth: 220 }} />
        <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
          {loading ? 'Se încarcă…' : 'Caută'}
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell sx={{ fontWeight: 700 }}>CMD ERP</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Data ERP</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Partener</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Agent</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Linii</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Greutate</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Sursă</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Picking</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            )}
            {!loading && notes.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Nicio notă de culegere. Importați prima notă din ERP sau din CSV.
                </TableCell>
              </TableRow>
            )}
            {notes.map(note => (
              <TableRow key={note.id} hover sx={{ cursor: 'pointer', bgcolor: note.status === 'PENDING' ? '#fffde7' : 'inherit' }}
                onClick={() => setDetailId(note.id)}>
                <TableCell>
                  <Typography fontWeight={700} fontFamily="monospace" fontSize="0.85rem">{note.erp_cmd_number}</Typography>
                </TableCell>
                <TableCell>{note.erp_date ? new Date(note.erp_date).toLocaleDateString('ro-RO') : '—'}</TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>{note.partner_name ?? '—'}</Typography>
                  <Typography variant="caption" color="text.secondary">{note.contact_person}</Typography>
                </TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{note.agent_name ?? '—'}</TableCell>
                <TableCell align="center"><Chip label={note.line_count ?? 0} size="small" variant="outlined" /></TableCell>
                <TableCell align="right">{note.total_weight ? `${note.total_weight} kg` : '—'}</TableCell>
                <TableCell><Chip label={SOURCE_LABEL[note.source] ?? note.source} size="small" variant="outlined" /></TableCell>
                <TableCell><Chip label={NOTE_STATUS_LABEL[note.status]} color={NOTE_STATUS_COLOR[note.status]} size="small" /></TableCell>
                <TableCell>
                  {note.picking_job_id ? (
                    <Tooltip title="Job picking generat">
                      <Chip label="Job activ" color="success" size="small"
                        onClick={e => { e.stopPropagation(); navigate('/pick-jobs'); }} />
                    </Tooltip>
                  ) : note.status === 'PENDING' ? (
                    <Tooltip title="Generează job de picking">
                      <IconButton size="small" color="primary"
                        onClick={e => { e.stopPropagation(); setGenerateNote(note); }}>
                        <PlayArrowIcon />
                      </IconButton>
                    </Tooltip>
                  ) : '—'}
                </TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  {note.status !== 'CANCELLED' && note.status !== 'COMPLETED' && (
                    <Tooltip title="Anulează nota">
                      <IconButton size="small" color="error" onClick={() => handleCancel(note.id)}>
                        <CancelIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialogs */}
      <ImportDialog open={importOpen} initialTab={importTab}
        onClose={() => setImportOpen(false)}
        onImported={() => { setImportOpen(false); void load(); }} />

      <DetailDialog noteId={detailId} open={!!detailId}
        onClose={() => setDetailId(null)}
        onGenerate={note => { setDetailId(null); setGenerateNote(note); }}
        onCancel={id => { void handleCancel(id); void load(); }} />

      <GeneratePickingDialog note={generateNote} open={!!generateNote}
        onClose={() => setGenerateNote(null)}
        onDone={() => { setGenerateNote(null); void load(); }} />
    </Box>
  );
}