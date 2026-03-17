import { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Typography, Card, CardContent, Alert, Chip, List, ListItem, ListItemButton, Divider } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import axios from 'axios';
import { useAuth } from '../../../hooks/useAuth';
import { useScannerFeedback } from '../../../hooks/useScannerFeedback';
import type { PickJob, PickJobItem } from '../types';
import ScanInput from '../ui/ScanInput';
import BigInstruction from '../ui/BigInstruction';
import LocationBadge from '../ui/LocationBadge';
import ActionButton from '../ui/ActionButton';
import QuantityKeypad from '../ui/QuantityKeypad';
import ProgressBar from '../ui/ProgressBar';
import StatusFlash from '../ui/StatusFlash';

const API = 'http://localhost:3011/api/v1';
type Step = 'LOADING' | 'SHOW_JOBS' | 'NO_JOBS' | 'SHOW_ITEM' | 'SCAN_LOCATION' | 'SCAN_PRODUCT' | 'CONFIRM_QUANTITY' | 'ITEM_DONE' | 'JOB_COMPLETE' | 'ERROR';

export default function PickingWorkflow({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const { feedbackOK, feedbackError, feedbackDone, flashRef } = useScannerFeedback();

  const [step, setStep] = useState<Step>('LOADING');
  const [jobs, setJobs] = useState<PickJob[]>([]);
  const [activeJob, setActiveJob] = useState<PickJob | null>(null);
  const [itemIndex, setItemIndex] = useState(0);
  const [quantity, setQuantity] = useState(0);
  const [message, setMessage] = useState('');

  const token = localStorage.getItem('accessToken');
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const currentItem: PickJobItem | null = activeJob?.items?.[itemIndex] ?? null;

  const loadJobs = useCallback(async () => {
    setStep('LOADING');
    try {
      const res = await axios.get(`${API}/pick-jobs?status=PENDING,ASSIGNED,IN_PROGRESS&mine=1`, { headers });
      const raw: Array<{
        id: string;
        job_number?: string;
        order_number?: string;
        status?: string;
        items?: PickJobItem[];
        pick_items?: PickJobItem[];
      }> = res.data.data || res.data.jobs || res.data || [];
      const mapped: PickJob[] = raw.map(j => ({
        id: j.id,
        jobNumber: j.job_number || j.id,
        orderNumber: j.order_number,
        status: j.status || 'PENDING',
        items: (j.items || j.pick_items || []).map((item: PickJobItem) => ({
          ...item,
          status: item.status || 'PENDING',
        })),
        currentItemIndex: 0,
      }));
      setJobs(mapped);
      setStep(mapped.length > 0 ? 'SHOW_JOBS' : 'NO_JOBS');
    } catch {
      setMessage('Eroare la încărcarea joburilor picking.');
      setStep('ERROR');
    }
  }, [headers]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const selectJob = useCallback(async (job: PickJob) => {
    try {
      await axios.post(`${API}/pick-jobs/${job.id}/accept`, {}, { headers });
    } catch { /* already accepted */ }
    setActiveJob(job);
    setItemIndex(0);
    setQuantity(job.items[0]?.quantity ?? 0);
    setStep('SHOW_ITEM');
  }, [headers]);

  // Validare locație
  const handleScanLocation = useCallback((code: string) => {
    if (!currentItem) return;
    if (code.trim().toUpperCase() !== (currentItem.locationCode ?? '').toUpperCase()) {
      feedbackError();
      setMessage(`Locație greșită!\nAșteptat: ${currentItem.locationCode}\nScanat: ${code}`);
      setStep('ERROR');
      return;
    }
    feedbackOK();
    setStep('SCAN_PRODUCT');
  }, [currentItem, feedbackOK, feedbackError]);

  // Validare produs
  const handleScanProduct = useCallback((code: string) => {
    if (!currentItem) return;
    const expected = (currentItem.productSku ?? '').toUpperCase();
    const scanned = code.trim().toUpperCase();
    if (scanned !== expected && scanned !== (currentItem.batchNumber ?? '').toUpperCase()) {
      feedbackError();
      setMessage(`Produs greșit!\nAșteptat: ${currentItem.productSku}\nScanat: ${code}`);
      setStep('ERROR');
      return;
    }
    feedbackOK();
    setQuantity(currentItem.quantity - currentItem.pickedQty);
    setStep('CONFIRM_QUANTITY');
  }, [currentItem, feedbackOK, feedbackError]);

  // Confirmare culegere
  const confirmPick = useCallback(async () => {
    if (!activeJob || !currentItem) return;
    try {
      await axios.post(
        `${API}/pick-jobs/${activeJob.id}/pick`,
        { item_id: currentItem.id, picked_qty: quantity, picked_by: user?.username },
        { headers }
      );
      feedbackOK();

      // Move to next un-picked item
      const updatedItems = activeJob.items.map((it, idx) =>
        idx === itemIndex ? { ...it, pickedQty: quantity, status: 'PICKED' } : it
      );
      const updatedJob = { ...activeJob, items: updatedItems };
      setActiveJob(updatedJob);

      const nextIndex = updatedItems.findIndex((it, idx) => idx > itemIndex && it.status !== 'PICKED');
      if (nextIndex >= 0) {
        setItemIndex(nextIndex);
        setQuantity(updatedItems[nextIndex].quantity - updatedItems[nextIndex].pickedQty);
        setStep('SHOW_ITEM');
      } else {
        // Complete job
        try {
          await axios.post(`${API}/pick-jobs/${activeJob.id}/complete`, {}, { headers });
        } catch { /* ignore */ }
        feedbackDone();
        setStep('JOB_COMPLETE');
      }
    } catch (err: unknown) {
      feedbackError();
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMessage(msg || 'Eroare la înregistrarea culegerii.');
      setStep('ERROR');
    }
  }, [activeJob, currentItem, itemIndex, quantity, user, headers, feedbackOK, feedbackError, feedbackDone]);

  // ─── RENDER ───────────────────────────────────────────────

  if (step === 'LOADING') return (
    <Box sx={{ ...wrapSx, alignItems: 'center', pt: 6 }}>
      <Typography sx={{ color: '#aaa', fontSize: 22 }}>Se încarcă joburi...</Typography>
    </Box>
  );

  if (step === 'NO_JOBS') return (
    <Box sx={{ ...wrapSx, alignItems: 'center', pt: 4 }}>
      <StatusFlash ref={flashRef} />
      <Typography sx={{ fontSize: 64 }}>📭</Typography>
      <Typography sx={{ fontSize: 26, fontWeight: 700, color: '#fff', textAlign: 'center' }}>
        Niciun job picking disponibil
      </Typography>
      <Typography sx={{ color: '#aaa', textAlign: 'center' }}>Nu ai joburi asignate momentan.</Typography>
      <ActionButton variant="primary" onClick={loadJobs} sx={{ mt: 4 }}>🔄 Reîncarcă</ActionButton>
      <ActionButton variant="cancel" onClick={onBack} sx={{ mt: 1.5 }}>← Înapoi la HUB</ActionButton>
    </Box>
  );

  if (step === 'SHOW_JOBS') return (
    <Box sx={wrapSx}>
      <StatusFlash ref={flashRef} />
      <BigInstruction icon="🛒" text="Selectează job picking" />
      <List sx={{ width: '100%' }}>
        {jobs.map(job => (
          <Box key={job.id}>
            <ListItem disablePadding>
              <ListItemButton onClick={() => selectJob(job)} sx={{ borderRadius: 2, py: 2, mb: 1, bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid #333' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>Job #{job.jobNumber}</Typography>
                  {job.orderNumber && <Typography sx={{ color: '#aaa', fontSize: 15 }}>Comandă: {job.orderNumber}</Typography>}
                  <Chip label={`${job.items.length} produse`} size="small" sx={{ mt: 0.5, bgcolor: '#1565c0', color: '#fff' }} />
                </Box>
                <ShoppingCartIcon sx={{ color: '#00e5ff', fontSize: 36 }} />
              </ListItemButton>
            </ListItem>
            <Divider sx={{ borderColor: '#222' }} />
          </Box>
        ))}
      </List>
      <ActionButton variant="cancel" onClick={onBack} sx={{ mt: 2 }}>← Înapoi la HUB</ActionButton>
    </Box>
  );

  if (step === 'SHOW_ITEM' && currentItem) return (
    <Box sx={wrapSx}>
      <StatusFlash ref={flashRef} />
      <ProgressBar current={itemIndex + 1} total={activeJob!.items.length} label="Produse culese" />
      <BigInstruction icon="👉" text="Mergi la:" color="#aaa" />
      <LocationBadge code={currentItem.locationCode} highlight />
      <Card sx={cardSx}>
        <CardContent>
          <Typography sx={{ color: '#aaa', fontSize: 13 }}>Produs</Typography>
          <Typography sx={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>{currentItem.productSku}</Typography>
          <Typography sx={{ color: '#ccc', fontSize: 16 }}>{currentItem.productName}</Typography>
          <Divider sx={{ my: 1, borderColor: '#333' }} />
          <Typography sx={{ color: '#ffd740', fontSize: 24, fontWeight: 700 }}>
            {currentItem.quantity - currentItem.pickedQty} {currentItem.unit}
          </Typography>
          <Typography sx={{ color: '#aaa', fontSize: 13 }}>Lot: {currentItem.batchNumber}</Typography>
        </CardContent>
      </Card>
      <ActionButton variant="confirm" onClick={() => setStep('SCAN_LOCATION')} sx={{ mt: 1 }}>
        SCANEAZĂ LOCAȚIA
      </ActionButton>
      <ActionButton variant="cancel" onClick={onBack} sx={{ mt: 1 }}>← Abandonează job</ActionButton>
    </Box>
  );

  if (step === 'SCAN_LOCATION') return (
    <Box sx={wrapSx}>
      <StatusFlash ref={flashRef} />
      <BigInstruction icon="📍" text={`Scanează: ${currentItem?.locationCode}`} subtext="confirmă că ești la locația corectă" color="#00e5ff" />
      <LocationBadge code={currentItem?.locationCode ?? ''} highlight />
      <ScanInput onScan={handleScanLocation} active placeholder="Scanează locația..." />
      <ActionButton variant="skip" onClick={() => setStep('SHOW_ITEM')} sx={{ mt: 3 }}>← Înapoi</ActionButton>
    </Box>
  );

  if (step === 'SCAN_PRODUCT') return (
    <Box sx={wrapSx}>
      <StatusFlash ref={flashRef} />
      <BigInstruction icon="📦" text="Scanează produsul" subtext={currentItem?.productSku ?? ''} />
      <ScanInput onScan={handleScanProduct} active placeholder="Scanează produsul..." />
      <ActionButton variant="skip" onClick={() => setStep('SCAN_LOCATION')} sx={{ mt: 3 }}>← Înapoi</ActionButton>
    </Box>
  );

  if (step === 'CONFIRM_QUANTITY') return (
    <Box sx={wrapSx}>
      <StatusFlash ref={flashRef} />
      <BigInstruction icon="🔢" text="Confirmă cantitatea culeasă" subtext={currentItem?.productSku ?? ''} />
      <QuantityKeypad value={quantity} onChange={setQuantity} unit={currentItem?.unit || 'buc'} maxValue={currentItem?.quantity} label="Cantitate culeasă" />
      <ActionButton variant="confirm" onClick={confirmPick} sx={{ mt: 3 }} disabled={quantity <= 0}>
        ✅ CONFIRMĂ CULEGEREA
      </ActionButton>
      <ActionButton variant="skip" onClick={() => setStep('SCAN_PRODUCT')} sx={{ mt: 1.5 }}>← Înapoi</ActionButton>
    </Box>
  );

  if (step === 'JOB_COMPLETE') return (
    <Box sx={{ ...wrapSx, alignItems: 'center', pt: 4 }}>
      <StatusFlash ref={flashRef} />
      <CheckCircleIcon sx={{ fontSize: 96, color: '#00c853', mb: 2 }} />
      <Typography sx={{ fontSize: 30, fontWeight: 700, color: '#00c853', textAlign: 'center' }}>
        JOB FINALIZAT!
      </Typography>
      <Typography sx={{ color: '#aaa', textAlign: 'center', mt: 1, fontSize: 18 }}>
        Job #{activeJob?.jobNumber} — {activeJob?.items.length} produse culese
      </Typography>
      <Alert severity="info" sx={{ mt: 2, fontSize: 16 }}>
        🚚 Mergi la zona SHIP pentru predare
      </Alert>
      <ActionButton variant="confirm" onClick={loadJobs} sx={{ mt: 4 }}>
        🛒 URMĂTOR JOB
      </ActionButton>
      <ActionButton variant="cancel" onClick={onBack} sx={{ mt: 1.5 }}>← Înapoi la HUB</ActionButton>
    </Box>
  );

  if (step === 'ERROR') return (
    <Box sx={wrapSx}>
      <StatusFlash ref={flashRef} />
      <Typography sx={{ fontSize: 64, textAlign: 'center' }}>❌</Typography>
      <Alert severity="error" sx={{ fontSize: 16, whiteSpace: 'pre-line' }}>{message}</Alert>
      <ActionButton variant="primary" onClick={() => setStep(activeJob ? 'SHOW_ITEM' : 'SHOW_JOBS')}>🔄 Încearcă din nou</ActionButton>
      <ActionButton variant="cancel" onClick={onBack} sx={{ mt: 1.5 }}>← Înapoi la HUB</ActionButton>
    </Box>
  );

  return null;
}

const wrapSx = { display: 'flex', flexDirection: 'column' as const, gap: 2, width: '100%', maxWidth: 520, mx: 'auto', px: 2 };
const cardSx = { bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid #333', borderRadius: 3 };
