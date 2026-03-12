import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Stepper, Step, StepLabel, Paper, Stack,
  TextField, Button, Autocomplete, Select, MenuItem, FormControl,
  InputLabel, Alert, CircularProgress, Chip, Card, CardContent,
  Divider,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PrintIcon from '@mui/icons-material/Print';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import axios from 'axios';

const INVENTORY_API = 'http://localhost:3011/api/v1';
const WAREHOUSE_API = 'http://localhost:3020/api/v1';

const STEPS = ['Date Receptie', 'Locatie Sugerata', 'Confirmat'];

interface ProductOption {
  sku: string;
  name: string;
  label: string;
}

interface UnitOption {
  id: string;
  code: string;
  name: string;
}

interface LocationSuggestion {
  id: string;
  location_code: string;
  zone: string;
  rack?: string;
  position?: string;
  score?: number;
}

interface BatchRecord {
  id: string;
  batch_number: string;
  length_meters?: number;
  weight_kg?: number;
}

function QrImg({ value, size = 160 }: { value: string; size?: number }) {
  const url = `https://chart.googleapis.com/chart?chs=${size}x${size}&cht=qr&chl=${encodeURIComponent(value)}&choe=UTF-8`;
  return (
    <img src={url} alt="QR Code" style={{ display: 'block', margin: '0 auto', border: '4px solid white' }} />
  );
}

export default function ReceptieMarfaPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [product, setProduct] = useState<ProductOption | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [unitCode, setUnitCode] = useState('DRUM');
  const [supplier, setSupplier] = useState('');
  const [lengthMeters, setLengthMeters] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [notes, setNotes] = useState('');
  const [locSuggestions, setLocSuggestions] = useState<LocationSuggestion[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationSuggestion | null>(null);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [suggestError, setSuggestError] = useState('');
  const [createdBatch, setCreatedBatch] = useState<BatchRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const token = localStorage.getItem('accessToken');
  const authHeaders = { Authorization: `Bearer ${token}` };

  const fetchProducts = useCallback(async () => {
    try {
      const { data } = await axios.get(`${INVENTORY_API}/products?limit=500`, { headers: authHeaders });
      const list = (data.data || data.products || data || []) as Array<{ sku: string; name: string }>;
      setProducts(list.map((p) => ({ sku: p.sku, name: p.name, label: `${p.sku} -- ${p.name}` })));
    } catch { /* non-critical */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchUnits = useCallback(async () => {
    try {
      const { data } = await axios.get(`${INVENTORY_API}/receptie/units`, { headers: authHeaders });
      setUnits((data.data || []) as UnitOption[]);
    } catch { /* fallback static options used */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    fetchProducts();
    fetchUnits();
  }, [fetchProducts, fetchUnits]);

  const buildQrValue = (batchNum: string, batchId = '') =>
    JSON.stringify({
      type: 'WMS_BATCH',
      batch: batchNum,
      id: batchId,
      sku: product?.sku ?? '',
      name: product?.name ?? '',
      supplier: supplier || '',
      length: lengthMeters ? parseFloat(lengthMeters) : null,
      unit: unitCode,
    });

  const previewBatchNum = `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-XXXXX`;

  const handleStep1Next = () => {
    if (!product) return;
    setActiveStep(1);
    void fetchSuggestions();
  };

  const fetchSuggestions = async () => {
    setLoadingSuggest(true);
    setSuggestError('');
    setLocSuggestions([]);
    setSelectedLocation(null);
    try {
      const locResp = await axios.get(`${INVENTORY_API}/locations?is_active=true&limit=1`, { headers: authHeaders });
      const locs = (locResp.data.data || locResp.data.locations || locResp.data || []) as Array<{ warehouse_id?: string }>;
      const warehouseId = locs[0]?.warehouse_id ?? '00000000-0000-0000-0000-000000000001';
      const payload = {
        warehouse_id: warehouseId,
        product_sku: product?.sku,
        quantity: parseFloat(lengthMeters) || 1,
        uom: unitCode,
        product: { name: product?.name, category: 'CABLU' },
        limit: 5,
      };
      const resp = await axios.post(`${WAREHOUSE_API}/suggest/putaway`, payload, { headers: authHeaders });
      const suggestions = (resp.data?.suggestions || resp.data?.data || []) as Array<{
        location?: { id?: string; location_code?: string; zone?: string; rack?: string; position?: string };
        id?: string;
        location_code?: string;
        zone?: string;
        rack?: string;
        position?: string;
        score?: number;
      }>;
      setLocSuggestions(suggestions.map((s) => ({
        id: s.location?.id ?? s.id ?? '',
        location_code: s.location?.location_code ?? s.location_code ?? s.id ?? '',
        zone: s.location?.zone ?? s.zone ?? '',
        rack: s.location?.rack ?? s.rack,
        position: s.location?.position ?? s.position,
        score: s.score,
      })));
    } catch {
      try {
        const resp = await axios.get(`${INVENTORY_API}/locations?is_active=true&limit=10`, { headers: authHeaders });
        const all = (resp.data.data || resp.data.locations || resp.data || []) as Array<{
          id: string; location_code?: string; zone?: string; rack?: string; position?: string;
        }>;
        setLocSuggestions(all.slice(0, 5).map((l) => ({
          id: l.id,
          location_code: l.location_code ?? l.id,
          zone: l.zone ?? '',
          rack: l.rack,
          position: l.position,
        })));
        setSuggestError('Motorul de reguli indisponibil -- se afiseaza primele locatii disponibile');
      } catch {
        setSuggestError('Nu s-au putut incarca locatiile. Puteti confirma fara locatie selectata.');
      }
    } finally {
      setLoadingSuggest(false);
    }
  };

  const handleConfirm = async () => {
    setCreating(true);
    setCreateError('');
    try {
      const payload = {
        product_sku: product?.sku,
        unit_code: unitCode,
        supplier: supplier || null,
        length_meters: lengthMeters ? parseFloat(lengthMeters) : null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        location_id: selectedLocation?.id || null,
        notes: notes || null,
      };
      const { data } = await axios.post(`${INVENTORY_API}/receptie`, payload, { headers: authHeaders });
      setCreatedBatch(data.data as BatchRecord);
      setActiveStep(2);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data as { message?: string })?.message ?? 'Eroare la creare'
        : 'Eroare la crearea inregistrarii';
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleReset = () => {
    setActiveStep(0);
    setProduct(null);
    setSupplier('');
    setLengthMeters('');
    setWeightKg('');
    setNotes('');
    setUnitCode('DRUM');
    setLocSuggestions([]);
    setSelectedLocation(null);
    setCreatedBatch(null);
    setCreateError('');
  };

  const handlePrint = () => {
    if (!createdBatch) return;
    const qrValue = buildQrValue(createdBatch.batch_number, createdBatch.id);
    const qrUrl = `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(qrValue)}&choe=UTF-8`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Eticheta -- ${createdBatch.batch_number}</title>
<style>body{font-family:Arial;margin:0;padding:20px;text-align:center}.label{border:2px solid #000;display:inline-block;padding:20px;width:320px;border-radius:4px}h2{margin:0 0 6px;font-size:16px}p{margin:3px 0;font-size:13px}.batch{font-size:15px;font-weight:bold;color:#1565c0;margin:6px 0}img{margin:12px auto;display:block}.date{font-size:10px;color:#666;margin-top:8px}</style>
</head><body><div class="label"><h2>${product?.name ?? ''}</h2><p>SKU: ${product?.sku ?? ''}</p>
<p class="batch">${createdBatch.batch_number}</p>
${supplier ? `<p>Furnizor: ${supplier}</p>` : ''}
${createdBatch.length_meters ? `<p>Lungime: ${createdBatch.length_meters} m</p>` : ''}
${createdBatch.weight_kg ? `<p>Greutate: ${createdBatch.weight_kg} kg</p>` : ''}
${selectedLocation ? `<p>Locatie: <b>${selectedLocation.location_code}</b></p>` : ''}
<img src="${qrUrl}" alt="QR" width="200" height="200" />
<p class="date">Receptionat: ${new Date().toLocaleDateString('ro-RO')}</p>
</div><script>window.print();window.close();</script></body></html>`);
    win.document.close();
  };

  const unitLabel = (code: string) => {
    const found = units.find((u) => u.code === code);
    if (found) return found.name;
    const map: Record<string, string> = { DRUM: 'Tambur', ROLL: 'Colac / Rola', BOX: 'Cutie' };
    return map[code] ?? code;
  };

  const unitOptions: UnitOption[] = units.length > 0
    ? units.filter((u) => ['DRUM', 'ROLL', 'BOX'].includes(u.code))
    : [
        { id: '', code: 'DRUM', name: 'Tambur' },
        { id: '', code: 'ROLL', name: 'Colac / Rola' },
        { id: '', code: 'BOX', name: 'Cutie' },
      ];

  return (
    <Box sx={{ p: 3, maxWidth: 860, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>Receptie Marfa</Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Receptioneaza un tambur / colac de cablu, genereaza cod QR unic si aloca o locatie in depozit.
      </Typography>
      <Stepper activeStep={activeStep} sx={{ my: 3 }}>
        {STEPS.map((label) => (<Step key={label}><StepLabel>{label}</StepLabel></Step>))}
      </Stepper>

      {activeStep === 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Date receptie</Typography>
          <Stack spacing={2}>
            <Autocomplete
              options={products}
              getOptionLabel={(o) => o.label}
              value={product}
              onChange={(_, val) => setProduct(val)}
              renderInput={(params) => (
                <TextField {...params} label="Produs (SKU / Nume) *" placeholder="Cauta dupa SKU sau denumire..." />
              )}
              isOptionEqualToValue={(o, v) => o.sku === v.sku}
              noOptionsText="Niciun produs gasit"
            />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Producator / Furnizor"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="ex: Nexans, Draka, Belden"
                sx={{ flex: '1 1 200px' }}
              />
              <FormControl sx={{ flex: '1 1 160px' }} required>
                <InputLabel>Tip Ambalaj</InputLabel>
                <Select value={unitCode} label="Tip Ambalaj" onChange={(e) => setUnitCode(e.target.value)}>
                  {unitOptions.map((u) => (<MenuItem key={u.code} value={u.code}>{u.name}</MenuItem>))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {(unitCode === 'DRUM' || unitCode === 'ROLL') && (
                <TextField
                  label="Lungime (m)" type="number" value={lengthMeters}
                  onChange={(e) => setLengthMeters(e.target.value)}
                  inputProps={{ min: 0, step: 0.5 }} placeholder="ex: 500"
                  sx={{ flex: '1 1 160px' }}
                />
              )}
              <TextField
                label="Greutate (kg)" type="number" value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                inputProps={{ min: 0, step: 0.1 }} sx={{ flex: '1 1 160px' }}
              />
            </Box>
            <TextField label="Note / Observatii" multiline rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" size="large" onClick={handleStep1Next} disabled={!product}>
                Verifica Locatie
              </Button>
            </Box>
          </Stack>
        </Paper>
      )}

      {activeStep === 1 && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Box sx={{ flex: '0 0 220px', minWidth: 180 }}>
              <Typography variant="h6" gutterBottom>Previzualizare tambur</Typography>
              <Box sx={{ p: 2, border: '1px dashed', borderColor: 'grey.400', borderRadius: 1, textAlign: 'center', bgcolor: 'grey.50' }}>
                <QrImg value={buildQrValue(previewBatchNum)} size={150} />
                <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
                  QR-ul final se genereaza dupa confirmare
                </Typography>
              </Box>
              <Stack spacing={0.5} sx={{ mt: 2 }}>
                <Typography><b>Produs:</b> {product?.name}</Typography>
                <Typography><b>SKU:</b> {product?.sku}</Typography>
                {supplier && <Typography><b>Furnizor:</b> {supplier}</Typography>}
                <Typography><b>Tip:</b> {unitLabel(unitCode)}</Typography>
                {lengthMeters && <Typography><b>Lungime:</b> {lengthMeters} m</Typography>}
                {weightKg && <Typography><b>Greutate:</b> {weightKg} kg</Typography>}
              </Stack>
            </Box>
            <Box sx={{ flex: '1 1 280px' }}>
              <Typography variant="h6" gutterBottom>Locatii sugerate</Typography>
              {loadingSuggest && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 2 }}>
                  <CircularProgress size={20} /><Typography>Se calculeaza locatia optima...</Typography>
                </Box>
              )}
              {suggestError && <Alert severity="warning" sx={{ mb: 2 }}>{suggestError}</Alert>}
              {!loadingSuggest && locSuggestions.length === 0 && !suggestError && (
                <Alert severity="info" sx={{ mb: 2 }}>Nu exista locatii disponibile. Puteti confirma fara locatie.</Alert>
              )}
              <Stack spacing={1}>
                {locSuggestions.map((loc) => (
                  <Card
                    key={loc.id}
                    onClick={() => setSelectedLocation(loc.id === selectedLocation?.id ? null : loc)}
                    sx={{
                      cursor: 'pointer',
                      border: '2px solid',
                      borderColor: loc.id === selectedLocation?.id ? 'primary.main' : 'grey.300',
                      '&:hover': { borderColor: 'primary.light' },
                      transition: 'border-color 0.15s',
                    }}
                  >
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle1" fontWeight="bold">{loc.location_code}</Typography>
                        {loc.score !== undefined && (
                          <Chip label={`Scor: ${loc.score}`} size="small" color="primary" variant="outlined" />
                        )}
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        Zona: {loc.zone}{loc.rack ? ` / ${loc.rack}` : ''}{loc.position ? ` / ${loc.position}` : ''}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
              {selectedLocation && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  Locatie selectata: <b>{selectedLocation.location_code}</b>
                </Alert>
              )}
            </Box>
          </Box>
          <Divider sx={{ my: 2 }} />
          {createError && <Alert severity="error" sx={{ mb: 2 }}>{createError}</Alert>}
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button variant="outlined" onClick={() => setActiveStep(0)}>Inapoi</Button>
            <Button
              variant="contained" color="success" size="large"
              onClick={() => void handleConfirm()} disabled={creating}
              startIcon={creating ? <CircularProgress size={18} color="inherit" /> : undefined}
            >
              {creating ? 'Se creeaza...' : 'Confirma Receptia'}
            </Button>
          </Box>
        </Paper>
      )}

      {activeStep === 2 && createdBatch && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CheckCircleIcon sx={{ fontSize: 72, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom>Receptie finalizata cu succes!</Typography>
          <Typography variant="h6" color="primary" gutterBottom>{createdBatch.batch_number}</Typography>
          <Box sx={{ my: 3 }}>
            <QrImg value={buildQrValue(createdBatch.batch_number, createdBatch.id)} size={200} />
            <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
              Scaneaza pentru a identifica tamburul in depozit
            </Typography>
          </Box>
          <Box sx={{ mb: 3, textAlign: 'left', display: 'inline-block', p: 2, bgcolor: 'grey.50', borderRadius: 1, minWidth: 280 }}>
            <Stack spacing={0.5}>
              <Typography><b>Produs:</b> {product?.name} ({product?.sku})</Typography>
              {supplier && <Typography><b>Furnizor:</b> {supplier}</Typography>}
              {createdBatch.length_meters && <Typography><b>Lungime:</b> {createdBatch.length_meters} m</Typography>}
              {createdBatch.weight_kg && <Typography><b>Greutate:</b> {createdBatch.weight_kg} kg</Typography>}
              {selectedLocation && <Typography><b>Locatie:</b> {selectedLocation.location_code}</Typography>}
              <Typography><b>Status:</b> INTACT</Typography>
            </Stack>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint} size="large">
              Printeaza Eticheta
            </Button>
            <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={handleReset} size="large">
              Receptioneaza Alt Tambur
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
