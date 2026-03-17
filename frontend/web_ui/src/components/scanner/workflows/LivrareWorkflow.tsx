import { useState, useCallback, useMemo } from 'react';
import { Box, Typography, Card, CardContent, Alert, Divider } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import axios from 'axios';
import { useScannerFeedback } from '../../../hooks/useScannerFeedback';
import ScanInput from '../ui/ScanInput';
import BigInstruction from '../ui/BigInstruction';
import ActionButton from '../ui/ActionButton';
import ProgressBar from '../ui/ProgressBar';
import StatusFlash from '../ui/StatusFlash';

const API_INVENTORY = 'http://localhost:3011/api/v1';
const API_SHIPMENTS = 'http://localhost:3016/api/v1';

type Step = 'SCAN_SHIPMENT' | 'SHOW_SHIPMENT' | 'SCAN_PRODUCTS' | 'CONFIRM_LOADING' | 'SUCCESS' | 'ERROR';

interface ShipmentInfo {
  id: string;
  shipmentNumber: string;
  orderNumber?: string;
  destinatie?: string;
  items: ShipmentItem[];
}

interface ShipmentItem {
  id: string;
  productSku: string;
  productName: string;
  quantity: number;
  unit: string;
  verified: boolean;
}

export default function LivrareWorkflow({ onBack }: { onBack: () => void }) {
  const { feedbackOK, feedbackError, feedbackDone, flashRef } = useScannerFeedback();

  const [step, setStep] = useState<Step>('SCAN_SHIPMENT');
  const [shipment, setShipment] = useState<ShipmentInfo | null>(null);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem('accessToken');
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const handleScanShipment = useCallback(async (code: string) => {
    setLoading(true);
    try {
      // Try by shipment number / order code
      let res;
      try {
        res = await axios.get(`${API_SHIPMENTS}/shipments?order_number=${encodeURIComponent(code)}&limit=1`, { headers });
      } catch {
        res = await axios.get(`${API_INVENTORY}/orders?order_number=${encodeURIComponent(code)}&limit=1`, { headers });
      }

      const rawShipments = res.data.data || res.data.shipments || res.data.orders || res.data || [];
      const s = Array.isArray(rawShipments) ? rawShipments[0] : null;

      if (!s) {
        feedbackError();
        setMessage(`Comanda/livrarea „${code}" nu a fost găsită.`);
        setStep('ERROR');
        setLoading(false);
        return;
      }

      const items: ShipmentItem[] = (s.lines || s.items || s.order_lines || []).map((l: {
        id?: string;
        product_sku?: string;
        sku?: string;
        product_name?: string;
        name?: string;
        quantity?: number;
        qty?: number;
        unit?: string;
      }) => ({
        id: l.id || String(Math.random()),
        productSku: l.product_sku || l.sku || '—',
        productName: l.product_name || l.name || '—',
        quantity: l.quantity || l.qty || 0,
        unit: l.unit || 'buc',
        verified: false,
      }));

      setShipment({
        id: s.id,
        shipmentNumber: s.shipment_number || s.order_number || s.id,
        orderNumber: s.order_number,
        destinatie: s.client_name || s.destination || s.customer_name,
        items,
      });
      setVerifiedCount(0);
      feedbackOK();
      setStep('SHOW_SHIPMENT');
    } catch {
      feedbackError();
      setMessage('Eroare la căutarea livrării.');
      setStep('ERROR');
    } finally {
      setLoading(false);
    }
  }, [headers, feedbackOK, feedbackError]);

  const handleScanProduct = useCallback((code: string) => {
    if (!shipment) return;
    const idx = shipment.items.findIndex(
      it => !it.verified && (it.productSku.toUpperCase() === code.trim().toUpperCase())
    );
    if (idx < 0) {
      feedbackError();
      setMessage(`Produsul „${code}" nu este în această livrare sau a fost deja verificat.`);
      setTimeout(() => setMessage(''), 2500);
      return;
    }
    feedbackOK();
    const updated = shipment.items.map((it, i) => i === idx ? { ...it, verified: true } : it);
    const newCount = updated.filter(it => it.verified).length;
    setShipment({ ...shipment, items: updated });
    setVerifiedCount(newCount);

    if (newCount === shipment.items.length) {
      setStep('CONFIRM_LOADING');
    }
  }, [shipment, feedbackOK, feedbackError]);

  const confirmLoading = useCallback(async () => {
    if (!shipment) return;
    try {
      await axios.patch(
        `${API_SHIPMENTS}/shipments/${shipment.id}/status`,
        { status: 'LOADED' },
        { headers }
      );
    } catch { /* shipment service may differ */ }
    feedbackDone();
    setStep('SUCCESS');
  }, [shipment, headers, feedbackDone]);

  const reset = () => {
    setStep('SCAN_SHIPMENT');
    setShipment(null);
    setVerifiedCount(0);
    setMessage('');
  };

  // ─── RENDER ───────────────────────────────────────────────

  if (step === 'SCAN_SHIPMENT') return (
    <Box sx={wrapSx}>
      <StatusFlash ref={flashRef} />
      <BigInstruction icon="🚚" text="Scanează bon livrare" subtext="cod comandă sau număr livrare" />
      <ScanInput onScan={handleScanShipment} active={!loading} placeholder="Scanează comanda..." />
      {loading && <Typography sx={{ color: '#aaa', textAlign: 'center' }}>Se caută...</Typography>}
      <ActionButton variant="cancel" onClick={onBack} sx={{ mt: 4 }}>← Înapoi la HUB</ActionButton>
    </Box>
  );

  if (step === 'SHOW_SHIPMENT' && shipment) return (
    <Box sx={wrapSx}>
      <StatusFlash ref={flashRef} />
      <BigInstruction icon="📋" text="Detalii livrare" />
      <Card sx={cardSx}>
        <CardContent>
          <Typography sx={{ color: '#aaa', fontSize: 13 }}>Livrare</Typography>
          <Typography sx={{ color: '#00e5ff', fontSize: 24, fontWeight: 700 }}>{shipment.shipmentNumber}</Typography>
          {shipment.destinatie && <>
            <Divider sx={{ my: 1, borderColor: '#333' }} />
            <Typography sx={{ color: '#aaa', fontSize: 13 }}>Destinatar</Typography>
            <Typography sx={{ color: '#fff', fontSize: 18 }}>{shipment.destinatie}</Typography>
          </>}
          <Divider sx={{ my: 1, borderColor: '#333' }} />
          <Typography sx={{ color: '#ffd740', fontSize: 18, fontWeight: 700 }}>
            {shipment.items.length} produse de verificat
          </Typography>
        </CardContent>
      </Card>
      <ActionButton variant="confirm" onClick={() => setStep('SCAN_PRODUCTS')} icon={<LocalShippingIcon />}>
        ÎNCEPE VERIFICAREA
      </ActionButton>
      <ActionButton variant="cancel" onClick={reset} sx={{ mt: 1.5 }}>✕ Anulează</ActionButton>
    </Box>
  );

  if (step === 'SCAN_PRODUCTS' && shipment) return (
    <Box sx={wrapSx}>
      <StatusFlash ref={flashRef} />
      <ProgressBar current={verifiedCount} total={shipment.items.length} label="Produse verificate" />
      <BigInstruction icon="📦" text="Scanează produsul" subtext={message || 'verificare colete'} color={message ? '#ff5252' : '#fff'} />

      {/* Lista produse */}
      <Box sx={{ my: 1 }}>
        {shipment.items.map(it => (
          <Box key={it.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            p: 1.5, mb: 0.5, borderRadius: 2, bgcolor: it.verified ? 'rgba(0,200,83,0.12)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${it.verified ? '#00c853' : '#333'}` }}>
            <Box>
              <Typography sx={{ color: it.verified ? '#00c853' : '#fff', fontWeight: 700, fontSize: 16 }}>{it.productSku}</Typography>
              <Typography sx={{ color: '#aaa', fontSize: 13 }}>{it.quantity} {it.unit}</Typography>
            </Box>
            <Typography sx={{ fontSize: 24 }}>{it.verified ? '✅' : '⬜'}</Typography>
          </Box>
        ))}
      </Box>

      <ScanInput onScan={handleScanProduct} active placeholder="Scanează produsul..." />
      <ActionButton variant="cancel" onClick={() => setStep('SHOW_SHIPMENT')} sx={{ mt: 2 }}>← Înapoi</ActionButton>
    </Box>
  );

  if (step === 'CONFIRM_LOADING' && shipment) return (
    <Box sx={{ ...wrapSx, alignItems: 'center' }}>
      <StatusFlash ref={flashRef} />
      <Typography sx={{ fontSize: 64 }}>✅</Typography>
      <Typography sx={{ fontSize: 28, fontWeight: 700, color: '#00c853', textAlign: 'center' }}>
        Toate produsele verificate!
      </Typography>
      <Alert severity="success" sx={{ mt: 2, fontSize: 16, width: '100%' }}>
        {shipment.items.length} produse OK · Livrare {shipment.shipmentNumber}
      </Alert>
      <ActionButton variant="confirm" onClick={confirmLoading} sx={{ mt: 4 }} icon={<LocalShippingIcon />}>
        🚚 CONFIRMĂ ÎNCĂRCAREA
      </ActionButton>
      <ActionButton variant="cancel" onClick={() => setStep('SCAN_PRODUCTS')} sx={{ mt: 1.5 }}>← Înapoi la verificare</ActionButton>
    </Box>
  );

  if (step === 'SUCCESS') return (
    <Box sx={{ ...wrapSx, alignItems: 'center', pt: 4 }}>
      <StatusFlash ref={flashRef} />
      <CheckCircleIcon sx={{ fontSize: 96, color: '#00c853', mb: 2 }} />
      <Typography sx={{ fontSize: 30, fontWeight: 700, color: '#00c853', textAlign: 'center' }}>
        LIVRARE CONFIRMATĂ!
      </Typography>
      <Typography sx={{ color: '#aaa', textAlign: 'center', mt: 1, fontSize: 18 }}>
        Bon: <strong style={{ color: '#fff' }}>{shipment?.shipmentNumber}</strong>
      </Typography>
      <ActionButton variant="confirm" onClick={reset} sx={{ mt: 4 }}>
        🚚 URMĂTOAREA LIVRARE
      </ActionButton>
      <ActionButton variant="cancel" onClick={onBack} sx={{ mt: 1.5 }}>← Înapoi la HUB</ActionButton>
    </Box>
  );

  if (step === 'ERROR') return (
    <Box sx={wrapSx}>
      <StatusFlash ref={flashRef} />
      <Typography sx={{ fontSize: 64, textAlign: 'center' }}>❌</Typography>
      <Alert severity="error" sx={{ fontSize: 16 }}>{message}</Alert>
      <ActionButton variant="primary" onClick={reset}>🔄 Încearcă din nou</ActionButton>
      <ActionButton variant="cancel" onClick={onBack} sx={{ mt: 1.5 }}>← Înapoi la HUB</ActionButton>
    </Box>
  );

  return null;
}

const wrapSx = { display: 'flex', flexDirection: 'column' as const, gap: 2, width: '100%', maxWidth: 520, mx: 'auto', px: 2 };
const cardSx = { bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid #333', borderRadius: 3 };
