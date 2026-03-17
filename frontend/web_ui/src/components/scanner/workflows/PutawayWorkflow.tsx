import { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Typography, Card, CardContent, Alert, Chip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import axios from 'axios';
import { useAuth } from '../../../hooks/useAuth';
import { useScannerFeedback } from '../../../hooks/useScannerFeedback';
import type { PutawayTask } from '../types';
import ScanInput from '../ui/ScanInput';
import BigInstruction from '../ui/BigInstruction';
import LocationBadge from '../ui/LocationBadge';
import ActionButton from '../ui/ActionButton';
import ProgressBar from '../ui/ProgressBar';
import StatusFlash from '../ui/StatusFlash';

const API = 'http://localhost:3011/api/v1';
type Step = 'LOADING' | 'NO_TASKS' | 'SHOW_TASK' | 'SCAN_LOCATION' | 'SCAN_PRODUCT' | 'SUCCESS' | 'ERROR';

export default function PutawayWorkflow({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const { feedbackOK, feedbackError, feedbackDone, flashRef } = useScannerFeedback();

  const [step, setStep] = useState<Step>('LOADING');
  const [tasks, setTasks] = useState<PutawayTask[]>([]);
  const [taskIndex, setTaskIndex] = useState(0);
  const [message, setMessage] = useState('');

  const token = localStorage.getItem('accessToken');
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const currentTask = tasks[taskIndex] ?? null;

  const loadTasks = useCallback(async () => {
    setStep('LOADING');
    try {
      const res = await axios.get(`${API}/batches/pending-putaway`, { headers });
      const raw: Array<{
        id: string;
        batch_number?: string;
        product_sku?: string;
        product_name?: string;
        quantity?: number;
        unit?: string;
        suggested_location_id?: string;
        suggested_location_code?: string;
      }> = res.data.data || res.data.batches || res.data || [];
      const mapped: PutawayTask[] = raw.map((b, i) => ({
        id: b.id,
        batchId: b.id,
        batchNumber: b.batch_number || b.id,
        productSku: b.product_sku || '—',
        productName: b.product_name || b.product_sku || '—',
        quantity: b.quantity || 0,
        unit: b.unit || 'buc',
        suggestedLocationId: b.suggested_location_id || null,
        suggestedLocationCode: b.suggested_location_code || null,
        taskIndex: i + 1,
        totalTasks: raw.length,
      }));
      setTasks(mapped);
      setTaskIndex(0);
      setStep(mapped.length > 0 ? 'SHOW_TASK' : 'NO_TASKS');
    } catch {
      setMessage('Eroare la încărcarea taskurilor putaway.');
      setStep('ERROR');
    }
  }, [headers]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // Validare locație scanată
  const handleScanLocation = useCallback((code: string) => {
    if (!currentTask) return;
    const expected = currentTask.suggestedLocationCode;
    if (expected && code.trim().toUpperCase() !== expected.trim().toUpperCase()) {
      feedbackError();
      setMessage(`Locație greșită!\nAșteptat: ${expected}\nScanat: ${code}`);
      setStep('ERROR');
      return;
    }
    feedbackOK();
    setStep('SCAN_PRODUCT');
  }, [currentTask, feedbackOK, feedbackError]);

  // Confirmare putaway
  const handleScanProduct = useCallback(async (code: string) => {
    if (!currentTask) return;
    // Accept any scan as confirmation (product already selected from batch)
    if (code.trim() === '') return;
    try {
      await axios.post(
        `${API}/batches/${currentTask.batchId}/confirm-putaway`,
        {
          location_code: currentTask.suggestedLocationCode,
          confirmed_by: user?.username,
        },
        { headers }
      );
      feedbackDone();

      const nextIndex = taskIndex + 1;
      if (nextIndex < tasks.length) {
        setTaskIndex(nextIndex);
        setStep('SHOW_TASK');
      } else {
        setStep('SUCCESS');
      }
    } catch (err: unknown) {
      feedbackError();
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMessage(msg || 'Eroare la confirmarea putaway.');
      setStep('ERROR');
    }
  }, [currentTask, taskIndex, tasks.length, user, headers, feedbackError, feedbackDone]);

  const skipTask = () => {
    const next = taskIndex + 1;
    if (next < tasks.length) {
      setTaskIndex(next);
      setStep('SHOW_TASK');
    } else {
      setStep('NO_TASKS');
    }
  };

  // ─── RENDER ───────────────────────────────────────────────

  if (step === 'LOADING') return (
    <Box sx={{ ...wrapSx, alignItems: 'center', pt: 6 }}>
      <Typography sx={{ color: '#aaa', fontSize: 22 }}>Se încarcă taskuri...</Typography>
    </Box>
  );

  if (step === 'NO_TASKS') return (
    <Box sx={{ ...wrapSx, alignItems: 'center', pt: 4 }}>
      <StatusFlash ref={flashRef} />
      <Typography sx={{ fontSize: 64 }}>🎉</Typography>
      <Typography sx={{ fontSize: 28, fontWeight: 700, color: '#00c853', textAlign: 'center' }}>
        Niciun task putaway rămas!
      </Typography>
      <Typography sx={{ color: '#aaa', textAlign: 'center', mt: 1 }}>
        Toate produsele au fost depozitate.
      </Typography>
      <ActionButton variant="primary" onClick={loadTasks} sx={{ mt: 4 }}>🔄 Reîncarcă</ActionButton>
      <ActionButton variant="cancel" onClick={onBack} sx={{ mt: 1.5 }}>← Înapoi la HUB</ActionButton>
    </Box>
  );

  if (step === 'SHOW_TASK' && currentTask) return (
    <Box sx={wrapSx}>
      <StatusFlash ref={flashRef} />
      <ProgressBar current={taskIndex + 1} total={tasks.length} label="Task putaway" />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
        <WarehouseIcon sx={{ color: '#00e5ff' }} />
        <Typography sx={{ color: '#aaa', fontSize: 15 }}>
          Lot: <strong style={{ color: '#fff' }}>{currentTask.batchNumber}</strong>
        </Typography>
        <Chip label={`${currentTask.quantity} ${currentTask.unit}`} size="small" sx={{ bgcolor: '#1565c0', color: '#fff' }} />
      </Box>

      <Card sx={cardSx}>
        <CardContent>
          <Typography sx={{ color: '#aaa', fontSize: 13 }}>Produs</Typography>
          <Typography sx={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>{currentTask.productSku}</Typography>
          <Typography sx={{ color: '#ccc', fontSize: 16 }}>{currentTask.productName}</Typography>
        </CardContent>
      </Card>

      <BigInstruction icon="📍" text="Mergi la:" color="#aaa" />
      {currentTask.suggestedLocationCode
        ? <LocationBadge code={currentTask.suggestedLocationCode} highlight />
        : <Alert severity="warning">Nicio locație sugerată — selectează manual.</Alert>
      }

      <ActionButton variant="confirm" onClick={() => setStep('SCAN_LOCATION')} icon={<WarehouseIcon />} sx={{ mt: 2 }}>
        SCANEAZĂ LOCAȚIA
      </ActionButton>
      <ActionButton variant="skip" onClick={skipTask} sx={{ mt: 1 }}>⏭ Saltă task</ActionButton>
      <ActionButton variant="cancel" onClick={onBack} sx={{ mt: 1 }}>← Înapoi la HUB</ActionButton>
    </Box>
  );

  if (step === 'SCAN_LOCATION') return (
    <Box sx={wrapSx}>
      <StatusFlash ref={flashRef} />
      <BigInstruction
        icon="📍"
        text={`Scanează: ${currentTask?.suggestedLocationCode ?? '—'}`}
        subtext="confirmă că ești la locația corectă"
        color="#00e5ff"
      />
      {currentTask?.suggestedLocationCode && (
        <LocationBadge code={currentTask.suggestedLocationCode} highlight />
      )}
      <ScanInput onScan={handleScanLocation} active placeholder="Scanează locația..." />
      <ActionButton variant="skip" onClick={() => setStep('SHOW_TASK')} sx={{ mt: 3 }}>← Înapoi</ActionButton>
    </Box>
  );

  if (step === 'SCAN_PRODUCT') return (
    <Box sx={wrapSx}>
      <StatusFlash ref={flashRef} />
      <BigInstruction icon="📦" text="Scanează produsul pentru confirmare" subtext="confirmă că ai depozitat produsul corect" />
      <Card sx={cardSx}>
        <CardContent>
          <Typography sx={{ color: '#aaa', fontSize: 13 }}>Produs</Typography>
          <Typography sx={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>{currentTask?.productSku}</Typography>
          <Typography sx={{ color: '#ccc' }}>{currentTask?.productName}</Typography>
          <Typography sx={{ color: '#ffd740', mt: 1 }}>{currentTask?.quantity} {currentTask?.unit}</Typography>
        </CardContent>
      </Card>
      <ScanInput onScan={handleScanProduct} active placeholder="Scanează produsul..." />
      <ActionButton variant="skip" onClick={() => setStep('SCAN_LOCATION')} sx={{ mt: 3 }}>← Înapoi</ActionButton>
    </Box>
  );

  if (step === 'SUCCESS') return (
    <Box sx={{ ...wrapSx, alignItems: 'center', pt: 4 }}>
      <StatusFlash ref={flashRef} />
      <CheckCircleIcon sx={{ fontSize: 96, color: '#00c853', mb: 2 }} />
      <Typography sx={{ fontSize: 30, fontWeight: 700, color: '#00c853', textAlign: 'center' }}>
        TOATE TASKURILE FINALIZATE!
      </Typography>
      <Typography sx={{ color: '#aaa', textAlign: 'center', mt: 1 }}>
        {tasks.length} loturi depozitate cu succes.
      </Typography>
      <ActionButton variant="primary" onClick={loadTasks} sx={{ mt: 4 }}>🔄 Verifică noi taskuri</ActionButton>
      <ActionButton variant="cancel" onClick={onBack} sx={{ mt: 1.5 }}>← Înapoi la HUB</ActionButton>
    </Box>
  );

  if (step === 'ERROR') return (
    <Box sx={wrapSx}>
      <StatusFlash ref={flashRef} />
      <Typography sx={{ fontSize: 64, textAlign: 'center' }}>❌</Typography>
      <Alert severity="error" sx={{ fontSize: 16, whiteSpace: 'pre-line' }}>{message}</Alert>
      <ActionButton variant="primary" onClick={() => setStep(currentTask ? 'SHOW_TASK' : 'LOADING')}>🔄 Încearcă din nou</ActionButton>
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
};
