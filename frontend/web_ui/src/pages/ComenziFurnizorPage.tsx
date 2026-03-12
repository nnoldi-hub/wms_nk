import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, IconButton, Tooltip, Stack, Autocomplete,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

const API = 'http://localhost:3011/api/v1';

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
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} size="large">
          Comandă Nouă
        </Button>
      </Stack>

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
    </Box>
  );
}
