import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, IconButton, Tooltip, Stack, Autocomplete, Alert, LinearProgress,
  Tab, Tabs,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import SyncIcon from '@mui/icons-material/Sync';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

// ─── CSV helpers ─────────────────────────────────────────────────────────────
// Expected CSV columns (tab or comma separated):
// Nr.Comanda, Furnizor, DataComanda, TermenLivrare, NumeProdus, SKU, Cantitate, UM, PretLista, Discount%, PretUnitar, TipAmbalare

function parseCSV(text: string): ImportPO[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
  if (lines.length < 2) return [];
  const sep = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, '_'));

  const col = (row: string[], names: string[]): string => {
    for (const n of names) {
      const idx = headers.findIndex(h => h.includes(n));
      if (idx >= 0 && row[idx]) return row[idx].trim().replace(/^"|"$/g, '');
    }
    return '';
  };

  const orderMap: Record<string, ImportPO> = {};
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const row = lines[i].split(sep);
    const nr = col(row, ['nr_comanda', 'nr__comanda', 'comanda', 'order_number', 'numar']);
    const supplier = col(row, ['furnizor', 'supplier']);
    if (!nr || !supplier) continue;

    if (!orderMap[nr]) {
      orderMap[nr] = {
        order_number: nr,
        supplier_name: supplier,
        order_date: col(row, ['data', 'order_date', 'data_comanda']).slice(0, 10) || new Date().toISOString().slice(0, 10),
        delivery_date: col(row, ['termen', 'delivery_date', 'termen_livrare']).slice(0, 10) || '',
        currency: col(row, ['valuta', 'currency']) || 'RON',
        notes: col(row, ['observ', 'notes', 'nota']) || '',
        lines: [],
      };
    }
    const productName = col(row, ['produs', 'produs_name', 'denumire', 'product_name', 'material']);
    if (productName) {
      const lp = parseFloat(col(row, ['pret_lista', 'list_price', 'pret_lista_'])) || 0;
      const dp = parseFloat(col(row, ['discount', 'disco'])) || 0;
      const up = parseFloat(col(row, ['pret_unitar', 'unit_price', 'pret_unitar_'])) || (dp ? lp * (1 - dp / 100) : lp);
      const qty = parseFloat(col(row, ['cantitate', 'quantity', 'cant'])) || 0;
      orderMap[nr].lines.push({
        line_number: orderMap[nr].lines.length + 1,
        product_name: productName,
        product_sku: col(row, ['sku', 'cod', 'cod_material']) || '',
        quantity: qty,
        unit: col(row, ['um', 'unit', 'unitate_masura']) || 'Km',
        list_price: lp,
        discount_pct: dp,
        unit_price: up,
        line_value: Math.round(qty * up * 100) / 100,
        packaging_type: col(row, ['ambalare', 'packaging', 'tip_ambalare']) || '',
      });
    }
  }
  return Object.values(orderMap);
}

function downloadSampleCSV() {
  const header = 'Nr.Comanda\tFurnizor\tDataComanda\tTermenLivrare\tDenumire\tSKU\tCantitate\tUM\tPretLista\tDiscount%\tPretUnitar\tTipAmbalare';
  const row1 = 'CA_100\tBENEXEL SRL\t2026-03-13\t2026-04-15\tCYABY-F 5X2.5 NEGRU\tCBL-001\t5\tKm\t120.5000\t5\t114.4750\tTambur';
  const row2 = 'CA_100\tBENEXEL SRL\t2026-03-13\t2026-04-15\tCYKY 4X25 ALB\tCBL-002\t3\tKm\t85.0000\t0\t85.0000\tRola';
  const row3 = 'CA_101\tELECTROCAB SA\t2026-03-13\t2026-05-01\tNYY-J 3X2.5\tCBL-010\t10\tKm\t55.2000\t10\t49.6800\tTambur';
  const csv = [header, row1, row2, row3].join('\n');
  const blob = new Blob([csv], { type: 'text/tab-separated-values' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'comenzi_furnizor_template.tsv'; a.click();
}

interface ImportLine {
  line_number: number; product_name: string; product_sku: string;
  quantity: number; unit: string; list_price: number; discount_pct: number;
  unit_price: number; line_value: number; packaging_type: string;
}
interface ImportPO {
  order_number: string; supplier_name: string; order_date: string;
  delivery_date: string; currency: string; notes: string; lines: ImportLine[];
}
interface ImportResult { created: { order_number: string }[]; skipped: { order_number: string; reason: string }[] }

const API = 'http://localhost:3011/api/v1';
const ERP_URL_KEY = 'wms_erp_sync_url';

const STATUS_COLORS: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  DRAFT: 'default',
  CONFIRMED: 'info',
  RECEIVING: 'warning',
  RECEIVED: 'success',
  CLOSED: 'success',
  CANCELLED: 'error',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Ciornă',
  CONFIRMED: 'Confirmată',
  RECEIVING: 'În recepție',
  RECEIVED: 'Recepționată',
  CLOSED: 'Închisă',
  CANCELLED: 'Anulată',
};

interface POLine {
  id?: string;
  line_number: number;
  product_sku: string;
  product_name: string;
  quantity: string;
  unit: string;
  list_price: string;
  discount_pct: string;
  unit_price: string;
  line_value: number;
  packaging_type: string;
}

interface PO {
  id: string;
  order_number: string;
  supplier_name: string;
  order_date: string;
  delivery_date: string;
  status: string;
  line_count: number;
  computed_total: number;
  currency: string;
  notes?: string;
  lines?: POLine[];
}

const emptyLine = (num: number): POLine => ({
  line_number: num,
  product_sku: '',
  product_name: '',
  quantity: '',
  unit: 'Km',
  list_price: '',
  discount_pct: '0',
  unit_price: '',
  line_value: 0,
  packaging_type: '',
});

const emptyForm = () => ({
  order_number: '',
  supplier_name: '',
  order_date: new Date().toISOString().slice(0, 10),
  delivery_date: '',
  currency: 'RON',
  notes: '',
});

export default function ComenziFurnizorPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PO[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [viewOrder, setViewOrder] = useState<PO | null>(null);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [lines, setLines] = useState<POLine[]>([emptyLine(1)]);
  const [saving, setSaving] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);

  // Import CSV state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importTab, setImportTab] = useState(0); // 0=CSV, 1=ERP
  const [csvPreview, setCsvPreview] = useState<ImportPO[]>([]);
  const [csvError, setCsvError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // ERP sync state
  const [erpUrl, setErpUrl] = useState(localStorage.getItem(ERP_URL_KEY) || '');
  const [erpApiKey, setErpApiKey] = useState('');
  const [erpPreview, setErpPreview] = useState<ImportPO[]>([]);
  const [erpFetchLoading, setErpFetchLoading] = useState(false);
  const [erpError, setErpError] = useState('');

  const token = localStorage.getItem('accessToken');

  const loadOrders = useCallback(async () => {
    const hdrs = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    setLoading(true);
    try {
      const params = filterStatus ? `?status=${filterStatus}` : '';
      const r = await fetch(`${API}/purchase-orders${params}`, { headers: hdrs });
      const j = await r.json();
      if (j.success) setOrders(j.data);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, token]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const openCreate = async () => {
    const hdrs = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const [nn, sup] = await Promise.all([
      fetch(`${API}/purchase-orders/next-number`, { headers: hdrs }).then(r => r.json()),
      fetch(`${API}/purchase-orders/suppliers`, { headers: hdrs }).then(r => r.json()),
    ]);
    setForm({ ...emptyForm(), order_number: nn.success ? nn.data : '' });
    if (sup.success) setSuppliers(sup.data);
    setLines([emptyLine(1)]);
    setCreateOpen(true);
  };

  const updateLine = (idx: number, field: keyof POLine, val: string) => {
    setLines(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      // Auto-calc unit_price from list_price and discount_pct
      if (field === 'list_price' || field === 'discount_pct') {
        const lp = parseFloat(field === 'list_price' ? val : next[idx].list_price) || 0;
        const dp = parseFloat(field === 'discount_pct' ? val : next[idx].discount_pct) || 0;
        next[idx].unit_price = (lp * (1 - dp / 100)).toFixed(4);
      }
      // Auto-calc line_value
      if (['quantity', 'unit_price', 'list_price', 'discount_pct'].includes(field)) {
        const qty = parseFloat(field === 'quantity' ? val : next[idx].quantity) || 0;
        const up = parseFloat(next[idx].unit_price) || 0;
        next[idx].line_value = Math.round(qty * up * 100) / 100;
      }
      return next;
    });
  };

  const addLine = () =>
    setLines(prev => [...prev, emptyLine(prev.length + 1)]);

  const removeLine = (idx: number) =>
    setLines(prev =>
      prev.filter((_, i) => i !== idx).map((l, i) => ({ ...l, line_number: i + 1 }))
    );

  const handleSave = async () => {
    if (!form.order_number || !form.supplier_name) return;
    const hdrs = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    setSaving(true);
    try {
      const body = {
        ...form,
        lines: lines.map((l, i) => ({
          ...l,
          line_number: i + 1,
          quantity: parseFloat(l.quantity) || 0,
          unit_price: parseFloat(l.unit_price) || 0,
          list_price: parseFloat(l.list_price) || 0,
          discount_pct: parseFloat(l.discount_pct) || 0,
        })),
      };
      const r = await fetch(`${API}/purchase-orders`, {
        method: 'POST', headers: hdrs, body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.success) {
        setCreateOpen(false);
        loadOrders();
      } else {
        alert(j.message || 'Eroare la salvare');
      }
    } finally {
      setSaving(false);
    }
  };

  const openView = async (id: string) => {
    const hdrs = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    setViewLoading(true);
    setViewOrder({ id, order_number: '...', supplier_name: '', order_date: '', delivery_date: '', status: 'DRAFT', line_count: 0, computed_total: 0, currency: 'RON' });
    const r = await fetch(`${API}/purchase-orders/${id}`, { headers: hdrs });
    const j = await r.json();
    setViewLoading(false);
    if (j.success) setViewOrder(j.data);
  };

  const totalValue = lines.reduce((s, l) => s + (l.line_value || 0), 0);

  // ─── CSV Import handlers ───────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      try {
        const parsed = parseCSV(text);
        if (parsed.length === 0) {
          setCsvError('Nu s-au detectat comenzi valide. Verifică formatul fișierului.');
        } else {
          setCsvPreview(parsed);
          setCsvError('');
        }
      } catch {
        setCsvError('Eroare la parsarea fișierului.');
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = ''; // reset so same file can be re-uploaded
  };

  const handleImportBulk = async (pos: ImportPO[], source: string) => {
    setImporting(true);
    setImportResult(null);
    try {
      const hdrs = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      const r = await fetch(`${API}/purchase-orders/import-bulk`, {
        method: 'POST', headers: hdrs,
        body: JSON.stringify({ orders: pos, source }),
      });
      const j = await r.json() as { success: boolean; data?: ImportResult; message?: string };
      if (j.success && j.data) {
        setImportResult(j.data);
        loadOrders();
      } else {
        setCsvError(j.message || 'Eroare la import');
      }
    } finally {
      setImporting(false);
    }
  };

  // ─── ERP Sync handlers ────────────────────────────────────────────────────
  const handleErpFetch = async () => {
    if (!erpUrl) return;
    setErpFetchLoading(true);
    setErpError('');
    setErpPreview([]);
    try {
      localStorage.setItem(ERP_URL_KEY, erpUrl);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (erpApiKey) headers['X-Api-Key'] = erpApiKey;
      const r = await fetch(erpUrl, { headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
      const j = await r.json() as unknown;
      // Accept both: array of POs or { orders: [...] } or { data: [...] }
      let pos: ImportPO[] = [];
      if (Array.isArray(j)) pos = j as ImportPO[];
      else if (j && typeof j === 'object') {
        const obj = j as Record<string, unknown>;
        const list = (obj.orders || obj.data || obj.items || []) as ImportPO[];
        pos = list;
      }
      if (pos.length === 0) {
        setErpError('ERP-ul a răspuns, dar fără comenzi (lista goală). Verifică URL-ul sau formatul răspunsului.');
      } else {
        setErpPreview(pos);
      }
    } catch (e: unknown) {
      setErpError(`Nu s-a putut conecta la ERP: ${(e as Error).message}. Verifică URL-ul, CORS și că ERP-ul este accesibil.`);
    } finally {
      setErpFetchLoading(false);
    }
  };

  const closeImport = () => {
    setImportOpen(false);
    setCsvPreview([]);
    setCsvError('');
    setImportResult(null);
    setErpPreview([]);
    setErpError('');
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4">Comenzi Furnizor</Typography>
          <Typography variant="body2" color="text.secondary">
            Gestionare comenzi de achiziție — format CA_XXXX / DD/MM/YYYY
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
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} size="large">
            Comandă Nouă
          </Button>
        </Stack>
      </Stack>

      {/* hidden file input */}
      <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt" style={{ display: 'none' }} onChange={handleFileChange} />

      {/* Filter bar */}
      <Stack direction="row" spacing={2} mb={2}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select value={filterStatus} label="Status" onChange={e => setFilterStatus(e.target.value)}>
            <MenuItem value="">Toate</MenuItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <MenuItem key={k} value={k}>{v}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
          {orders.length} comenz{orders.length === 1 ? 'i' : 'i'}
        </Typography>
      </Stack>

      {/* Table */}
      <TableContainer component={Paper} elevation={2}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'primary.main' }}>
              {['Nr. Comandă', 'Furnizor', 'Data', 'Termen Livrare', 'Status', 'Linii', 'Valoare Totală', 'Acțiuni'].map(h => (
                <TableCell key={h} sx={{ color: 'white', fontWeight: 700 }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>Încărcare...</TableCell></TableRow>
            ) : orders.length === 0 ? (
              <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                Nicio comandă. Apasă "Comandă Nouă" pentru a crea prima comandă furnizor.
              </TableCell></TableRow>
            ) : orders.map(o => (
              <TableRow key={o.id} hover sx={{ cursor: 'pointer' }} onClick={() => openView(o.id)}>
                <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace', color: 'primary.main' }}>
                  {o.order_number}
                </TableCell>
                <TableCell sx={{ fontWeight: 500 }}>{o.supplier_name}</TableCell>
                <TableCell>{o.order_date?.slice(0, 10)}</TableCell>
                <TableCell>{o.delivery_date?.slice(0, 10) || '—'}</TableCell>
                <TableCell>
                  <Chip
                    label={STATUS_LABELS[o.status] ?? o.status}
                    color={STATUS_COLORS[o.status] ?? 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell align="center">{o.line_count}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  {Number(o.computed_total || 0).toLocaleString('ro-RO', { minimumFractionDigits: 2 })} {o.currency}
                </TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  <Tooltip title="Vizualizare detalii">
                    <IconButton size="small" onClick={() => openView(o.id)}>
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Creează NIR din această comandă">
                    <IconButton
                      size="small"
                      color="success"
                      onClick={() => navigate(`/receptie-nir?po=${o.id}`)}
                    >
                      <ReceiptLongIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ─── Dialog Creare Comandă ─── */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xl" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <AddIcon color="primary" />
            <span>Comandă Furnizor Nouă</span>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            {/* Date generale */}
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 1 }}>
                Date generale
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                  label="Nr. Comandă *"
                  value={form.order_number}
                  onChange={e => setForm(f => ({ ...f, order_number: e.target.value }))}
                  sx={{ flex: '0 0 130px' }}
                  InputProps={{ style: { fontFamily: 'monospace', fontWeight: 700 } }}
                />
                <Autocomplete
                  freeSolo
                  options={suppliers}
                  value={form.supplier_name}
                  onInputChange={(_, v) => setForm(f => ({ ...f, supplier_name: v }))}
                  renderInput={params => <TextField {...params} label="Furnizor *" />}
                  sx={{ flex: '1 1 260px' }}
                />
                <TextField
                  label="Data comenzii"
                  type="date"
                  value={form.order_date}
                  onChange={e => setForm(f => ({ ...f, order_date: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: '0 0 155px' }}
                />
                <TextField
                  label="Termen livrare"
                  type="date"
                  value={form.delivery_date}
                  onChange={e => setForm(f => ({ ...f, delivery_date: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: '0 0 155px' }}
                />
                <FormControl sx={{ flex: '0 0 110px' }}>
                  <InputLabel>Valută</InputLabel>
                  <Select value={form.currency} label="Valută" onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                    <MenuItem value="RON">RON</MenuItem>
                    <MenuItem value="EUR">EUR</MenuItem>
                    <MenuItem value="USD">USD</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Box>

            {/* Linii comandă */}
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 1 }}>
                Linii comandă ({lines.length})
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 360, overflow: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {['Nr.', 'Denumire Produs *', 'SKU', 'Cant.', 'UM', 'Preț Listă', 'Disco %', 'Preț Unitar', 'Valoare', 'Ambalare', ''].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 700, bgcolor: 'grey.50', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lines.map((l, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell sx={{ color: 'text.disabled', width: 28, fontSize: '0.75rem' }}>{idx + 1}</TableCell>
                        <TableCell>
                          <TextField
                            variant="standard"
                            value={l.product_name}
                            onChange={e => updateLine(idx, 'product_name', e.target.value)}
                            placeholder="ex: CYABY-F 5X2.5 NEGRU"
                            sx={{ minWidth: 210 }}
                            inputProps={{ style: { fontSize: '0.85rem' } }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField variant="standard" value={l.product_sku} onChange={e => updateLine(idx, 'product_sku', e.target.value)} sx={{ width: 70 }} inputProps={{ style: { fontSize: '0.85rem' } }} />
                        </TableCell>
                        <TableCell>
                          <TextField variant="standard" type="number" value={l.quantity} onChange={e => updateLine(idx, 'quantity', e.target.value)} inputProps={{ step: 0.001, style: { fontSize: '0.85rem', textAlign: 'right' } }} sx={{ width: 75 }} />
                        </TableCell>
                        <TableCell>
                          <Select variant="standard" value={l.unit} onChange={e => updateLine(idx, 'unit', e.target.value as string)} sx={{ width: 55, fontSize: '0.85rem' }}>
                            {['Km', 'Buc', 'Kg', 'm', 'Rol'].map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                          </Select>
                        </TableCell>
                        <TableCell>
                          <TextField variant="standard" type="number" value={l.list_price} onChange={e => updateLine(idx, 'list_price', e.target.value)} inputProps={{ step: 0.0001, style: { fontSize: '0.85rem', textAlign: 'right' } }} sx={{ width: 90 }} />
                        </TableCell>
                        <TableCell>
                          <TextField variant="standard" type="number" value={l.discount_pct} onChange={e => updateLine(idx, 'discount_pct', e.target.value)} inputProps={{ min: 0, max: 100, style: { fontSize: '0.85rem', textAlign: 'right' } }} sx={{ width: 55 }} />
                        </TableCell>
                        <TableCell>
                          <TextField variant="standard" type="number" value={l.unit_price} onChange={e => updateLine(idx, 'unit_price', e.target.value)} inputProps={{ step: 0.0001, style: { fontSize: '0.85rem', textAlign: 'right' } }} sx={{ width: 90 }} />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                          {(l.line_value || 0).toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <TextField variant="standard" value={l.packaging_type} onChange={e => updateLine(idx, 'packaging_type', e.target.value)} placeholder="Tambur" sx={{ width: 75 }} inputProps={{ style: { fontSize: '0.85rem' } }} />
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => removeLine(idx)} disabled={lines.length === 1} color="error">
                            <DeleteIcon sx={{ fontSize: '1rem' }} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1}>
                <Button size="small" startIcon={<AddCircleOutlineIcon />} onClick={addLine}>
                  Adaugă Linie
                </Button>
                <Typography variant="body1" fontWeight={700} color="primary">
                  TOTAL: {totalValue.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} {form.currency}
                </Typography>
              </Stack>
            </Box>

            <TextField
              label="Observații"
              multiline
              rows={2}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>Anulează</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !form.order_number || !form.supplier_name}
            size="large"
          >
            {saving ? 'Salvare...' : 'Salvează Comanda'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Dialog Vizualizare Comandă ─── */}
      {viewOrder && (
        <Dialog open={!!viewOrder} onClose={() => setViewOrder(null)} maxWidth="lg" fullWidth>
          <DialogTitle>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="h6" fontFamily="monospace" color="primary">{viewOrder.order_number}</Typography>
                <Typography variant="h6">—</Typography>
                <Typography variant="h6">{viewOrder.supplier_name}</Typography>
              </Stack>
              <Chip
                label={STATUS_LABELS[viewOrder.status] ?? viewOrder.status}
                color={STATUS_COLORS[viewOrder.status] ?? 'default'}
              />
            </Stack>
          </DialogTitle>
          <DialogContent dividers>
            {viewLoading ? (
              <Typography color="text.secondary" align="center" py={4}>Încărcare...</Typography>
            ) : (
              <>
                <Stack direction="row" spacing={4} mb={2}>
                  <Typography variant="body2">
                    <strong>Data:</strong> {viewOrder.order_date?.slice(0, 10)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Termen:</strong> {viewOrder.delivery_date?.slice(0, 10) || '—'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Valută:</strong> {viewOrder.currency}
                  </Typography>
                </Stack>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        {['Nr.', 'Denumire Produs', 'Cant.', 'UM', 'Preț Listă', 'Disco %', 'Preț Unitar', 'Valoare', 'Ambalare'].map(h => (
                          <TableCell key={h} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(viewOrder.lines || []).map(l => (
                        <TableRow key={l.line_number} hover>
                          <TableCell width={32}>{l.line_number}</TableCell>
                          <TableCell sx={{ fontWeight: 500 }}>{l.product_name}</TableCell>
                          <TableCell align="right">{Number(l.quantity).toLocaleString('ro-RO', { maximumFractionDigits: 3 })}</TableCell>
                          <TableCell>{l.unit}</TableCell>
                          <TableCell align="right">{Number(l.list_price || 0).toLocaleString('ro-RO', { minimumFractionDigits: 4 })}</TableCell>
                          <TableCell align="right">{l.discount_pct}%</TableCell>
                          <TableCell align="right">{Number(l.unit_price || 0).toLocaleString('ro-RO', { minimumFractionDigits: 4 })}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>
                            {Number(l.line_value || 0).toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>{l.packaging_type || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Box mt={2} textAlign="right">
                  <Typography variant="h6" fontWeight={700} color="primary">
                    Valoare comandă: {Number(viewOrder.computed_total || 0).toLocaleString('ro-RO', { minimumFractionDigits: 2 })} {viewOrder.currency}
                  </Typography>
                </Box>
              </>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setViewOrder(null)}>Închide</Button>
            <Button
              variant="contained"
              color="success"
              startIcon={<ReceiptLongIcon />}
              onClick={() => {
                setViewOrder(null);
                navigate(`/receptie-nir?po=${viewOrder!.id}`);
              }}
            >
              Creează NIR
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {/* ─── Dialog Import CSV / ERP ─── */}
      <Dialog open={importOpen} onClose={closeImport} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <UploadFileIcon color="primary" />
            <span>Import Comenzi Furnizor</span>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ minHeight: 340 }}>
          <Tabs value={importTab} onChange={(_, v: number) => setImportTab(v)} sx={{ mb: 2 }}>
            <Tab label="📂 Import CSV / TSV" />
            <Tab label="🔗 Sincronizare ERP" />
          </Tabs>

          {/* ── Tab 0: CSV Import ── */}
          {importTab === 0 && (
            <Box>
              {!importResult ? (
                <>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Fișierul trebuie să conțină coloanele: <strong>Nr.Comanda, Furnizor, DataComanda, TermenLivrare, Denumire, SKU, Cantitate, UM, PretLista, Discount%, PretUnitar, TipAmbalare</strong>.
                    Separatorul poate fi virgulă sau tab. O linie per produs (mai multe linii cu același Nr.Comanda = o singură comandă).
                  </Alert>
                  <Stack direction="row" spacing={2} mb={2}>
                    <Button variant="contained" startIcon={<UploadFileIcon />}
                      onClick={() => fileInputRef.current?.click()}>
                      Alege Fișier CSV / TSV
                    </Button>
                    <Button variant="outlined" startIcon={<DownloadIcon />} onClick={downloadSampleCSV}>
                      Descarcă Template
                    </Button>
                  </Stack>
                  {csvError && <Alert severity="error" sx={{ mb: 2 }}>{csvError}</Alert>}
                  {csvPreview.length > 0 && (
                    <>
                      <Alert severity="success" sx={{ mb: 1 }}>
                        S-au detectat <strong>{csvPreview.length} comenzi</strong> cu total{' '}
                        <strong>{csvPreview.reduce((s, p) => s + p.lines.length, 0)} linii produse</strong>.
                        Began duplicatele sunt sărite automat.
                      </Alert>
                      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 220, mb: 2 }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              {['Nr. Comandă', 'Furnizor', 'Data', 'Termen', 'Linii', 'Total'].map(h => (
                                <TableCell key={h} sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>{h}</TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {csvPreview.map(po => {
                              const total = po.lines.reduce((s, l) => s + l.line_value, 0);
                              return (
                                <TableRow key={po.order_number} hover>
                                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{po.order_number}</TableCell>
                                  <TableCell>{po.supplier_name}</TableCell>
                                  <TableCell>{po.order_date}</TableCell>
                                  <TableCell>{po.delivery_date || '—'}</TableCell>
                                  <TableCell align="center">{po.lines.length}</TableCell>
                                  <TableCell>{total.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} {po.currency || 'RON'}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </>
                  )}
                </>
              ) : (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <CheckCircleIcon sx={{ fontSize: 60, color: 'success.main', mb: 1 }} />
                  <Typography variant="h6" color="success.main">Import finalizat!</Typography>
                  <Typography variant="body2" mt={1}>
                    ✅ <strong>{importResult.created.length}</strong> comenzi importate cu succes.
                  </Typography>
                  {importResult.skipped.length > 0 && (
                    <Box mt={1}>
                      <Typography variant="body2" color="warning.main">
                        ⚠️ <strong>{importResult.skipped.length}</strong> comenzi sărite:
                      </Typography>
                      {importResult.skipped.map(s => (
                        <Typography key={s.order_number} variant="caption" display="block" color="text.secondary">
                          {s.order_number}: {s.reason}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Box>
              )}
              {importing && <LinearProgress sx={{ mt: 1 }} />}
            </Box>
          )}

          {/* ── Tab 1: ERP Sync ── */}
          {importTab === 1 && (
            <Box>
              {!importResult ? (
                <>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    ERP-ul trebuie să expună un endpoint REST care returnează o listă de comenzi în format JSON compatibil WMS (<code>{'[{order_number, supplier_name, order_date, lines:[...]}]'}</code>).
                  </Alert>
                  <Stack spacing={2} mb={2}>
                    <TextField
                      label="URL Endpoint ERP (GET)"
                      placeholder="http://erp.companie.ro/api/purchase-orders"
                      value={erpUrl}
                      onChange={e => setErpUrl(e.target.value)}
                      fullWidth
                      helperText="URL-ul este reținut în sesiunea browser-ului."
                    />
                    <TextField
                      label="API Key (opțional)"
                      placeholder="Bearer token sau API key"
                      value={erpApiKey}
                      onChange={e => setErpApiKey(e.target.value)}
                      type="password"
                      fullWidth
                      helperText="Se trimite în header X-Api-Key"
                    />
                    <Button
                      variant="outlined"
                      startIcon={erpFetchLoading ? undefined : <SyncIcon />}
                      onClick={() => void handleErpFetch()}
                      disabled={!erpUrl || erpFetchLoading}
                    >
                      {erpFetchLoading ? 'Se conectează la ERP...' : 'Preia Comenzi din ERP'}
                    </Button>
                    {erpFetchLoading && <LinearProgress />}
                  </Stack>
                  {erpError && (
                    <Alert severity="error" icon={<ErrorIcon />} sx={{ mb: 2 }}>
                      {erpError}
                    </Alert>
                  )}
                  {erpPreview.length > 0 && (
                    <>
                      <Alert severity="success" sx={{ mb: 1 }}>
                        ERP-ul a returnat <strong>{erpPreview.length} comenzi</strong>. Verifică lista și confirmă importul.
                      </Alert>
                      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 200, mb: 2 }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              {['Nr. Comandă', 'Furnizor', 'Data', 'Linii'].map(h => (
                                <TableCell key={h} sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>{h}</TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {erpPreview.map(po => (
                              <TableRow key={po.order_number} hover>
                                <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{po.order_number}</TableCell>
                                <TableCell>{po.supplier_name}</TableCell>
                                <TableCell>{po.order_date?.slice(0, 10)}</TableCell>
                                <TableCell align="center">{po.lines.length}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </>
                  )}
                </>
              ) : (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <CheckCircleIcon sx={{ fontSize: 60, color: 'success.main', mb: 1 }} />
                  <Typography variant="h6" color="success.main">Sincronizare ERP finalizată!</Typography>
                  <Typography variant="body2" mt={1}>
                    ✅ <strong>{importResult.created.length}</strong> comenzi importate din ERP.
                  </Typography>
                  {importResult.skipped.length > 0 && (
                    <Typography variant="body2" color="warning.main" mt={1}>
                      ⚠️ <strong>{importResult.skipped.length}</strong> comenzi existau deja — sărite.
                    </Typography>
                  )}
                </Box>
              )}
              {importing && <LinearProgress sx={{ mt: 1 }} />}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeImport}>{importResult ? 'Închide' : 'Anulează'}</Button>
          {!importResult && importTab === 0 && csvPreview.length > 0 && (
            <Button
              variant="contained"
              onClick={() => void handleImportBulk(csvPreview, 'CSV_IMPORT')}
              disabled={importing}
              startIcon={<UploadFileIcon />}
            >
              {importing ? 'Se importă...' : `Importă ${csvPreview.length} comenzi`}
            </Button>
          )}
          {!importResult && importTab === 1 && erpPreview.length > 0 && (
            <Button
              variant="contained"
              color="success"
              onClick={() => void handleImportBulk(erpPreview, 'ERP_SYNC')}
              disabled={importing}
              startIcon={<SyncIcon />}
            >
              {importing ? 'Se importă...' : `Importă ${erpPreview.length} comenzi din ERP`}
            </Button>
          )}
        </DialogActions>
      </Dialog>

    </Box>
  );
}
