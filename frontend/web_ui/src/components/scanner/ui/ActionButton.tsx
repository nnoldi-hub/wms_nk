import { Button, type SxProps } from '@mui/material';

type Variant = 'confirm' | 'cancel' | 'skip' | 'primary';

const COLORS: Record<Variant, { bgcolor: string; hover: string; color: string }> = {
  confirm: { bgcolor: '#00c853', hover: '#00a041', color: '#000' },
  cancel:  { bgcolor: '#d50000', hover: '#b71c1c', color: '#fff' },
  skip:    { bgcolor: '#424242', hover: '#333',    color: '#ccc' },
  primary: { bgcolor: '#1565c0', hover: '#0d47a1', color: '#fff' },
};

interface ActionButtonProps {
  variant?: Variant;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  sx?: SxProps;
}

export default function ActionButton({
  variant = 'primary',
  onClick,
  children,
  disabled = false,
  fullWidth = true,
  icon,
  sx,
}: ActionButtonProps) {
  const c = COLORS[variant];
  return (
    <Button
      fullWidth={fullWidth}
      disabled={disabled}
      onClick={onClick}
      startIcon={icon}
      sx={{
        minHeight: 80,
        fontSize: { xs: 18, sm: 22 },
        fontWeight: 700,
        borderRadius: 3,
        bgcolor: c.bgcolor,
        color: c.color,
        letterSpacing: 1,
        textTransform: 'none',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        transition: 'all 0.2s',
        '&:hover': { bgcolor: c.hover, transform: 'scale(1.01)' },
        '&:active': { transform: 'scale(0.98)' },
        '&:disabled': { opacity: 0.4 },
        ...sx,
      }}
    >
      {children}
    </Button>
  );
}
