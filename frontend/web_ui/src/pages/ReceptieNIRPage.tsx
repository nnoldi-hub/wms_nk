import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, TextField, Select, MenuItem, FormControl,
  InputLabel, Stack, Alert, Chip, Divider,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PrintIcon from '@mui/icons-material/Print';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';

const API = 'http://localhost:3011/api/v1';

const GESTIUNI = [
  { code: 'VZCB_CMP', name: 'VZCB_CMP 01.Vanzari CABLURI (CMP)' },
  { code: 'AMB_CMP',  name: 'AMB_CMP 04.AMBALAJE (CMP)' },
  { code: 'PROD_CMP', name: 'PROD_CMP 02.Productie (CMP)' },
  { code: 'SCULE',    name: 'SCULE 05.Scule si SDV-uri' },
];

interface NIRLine {
  line_number: number;
  material_name: string;
  cod_material: string;
  cont_debitor: string;
  unit: string;
  cant_doc: string;
  cant_received: string;
  price_intrare: string;
  total_fara_tva: number;
  order_line_id?: string;
  product_sku?: string;
}

interface POData {
  id: string;
  order_number: string;
  supplier_name: string;
  delivery_date?: string;
  invoice_number?: string;
  lines: {
    id: string;
    line_number: number;
    product_name: string;
    product_sku: string;
    quantity: number;
    unit: string;
    unit_price: number;
    packaging_type?: string;
  }[];
}

interface SavedNIR {
  nir_number: string;
  id: string;
  total_fara_tva: number;
}

const emptyLine = (num: number): NIRLine => ({
  line_number: num,
  material_name: '',
  cod_material: '',
  cont_debitor: '',
  unit: 'Buc',
  cant_doc: '',
  cant_received: '',
  price_intrare: '',
  total_fara_tva: 0,
});

export default function ReceptieNIRPage() {
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const poId = searchParams.get('po');

  const [po, setPo] = useState<POData | null>(null);
  const [nirNumber, setNirNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10));
  const [gestiune, setGestiune] = useState('VZCB_CMP');
  const [transportDoc, setTransportDoc] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<NIRLine[]>([emptyLine(1)]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedNIR | null>(null);
  const [loadingPo, setLoadingPo] = useState(false);

  const token = localStorage.getItem('accessToken');

  const loadNextNir = useCallback(async () => {
    const hdrs = { Authorization: `Bearer ${token}` };
    const r = await fetch(`${API}/goods-receipts/next-number`, { headers: hdrs });
    const j = await r.json();
    if (j.success) setNirNumber(j.data);
  }, [token]);

  useEffect(() => {
    loadNextNir();
    if (poId) {
      const hdrs = { Authorization: `Bearer ${token}` };
      setLoadingPo(true);
      fetch(`${API}/purchase-orders/${poId}`, { headers: hdrs })
        .then(r => r.json())
        .then(j => {
          setLoadingPo(false);
          if (!j.success) return;
          const poData: POData = j.data;
          setPo(poData);
          setSupplierName(poData.supplier_name);
          if (poData.invoice_number) setInvoiceNumber(poData.invoice_number);
          setLines(
            poData.lines.map((l, i) => ({
              line_number: i + 1,
              material_name: l.product_name,
              cod_material: l.product_sku || '',
              cont_debitor: '',
              unit: l.unit === 'Km' ? 'Km' : l.unit === 'Buc' ? 'Buc' : l.unit,
              cant_doc: String(l.quantity),
              cant_received: String(l.quantity),
              price_intrare: l.unit_price > 0 ? String(l.unit_price) : '',
              total_fara_tva: Math.round(l.quantity * (l.unit_price || 0) * 100) / 100,
              order_line_id: l.id,
              product_sku: l.product_sku || '',
            }))
          );
        })
        .catch(() => setLoadingPo(false));
    }
  }, [poId, token, loadNextNir]);

  const updateLine = (idx: number, field: keyof NIRLine, val: string) => {
    setLines(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      if (field === 'cant_received' || field === 'price_intrare') {
        const qty = parseFloat(field === 'cant_received' ? val : next[idx].cant_received) || 0;
        const prt = parseFloat(field === 'price_intrare' ? val : next[idx].price_intrare) || 0;
        next[idx].total_fara_tva = Math.round(qty * prt * 100) / 100;
      }
      return next;
    });
  };

  const addLine = () =>
    setLines(prev => [...prev, { ...emptyLine(prev.length + 1), unit: 'Buc' }]);

  const removeLine = (idx: number) =>
    setLines(prev =>
      prev.filter((_, i) => i !== idx).map((l, i) => ({ ...l, line_number: i + 1 }))
    );

  const total = lines.reduce((s, l) => s + (l.total_fara_tva || 0), 0);

  const handleSubmit = async () => {
    if (!supplierName || !nirNumber) return;
    const hdrs = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    setSaving(true);
    try {
      const body = {
        nir_number: nirNumber,
        supplier_order_id: poId || undefined,
        supplier_name: supplierName,
        invoice_number: invoiceNumber || undefined,
        invoice_date: invoiceDate || undefined,
        receipt_date: receiptDate,
        gestiune: GESTIUNI.find(g => g.code === gestiune)?.name || gestiune,
        gestiune_code: gestiune,
        transport_doc: transportDoc || undefined,
        notes: notes || undefined,
        lines: lines.map((l, i) => ({
          ...l,
          line_number: i + 1,
          cant_doc: parseFloat(l.cant_doc) || 0,
          cant_received: parseFloat(l.cant_received) || 0,
          price_intrare: parseFloat(l.price_intrare) || 0,
        })),
      };
      const r = await fetch(`${API}/goods-receipts`, {
        method: 'POST', headers: hdrs, body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.success) {
        setSaved({
          nir_number: j.data.nir_number || nirNumber,
          id: j.data.id,
          total_fara_tva: j.data.total_fara_tva || total,
        });
      } else {
        alert(j.message || 'Eroare la salvare NIR');
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    if (!saved) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    const linesHtml = lines.map((l, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${l.material_name}</td>
        <td>${l.cont_debitor || ''}</td>
        <td>${l.cod_material || ''}</td>
        <td>${l.unit}</td>
        <td style="text-align:right">${parseFloat(l.cant_doc || '0').toFixed(3)}</td>
        <td style="text-align:right">${parseFloat(l.cant_received || '0').toFixed(3)}</td>
        <td style="text-align:right">${parseFloat(l.price_intrare || '0').toFixed(2)}</td>
        <td style="text-align:right">${(l.total_fara_tva || 0).toFixed(2)}</td>
      </tr>`).join('');
    win.document.write(`<!DOCTYPE html><html><head><title>NIR ${saved.nir_number}</title>
      <style>body{font-family:Arial,sans-serif;font-size:11px;margin:20px}
      h2{text-align:center;font-size:14px}h3{text-align:center;font-size:12px;font-weight:normal}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border:1px solid #333;padding:3px 5px}th{background:#eee;font-weight:bold}
      .header-info{display:flex;justify-content:space-between;margin:8px 0;font-size:11px}
      .total-row{font-weight:bold;background:#f5f5f5}.footer{margin-top:30px;display:flex;justify-content:space-between}
      </style></head><body>
      <div style="text-align:center"><strong>NK SMART CABLES SRL</strong></div>
      <h2>NOTA DE INTRARE - RECEPȚIE</h2>
      <h3>Nr. ${saved.nir_number} din ${receiptDate}</h3>
      <div class="header-info">
        <span>Gestiunea: <strong>${GESTIUNI.find(g => g.code === gestiune)?.name || gestiune}</strong></span>
        <span>Furnizor: <strong>${supplierName}</strong></span>
      </div>
      <div class="header-info">
        <span>Subsemnații, membri ai comisiei de recepție, am procedat la recepționarea valorilor materiale furnizate de:</span>
      </div>
      <div class="header-info">
        <span>cu factura nr. <strong>${invoiceNumber || '—'}</strong> din <strong>${invoiceDate || '—'}</strong></span>
        <span>cu vagonul/auto nr. <strong>${transportDoc || '—'}</strong></span>
      </div>
      <table>
        <thead><tr>
          <th>Nr.crt</th><th>Denumire material</th><th>Cont Debitor</th><th>Cod material</th>
          <th>UM</th><th>Cant. Doc.</th><th>Cant. Rec.</th><th>Preț Intrare</th><th>Total Fără TVA</th>
        </tr></thead>
        <tbody>${linesHtml}
          <tr class="total-row"><td colspan="8" style="text-align:right">Valoare comandă:</td>
          <td style="text-align:right">${saved.total_fara_tva.toFixed(2)} ROL</td></tr>
        </tbody>
      </table>
      <div class="footer">
        <span>Comisia de recepție:</span>
        <span>Primit în gestiune:</span>
      </div>
      <script>window.print();window.close();</script></body></html>`);
    win.document.close();
  };

  // ─── Confirmare salvare ───
  if (saved) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', maxWidth: 700, mx: 'auto', mt: 4 }}>
        <CheckCircleIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
        <Typography variant="h4" gutterBottom>NIR Înregistrat cu Succes</Typography>
        <Paper sx={{ p: 3, mb: 4, bgcolor: 'success.50', border: '2px solid', borderColor: 'success.main' }}>
          <Typography variant="h3" color="primary" fontFamily="monospace" fontWeight={700}>
            {saved.nir_number}
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
            Furnizor: {supplierName} · Gestiune: {GESTIUNI.find(g => g.code === gestiune)?.name}
          </Typography>
          <Typography variant="h6" color="success.main" mt={1}>
            Total fără TVA: {saved.total_fara_tva.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} ROL
          </Typography>
        </Paper>
        <Stack direction="row" spacing={2} justifyContent="center">
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint} size="large">
            Printează NIR
          </Button>
          <Button variant="contained" onClick={() => navigate('/comenzi-furnizor')} size="large">
            Înapoi la Comenzi
          </Button>
          <Button onClick={() => { setSaved(null); loadNextNir(); setLines([emptyLine(1)]); }} size="large">
            NIR Nou
          </Button>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1300, mx: 'auto' }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/comenzi-furnizor')} variant="outlined" size="small">
          Comenzi
        </Button>
        <Box>
          <Typography variant="h4">Notă de Intrare - Recepție</Typography>
          <Typography variant="body2" color="text.secondary">
            Format NK{new Date().getFullYear().toString().slice(-2)}_XXX · Creat automat pe baza comenzii furnizor
          </Typography>
        </Box>
      </Stack>

      {loadingPo && (
        <Alert severity="info" sx={{ mb: 2 }}>Încărcare date din comanda furnizor...</Alert>
      )}
      {po && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Recepție pe baza comenzii{' '}
          <strong style={{ fontFamily: 'monospace' }}>{po.order_number}</strong> —{' '}
          {po.supplier_name}
          {po.delivery_date && ` · Termen: ${po.delivery_date.slice(0, 10)}`}
        </Alert>
      )}

      {/* Header NIR */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 1 }}>
          Date NIR
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <TextField
            label="Nr. NIR *"
            value={nirNumber}
            onChange={e => setNirNumber(e.target.value)}
            sx={{ flex: '0 0 150px' }}
            InputProps={{ style: { fontFamily: 'monospace', fontWeight: 700, fontSize: '1.1rem' } }}
          />
          <TextField
            label="Data recepției *"
            type="date"
            value={receiptDate}
            onChange={e => setReceiptDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ flex: '0 0 155px' }}
          />
          <FormControl sx={{ flex: '1 1 300px' }} required>
            <InputLabel>Gestiune *</InputLabel>
            <Select value={gestiune} label="Gestiune *" onChange={e => setGestiune(e.target.value)}>
              {GESTIUNI.map(g => (
                <MenuItem key={g.code} value={g.code}>
                  <Chip label={g.code} size="small" sx={{ mr: 1, fontFamily: 'monospace', fontSize: '0.7rem' }} />
                  {g.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            label="Furnizor *"
            value={supplierName}
            onChange={e => setSupplierName(e.target.value)}
            sx={{ flex: '1 1 240px' }}
          />
          <TextField
            label="Nr. Factură"
            value={invoiceNumber}
            onChange={e => setInvoiceNumber(e.target.value)}
            sx={{ flex: '0 0 180px' }}
            placeholder="ex: BNENG.0217.2026"
          />
          <TextField
            label="Data Factură"
            type="date"
            value={invoiceDate}
            onChange={e => setInvoiceDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ flex: '0 0 155px' }}
          />
          <TextField
            label="Nr. Vagon / Auto"
            value={transportDoc}
            onChange={e => setTransportDoc(e.target.value)}
            sx={{ flex: '0 0 180px' }}
          />
        </Box>
      </Paper>

      {/* Linii NIR */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: 1 }}>
          Materiale recepționate ({lines.length} linii)
        </Typography>
        <TableContainer sx={{ maxHeight: 440, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {['Nr.crt', 'Denumire Material', 'Cont Debitor', 'Cod Material', 'UM', 'Cant. Doc.', 'Cant. Recep.', 'Preț Intrare', 'Total Fără TVA', ''].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 700, bgcolor: 'grey.100', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((l, idx) => {
                const cantRec = parseFloat(l.cant_received) || 0;
                const cantDoc = parseFloat(l.cant_doc) || 0;
                const isShort = cantDoc > 0 && cantRec < cantDoc;
                return (
                  <TableRow key={idx} hover sx={{ bgcolor: isShort ? 'warning.50' : undefined }}>
                    <TableCell sx={{ color: 'text.disabled', width: 32, fontSize: '0.8rem' }}>{idx + 1}</TableCell>
                    <TableCell>
                      <TextField
                        variant="standard"
                        value={l.material_name}
                        onChange={e => updateLine(idx, 'material_name', e.target.value)}
                        sx={{ minWidth: 190 }}
                        inputProps={{ style: { fontSize: '0.85rem' } }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        variant="standard"
                        value={l.cont_debitor}
                        onChange={e => updateLine(idx, 'cont_debitor', e.target.value)}
                        placeholder="P"
                        sx={{ width: 50 }}
                        inputProps={{ style: { fontSize: '0.85rem', textAlign: 'center' } }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        variant="standard"
                        value={l.cod_material}
                        onChange={e => updateLine(idx, 'cod_material', e.target.value)}
                        sx={{ width: 80 }}
                        inputProps={{ style: { fontSize: '0.85rem' } }}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        variant="standard"
                        value={l.unit}
                        onChange={e => updateLine(idx, 'unit', e.target.value as string)}
                        sx={{ width: 55, fontSize: '0.85rem' }}
                      >
                        {['Km', 'Buc', 'Kg', 'm', 'Rol'].map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <TextField
                        variant="standard"
                        type="number"
                        value={l.cant_doc}
                        onChange={e => updateLine(idx, 'cant_doc', e.target.value)}
                        sx={{ width: 75 }}
                        inputProps={{ step: 0.001, style: { textAlign: 'right', fontSize: '0.85rem' } }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        variant="standard"
                        type="number"
                        value={l.cant_received}
                        onChange={e => updateLine(idx, 'cant_received', e.target.value)}
                        sx={{ width: 75 }}
                        inputProps={{
                          step: 0.001,
                          style: {
                            textAlign: 'right',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            color: isShort ? '#d32f2f' : undefined,
                          },
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        variant="standard"
                        type="number"
                        value={l.price_intrare}
                        onChange={e => updateLine(idx, 'price_intrare', e.target.value)}
                        sx={{ width: 90 }}
                        inputProps={{ step: 0.01, style: { textAlign: 'right', fontSize: '0.85rem' } }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                      {(l.total_fara_tva || 0).toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => removeLine(idx)}
                        disabled={lines.length === 1}
                        sx={{ minWidth: 0, p: 0.5 }}
                      >
                        <DeleteIcon sx={{ fontSize: '1rem' }} />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        <Divider sx={{ my: 1.5 }} />
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Button size="small" startIcon={<AddCircleOutlineIcon />} onClick={addLine}>
            Adaugă Linie
          </Button>
          <Typography variant="h6" fontWeight={700} color="primary">
            Valoare comandă: {total.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} ROL
          </Typography>
        </Stack>
      </Paper>

      {/* Footer */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        <TextField
          label="Observații"
          multiline
          rows={2}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          sx={{ flex: 1 }}
        />
        <Button
          variant="contained"
          size="large"
          onClick={handleSubmit}
          disabled={saving || !supplierName || !nirNumber}
          sx={{ height: 56, px: 4, alignSelf: 'flex-end' }}
        >
          {saving ? 'Salvare...' : 'Înregistrează NIR'}
        </Button>
      </Box>
    </Box>
  );
}
