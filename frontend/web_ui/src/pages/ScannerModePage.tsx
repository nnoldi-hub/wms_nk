import { useState, useEffect } from 'react';
import { Box, Typography, Button, IconButton, Tooltip, Badge } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useScannerFeedback } from '../hooks/useScannerFeedback';
import { useNotifications } from '../hooks/useNotifications';
import ReceptieWorkflow from '../components/scanner/workflows/ReceptieWorkflow';
import PutawayWorkflow from '../components/scanner/workflows/PutawayWorkflow';
import PickingWorkflow from '../components/scanner/workflows/PickingWorkflow';
import LivrareWorkflow from '../components/scanner/workflows/LivrareWorkflow';
import type { WorkflowType } from '../components/scanner/types';

type ActiveView = WorkflowType | null;

interface HubAction {
  workflow: WorkflowType;
  icon: string;
  label: string;
  color: string;
  border: string;
}

const WORKFLOW_LABELS: Record<WorkflowType, string> = {
  RECEPTIE: 'RECEPȚIE',
  PUTAWAY:  'DEPOZITARE',
  PICKING:  'CULEGERE',
  LIVRARE:  'LIVRARE',
};

const ACTIONS: HubAction[] = [
  { workflow: 'RECEPTIE', icon: '📥', label: 'RECEPȚIE',     color: 'rgba(21,101,192,0.35)',  border: '#1565c0' },
  { workflow: 'PUTAWAY',  icon: '📦', label: 'DEPOZITARE',   color: 'rgba(74,20,140,0.35)',   border: '#7b1fa2' },
  { workflow: 'PICKING',  icon: '🛒', label: 'CULEGERE',     color: 'rgba(230,81,0,0.35)',    border: '#e65100' },
  { workflow: 'LIVRARE',  icon: '🚚', label: 'LIVRARE',      color: 'rgba(1,87,46,0.35)',     border: '#00c853' },
];

export default function ScannerModePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { getSoundEnabled, setSoundEnabled, feedbackOK } = useScannerFeedback();
  const [activeView, setActiveView] = useState<ActiveView>(null);
  const [soundOn, setSoundOn] = useState(getSoundEnabled());
  const { assignedJobCount, lastJobAssigned, clearLastJob } = useNotifications();
  const [showJobBanner, setShowJobBanner] = useState(false);

  // Arată banner fullscreen când vine un job nou
  useEffect(() => {
    if (lastJobAssigned) {
      setShowJobBanner(true);
      // Sunet alertă job nou (dacă sunetul e pornit)
      if (getSoundEnabled()) feedbackOK();
    }
  }, [lastJobAssigned, getSoundEnabled, playFeedback]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#0d0d0d',
        display: 'flex',
        flexDirection: 'column',
        color: '#fff',
        // Prevent zoom on double-tap (mobile)
        touchAction: 'manipulation',
      }}
    >
      {/* ── HEADER ─────────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          bgcolor: '#141414',
          borderBottom: '1px solid #222',
          minHeight: 56,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {activeView && (
            <Button
              onClick={() => setActiveView(null)}
              sx={{ color: '#aaa', fontSize: 14, textTransform: 'none', minWidth: 0, px: 1 }}
            >
              ← HUB
            </Button>
          )}
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: activeView ? '#00e5ff' : '#fff' }}>
            {activeView ? WORKFLOW_LABELS[activeView] : 'WMS NK — Operator'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ color: '#666', fontSize: 13, display: { xs: 'none', sm: 'block' } }}>
            {user?.username}
          </Typography>

          <Tooltip title={soundOn ? 'Sunet activ' : 'Sunet oprit'}>
            <IconButton onClick={toggleSound} size="small" sx={{ color: soundOn ? '#00e5ff' : '#555' }}>
              {soundOn ? <VolumeUpIcon /> : <VolumeOffIcon />}
            </IconButton>
          </Tooltip>

          {/* Buton switch la UI admin (pentru manager/admin) */}
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <Tooltip title="Deschide UI Admin">
              <IconButton onClick={() => navigate('/dashboard')} size="small" sx={{ color: '#888' }}>
                <OpenInNewIcon />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title="Deconectare">
            <IconButton onClick={handleLogout} size="small" sx={{ color: '#ff5252' }}>
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ── CONTENT ────────────────────────────────────────── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {activeView === null && <HubScreen onSelect={setActiveView} pickingBadge={assignedJobCount} />}
        {showJobBanner && lastJobAssigned && (
          <Box
            sx={{
              position: 'fixed', inset: 0, zIndex: 9999,
              bgcolor: lastJobAssigned.priority === 'CRITIC' ? 'rgba(211,47,47,0.97)' : 'rgba(230,81,0,0.97)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 3, p: 4,
              animation: lastJobAssigned.priority === 'CRITIC' ? 'pulse 1s infinite' : undefined,
            }}
          >
            <Typography sx={{ fontSize: 60 }}>🔔</Typography>
            <Typography sx={{ fontSize: 28, fontWeight: 900, color: '#fff', textAlign: 'center' }}>
              JOB NOU ALOCAT!
            </Typography>
            {lastJobAssigned.orderRef && (
              <Typography sx={{ fontSize: 18, color: '#ffe0b2', textAlign: 'center' }}>
                Comandă: {lastJobAssigned.orderRef}
              </Typography>
            )}
            {lastJobAssigned.priority !== 'NORMAL' && (
              <Box sx={{
                bgcolor: '#fff', color: '#b71c1c', px: 3, py: 1,
                borderRadius: 2, fontWeight: 900, fontSize: 20,
              }}>
                ⚠️ PRIORITATE: {lastJobAssigned.priority}
              </Box>
            )}
            <Button
              variant="contained"
              size="large"
              onClick={() => { setShowJobBanner(false); clearLastJob(); setActiveView('PICKING'); }}
              sx={{ mt: 2, bgcolor: '#fff', color: '#e65100', fontWeight: 900, fontSize: 18, px: 5, py: 1.5 }}
            >
              ACCEPTĂ
            </Button>
            <Button
              onClick={() => { setShowJobBanner(false); clearLastJob(); }}
              sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}
            >
              Ignoră momentan
            </Button>
          </Box>
        )}
        {activeView === 'RECEPTIE' && <ReceptieWorkflow onBack={() => setActiveView(null)} />}
        {activeView === 'PUTAWAY'  && <PutawayWorkflow  onBack={() => setActiveView(null)} />}
        {activeView === 'PICKING'  && <PickingWorkflow  onBack={() => setActiveView(null)} />}
        {activeView === 'LIVRARE'  && <LivrareWorkflow  onBack={() => setActiveView(null)} />}
      </Box>
    </Box>
  );
}

// ── HUB SCREEN ──────────────────────────────────────────────
function HubScreen({ onSelect, pickingBadge = 0 }: { onSelect: (w: WorkflowType) => void; pickingBadge?: number }) {
  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        px: 3,
        py: 4,
        gap: 4,
      }}
    >
      <Typography
        sx={{
          fontSize: { xs: 20, sm: 26 },
          fontWeight: 300,
          color: '#aaa',
          letterSpacing: 2,
          textTransform: 'uppercase',
          textAlign: 'center',
        }}
      >
        Ce operație faci?
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(2, minmax(180px, 260px))' },
          gap: { xs: 2, sm: 3 },
          width: '100%',
          maxWidth: 600,
        }}
      >
        {ACTIONS.map(({ workflow, icon, label, color, border }) => {
          const badgeCount = workflow === 'PICKING' ? pickingBadge : 0;
          return (
            <Badge
              key={workflow}
              badgeContent={badgeCount > 0 ? badgeCount : undefined}
              color={badgeCount > 0 ? 'error' : 'default'}
              sx={{ '& .MuiBadge-badge': { fontSize: 14, fontWeight: 900, minWidth: 22, height: 22 } }}
            >
              <Button
                onClick={() => onSelect(workflow)}
                sx={{
                  flexDirection: 'column',
                  gap: 1.5,
                  minHeight: { xs: 130, sm: 160 },
                  width: '100%',
                  borderRadius: 4,
                  bgcolor: color,
                  border: `2px solid ${badgeCount > 0 && workflow === 'PICKING' ? '#ff1744' : border}`,
                  color: '#fff',
                  fontSize: { xs: 18, sm: 22 },
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: 'none',
                  boxShadow: badgeCount > 0 && workflow === 'PICKING'
                    ? '0 4px 20px #ff174466'
                    : `0 4px 20px ${border}33`,
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: color.replace('0.35', '0.55'),
                    transform: 'scale(1.03)',
                    boxShadow: `0 8px 28px ${border}55`,
                  },
                  '&:active': { transform: 'scale(0.97)' },
                }}
              >
                <Typography sx={{ fontSize: { xs: 44, sm: 52 }, lineHeight: 1 }}>{icon}</Typography>
                {label}
              </Button>
            </Badge>
          );
        })}
      </Box>

      <Typography sx={{ color: '#333', fontSize: 12, textAlign: 'center', mt: 2 }}>
        WMS NK · Mod Operator · v2
      </Typography>
    </Box>
  );
}
