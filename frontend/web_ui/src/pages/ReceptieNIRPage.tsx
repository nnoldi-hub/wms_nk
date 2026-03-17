import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Button, TextField, Select, MenuItem, FormControl,
  InputLabel, Stack, Alert, Chip, Divider, Tooltip,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PrintIcon from '@mui/icons-material/Print';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

const API = 'http://localhost:3011/api/v1';

const AMBALAJ_TYPES = [
  { value: 'COLAC',  label: 'Colac',    icon: '🔄', hint: 'Colac / Bobină' },
  { value: 'T500',   label: 'T-500',    icon: '🥁', hint: 'Tambur Ø500mm (~500m)' },
  { value: 'T630',   label: 'T-630',    icon: '🥁', hint: 'Tambur Ø630mm (~630m)' },
  { value: 'T800',   label: 'T-800',    icon: '🥁', hint: 'Tambur Ø800mm (~800m)' },
  { value: 'T1000',  label: 'T-1000',   icon: '🥁', hint: 'Tambur Ø1000mm (~1000m)' },
  { value: 'T1250',  label: 'T-1250',   icon: '🥁', hint: 'Tambur Ø1250mm (~1250m)' },
  { value: 'T1600',  label: 'T-1600',   icon: '🥁', hint: 'Tambur Ø1600mm (~1600m)' },
  { value: 'T2000',  label: 'T-2000',   icon: '🥁', hint: 'Tambur Ø2000mm (~2000m)' },
  { value: 'T2500',  label: 'T-2500',   icon: '🥁', hint: 'Tambur Ø2500mm (~2500m)' },
  { value: 'T3000',  label: 'T-3000',   icon: '🥁', hint: 'Tambur Ø3000mm (~3000m)' },
  { value: 'CUTIE',  label: 'Cutie',    icon: '📦', hint: 'Cutie / Colet (buc/kg)' },
];

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
  damaged?: boolean;
  tip_ambalaj?: string;   // COLAC, T500, T630, T800, T1000, T1250, T1600, T2000, T2500, T3000, CUTIE
  nr_ambalaj?: string;    // nr. fizic / prefix serie (ex: E1000, C, B003)
  lungime_colac?: number; // lungime standard per colac (m) — ex: 100, 200, 500 (pentru COLAC)
  tambur_nr?: string;     // @deprecated — backward compat
  metraj_start?: string;  // nr. imprimat capat A al cablului (ex: 0, 21)
  metraj_final?: string;  // nr. imprimat capat B al cablului (ex: 1012, 4228)
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

interface SavedBatch {
  line_number: number;
  material_name: string;
  batch_number: string;
  cant_received: number;
  unit: string;
  notes?: string;
}

// Detecteaza tipul de ambalaj si lungimea din denumire (ex: 'MYYM 2X0.75 C100' -> COLAC 100m)
function detectAmbalaj(productName: string): { tip_ambalaj: string; lungime_colac?: number } {
  const colacMatch = productName.match(/\bC(\d+)\b/);
  if (colacMatch) return { tip_ambalaj: 'COLAC', lungime_colac: parseInt(colacMatch[1]) };
  return { tip_ambalaj: '' };
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
  tip_ambalaj: '',
  nr_ambalaj: '',
  lungime_colac: undefined,
  tambur_nr: '',
  metraj_start: '',
  metraj_final: '',
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
  const [savedBatches, setSavedBatches] = useState<SavedBatch[]>([]);
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
              material_name: l.product_name.replace(/^\d+\s+/, ''),  // strip prefix "1 " din PO
              cod_material: l.product_sku || '',
              cont_debitor: '',
              unit: l.unit === 'Km' ? 'Km' : l.unit === 'Buc' ? 'Buc' : l.unit,
              cant_doc: String(l.quantity),
              cant_received: String(l.quantity),
              price_intrare: l.unit_price > 0 ? String(l.unit_price) : '',
              total_fara_tva: Math.round(l.quantity * (l.unit_price || 0) * 100) / 100,
              order_line_id: l.id,
              product_sku: l.product_sku || '',
              ...(() => {
                const name = l.product_name.replace(/^\d+\s+/, '');
                const det = detectAmbalaj(name);
                return det;
              })(),
              nr_ambalaj: '',
              tambur_nr: '',
              metraj_start: '',
              metraj_final: '',
            }))
          );
        })
        .catch(() => setLoadingPo(false));
    }
  }, [poId, token, loadNextNir]);

  const toSku = (text: string) =>
    text.trim().toUpperCase()
      .replace(/[^A-Z0-9.\-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);

  const updateLine = (idx: number, field: keyof NIRLine, val: string) => {
    setLines(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };

      // Auto-completare cod_material din material_name dacă e gol
      if (field === 'material_name' && !next[idx].cod_material) {
        next[idx].cod_material = val ? toSku(val) : '';
      }

      // Auto-comuta UM la selectarea tipului de ambalaj
      if (field === 'tip_ambalaj') {
        if (val === 'CUTIE') {
          next[idx].unit = 'Buc';
          next[idx].metraj_start = '';
          next[idx].metraj_final = '';
          next[idx].lungime_colac = undefined;
        } else if (val === 'COLAC') {
          next[idx].unit = 'Km';
          // pastreaza lungime_colac daca exista deja din auto-detectie
        } else if (val && val !== '') {
          next[idx].unit = 'Km';
          next[idx].lungime_colac = undefined;
        }
      }

      // Daca se schimba lungime_colac, recalculeaza cant_received total nu se schimba,
      // dar afisam nr colaci live
      if (field === 'lungime_colac') {
        // lung_colac e stocat ca number; val vine ca string din input
        next[idx].lungime_colac = parseFloat(val) || undefined;
      }

      // Auto-calculeaza cantitatea din metraj start-final (doar pentru Km)
      if (field === 'metraj_start' || field === 'metraj_final') {
        const start = parseFloat(field === 'metraj_start' ? val : next[idx].metraj_start || '0') || 0;
        const final = parseFloat(field === 'metraj_final' ? val : next[idx].metraj_final || '0') || 0;
        if (final > start && next[idx].unit === 'Km') {
          const km = ((final - start) / 1000).toFixed(3);
          next[idx].cant_received = km;
          const prt = parseFloat(next[idx].price_intrare) || 0;
          next[idx].total_fara_tva = Math.round(parseFloat(km) * prt * 100) / 100;
        }
      }
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

  const toggleDamaged = (idx: number) =>
    setLines(prev => { const n = [...prev]; n[idx] = { ...n[idx], damaged: !n[idx].damaged }; return n; });

  const total = lines.reduce((s, l) => s + (l.total_fara_tva || 0), 0);

  const handleSubmit = async () => {
    if (!supplierName || !nirNumber) return;
    const hdrs = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    setSaving(true);
    try {
      // Compute anomalii note
      const anomalii: string[] = [];
      lines.forEach(l => {
        if (l.damaged) anomalii.push(`L${l.line_number}:DETERIORAT`);
        const r = parseFloat(l.cant_received) || 0;
        const d = parseFloat(l.cant_doc) || 0;
        if (d > 0 && r > d) anomalii.push(`L${l.line_number}:SUPRALIVR+${Math.round(((r - d) / d) * 100)}%`);
        if (d > 0 && r < d) anomalii.push(`L${l.line_number}:LIPSA-${Math.round(((d - r) / d) * 100)}%`);
      });
      const notesWithAnomalii = anomalii.length
        ? `${notes ? notes + ' | ' : ''}ANOMALII: ${anomalii.join('; ')}`
        : notes;
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
        notes: notesWithAnomalii || undefined,
        lines: (() => {
          // Expandeaza liniile de COLAC in colaci individuali
          const expanded: object[] = [];
          let lineCounter = 0;
          lines.forEach(l => {
            const cantKm = parseFloat(l.cant_received) || 0;
            const isColac = l.tip_ambalaj === 'COLAC' && (l.lungime_colac || 0) > 0;
            const nrColaci = isColac ? Math.round(cantKm * 1000 / l.lungime_colac!) : 0;

            if (isColac && nrColaci > 1) {
              // Expandem in nrColaci sub-linii individuale
              const prefix = (l.nr_ambalaj || 'C').toUpperCase().replace(/\d+$/, '') || 'C';
              const lungM = l.lungime_colac!;
              for (let c = 1; c <= nrColaci; c++) {
                lineCounter++;
                const colacNr = `${prefix}${String(c).padStart(3, '0')}`;
                const lotId = `##${colacNr} ${supplierName} 0-${lungM} ${lungM} M | Ambalaj: COLAC-${lungM}M`;
                expanded.push({
                  ...l,
                  line_number: lineCounter,
                  nr_ambalaj: colacNr,
                  material_name: l.material_name,
                  cant_doc: lungM / 1000,
                  cant_received: lungM / 1000,
                  price_intrare: parseFloat(l.price_intrare) || 0,
                  total_fara_tva: Math.round((lungM / 1000) * (parseFloat(l.price_intrare) || 0) * 100) / 100,
                  metraj_start: '0',
                  metraj_final: String(lungM),
                  notes: lotId,
                });
              }
            } else {
              // Linie normala (tambur sau cutie sau colac unic)
              lineCounter++;
              const ambalajId = (l.nr_ambalaj || l.tambur_nr || '').toUpperCase().replace(/^##/, '');
              let lotId: string | undefined;
              if (ambalajId) {
                const start = l.metraj_start || '0';
                const final = l.metraj_final || '';
                const lengthM = final ? String(Math.round(parseFloat(final) - parseFloat(start))) : '';
                const parts = [`##${ambalajId}`, supplierName];
                if (final) parts.push(`${start}-${final}`);
                if (lengthM) parts.push(`${lengthM} M`);
                lotId = parts.join(' ');
                if (l.tip_ambalaj) lotId += ` | Ambalaj: ${l.tip_ambalaj}`;
              }
              expanded.push({
                ...l,
                line_number: lineCounter,
                cant_doc: parseFloat(l.cant_doc) || 0,
                cant_received: parseFloat(l.cant_received) || 0,
                price_intrare: parseFloat(l.price_intrare) || 0,
                notes: lotId || undefined,
              });
            }
          });
          return expanded;
        })(),
      };
      const r = await fetch(`${API}/goods-receipts`, {
        method: 'POST', headers: hdrs, body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!j.success) {
        alert(j.message || 'Eroare la salvare NIR');
        return;
      }
      // Auto-confirmare NIR: genereaza numarul NK, create batches, actualizeaza PO status
      const nirId = j.data.id;
      const confR = await fetch(`${API}/goods-receipts/${nirId}/confirm`, {
        method: 'POST', headers: hdrs,
      });
      const confJ = await confR.json();
      const finalData = confJ.success ? confJ.data : j.data;
      setSaved({
        nir_number: finalData.nir_number || nirNumber,
        id: finalData.id,
        total_fara_tva: finalData.total_fara_tva || total,
      });
      // Stocheaza batch-urile create pentru afisare QR
      if (confJ.success && finalData.lines) {
        const batches: SavedBatch[] = (finalData.lines as Array<{
          line_number: number; material_name: string; batch_number?: string;
          cant_received: number; unit: string; notes?: string;
        }>)
          .filter(l => l.batch_number)
          .map(l => ({
            line_number: l.line_number,
            material_name: l.material_name,
            batch_number: l.batch_number!,
            cant_received: l.cant_received,
            unit: l.unit,
            notes: l.notes,
          }));
        setSavedBatches(batches);
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

  const handlePrintLabels = () => {
    if (!savedBatches.length || !saved) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;

    const labelSize = 200; // px per QR
    const labelsHtml = savedBatches.map(b => {
      const qrData = JSON.stringify({
        t: 'BATCH', bn: b.batch_number, mat: b.material_name,
        qty: b.cant_received, unit: b.unit, nir: saved!.nir_number,
        ...(b.notes ? { cap: b.notes } : {}),
      });
      // Use Google Charts API to render QR (no JS needed in print window)
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrData)}&size=${labelSize}x${labelSize}&ecc=M`;
      return `
        <div class="label">
          <div class="label-header">NK SMART CABLES</div>
          <img src="${qrUrl}" width="${labelSize}" height="${labelSize}" alt="QR" />
          <div class="batch-number">${b.batch_number}</div>
          <div class="material">${b.material_name}</div>
          <div class="qty">${b.cant_received} ${b.unit}${b.notes ? ' · ' + b.notes : ''}</div>
          <div class="nir">NIR: ${saved!.nir_number}</div>
        </div>`;
    }).join('');

    win.document.write(`<!DOCTYPE html><html><head><title>Etichete — ${saved.nir_number}</title>
      <style>
        @media print { @page { margin: 5mm; } }
        body { font-family: Arial, sans-serif; margin: 0; background: white; }
        .grid { display: flex; flex-wrap: wrap; gap: 8px; padding: 8px; }
        .label {
          border: 2px solid #1565c0; border-radius: 6px; padding: 8px;
          width: 220px; text-align: center; page-break-inside: avoid;
          background: white;
        }
        .label-header { font-size: 9px; font-weight: bold; color: #666; letter-spacing: 1px; margin-bottom: 4px; }
        .batch-number { font-family: monospace; font-size: 11px; font-weight: 900; color: #1565c0; margin: 4px 0; }
        .material { font-size: 9px; word-break: break-word; margin: 2px 0; }
        .qty { font-size: 10px; font-weight: bold; color: #2e7d32; }
        .nir { font-size: 8px; color: #999; margin-top: 4px; }
      </style>
    </head><body>
      <div class="grid">${labelsHtml}</div>
      <script>
        // Wait for images to load then print
        window.onload = function() { window.print(); };
      </script>
    </body></html>`);
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
        {/* QR Codes per batch */}
        {savedBatches.length > 0 && (
          <Paper sx={{ p: 3, mb: 3, bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              🏷️ Etichete QR — {savedBatches.length} batch-uri create
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Scanați codul QR pentru a identifica fiecare bobină/tamburul în depozit.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
              {savedBatches.map(b => {
                const qrData = JSON.stringify({
                  t: 'BATCH',
                  bn: b.batch_number,
                  mat: b.material_name,
                  qty: b.cant_received,
                  unit: b.unit,
                  nir: saved!.nir_number,
                  ...(b.notes ? { cap: b.notes } : {}),
                });
                return (
                  <Box
                    key={b.batch_number}
                    sx={{
                      border: '2px solid',
                      borderColor: 'primary.main',
                      borderRadius: 2,
                      p: 2,
                      width: 180,
                      textAlign: 'center',
                      bgcolor: 'white',
                    }}
                  >
                    <QRCodeSVG value={qrData} size={140} level="M" />
                    <Typography fontFamily="monospace" fontSize="0.7rem" fontWeight={700} mt={1} color="primary.main">
                      {b.batch_number}
                    </Typography>
                    <Typography fontSize="0.7rem" mt={0.5} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.material_name}
                    </Typography>
                    <Typography fontSize="0.7rem" color="text.secondary">
                      {b.cant_received} {b.unit}
                      {b.notes && <><br /><em>{b.notes}</em></>}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Paper>
        )}

        <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap">
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint} size="large">
            Printează NIR
          </Button>
          {savedBatches.length > 0 && (
            <Button variant="outlined" color="secondary" startIcon={<PrintIcon />} onClick={handlePrintLabels} size="large">
              🏷️ Printează Etichete ({savedBatches.length})
            </Button>
          )}
          <Button variant="contained" color="success" onClick={() => navigate('/putaway-tasks')} size="large">
            📦 Sarcini Putaway
          </Button>
          <Button variant="contained" onClick={() => navigate('/comenzi-furnizor')} size="large">
            Înapoi la Comenzi
          </Button>
          <Button onClick={() => { setSaved(null); setSavedBatches([]); loadNextNir(); setLines([emptyLine(1)]); }} size="large">
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
                {['Nr.crt', 'Denumire Material', 'Ambalaj / Nr. Ident.', 'Capat A (m)', 'Capat B (m)', 'Cont Debitor', 'Cod Material', 'UM', 'Cant. Doc.', 'Cant. Recep.', ''].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 700, bgcolor: 'grey.100', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((l, idx) => {
                const cantRec = parseFloat(l.cant_received) || 0;
                const cantDoc = parseFloat(l.cant_doc) || 0;
                const isShort = cantDoc > 0 && cantRec < cantDoc;
                const isOver = cantDoc > 0 && cantRec > cantDoc;
                const diff = cantRec - cantDoc;
                const diffPct = cantDoc > 0 ? Math.round((diff / cantDoc) * 100) : 0;
                return (
                  <TableRow key={idx} hover sx={{ bgcolor: l.damaged ? '#fce4ec' : isShort ? 'warning.50' : isOver ? '#fff3e0' : undefined }}>
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
                    {/* Ambalaj: tip dropdown + nr. identificare */}
                    <TableCell sx={{ minWidth: 170 }}>
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                        <Tooltip
                          title={
                            l.tip_ambalaj
                              ? AMBALAJ_TYPES.find(a => a.value === l.tip_ambalaj)?.hint || l.tip_ambalaj
                              : 'Selectați tipul ambalajului'
                          }
                          placement="top"
                        >
                          <Select
                            variant="standard"
                            value={l.tip_ambalaj || ''}
                            onChange={e => updateLine(idx, 'tip_ambalaj', e.target.value as string)}
                            displayEmpty
                            renderValue={v => {
                              const found = AMBALAJ_TYPES.find(a => a.value === v);
                              return found ? (
                                <span title={found.hint}>{found.icon}</span>
                              ) : <span style={{ color: '#aaa', fontSize: '0.75rem' }}>tip</span>;
                            }}
                            sx={{ width: 44, fontSize: '1.1rem', '& .MuiSelect-select': { pb: '2px' } }}
                          >
                            <MenuItem value=""><em style={{ fontSize: '0.8rem', color: '#aaa' }}>— tip —</em></MenuItem>
                            {AMBALAJ_TYPES.map(a => (
                              <MenuItem key={a.value} value={a.value}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <span>{a.icon}</span>
                                  <Box>
                                    <Typography fontSize="0.85rem" fontWeight={600}>{a.label}</Typography>
                                    <Typography fontSize="0.7rem" color="text.secondary">{a.hint}</Typography>
                                  </Box>
                                </Box>
                              </MenuItem>
                            ))}
                          </Select>
                        </Tooltip>
                        <TextField
                          variant="standard"
                          value={l.nr_ambalaj || ''}
                          onChange={e => updateLine(idx, 'nr_ambalaj', e.target.value)}
                          placeholder={l.tip_ambalaj === 'COLAC' ? 'C' : l.tip_ambalaj === 'CUTIE' ? 'B001' : 'E1000'}
                          sx={{ flex: 1, minWidth: 0 }}
                          inputProps={{
                            style: { fontSize: '0.8rem', fontFamily: 'monospace', textTransform: 'uppercase' },
                            maxLength: 12,
                          }}
                        />
                      </Box>
                      {/* Lungime per colac + nr colaci calculat */}
                      {l.tip_ambalaj === 'COLAC' && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                          <TextField
                            variant="standard"
                            type="number"
                            value={l.lungime_colac ?? ''}
                            onChange={e => updateLine(idx, 'lungime_colac', e.target.value)}
                            placeholder="100"
                            sx={{ width: 52 }}
                            inputProps={{ style: { fontSize: '0.72rem', textAlign: 'right' }, min: 1 }}
                          />
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>m/buc</Typography>
                          {l.lungime_colac && parseFloat(l.cant_doc || '0') > 0 && (
                            <Chip
                              label={`${Math.round(parseFloat(l.cant_doc) * 1000 / l.lungime_colac)} buc`}
                              size="small"
                              color="primary"
                              title={`${Math.round(parseFloat(l.cant_doc) * 1000 / l.lungime_colac)} colaci × ${l.lungime_colac}m`}
                              sx={{ height: 16, fontSize: '0.62rem', fontWeight: 700, cursor: 'default' }}
                            />
                          )}
                        </Box>
                      )}
                      {l.tip_ambalaj && l.tip_ambalaj !== 'COLAC' && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.62rem', ml: 0.5 }}>
                          {AMBALAJ_TYPES.find(a => a.value === l.tip_ambalaj)?.label}
                        </Typography>
                      )}
                    </TableCell>
                    {/* Capat A (metraj start) */}
                    <TableCell>
                      {l.tip_ambalaj === 'COLAC' ? (
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
                          0 m
                        </Typography>
                      ) : (
                      <TextField
                        variant="standard"
                        type="number"
                        value={l.metraj_start || ''}
                        onChange={e => updateLine(idx, 'metraj_start', e.target.value)}
                        placeholder="0"
                        disabled={l.tip_ambalaj === 'CUTIE'}
                        sx={{ width: 65 }}
                        inputProps={{ style: { fontSize: '0.8rem', textAlign: 'right' } }}
                      />
                      )}
                    </TableCell>
                    {/* Capat B (metraj final) */}
                    <TableCell>
                      {l.tip_ambalaj === 'COLAC' ? (
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
                          {l.lungime_colac ? `${l.lungime_colac} m` : '— m'}
                        </Typography>
                      ) : (
                      <TextField
                        variant="standard"
                        type="number"
                        value={l.metraj_final || ''}
                        onChange={e => updateLine(idx, 'metraj_final', e.target.value)}
                        placeholder={
                          l.tip_ambalaj === 'T500' ? '500' :
                          l.tip_ambalaj === 'T630' ? '630' :
                          l.tip_ambalaj === 'T800' ? '800' :
                          l.tip_ambalaj === 'T1000' ? '1000' :
                          l.tip_ambalaj === 'T1250' ? '1250' :
                          l.tip_ambalaj === 'T1600' ? '1600' :
                          l.tip_ambalaj === 'T2000' ? '2000' :
                          l.tip_ambalaj === 'T2500' ? '2500' :
                          l.tip_ambalaj === 'T3000' ? '3000' : '1012'
                        }
                        disabled={l.tip_ambalaj === 'CUTIE'}
                        sx={{ width: 65 }}
                        inputProps={{ style: { fontSize: '0.8rem', textAlign: 'right' } }}
                      />
                      )}
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
                      <Tooltip
                        title={
                          (l.nr_ambalaj || l.tambur_nr)
                            ? `Lot: ##${(l.nr_ambalaj || l.tambur_nr || '').toUpperCase()} ${supplierName} ${l.metraj_start||'?'}-${l.metraj_final||'?'} ${l.metraj_start&&l.metraj_final?Math.round(parseFloat(l.metraj_final)-parseFloat(l.metraj_start))+' M':''}${l.tip_ambalaj ? ` | Ambalaj: ${l.tip_ambalaj}` : ''}`
                            : 'Introduceți nr. ambalaj și capatele (A→B) pentru a genera lot-ul'
                        }
                        placement="top"
                        arrow
                      >
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
                            color: isShort ? '#d32f2f' : isOver ? '#f57c00' : undefined,
                          },
                        }}
                      />
                      </Tooltip>
                      {cantDoc > 0 && diff !== 0 && (
                        <Chip
                          label={diff > 0 ? `+${diffPct}%` : `${diffPct}%`}
                          size="small"
                          color={diff > 0 ? 'warning' : 'error'}
                          sx={{ mt: 0.3, height: 16, fontSize: '0.6rem', display: 'block' }}
                        />
                      )}
                    </TableCell>
                    {/* price_intrare ascuns in tabel WMS, ramane in date pt NIR tipărit */}
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title={l.damaged ? 'Anulează marfă deteriorată' : 'Marchează ca deteriorată (→ CARANTINA)'}>
                        <Button size="small" onClick={() => toggleDamaged(idx)} sx={{ minWidth: 0, p: 0.5 }}>
                          <WarningAmberIcon sx={{ fontSize: '1rem', color: l.damaged ? 'error.main' : 'action.disabled' }} />
                        </Button>
                      </Tooltip>
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

        {(() => {
          const damagedLines = lines.filter(l => l.damaged).map(l => l.line_number);
          const overLines = lines.filter(l => { const r = parseFloat(l.cant_received)||0; const d = parseFloat(l.cant_doc)||0; return d > 0 && r > d; });
          const shortLines = lines.filter(l => { const r = parseFloat(l.cant_received)||0; const d = parseFloat(l.cant_doc)||0; return d > 0 && r < d; });
          // Sumar colaci
          const colaciLines = lines.filter(l => l.tip_ambalaj === 'COLAC' && (l.lungime_colac || 0) > 0 && parseFloat(l.cant_doc || '0') > 0);
          const totalColaci = colaciLines.reduce((s, l) => s + Math.round(parseFloat(l.cant_doc) * 1000 / l.lungime_colac!), 0);
          return (
            <>
              {colaciLines.length > 0 && (
                <Alert severity="info" sx={{ mt: 1 }} icon={<span>🔄</span>}>
                  <strong>Colaci detectate automat:</strong>{' '}
                  {colaciLines.map(l => {
                    const nr = Math.round(parseFloat(l.cant_doc) * 1000 / l.lungime_colac!);
                    return `L${l.line_number}: ${nr} × ${l.lungime_colac}m = ${l.cant_doc} Km`;
                  }).join(' | ')}
                  {' '}→ <strong>{totalColaci} etichete QR</strong> vor fi generate la confirmare.
                </Alert>
              )}
              {(damagedLines.length > 0 || overLines.length > 0 || shortLines.length > 0) && (
                <Alert severity={damagedLines.length ? 'error' : 'warning'} sx={{ mt: 1, mb: 0 }}>
                  {damagedLines.length > 0 && <span>⚠️ <strong>Marfă deteriorată</strong> pe liniile {damagedLines.join(', ')} — va fi marcată CARANTINA la putaway. </span>}
                  {overLines.length > 0 && <span>📈 <strong>Supralivrare</strong> detectată: {overLines.length} linie/linii. </span>}
                  {shortLines.length > 0 && <span>📉 <strong>Lipsă</strong> detectată: {shortLines.length} linie/linii. </span>}
                </Alert>
              )}
            </>
          );
        })()}
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
