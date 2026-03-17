import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Box, Typography } from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';

interface ScanInputProps {
  onScan: (code: string) => void;
  active?: boolean;
  placeholder?: string;
}

export interface ScanInputHandle {
  focus: () => void;
}

// Hidden input that captures barcode/QR scanner output (Enter-terminated)
const ScanInput = forwardRef<ScanInputHandle, ScanInputProps>(
  ({ onScan, active = true, placeholder = 'Scanează codul...' }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const bufferRef = useRef('');
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
    }));

    // Auto-focus when active
    useEffect(() => {
      if (active) {
        const t = setTimeout(() => inputRef.current?.focus(), 100);
        return () => clearTimeout(t);
      }
    }, [active]);

    // Re-focus if focus is lost (operator accidentally clicks elsewhere)
    useEffect(() => {
      if (!active) return;
      const handleBlur = () => {
        const t = setTimeout(() => inputRef.current?.focus(), 1500);
        return () => clearTimeout(t);
      };
      const el = inputRef.current;
      el?.addEventListener('blur', handleBlur);
      return () => el?.removeEventListener('blur', handleBlur);
    }, [active]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const code = bufferRef.current.trim();
        bufferRef.current = '';
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        if (code) onScan(code);
      } else {
        bufferRef.current += e.key;
        // Auto-flush after 200ms silent pause (some scanners don't send Enter)
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          const code = bufferRef.current.trim();
          bufferRef.current = '';
          if (code.length > 2) onScan(code);
        }, 200);
      }
    };

    return (
      <Box sx={{ position: 'relative', textAlign: 'center' }}>
        {/* Visible indicator */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            px: 3, py: 2,
            borderRadius: 3,
            border: active ? '2px solid #00e5ff' : '2px solid #444',
            bgcolor: active ? 'rgba(0,229,255,0.07)' : 'rgba(255,255,255,0.03)',
            cursor: 'text',
            transition: 'all 0.3s',
          }}
          onClick={() => inputRef.current?.focus()}
        >
          <QrCodeScannerIcon sx={{ color: active ? '#00e5ff' : '#555', fontSize: 32 }} />
          <Typography sx={{ color: active ? '#00e5ff' : '#555', fontSize: 18, letterSpacing: 1 }}>
            {placeholder}
          </Typography>
        </Box>

        {/* Hidden actual input */}
        <input
          ref={inputRef}
          onKeyDown={handleKeyDown}
          onChange={() => { /* controlled via keydown buffer */ }}
          value=""
          style={{
            position: 'absolute',
            opacity: 0,
            width: 1,
            height: 1,
            top: 0,
            left: 0,
            pointerEvents: 'none',
          }}
          readOnly={false}
          tabIndex={-1}
          aria-label="Scanner input"
        />
      </Box>
    );
  }
);

ScanInput.displayName = 'ScanInput';
export default ScanInput;
