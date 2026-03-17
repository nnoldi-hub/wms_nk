/**
 * NotificationBell.tsx — Faza 6.3: Alerte în timp real (WebSocket)
 *
 * Buton clopoțel în AppBar. Primește alerte prin WebSocket (ws://warehouse-config/ws).
 * Fallback: dacă WS nu e conectat, afișează un indicator de reconectare.
 */

import { useState } from 'react';
import {
  Badge, IconButton, Popover, Box, Typography, List, ListItem,
  ListItemText, ListItemIcon, Divider, Button, Chip, Tooltip,
  CircularProgress,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import ErrorIcon from '@mui/icons-material/Error';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';

const SEV_ICON: Record<string, React.ReactNode> = {
  CRITICAL: <ErrorIcon fontSize="small" sx={{ color: 'error.main' }} />,
  WARNING: <WarningAmberIcon fontSize="small" sx={{ color: 'warning.main' }} />,
  INFO: <InfoOutlinedIcon fontSize="small" sx={{ color: 'info.main' }} />,
};

const SEV_COLOR: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  CRITICAL: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

export default function NotificationBell() {
  const { alerts, connected, lastUpdate, reconnectCount } = useWebSocket();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const navigate = useNavigate();

  const criticalCount = alerts.filter(a => a.severity === 'CRITICAL').length;
  const warningCount = alerts.filter(a => a.severity === 'WARNING').length;
  const badgeCount = criticalCount + warningCount;

  const badgeColor = criticalCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'default';

  const open = Boolean(anchorEl);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleGoToAlerts = () => {
    handleClose();
    navigate('/alerte-live');
  };

  const displayAlerts = alerts.slice(0, 8);

  const tooltipText = !connected
    ? `Reconectare... (${reconnectCount})`
    : badgeCount > 0
      ? `${badgeCount} alerte active`
      : 'Nicio alertă activă';

  return (
    <>
      <Tooltip title={tooltipText}>
        <IconButton color="inherit" onClick={handleOpen} sx={{ mr: 1 }} data-tutorial="notification-bell">
          <Badge badgeContent={badgeCount > 0 ? badgeCount : undefined} color={badgeColor as 'error' | 'warning'} max={99}>
            {!connected
              ? <CircularProgress size={20} color="inherit" thickness={5} />
              : badgeCount > 0
                ? <NotificationsIcon />
                : <NotificationsNoneIcon />}
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 380, maxHeight: 520, display: 'flex', flexDirection: 'column' } }}
      >
        {/* Header */}
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="subtitle1" fontWeight="bold">Alerte WMS</Typography>
            {lastUpdate && (
              <Typography variant="caption" color="text.secondary">
                Actualizat: {lastUpdate.toLocaleTimeString('ro-RO')}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            {criticalCount > 0 && <Chip label={`${criticalCount} CRITICAL`} size="small" color="error" />}
            {warningCount > 0 && <Chip label={`${warningCount} WARNING`} size="small" color="warning" />}
            <Tooltip title={connected ? 'WebSocket conectat — real-time' : `Reconectare... (${reconnectCount})`}>
              <Box sx={{ display: 'flex', alignItems: 'center', ml: 0.5 }}>
                {connected
                  ? <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} />
                  : <WifiOffIcon fontSize="small" color="disabled" />}
              </Box>
            </Tooltip>
          </Box>
        </Box>

        {/* Lista alerte */}
        <Box sx={{ overflowY: 'auto', flexGrow: 1 }}>
          {displayAlerts.length === 0 ? (
            <Box sx={{ py: 4, px: 2, textAlign: 'center' }}>
              <NotificationsNoneIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                {!connected ? 'Conectare la server...' : 'Nicio alertă activă — depozitul funcționează normal ✓'}
              </Typography>
            </Box>
          ) : (
            <List dense disablePadding>
              {displayAlerts.map((alert, i) => (
                <Box key={alert.id || i}>
                  {i > 0 && <Divider />}
                  <ListItem alignItems="flex-start" sx={{ py: 1.5 }}>
                    <ListItemIcon sx={{ mt: 0.5, minWidth: 32 }}>
                      {SEV_ICON[alert.severity]}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="body2" fontWeight="medium" sx={{ flexGrow: 1 }}>
                            {alert.title}
                          </Typography>
                          <Chip
                            label={alert.severity}
                            size="small"
                            color={SEV_COLOR[alert.severity] || 'default'}
                            sx={{ fontSize: '0.65rem', height: 18 }}
                          />
                        </Box>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                          {alert.message}
                        </Typography>
                      }
                    />
                  </ListItem>
                </Box>
              ))}
              {alerts.length > 8 && (
                <Box sx={{ textAlign: 'center', py: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    +{alerts.length - 8} alerte suplimentare
                  </Typography>
                </Box>
              )}
            </List>
          )}
        </Box>

        {/* Footer */}
        <Divider />
        <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            size="small"
            endIcon={<OpenInNewIcon fontSize="small" />}
            onClick={handleGoToAlerts}
          >
            Vezi toate alertele
          </Button>
        </Box>
      </Popover>
    </>
  );
}
