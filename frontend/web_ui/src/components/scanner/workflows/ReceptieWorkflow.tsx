import { useState, useCallback, useMemo } from 'react';
import { Box, Typography, Card, CardContent, Divider, Alert } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InventoryIcon from '@mui/icons-material/Inventory';
import axios from 'axios';
import { useAuth } from '../../../hooks/useAuth';
import { useScannerFeedback } from '../../../hooks/useScannerFeedback';
import ScanInput from '../ui/ScanInput';
import BigInstruction from '../ui/BigInstruction';
import ActionButton from '../ui/ActionButton';
import QuantityKeypad from '../ui/QuantityKeypad';
import StatusFlash from '../ui/StatusFlash';

const API = 'http://localhost:3011/api/v1';

type Step = 'SCAN_PRODUCT' | 'CONFIRM_PRODUCT' | 'CONFIRM_QUANTITY' | 'SCAN_LOCATION' | 'SUCCESS' | 'ERROR';

interface ProductInfo {
  id: string;
  sku: string;
  name: string;
  unit: string;
  poNumber?: string;
  poId?: string;
  goodsReceiptId?: string;
  expectedQty?: number;
}

export default function ReceptieWorkflow({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const { feedbackOK, feedbackError, feedbackDone, flashRef } = useScannerFeedback();

  const [step, setStep] = useState<Step>('SCAN_PRODUCT');
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [locationCode, setLocationCode] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastBatch, setLastBatch] = useState<string | null>(null);

  const token = localStorage.getItem('accessToken');
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const reset = () => {
    setStep('SCAN_PRODUCT');
    setProduct(null);
    setQuantity(1);
    setLocationCode('');
    setMessage('');
    setLastBatch(null);
  };

  // STEP 1: Scanare produs — caută în produse sau PO-uri
  const handleScanProduct = useCallback(async (code: string) => {
    setLoading(true);
    try {
      // Try product by SKU/barcode first
      const res = await axios.get(`${API}/products?search=${encodeURIComponent(code)}&limit=1`, { headers });
      const items = res.data.data || res.data.products || res.data || [];
      const prod = Array.isArray(items) ? items[0] : null;

      if (prod) {
        // Try finding an open PO for this product
        let poNumber: string | undefined;
        let poId: string | undefined;
        let expectedQty: number | undefined;
        try {
          const poRes = await axios.get(`${API}/purchase-orders?product_sku=${encodeURIComponent(prod.sku)}&status=CONFIRMED&limit=1`, { headers });
          const orders = poRes.data.data || poRes.data.orders || poRes.data || [];
          if (orders.length > 0) {
            poNumber = orders[0].order_number || orders[0].po_number;
            poId = orders[0].id;
            const lineMatch = (orders[0].lines || orders[0].items || []).find(
              (l: { product_sku?: string; sku?: string; quantity?: number }) => l.product_sku === prod.sku || l.sku === prod.sku
            );
            expectedQty = lineMatch?.quantity;
          }
        } catch { /* PO lookup optional */ }

        setProduct({ id: prod.id, sku: prod.sku, name: prod.name, unit: prod.unit || 'buc', poNumber, poId, expectedQty });
        feedbackOK();
        setStep('CONFIRM_PRODUCT');
      } else {
        feedbackError();
        setMessage(`Produsul „${code}" nu a fost găsit.`);
        setStep('ERROR');
      }
    } catch {
      feedbackError();
      setMessage('Eroare la căutarea produsului. Verificați conexiunea.');
      setStep('ERROR');
    } finally {
      setLoading(false);
    }
  }, [headers, feedbackOK, feedbackError]);

  // STEP 3: Scanare locație → creare lot PENDING_PUTAWAY
  const handleScanLocation = useCallback(async (code: string) => {
    if (!product) return;
    setLoading(true);
    try {
      // Look up location by code
      const locRes = await axios.get(`${API}/locations?code=${encodeURIComponent(code)}&limit=1`, { headers });
      const locs = locRes.data.data || locRes.data.locations || locRes.data || [];
      const loc = Array.isArray(locs) ? locs[0] : null;

      if (!loc) {
        feedbackError();
        setMessage(`Locația „${code}" nu a fost găsită.`);
        setStep('ERROR');
        setLoading(false);
        return;
      }

      // Create goods receipt + batch
      const payload = {
        product_id: product.id,
        product_sku: product.sku,
        quantity,
        location_id: loc.id,
        status: 'PENDING_PUTAWAY',
        received_by: user?.username,
        purchase_order_id: product.poId || null,
        notes: `Recepție operator ${user?.username}`,
      };

      const receiptRes = await axios.post(`${API}/goods-receipts`, payload, { headers });
      const batchNum = receiptRes.data?.batch?.batch_number
        || receiptRes.data?.batch_number
        || receiptRes.data?.id
        || '—';

      setLastBatch(batchNum);
      setLocationCode(code);
      feedbackDone();
      setStep('SUCCESS');
    } catch (err: unknown) {
      feedbackError();
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMessage(msg || 'Eroare la crearea recepției.');
      setStep('ERROR');
    } finally {
      setLoading(false);
    }
  }, [product, quantity, user, headers, feedbackError, feedbackDone]);

  // ─── RENDER ───────────────────────────────────────────────

  if (step === 'SCAN_PRODUCT') return (
    <Box sx={wrapSx}>
      <StatusFlash ref={flashRef} />
      <BigInstruction icon="📦" text="Scanează codul produsului" subtext="cod de bare, SKU sau QR" />
      <ScanInput onScan={handleScanProduct} active={!loading} placeholder="Scanează produsul..." />
      {loading && <Typography sx={{ color: '#aaa', textAlign: 'center', mt: 2 }}>Se caută...</Typography>}
      <ActionButton variant="cancel" onClick={onBack} sx={{ mt: 4 }}>← Înapoi la HUB</ActionButton>
    </Box>
  );

  if (step === 'CONFIRM_PRODUCT') return (
    <Box sx={wrapSx}>
      <StatusFlash ref={flashRef} />
      <BigInstruction icon="✅" text="Produs identificat" />
      <Card sx={cardSx}>
        <CardContent>
          <Typography sx={{ color: '#aaa', fontSize: 13 }}>SKU</Typography>
          <Typography sx={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>{product?.sku}</Typography>
          <Divider sx={{ my: 1.5, borderColor: '#333' }} />
          <Typography sx={{ color: '#aaa', fontSize: 13 }}>Produs</Typography>
          <Typography sx={{ color: '#fff', fontSize: 20 }}>{product?.name}</Typography>
          {product?.poNumber && <>
            <Divider sx={{ my: 1.5, borderColor: '#333' }} />
            <Typography sx={{ color: '#aaa', fontSize: 13 }}>Comandă furnizor</Typography>
            <Typography sx={{ color: '#00e5ff', fontSize: 18, fontWeight: 700 }}>PO: {product.poNumber}</Typography>
          </>}
          {product?.expectedQty && <>
            <Typography sx={{ color: '#aaa', fontSize: 13, mt: 1 }}>Cantitate așteptată</Typography>
            <Typography sx={{ color: '#ffd740', fontSize: 20, fontWeight: 700 }}>{product.expectedQty} {product.unit}</Typography>
          </>}
        </CardContent>
      </Card>
      <ActionButton variant="confirm" onClick={() => setStep('CONFIRM_QUANTITY')} icon={<InventoryIcon />}>
        CONFIRMĂ PRODUSUL
      </ActionButton>
      <ActionButton variant="cancel" onClick={reset} sx={{ mt: 1.5 }}>✕ Anulează</ActionButton>
    </Box>
  );

  if (step === 'CONFIRM_QUANTITY') return (
    <Box sx={wrapSx}>
      <StatusFlash ref={flashRef} />
      <BigInstruction icon="🔢" text="Introdu cantitatea primită" subtext={`unitate: ${product?.unit || 'buc'}`} />
      <QuantityKeypad value={quantity} onChange={setQuantity} unit={product?.unit || 'buc'} label="Cantitate recepționată" />
      <ActionButton variant="confirm" onClick={() => setStep('SCAN_LOCATION')} sx={{ mt: 3 }} disabled={quantity <= 0}>
        CONFIRMĂ → Scanează locația
      </ActionButton>
      <ActionButton variant="skip" onClick={() => setStep('CONFIRM_PRODUCT')} sx={{ mt: 1.5 }}>← Înapoi</ActionButton>
    </Box>
  );

  if (step === 'SCAN_LOCATION') return (
    <Box sx={wrapSx}>
      <StatusFlash ref={flashRef} />
      <BigInstruction icon="📍" text="Scanează locația de depozitare" subtext={`${quantity} ${product?.unit} din ${product?.sku}`} />
      <ScanInput onScan={handleScanLocation} active={!loading} placeholder="Scanează locația..." />
      {loading && <Typography sx={{ color: '#aaa', textAlign: 'center', mt: 2 }}>Se procesează...</Typography>}
      <ActionButton variant="skip" onClick={() => setStep('CONFIRM_QUANTITY')} sx={{ mt: 4 }}>← Înapoi</ActionButton>
    </Box>
  );

  if (step === 'SUCCESS') return (
    <Box sx={{ ...wrapSx, alignItems: 'center' }}>
      <StatusFlash ref={flashRef} />
      <CheckCircleIcon sx={{ fontSize: 96, color: '#00c853', mb: 2, animation: 'bounce 0.5s ease' }} />
      <Typography sx={{ fontSize: 32, fontWeight: 700, color: '#00c853', textAlign: 'center' }}>
        RECEPȚIE CONFIRMATĂ!
      </Typography>
      <Typography sx={{ fontSize: 18, color: '#aaa', mt: 1, textAlign: 'center' }}>
        Lot creat: <strong style={{ color: '#fff' }}>{lastBatch}</strong>
      </Typography>
      <Typography sx={{ fontSize: 16, color: '#aaa', textAlign: 'center' }}>
        Locație: <strong style={{ color: '#00e5ff' }}>{locationCode}</strong> · Status: PENDING PUTAWAY
      </Typography>
      <ActionButton variant="confirm" onClick={reset} sx={{ mt: 4 }}>
        📦 URMĂTORUL PRODUS
      </ActionButton>
      <ActionButton variant="cancel" onClick={onBack} sx={{ mt: 1.5 }}>← Înapoi la HUB</ActionButton>
    </Box>
  );

  if (step === 'ERROR') return (
    <Box sx={wrapSx}>
      <StatusFlash ref={flashRef} />
      <Typography sx={{ fontSize: 64, textAlign: 'center', mb: 2 }}>❌</Typography>
      <Alert severity="error" sx={{ mb: 3, fontSize: 18 }}>{message}</Alert>
      <ActionButton variant="primary" onClick={reset}>🔄 Încearcă din nou</ActionButton>
      <ActionButton variant="cancel" onClick={onBack} sx={{ mt: 1.5 }}>← Înapoi la HUB</ActionButton>
    </Box>
  );

  return null;
}

const wrapSx = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 2,
  width: '100%',
  maxWidth: 520,
  mx: 'auto',
  px: 2,
};

const cardSx = {
  bgcolor: 'rgba(255,255,255,0.06)',
  border: '1px solid #333',
  borderRadius: 3,
  mb: 2,
};
