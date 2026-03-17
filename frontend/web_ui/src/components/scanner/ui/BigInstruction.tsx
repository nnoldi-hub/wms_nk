import { Box, Typography } from '@mui/material';

interface BigInstructionProps {
  icon?: string;
  text: string;
  subtext?: string;
  color?: string;
}

export default function BigInstruction({ icon, text, subtext, color = '#ffffff' }: BigInstructionProps) {
  return (
    <Box sx={{ textAlign: 'center', py: 2 }}>
      {icon && (
        <Typography sx={{ fontSize: 64, lineHeight: 1.2, mb: 1 }}>
          {icon}
        </Typography>
      )}
      <Typography
        sx={{
          fontSize: { xs: 28, sm: 36, md: 42 },
          fontWeight: 700,
          color,
          letterSpacing: 0.5,
          lineHeight: 1.3,
          textShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}
      >
        {text}
      </Typography>
      {subtext && (
        <Typography
          sx={{
            fontSize: { xs: 16, sm: 20 },
            color: 'rgba(255,255,255,0.6)',
            mt: 1,
          }}
        >
          {subtext}
        </Typography>
      )}
    </Box>
  );
}
