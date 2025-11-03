import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from '@mui/material';
import { inventoryService, type InventoryItem } from '../services/inventory.service';

interface Props {
  open: boolean;
  onClose: () => void;
  productSku: string;
  productName: string;
}

type InventoryItemWithLocation = InventoryItem & {
  warehouse_name?: string;
  zone_name?: string;
  location_code?: string;
};

export const ProductInventoryDialog = ({ open, onClose, productSku, productName }: Props) => {
  const [items, setItems] = useState<InventoryItemWithLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!open) return;
      try {
        setLoading(true);
        setError('');
        const data = await inventoryService.getProductInventory(productSku);
        setItems(data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Nu s-a putut încărca stocul pe locații';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open, productSku]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Stoc pe Locații — {productName} (SKU: {productSku})</DialogTitle>
      <DialogContent>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}
        {!!error && <Alert severity="error">{error}</Alert>}
        {!loading && !error && (
          items.length === 0 ? (
            <Typography color="text.secondary">Nu există stoc pentru acest produs în nicio locație.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Depozit</TableCell>
                  <TableCell>Zonă</TableCell>
                  <TableCell>Locație</TableCell>
                  <TableCell align="right">Cantitate</TableCell>
                  <TableCell>Lot</TableCell>
                  <TableCell>QR</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>{it.warehouse_name || '-'}</TableCell>
                    <TableCell>{it.zone_name || '-'}</TableCell>
                    <TableCell>{it.location_code || it.location_id}</TableCell>
                    <TableCell align="right">{Number(it.quantity).toLocaleString()}</TableCell>
                    <TableCell>{it.lot_number || '-'}</TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {it.qr_code_data?.location_code || '-'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Închide</Button>
      </DialogActions>
    </Dialog>
  );
};
