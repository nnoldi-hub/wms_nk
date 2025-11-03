import { useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import PrintIcon from '@mui/icons-material/Print';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import Papa from 'papaparse';
import QRCode from 'qrcode';
import { setupService } from '../services/setup.service';

interface CsvRow {
  product_name?: string;
  sku?: string;
  quantity?: string;
  unit?: string; // tambur, colac, palet, etc.
  association?: string; // ex: cablu X pe tambur Y
  package_status?: string; // reutilizabil / consumabil
}

export function InitialSetupPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [qrMap, setQrMap] = useState<Record<string, string>>({}); // code -> dataURL
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);

  const headers = useMemo(
    () => ['product_name', 'sku', 'quantity', 'unit', 'association', 'package_status'],
    []
  );

  const handleChooseFile = () => fileInputRef.current?.click();

  type ParseResult<T> = { data: T[] };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result: ParseResult<CsvRow>) => {
        const parsed = (result.data || []).map((r: CsvRow) => ({ ...r }));
        setRows(parsed);
        // Pre-generate QR for SKU and any association token present
        void generateQRBatch(parsed);
      },
    });
  };

  const generateQRBatch = async (parsed: CsvRow[]) => {
    const next: Record<string, string> = {};
    for (const r of parsed) {
      if (r.sku) {
        const code = `PRODUCT:${r.sku}`;
        next[code] = await QRCode.toDataURL(code, { margin: 1, scale: 6 });
      }
      if (r.association) {
        const code = `COMPOSITE:${r.association}`;
        next[code] = await QRCode.toDataURL(code, { margin: 1, scale: 6 });
      }
    }
    setQrMap(next);
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;

    const chunks: string[] = [];
    chunks.push('<html><head><title>QR Codes</title></head><body>');
    chunks.push('<h3>QR Codes generate</h3>');
    chunks.push('<div style="display:flex; flex-wrap:wrap; gap:12px;">');

    Object.entries(qrMap).forEach(([code, dataUrl]) => {
      chunks.push(
        `<div style="border:1px solid #ccc; padding:8px; width:160px; text-align:center;">`
      );
      chunks.push(`<img src="${dataUrl}" style="width:140px;height:140px;" />`);
      chunks.push(`<div style="font-size:12px; word-break:break-all;">${code}</div>`);
      chunks.push('</div>');
    });

    chunks.push('</div>');
    chunks.push('</body></html>');

    win.document.write(chunks.join(''));
    win.document.close();
    win.focus();
    // Give the browser a moment to load images
    setTimeout(() => win.print(), 400);
  };

  const handleExport = async () => {
    setExporting(true);
    setExportResult(null);
    try {
      const result = await setupService.importProducts(rows);
      setExportResult(`Import reușit: produse ${result.createdProducts}, loturi ${result.createdBatches}.`);
    } catch (e: unknown) {
      setExportResult(`Eroare la import: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Setare Inițială Depozit
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Importă CSV (coloane recomandate: product_name, sku, quantity, unit, association, package_status),
        apoi generează coduri QR pentru etichetare inițială.
      </Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
        <Button startIcon={<UploadFileIcon />} variant="contained" onClick={handleChooseFile}>
          Import CSV
        </Button>
        <Button
          startIcon={<PrintIcon />}
          variant="outlined"
          onClick={handlePrint}
          disabled={!Object.keys(qrMap).length}
        >
          Printează QR
        </Button>
        <Button
          startIcon={<CloudUploadIcon />}
          variant="contained"
          color="success"
          onClick={handleExport}
          disabled={!rows.length || exporting}
        >
          Export către backend
        </Button>
      </Stack>

      {exportResult && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="body2">{exportResult}</Typography>
          </CardContent>
        </Card>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Preview QR generate ({Object.keys(qrMap).length})
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {Object.entries(qrMap).map(([code, dataUrl]) => (
              <Box key={code} sx={{ border: '1px solid #eee', p: 1, textAlign: 'center' }}>
                <img src={dataUrl} style={{ width: 120, height: 120 }} />
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                  {code}
                </Typography>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      {!!rows.length && (
        <>
          <Typography variant="h6">Preview date importate</Typography>
          <Divider sx={{ mb: 1 }} />
          <Card>
            <CardContent>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {headers.map((h) => (
                      <TableCell key={h}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.slice(0, 25).map((r, idx) => (
                    <TableRow key={idx}>
                      {headers.map((h) => {
                        const value = (r as Record<string, string | undefined>)[h];
                        return <TableCell key={h}>{value ?? ''}</TableCell>;
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length > 25 && (
                <Typography variant="caption" color="text.secondary">
                  +{rows.length - 25} rânduri ascunse
                </Typography>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}

export default InitialSetupPage;
