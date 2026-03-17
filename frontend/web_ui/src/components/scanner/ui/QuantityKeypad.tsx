import { useState } from 'react';
import { Box, Typography, Button, TextField } from '@mui/material';
import BackspaceIcon from '@mui/icons-material/Backspace';

interface QuantityKeypadProps {
  value: number;
  onChange: (v: number) => void;
  label?: string;
  unit?: string;
  maxValue?: number;
}

const QUICK_ADD = [1, 5, 10, 50];

export default function QuantityKeypad({ value, onChange, label = 'Cantitate', unit = 'buc', maxValue }: QuantityKeypadProps) {
  const [strVal, setStrVal] = useState(String(value || ''));

  const commit = (v: string) => {
    const n = parseInt(v, 10);
    if (!isNaN(n) && n >= 0) {
      const clamped = maxValue ? Math.min(n, maxValue) : n;
      onChange(clamped);
      setStrVal(String(clamped));
    }
  };

  const press = (digit: string) => {
    const next = strVal === '0' ? digit : strVal + digit;
    setStrVal(next);
    commit(next);
  };

  const backspace = () => {
    const next = strVal.slice(0, -1) || '0';
    setStrVal(next);
    commit(next);
  };

  const quickAdd = (n: number) => {
    const next = (value || 0) + n;
    const clamped = maxValue ? Math.min(next, maxValue) : next;
    onChange(clamped);
    setStrVal(String(clamped));
  };

  const digits = ['7','8','9','4','5','6','1','2','3','0','00','⌫'];

  return (
    <Box sx={{ maxWidth: 340, mx: 'auto' }}>
      <Typography sx={{ color: '#aaa', mb: 1, textAlign: 'center', fontSize: 16 }}>{label}</Typography>

      {/* Display */}
      <TextField
        value={strVal}
        onChange={e => { setStrVal(e.target.value); commit(e.target.value); }}
        inputProps={{ style: { fontSize: 48, textAlign: 'center', color: '#fff', fontWeight: 700 } }}
        sx={{
          mb: 2, width: '100%',
          '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.07)', borderRadius: 2 },
        }}
        InputProps={{
          endAdornment: <Typography sx={{ color: '#aaa', fontSize: 20, pr: 1 }}>{unit}</Typography>,
        }}
      />

      {/* Quick add buttons */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        {QUICK_ADD.map(n => (
          <Button
            key={n}
            onClick={() => quickAdd(n)}
            sx={{
              flex: 1, minHeight: 44, borderRadius: 2, fontSize: 16, fontWeight: 600,
              bgcolor: 'rgba(21,101,192,0.4)', color: '#90caf9',
              '&:hover': { bgcolor: 'rgba(21,101,192,0.65)' },
            }}
          >
            +{n}
          </Button>
        ))}
      </Box>

      {/* Digit grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
        {digits.map(d => (
          <Button
            key={d}
            onClick={() => d === '⌫' ? backspace() : press(d)}
            sx={{
              minHeight: 64, borderRadius: 2, fontSize: 22, fontWeight: 700,
              bgcolor: d === '⌫' ? 'rgba(211,47,47,0.35)' : 'rgba(255,255,255,0.08)',
              color: d === '⌫' ? '#ff5252' : '#fff',
              '&:hover': { bgcolor: d === '⌫' ? 'rgba(211,47,47,0.55)' : 'rgba(255,255,255,0.15)' },
            }}
          >
            {d === '⌫' ? <BackspaceIcon /> : d}
          </Button>
        ))}
      </Box>
    </Box>
  );
}
