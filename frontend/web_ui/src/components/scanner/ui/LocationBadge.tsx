import { Box, Typography, Chip } from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';

interface LocationBadgeProps {
  code: string;
  zone?: string;
  highlight?: boolean;
  subtext?: string;
}

export default function LocationBadge({ code, zone, highlight = false, subtext }: LocationBadgeProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        p: 3,
        borderRadius: 4,
        border: highlight ? '3px solid #00e5ff' : '2px solid #333',
        bgcolor: highlight ? 'rgba(0,229,255,0.08)' : 'rgba(255,255,255,0.04)',
        boxShadow: highlight ? '0 0 24px rgba(0,229,255,0.25)' : 'none',
        transition: 'all 0.3s',
        gap: 1,
      }}
    >
      <LocationOnIcon sx={{ color: highlight ? '#00e5ff' : '#888', fontSize: 40 }} />
      <Typography
        sx={{
          fontSize: { xs: 48, sm: 64, md: 72 },
          fontWeight: 900,
          color: highlight ? '#00e5ff' : '#ffffff',
          letterSpacing: 3,
          lineHeight: 1,
          fontFamily: 'monospace',
        }}
      >
        {code}
      </Typography>
      {zone && (
        <Chip
          label={`Zonă: ${zone}`}
          size="small"
          sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#ccc', fontSize: 14 }}
        />
      )}
      {subtext && (
        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, mt: 0.5 }}>
          {subtext}
        </Typography>
      )}
    </Box>
  );
}
