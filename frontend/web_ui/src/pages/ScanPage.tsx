import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Paper,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import ArticleIcon from '@mui/icons-material/Article';
import InventoryIcon from '@mui/icons-material/Inventory';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import HubIcon from '@mui/icons-material/Hub';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { scannerService, type EntityType } from '../services/scanner.service';
import { BrowserMultiFormatReader } from '@zxing/browser';

const API = 'http://localhost:3011/api/v1';

const modeOptions = [
  { value: 'RECEPTION', label: 'Recepție' },
  { value: 'PUTAWAY', label: '📦 Putaway' },
  { value: 'TRANSFORMATION', label: 'Transformare' },
  { value: 'DELIVERY', label: 'Livrare' },
] as const;

type Mode = typeof modeOptions[number]['value'];

type LogEntry = {
  ts: string;
  code: string;
  entityType: EntityType;
  entityId?: string;
  suggestion?: string;
  raw?: unknown;
};

// ─── Putaway batch type ───
interface PutawayBatch {
  id: string;
  batch_number: string;
  product_sku: string;
  product_name: string;
  current_quantity: number;
  length_meters: number | null;
  unit_code: string;
  nir_number: string;
  supplier_name: string;
  location_id: string | null;
}

interface PutawayLocation {
  id: string;
  location_code: string;
  zone: string;
  rack?: string;
  position?: string;
}

type PutawayStep = 'idle' | 'batch_found' | 'location_found' | 'confirmed' | 'error';

function PutawayMode() {
  const [step, setStep]               = useState<PutawayStep>('idle');
  const [inputCode, setInputCode]     = useState('');
  const [batch, setBatch]             = useState<PutawayBatch | null>(null);
  const [location, setLocation]       = useState<PutawayLocation | null>(null);
  const [loading, setLoading]         = useState(false);
  const [errorMsg, setErrorMsg]       = useState('');
  const [confirmedCount, setConfirmedCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const token = localStorage.getItem('accessToken');
  const hdrs = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const stepIndex = step === 'idle' ? 0
    : step === 'batch_found' ? 1
    : step === 'location_found' ? 2
    : step === 'confirmed' ? 3
    : 0;

  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  const reset = () => {
    setStep('idle');
    setBatch(null);
    setLocation(null);
    setInputCode('');
    setErrorMsg('');
  };

  // Parses QR code — either JSON batch or string location_code
  const parseQR = (raw: string): { type: 'batch'; batchNumber: string } | { type: 'location'; code: string } | null => {
    const trimmed = raw.trim();
    // Try JSON first
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      if (obj.type === 'WMS_BATCH' && typeof obj.batch === 'string') {
        return { type: 'batch', batchNumber: obj.batch };
      }
      if (obj.type === 'WMS_LOCATION' && typeof obj.code === 'string') {
        return { type: 'location', code: obj.code };
      }
      // Try location from json object with zone/rack/position
      if (obj.code && typeof obj.code === 'string') {
        return { type: 'location', code: obj.code as string };
      }
    } catch {
      // not JSON — treat as location_code string (ex: HALA-R01-P01)
    }
    // NIR batch number pattern: NIR-NK26_X-LX
    if (/^NIR-NK\d+_\d+-L\d+$/i.test(trimmed) || /^BATCH-/i.test(trimmed)) {
      return { type: 'batch', batchNumber: trimmed };
    }
    // Location code pattern: HALA-R01-P01, AER-R01-P01, TAIERE-M01
    if (/^(HALA|AER|TAIERE|WH|LOC)[-_]/i.test(trimmed)) {
      return { type: 'location', code: trimmed };
    }
    return null;
  };

  const handleScan = async () => {
    const raw = inputCode.trim();
    if (!raw) return;
    setLoading(true);
    setErrorMsg('');
    const parsed = parseQR(raw);

    try {
      if (step === 'idle' || step === 'error') {
        // Expecting batch QR
        if (!parsed) {
          setErrorMsg(`Cod nerecunoscut: "${raw}". Scanează un QR de tip batch (NIR-...) sau locație.`);
          setStep('error');
          setInputCode('');
          return;
        }
        if (parsed.type === 'location') {
          setErrorMsg('Ai scanat o LOCAȚIE. Scanează mai întâi un QR de batch/lot (de pe produs).');
          setStep('error');
          setInputCode('');
          return;
        }
        // Lookup batch by number
        const r = await fetch(`${API}/batches/by-number/${encodeURIComponent(parsed.batchNumber)}`, { headers: hdrs });
        const j = await r.json() as { success: boolean; data?: PutawayBatch; message?: string };
        if (!j.success || !j.data) {
          setErrorMsg(j.message || 'Batch negăsit în baza de date.');
          setStep('error');
          setInputCode('');
          return;
        }
        if (j.data.location_id) {
          setErrorMsg(`Batch-ul ${j.data.batch_number} are deja locație asignată. Putaway deja efectuat.`);
          setStep('error');
          setInputCode('');
          return;
        }
        setBatch(j.data);
        setStep('batch_found');
        setInputCode('');
      } else if (step === 'batch_found') {
        // Expecting location QR
        if (!parsed) {
          setErrorMsg(`Cod nerecunoscut: "${raw}". Scanează un QR de locație (ex: HALA-R01-P01).`);
          setStep('error');
          setInputCode('');
          return;
        }
        let locCode = '';
        if (parsed.type === 'location') {
          locCode = parsed.code;
        } else {
          // They scanned another batch — suggest reset
          setErrorMsg('Ai scanat un batch, dar aștept o LOCAȚIE. Resetează dacă vrei alt batch.');
          setStep('error');
          setInputCode('');
          return;
        }
        // Lookup location
        const r = await fetch(`${API}/locations/by-code/${encodeURIComponent(locCode)}`, { headers: hdrs });
        const j = await r.json() as { success: boolean; data?: PutawayLocation; message?: string };
        if (!j.success || !j.data) {
          setErrorMsg(j.message || `Locația "${locCode}" nu a fost găsită.`);
          setStep('error');
          setInputCode('');
          return;
        }
        setLocation(j.data);
        setStep('location_found');
        setInputCode('');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPutaway = async () => {
    if (!batch || !location) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const r = await fetch(`${API}/batches/${batch.id}`, {
        method: 'PUT',
        headers: hdrs,
        body: JSON.stringify({
          location_id: location.id,
          notes: [batch.nir_number ? `NIR: ${batch.nir_number}` : '', `Putaway scan: ${location.location_code}`]
            .filter(Boolean).join(' | '),
        }),
      });
      const j = await r.json() as { success: boolean; message?: string };
      if (!j.success) {
        setErrorMsg(j.message || 'Eroare la confirmare putaway.');
        setStep('error');
        return;
      }
      setConfirmedCount(c => c + 1);
      setStep('confirmed');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void handleScan();
  };

  return (
    <Box>
      {/* Stepper */}
      <Stepper activeStep={stepIndex} sx={{ mb: 3 }}>
        {['Scanează Batch', 'Scanează Locație', 'Confirmă', step === 'confirmed' ? '✅ Done' : ''].filter(Boolean).map((label, i) => (
          <Step key={i} completed={stepIndex > i || step === 'confirmed'}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Confirmed screen */}
      {step === 'confirmed' && batch && location && (
        <Paper sx={{ p: 4, textAlign: 'center', border: '2px solid', borderColor: 'success.main', mb: 3 }}>
          <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 1 }} />
          <Typography variant="h5" color="success.main" gutterBottom>Putaway Confirmat!</Typography>
          <Typography variant="body1">
            <strong>{batch.batch_number}</strong> → <strong>{location.location_code}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
            {batch.product_name} · {batch.length_meters ? `${(batch.length_meters / 1000).toFixed(3)} Km` : `${batch.current_quantity} buc`}
          </Typography>
          {confirmedCount > 1 && (
            <Chip label={`Total sesiune: ${confirmedCount} batch-uri depozitate`} color="success" sx={{ mt: 2 }} />
          )}
          <Stack direction="row" spacing={2} justifyContent="center" mt={3}>
            <Button variant="contained" onClick={reset} startIcon={<RestartAltIcon />} size="large">
              Batch Următor
            </Button>
          </Stack>
        </Paper>
      )}

      {/* Input box — shown when not confirmed */}
      {step !== 'confirmed' && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <TextField
            inputRef={inputRef}
            fullWidth
            label={step === 'idle' || step === 'error'
              ? '📦 Scanează QR Batch / Lot'
              : '📍 Scanează QR Locație'}
            placeholder={step === 'idle' || step === 'error'
              ? 'ex: NIR-NK26_1-L1'
              : 'ex: HALA-R01-P01'}
            value={inputCode}
            onChange={e => setInputCode(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading || step === 'location_found'}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  {step === 'batch_found' ? <LocationOnIcon color="primary" /> : <QrCodeScannerIcon />}
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="contained"
            onClick={() => void handleScan()}
            disabled={loading || !inputCode.trim() || step === 'location_found'}
            sx={{ minWidth: 110 }}
          >
            {loading ? <CircularProgress size={20} /> : 'Procesează'}
          </Button>
        </Stack>
      )}

      {/* Error alert */}
      {step === 'error' && errorMsg && (
        <Alert severity="error" sx={{ mb: 2 }} action={
          <Button color="inherit" size="small" onClick={reset} startIcon={<RestartAltIcon />}>
            Resetează
          </Button>
        }>
          {errorMsg}
        </Alert>
      )}

      {/* Batch found card */}
      {batch && step !== 'idle' && (
        <Card variant="outlined" sx={{ mb: 2, borderColor: 'primary.main', borderWidth: 2 }}>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              <ArticleIcon color="primary" />
              <Typography variant="subtitle1" fontWeight={700}>Batch identificat</Typography>
            </Stack>
            <Typography fontFamily="monospace" fontWeight={700} color="primary.main" fontSize="1.1rem">
              {batch.batch_number}
            </Typography>
            <Typography variant="body2">{batch.product_name}</Typography>
            <Typography variant="body2" color="text.secondary">
              SKU: {batch.product_sku} · {batch.length_meters
                ? `${(batch.length_meters / 1000).toFixed(3)} Km`
                : `${batch.current_quantity} ${batch.unit_code}`}
            </Typography>
            {batch.nir_number && (
              <Chip label={`NIR: ${batch.nir_number}`} size="small" color="info" variant="outlined" sx={{ mt: 0.5 }} />
            )}
            {batch.supplier_name && (
              <Typography variant="caption" color="text.secondary" display="block">
                Furnizor: {batch.supplier_name}
              </Typography>
            )}
          </CardContent>
        </Card>
      )}

      {/* Location found card + confirm button */}
      {location && step === 'location_found' && (
        <>
          <Card variant="outlined" sx={{ mb: 2, borderColor: 'success.main', borderWidth: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                <LocationOnIcon color="success" />
                <Typography variant="subtitle1" fontWeight={700}>Locație identificată</Typography>
              </Stack>
              <Typography fontFamily="monospace" fontWeight={700} color="success.main" fontSize="1.1rem">
                {location.location_code}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Zonă: {location.zone}{location.rack ? ` · Raft: ${location.rack}` : ''}{location.position ? ` · Pos: ${location.position}` : ''}
              </Typography>
            </CardContent>
          </Card>

          <Button
            variant="contained"
            color="success"
            size="large"
            fullWidth
            onClick={() => void handleConfirmPutaway()}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <CheckCircleIcon />}
            sx={{ mb: 2, py: 1.5, fontSize: '1rem' }}
          >
            {loading ? 'Se confirmă...' : '✅ Confirmă Putaway'}
          </Button>

          <Button variant="outlined" size="small" onClick={reset} startIcon={<RestartAltIcon />}>
            Anulează / Alt Batch
          </Button>
        </>
      )}

      {/* Guide when idle */}
      {step === 'idle' && (
        <Alert severity="info" icon={<QrCodeScannerIcon />}>
          <strong>Flux Putaway:</strong> Scanează QR-ul de pe produs/lot → Scanează QR-ul locației din depozit → Confirmă depozitarea.
        </Alert>
      )}
    </Box>
  );
}

function typeIcon(type: EntityType) {
  switch (type) {
    case 'product':
      return <InventoryIcon fontSize="small" />;
    case 'location':
      return <WarehouseIcon fontSize="small" />;
    case 'batch':
      return <ArticleIcon fontSize="small" />;
    case 'composite':
      return <HubIcon fontSize="small" />;
    default:
      return <QrCodeScannerIcon fontSize="small" />;
  }
}

export function ScanPage() {
  const [mode, setMode] = useState<Mode>('RECEPTION');
  const [code, setCode] = useState('');
  const [lastEntity, setLastEntity] = useState<{ type: EntityType; id?: string } | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [validating, setValidating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const [cameraOn, setCameraOn] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const suggestion = useMemo(() => {
    if (!lastEntity) return undefined;
    if (mode === 'RECEPTION') {
      return 'Asociere produs ↔ ambalaj în stoc';
    }
    if (mode === 'TRANSFORMATION') {
      return 'Transformare (ex: tăiere / reambalare)';
    }
    if (mode === 'DELIVERY') {
      return 'Scădere produs (+ ambalaj dacă e livrat)';
    }
    return undefined;
  }, [lastEntity, mode]);

  const handleScan = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setValidating(true);
    try {
      const res = await scannerService.scan(trimmed);
      const entityType = res.entity?.type ?? 'unknown';
      const entityId = res.entity?.id;

      const entry: LogEntry = {
        ts: new Date().toISOString(),
        code: trimmed,
        entityType,
        entityId,
        suggestion,
        raw: res.raw ?? res,
      };
      setLog((prev) => [entry, ...prev].slice(0, 50));
      setLastEntity(res.entity ?? null);
      setCode('');
      inputRef.current?.focus();
    } catch (err) {
      const entry: LogEntry = {
        ts: new Date().toISOString(),
        code: trimmed,
        entityType: 'unknown',
        suggestion: 'Eroare procesare scan. Verifică conexiunea/serviciul.',
        raw: err,
      };
      setLog((prev) => [entry, ...prev].slice(0, 50));
    } finally {
      setValidating(false);
    }
  };

  // Camera scanning
  useEffect(() => {
    if (!cameraOn) {
      // stop if running
  // try to stop streams if any
  const r = codeReaderRef.current as unknown as { stopStreams?: () => void; stopContinuousDecode?: () => void };
  r?.stopContinuousDecode?.();
  r?.stopStreams?.();
      return;
    }
    const reader = new BrowserMultiFormatReader();
    codeReaderRef.current = reader;
    let stopped = false;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result: unknown) => {
        if (stopped) return;
        const resObj = result as Record<string, unknown> | undefined;
        const getText = resObj && typeof (resObj as { getText?: () => string }).getText === 'function'
          ? (resObj as { getText: () => string }).getText
          : undefined;
        const text = getText?.();
        if (text) {
          setCode(text);
          handleScan();
        }
        // ignore errors; the library emits NotFound continuously
      })
      .catch((e) => console.error('Camera init error', e));

    return () => {
      stopped = true;
      const rr = reader as unknown as { stopStreams?: () => void; stopContinuousDecode?: () => void };
      rr.stopContinuousDecode?.();
      rr.stopStreams?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOn]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Scanare
      </Typography>

      {/* Mode selector — always visible */}
      <FormControl sx={{ minWidth: 220, mb: 3 }} data-tutorial="scan-mode">
        <InputLabel>Mod scanare</InputLabel>
        <Select
          label="Mod scanare"
          value={mode}
          onChange={(e) => setMode(e.target.value as Mode)}
        >
          {modeOptions.map((m) => (
            <MenuItem key={m.value} value={m.value}>
              {m.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* ── PUTAWAY mode — dedicated UI ── */}
      {mode === 'PUTAWAY' && <PutawayMode />}

      {/* ── Standard scan modes ── */}
      {mode !== 'PUTAWAY' && (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }} data-tutorial="scan-input">
            <TextField
              inputRef={inputRef}
              fullWidth
              label="Cod QR scanat / lipit"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <QrCodeScannerIcon />
                  </InputAdornment>
                ),
              }}
            />
            <Button
              variant="contained"
              startIcon={<QrCodeScannerIcon />}
              onClick={handleScan}
              disabled={validating || !code.trim()}
            >
              Procesează
            </Button>
            <Button
              variant={cameraOn ? 'outlined' : 'contained'}
              color={cameraOn ? 'warning' : 'primary'}
              onClick={() => setCameraOn((v) => !v)}
            >
              {cameraOn ? 'Oprește camera' : 'Pornește camera'}
            </Button>
          </Stack>

          {cameraOn && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Cameră
                </Typography>
                <video ref={videoRef} style={{ width: '100%', maxWidth: 640 }} muted autoPlay playsInline />
              </CardContent>
            </Card>
          )}

          {lastEntity && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Tip entitate detectată
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  {typeIcon(lastEntity.type)}
                  <Chip label={lastEntity.type} size="small" />
                  {lastEntity.id && <Chip label={lastEntity.id} size="small" color="primary" />}
                  {suggestion && <Chip label={suggestion} size="small" color="secondary" />}
                </Stack>
              </CardContent>
            </Card>
          )}

          <Typography variant="h6" gutterBottom data-tutorial="scan-log">
            Istoric scanări
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Stack spacing={1}>
            {log.map((entry, idx) => (
              <Card key={`${entry.ts}-${idx}`}>
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    {typeIcon(entry.entityType)}
                    <Chip label={entry.entityType} size="small" />
                    {entry.entityId && <Chip label={entry.entityId} size="small" color="primary" />}
                    {entry.suggestion && (
                      <Chip label={entry.suggestion} size="small" color="secondary" />
                    )}
                    <Typography variant="caption" sx={{ ml: 'auto' }}>
                      {new Date(entry.ts).toLocaleString()}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Cod: {entry.code}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </>
      )}
    </Box>
  );
}

export default ScanPage;
