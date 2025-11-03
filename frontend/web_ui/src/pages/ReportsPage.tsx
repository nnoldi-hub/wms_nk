import { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, Button, Stack } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { reportsService } from '../services/reports.service';

export function ReportsPage() {
  const [online, setOnline] = useState<'unknown' | 'online' | 'offline'>('unknown');

  useEffect(() => {
    (async () => {
      const res = await reportsService.ping();
      setOnline(res?.status === 'healthy' ? 'online' : 'offline');
    })();
  }, []);

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h4">Rapoarte</Typography>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={async () => {
          const res = await reportsService.ping();
          setOnline(res?.status === 'healthy' ? 'online' : 'offline');
        }}>REFRESH</Button>
      </Stack>

      <Stack spacing={2}>
        <Card>
          <CardContent>
            <Typography variant="subtitle1">Status serviciu rapoarte</Typography>
            <Typography variant="body2" color={online === 'online' ? 'success.main' : 'error.main'}>
              {online === 'unknown' ? 'Verific...' : online}
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="subtitle1">Exports disponibile (skeleton)</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Legăm aici acțiuni către rapoarte PDF/Excel din Reports Service.
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" disabled>Export Products CSV</Button>
              <Button variant="contained" disabled>Export Inventory PDF</Button>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}

export default ReportsPage;
