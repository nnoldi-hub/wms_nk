import { forwardRef } from 'react';
import { Box } from '@mui/material';

// Fullscreen color flash overlay — triggered via ref.style manipulation in useScannerFeedback
const StatusFlash = forwardRef<HTMLDivElement>((_, ref) => (
  <Box
    ref={ref}
    sx={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      pointerEvents: 'none',
      display: 'none',
      opacity: 0,
      transition: 'opacity 0.2s ease-out',
    }}
  />
));

StatusFlash.displayName = 'StatusFlash';
export default StatusFlash;
