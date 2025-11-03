import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Table, TableHead, TableRow, TableCell, TableBody, LinearProgress, Stack } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import { ordersService, type Order, type OrderLine } from '../services/orders.service';

interface Props {
  open: boolean;
  orderId: string | null;
  onClose: () => void;
}

export const OrderDetailsDialog = ({ open, orderId, onClose }: Props) => {
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [lines, setLines] = useState<OrderLine[]>([]);

  useEffect(() => {
    if (!open || !orderId) return;
    setLoading(true);
    ordersService
      .get(orderId)
      .then((res) => {
        setOrder(res.order);
        setLines(res.lines);
      })
      .finally(() => setLoading(false));
  }, [open, orderId]);

  const handlePrint = () => {
    if (!orderId) return;
    window.open(ordersService.getPickNoteUrl(orderId), '_blank');
  };

  const handleDownload = async () => {
    if (!orderId || !order) return;
    const url = ordersService.getPickNoteUrl(orderId);
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
    const blob = await resp.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${order.number}_pick_note.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  };

  const handleRefresh = async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const res = await ordersService.get(orderId);
      setOrder(res.order);
      setLines(res.lines);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Comanda {order?.number}</DialogTitle>
      <DialogContent>
        {loading && <LinearProgress sx={{ mb: 2 }} />}
        {order && (
          <Box mb={2}>
            <Typography variant="body2">Partener: {order.partner_name || order.customer_name || '-'}</Typography>
            <Typography variant="body2">Status: {order.status || '-'}</Typography>
            <Typography variant="body2">Greutate totala: {order.total_weight ?? '-'} kg</Typography>
            {order.created_at && <Typography variant="body2">Creat: {new Date(order.created_at).toLocaleString()}</Typography>}
          </Box>
        )}

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Denumire articol</TableCell>
              <TableCell>Cod gest.</TableCell>
              <TableCell>UM</TableCell>
              <TableCell align="right">Cantitate</TableCell>
              <TableCell>Lot intrare</TableCell>
              <TableCell align="right">Greutate</TableCell>
              <TableCell>Lungimi solicitate</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lines.map((ln) => (
              <TableRow key={ln.id}>
                <TableCell>{ln.description || ln.product_sku}</TableCell>
                <TableCell>{ln.management_code || ''}</TableCell>
                <TableCell>{ln.uom}</TableCell>
                <TableCell align="right">{ln.requested_qty}</TableCell>
                <TableCell>{ln.lot_label || ''}</TableCell>
                <TableCell align="right">{ln.line_weight ?? ''}</TableCell>
                <TableCell>
                  {(() => {
                    const v = ln.requested_lengths;
                    if (!v) return '';
                    try {
                      const arr = JSON.parse(v);
                      return Array.isArray(arr) ? arr.join('+') : '';
                    } catch {
                      return '';
                    }
                  })()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions>
        <Stack direction="row" spacing={1} sx={{ mr: 'auto' }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={handleRefresh} disabled={loading}>Reîncarcă</Button>
        </Stack>
        <Button onClick={handleDownload} startIcon={<DownloadIcon />} disabled={!order}>Descarcă PDF</Button>
        <Button onClick={handlePrint} startIcon={<PrintIcon />} disabled={!order}>Imprimă</Button>
        <Button onClick={onClose} variant="contained">Închide</Button>
      </DialogActions>
    </Dialog>
  );
};
