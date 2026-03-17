/**
 * TutorialOverlay — Card de tutorial flotant (colț dreapta-jos)
 *                 + Drawer lateral cu lista tuturor tutorialelor
 */
import { useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Drawer,
  IconButton,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useNavigate } from 'react-router-dom';

import { useTutorial } from '../hooks/useTutorial';
import { ALL_TUTORIALS, TUTORIAL_CATEGORIES } from '../utils/tutorials';
import type { Tutorial } from '../utils/tutorials';

// ─────────────────────────────────────────────────────────────────────────────
// CSS global injectat o singură dată pentru efectul de highlight
// ─────────────────────────────────────────────────────────────────────────────
const HIGHLIGHT_STYLE_ID = 'wms-tutorial-highlight-style';

function injectHighlightStyles() {
  if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = HIGHLIGHT_STYLE_ID;
  style.textContent = `
    @keyframes wmsTutorialPulse {
      0%   { outline-color: #1976d2; box-shadow: 0 0 0 4px rgba(25,118,210,0.25); }
      50%  { outline-color: #42a5f5; box-shadow: 0 0 0 8px rgba(25,118,210,0.10); }
      100% { outline-color: #1976d2; box-shadow: 0 0 0 4px rgba(25,118,210,0.25); }
    }
    .wms-tutorial-highlight {
      outline: 3px solid #1976d2 !important;
      outline-offset: 4px !important;
      border-radius: 6px !important;
      position: relative !important;
      z-index: 1400 !important;
      animation: wmsTutorialPulse 1.8s ease-in-out infinite !important;
    }
  `;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────────
// Drawer: lista tutorialelor grupate pe categorie
// ─────────────────────────────────────────────────────────────────────────────
function TutorialListDrawer() {
  const { isDrawerOpen, closeDrawer, startTutorial } = useTutorial();

  const grouped = Object.entries(TUTORIAL_CATEGORIES).map(([cat, meta]) => ({
    cat: cat as Tutorial['category'],
    ...meta,
    tutorials: ALL_TUTORIALS.filter((t) => t.category === cat),
  })).filter(g => g.tutorials.length > 0);

  return (
    <Drawer
      anchor="right"
      open={isDrawerOpen}
      onClose={closeDrawer}
      PaperProps={{ sx: { width: 340, p: 0 } }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 3,
          py: 2,
          background: 'linear-gradient(135deg, #1565c0 0%, #1976d2 100%)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Tutoriale WMS NK
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.85 }}>
            Ghiduri pas cu pas pentru fiecare flux
          </Typography>
        </Box>
        <IconButton onClick={closeDrawer} sx={{ color: '#fff' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Lista */}
      <Box sx={{ overflowY: 'auto', flex: 1 }}>
        {grouped.map(({ cat, label, emoji, tutorials }) => (
          <Box key={cat}>
            <Box sx={{ px: 2, pt: 2, pb: 0.5 }}>
              <Typography variant="overline" color="text.secondary" fontWeight={700}>
                {emoji} {label}
              </Typography>
            </Box>
            <List disablePadding>
              {tutorials.map((t) => (
                <ListItemButton
                  key={t.id}
                  onClick={() => startTutorial(t.id)}
                  sx={{
                    px: 2,
                    py: 1.5,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Box sx={{ fontSize: 28, mr: 2, lineHeight: 1 }}>{t.emoji}</Box>
                  <ListItemText
                    primary={
                      <Typography variant="body2" fontWeight={600}>
                        {t.title}
                      </Typography>
                    }
                    secondary={
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {t.description}
                        </Typography>
                        <Chip
                          label={`~${t.estimatedMinutes} min`}
                          size="small"
                          sx={{ mt: 0.5, height: 20, fontSize: 11 }}
                          variant="outlined"
                        />
                      </Box>
                    }
                  />
                </ListItemButton>
              ))}
            </List>
          </Box>
        ))}
      </Box>

      <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary">
          Tutorialele pot fi oprite oricând și reluate ulterior.
        </Typography>
      </Box>
    </Drawer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card flotant — afișat cât timp un tutorial este activ
// ─────────────────────────────────────────────────────────────────────────────
function ActiveTutorialCard() {
  const {
    activeTutorial,
    currentStep,
    currentStepIndex,
    nextStep,
    prevStep,
    closeTutorial,
  } = useTutorial();
  const navigate = useNavigate();

  if (!activeTutorial || !currentStep) return null;

  const totalSteps = activeTutorial.steps.length;
  const progress = ((currentStepIndex + 1) / totalSteps) * 100;
  const isLast = currentStepIndex === totalSteps - 1;

  return (
    <Card
      elevation={8}
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: 360,
        zIndex: 1500,
        borderRadius: 3,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'primary.main',
      }}
    >
      {/* Progress bar */}
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{ height: 4 }}
      />

      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1,
          background: 'linear-gradient(90deg, #1565c0, #1976d2)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: 20 }}>{activeTutorial.emoji}</Typography>
          <Box>
            <Typography variant="caption" sx={{ opacity: 0.85, display: 'block' }}>
              {activeTutorial.title}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.65 }}>
              Pasul {currentStepIndex + 1} din {totalSteps}
            </Typography>
          </Box>
        </Box>
        <Tooltip title="Închide tutorial">
          <IconButton size="small" onClick={closeTutorial} sx={{ color: '#fff' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Conținut pas */}
      <CardContent sx={{ pb: 1 }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          {currentStep.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
          {currentStep.content}
        </Typography>

        {/* Tip opțional */}
        {currentStep.tip && (
          <Box
            sx={{
              mt: 1.5,
              p: 1.2,
              borderRadius: 2,
              bgcolor: 'warning.50',
              border: '1px solid',
              borderColor: 'warning.200',
              display: 'flex',
              gap: 1,
              alignItems: 'flex-start',
            }}
          >
            <LightbulbOutlinedIcon fontSize="small" color="warning" sx={{ mt: 0.1 }} />
            <Typography variant="caption" color="text.secondary">
              {currentStep.tip}
            </Typography>
          </Box>
        )}

        {/* Buton acțiune opțional */}
        {currentStep.actionLabel && currentStep.actionPath && (
          <Button
            size="small"
            variant="outlined"
            endIcon={<OpenInNewIcon fontSize="small" />}
            onClick={() => navigate(currentStep.actionPath!)}
            sx={{ mt: 1.5, textTransform: 'none' }}
          >
            {currentStep.actionLabel}
          </Button>
        )}
      </CardContent>

      <Divider />

      {/* Navigare */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1 }}>
        <Button
          size="small"
          startIcon={<ArrowBackIcon />}
          onClick={prevStep}
          disabled={currentStepIndex === 0}
          sx={{ textTransform: 'none' }}
        >
          Înapoi
        </Button>

        <Box sx={{ display: 'flex', gap: 0.8 }}>
          {activeTutorial.steps.map((_, i) => (
            <Box
              key={i}
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: i === currentStepIndex ? 'primary.main' : 'grey.300',
                transition: 'background-color 0.3s',
              }}
            />
          ))}
        </Box>

        {isLast ? (
          <Button
            size="small"
            variant="contained"
            onClick={closeTutorial}
            sx={{ textTransform: 'none' }}
          >
            Finalizează ✓
          </Button>
        ) : (
          <Button
            size="small"
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            onClick={nextStep}
            sx={{ textTransform: 'none' }}
          >
            Următor
          </Button>
        )}
      </Stack>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Export principal — se montează o singură dată în App.tsx
// ─────────────────────────────────────────────────────────────────────────────
export default function TutorialOverlay() {
  // Injectează CSS la montare
  useEffect(() => {
    injectHighlightStyles();
  }, []);

  return (
    <>
      <TutorialListDrawer />
      <ActiveTutorialCard />
    </>
  );
}
