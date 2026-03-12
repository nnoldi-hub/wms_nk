import React, { useEffect, useState, useRef } from 'react';
import {
  Box, Typography, Button, ToggleButtonGroup, ToggleButton,
  CircularProgress, Alert, Chip, FormControlLabel, Switch, Divider,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import axios from 'axios';

const INVENTORY_API = 'http://localhost:3011/api/v1';

interface Location {
  id: string;
  zone: string;
  rack: string;
  position: string;
  location_code: string;
  qr_code: string;
  status: string;
  notes: string;
  requires_forklift: boolean;
  item_count: number;
}

// QR via Google Charts API (funcționează în browser fără librărie)
function QRImg({ value, size = 120 }: { value: string; size?: number }) {
  const url = `https://chart.googleapis.com/chart?chs=${size}x${size}&cht=qr&chl=${encodeURIComponent(value)}&choe=UTF-8`;
  return <img src={url} width={size} height={size} alt={value} loading="lazy" style={{ display: 'block' }} />;
}

const ZONE_LABELS: Record<string, string> = {
  HALA: '🏭 HALA — Rafturi Tamburi Mari',
  AER: '🌿 AER LIBER — Tamburi Voluminoși',
  TAIERE: '✂️ TAIERE — Mese Derulare',
};

const ZONE_COLOR: Record<string, string> = {
  HALA: '#1565c0',
  AER: '#2e7d32',
  TAIERE: '#c62828',
};

export default function QRLocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedZones, setSelectedZones] = useState<string[]>(['HALA', 'AER', 'TAIERE']);
  const [showOccupied, setShowOccupied] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    axios
      .get(`${INVENTORY_API}/locations?is_active=true`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(({ data }) => {
        const locs: Location[] = data.data || data.locations || data || [];
        setLocations(locs.filter((l) => l.qr_code));
      })
      .catch((e) => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = locations.filter((l) => {
    const zone = l.zone?.toUpperCase() || '';
    const inZone = selectedZones.length === 0 || selectedZones.includes(zone);
    const occupiedOk = showOccupied || Number(l.item_count) === 0;
    return inZone && occupiedOk;
  });

  const handleZoneToggle = (_: React.MouseEvent, val: string[]) => {
    setSelectedZones(val);
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`
      <html><head>
        <title>QR Locații Depozit</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; background: #fff; }
          .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 16px; }
          .card {
            border: 2px solid #333; border-radius: 8px; padding: 10px;
            text-align: center; page-break-inside: avoid;
          }
          .card-code { font-size: 14px; font-weight: bold; margin-top: 6px; }
          .card-zone { font-size: 11px; color: #555; margin-top: 2px; }
          .card-notes { font-size: 9px; color: #888; margin-top: 4px; }
          svg { max-width: 100%; height: auto; }
          @media print {
            @page { margin: 10mm; }
            .grid { gap: 8px; padding: 8px; }
          }
        </style>
      </head><body>
        <div class="grid">
          ${filtered
            .map((l) => {
              const qrVal = l.qr_code || l.location_code || l.id;
              return `
                <div class="card">
                  <div id="qr-${l.id}"><!-- QR placeholder --></div>
                  <div class="card-code">${l.location_code || l.id}</div>
                  <div class="card-zone">${l.zone || ''} ${l.rack ? '· ' + l.rack : ''} ${l.position ? '· ' + l.position : ''}</div>
                  ${l.requires_forklift ? '<div class="card-notes">🚜 Necesită stivuitor</div>' : ''}
                  <script>
                    (function() {
                      var qrValue = ${JSON.stringify(qrVal)};
                      var container = document.getElementById("qr-${l.id}");
                      // Use QRServer API as fallback for print window
                      var img = document.createElement("img");
                      img.src = "https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=" + encodeURIComponent(qrValue);
                      img.width = 120; img.height = 120;
                      container.appendChild(img);
                    })();
                  </script>
                </div>`;
            })
            .join('')}
        </div>
      </body></html>
    `);
    win.document.close();
    win.onload = () => {
      setTimeout(() => {
        win.print();
      }, 1500);
    };
  };

  if (loading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;
  if (error) return <Box sx={{ p: 4 }}><Alert severity="error">{error}</Alert></Box>;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <QrCode2Icon sx={{ fontSize: 36, color: 'primary.main' }} />
        <Box>
          <Typography variant="h5" fontWeight="bold">QR Coduri Locații</Typography>
          <Typography variant="body2" color="text.secondary">
            Generare și printare etichete QR pentru locații depozit
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<PrintIcon />}
          onClick={handlePrint}
          disabled={filtered.length === 0}
          sx={{ ml: 'auto' }}
        >
          Printează {filtered.length} etichete
        </Button>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Filtre */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 3, flexWrap: 'wrap' }}>
        <Typography variant="body2" fontWeight="bold">Zonă:</Typography>
        <ToggleButtonGroup value={selectedZones} onChange={handleZoneToggle} size="small">
          {Object.entries(ZONE_LABELS).map(([zone, label]) => (
            <ToggleButton key={zone} value={zone} sx={{ textTransform: 'none' }}>
              {label}
            </ToggleButton>
          ))}
          <ToggleButton value="" sx={{ textTransform: 'none' }}>
            Alte zone
          </ToggleButton>
        </ToggleButtonGroup>
        <FormControlLabel
          control={<Switch checked={showOccupied} onChange={(e) => setShowOccupied(e.target.checked)} />}
          label="Include locații ocupate"
        />
        <Chip label={`${filtered.length} locații`} color="primary" size="small" />
      </Box>

      {/* Grid QR-uri */}
      <Box
        ref={printRef}
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 2,
        }}
      >
        {filtered.map((loc) => {
          const qrValue = loc.qr_code || loc.location_code || loc.id;
          const zoneColor = ZONE_COLOR[loc.zone?.toUpperCase()] || '#333';

          return (
            <Box
              key={loc.id}
              sx={{
                border: `2px solid ${zoneColor}`,
                borderRadius: 2,
                p: 1.5,
                textAlign: 'center',
                bgcolor: 'background.paper',
                boxShadow: 1,
              }}
            >
              {/* QR Code */}
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                <QRImg value={qrValue} size={120} />
              </Box>

              {/* Cod locație */}
              <Typography variant="subtitle2" fontWeight="bold" noWrap>
                {loc.location_code || loc.id}
              </Typography>

              {/* Detalii */}
              <Typography variant="caption" color="text.secondary" display="block">
                {loc.zone} {loc.rack ? `· ${loc.rack}` : ''} {loc.position ? `· ${loc.position}` : ''}
              </Typography>

              {/* Status / forklift */}
              <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, justifyContent: 'center', flexWrap: 'wrap' }}>
                {loc.requires_forklift && (
                  <Chip label="🚜 Stivuitor" size="small" color="warning" sx={{ fontSize: 9 }} />
                )}
                {Number(loc.item_count) > 0 && (
                  <Chip label={`${loc.item_count} art.`} size="small" color="info" sx={{ fontSize: 9 }} />
                )}
                {loc.status === 'AVAILABLE' && Number(loc.item_count) === 0 && (
                  <Chip label="Liber" size="small" color="success" sx={{ fontSize: 9 }} />
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {filtered.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Nicio locație găsită pentru filtrele selectate.
        </Alert>
      )}
    </Box>
  );
}
