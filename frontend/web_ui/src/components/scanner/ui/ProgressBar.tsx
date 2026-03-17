import { Box, LinearProgress, Typography } from '@mui/material';

interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
}

export default function ProgressBar({ current, total, label }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography sx={{ color: '#aaa', fontSize: 14 }}>{label ?? 'Progres'}</Typography>
        <Typography sx={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>
          {current} / {total}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 10, borderRadius: 5,
          bgcolor: 'rgba(255,255,255,0.1)',
          '& .MuiLinearProgress-bar': {
            bgcolor: pct === 100 ? '#00c853' : '#00b0ff',
            borderRadius: 5,
          },
        }}
      />
    </Box>
  );
}
