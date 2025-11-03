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
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import ArticleIcon from '@mui/icons-material/Article';
import InventoryIcon from '@mui/icons-material/Inventory';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import HubIcon from '@mui/icons-material/Hub';
import { scannerService, type EntityType } from '../services/scanner.service';
import { BrowserMultiFormatReader } from '@zxing/browser';

const modeOptions = [
  { value: 'RECEPTION', label: 'Recepție' },
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

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <FormControl sx={{ minWidth: 220 }}>
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

      <Typography variant="h6" gutterBottom>
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
    </Box>
  );
}

export default ScanPage;
