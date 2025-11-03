import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Stack,
  Divider,
} from '@mui/material';
import QRCode from 'qrcode';
import { warehouseConfigService } from '../services/warehouseConfig.service';
import { inventoryService } from '../services/inventory.service';

interface LocationAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  productSku: string;
  productName: string;
  productUom: string;
  onSuccess: () => void;
}

interface Warehouse {
  id: string;
  warehouse_code: string;
  warehouse_name: string;
}

interface Zone {
  id: string;
  zone_code: string;
  zone_name: string;
  warehouse_id: string;
}

interface Location {
  id: string;
  location_code: string;
  aisle?: string;
  rack?: string;
  shelf_level?: number;
  bin_position?: string;
  status: string;
  zone_id: string;
}

export const LocationAssignmentDialog = ({
  open,
  onClose,
  productSku,
  productName,
  productUom,
  onSuccess,
}: LocationAssignmentDialogProps) => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qrPreviewUrl, setQrPreviewUrl] = useState('');

  // Load warehouses on mount
  useEffect(() => {
    if (open) {
      loadWarehouses();
    }
  }, [open]);

  // Load zones when warehouse is selected
  useEffect(() => {
    if (selectedWarehouseId) {
      loadZones(selectedWarehouseId);
      setSelectedZoneId('');
      setSelectedLocationId('');
      setLocations([]);
    }
  }, [selectedWarehouseId]);

  // Load locations when zone is selected
  useEffect(() => {
    if (selectedZoneId) {
      loadAvailableLocations(selectedZoneId);
      setSelectedLocationId('');
    }
  }, [selectedZoneId]);

  // Generate QR preview when all data is filled
  useEffect(() => {
    if (selectedLocationId && quantity) {
      generateQRPreview();
    }
  }, [selectedLocationId, quantity, lotNumber]);

  const loadWarehouses = async () => {
    try {
      setLoading(true);
      const data = await warehouseConfigService.getWarehouses();
      setWarehouses(data);
    } catch (err) {
      setError('Failed to load warehouses');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadZones = async (warehouseId: string) => {
    try {
      setLoading(true);
      const data = await warehouseConfigService.getZones(warehouseId);
      setZones(data);
    } catch (err) {
      setError('Failed to load zones');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableLocations = async (zoneId: string) => {
    try {
      setLoading(true);
      // Get all locations for this zone
      const allLocations = await warehouseConfigService.getLocations(zoneId);
      // Filter only AVAILABLE locations
      const availableLocations = allLocations.filter(
        (loc: Location) => loc.status === 'AVAILABLE'
      );
      setLocations(availableLocations);
      
      if (availableLocations.length === 0) {
        setError('No available locations in this zone');
      }
    } catch (err) {
      setError('Failed to load locations');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateQRPreview = async () => {
    try {
      const selectedLocation = locations.find(loc => loc.id === selectedLocationId);
      const selectedZone = zones.find(z => z.id === selectedZoneId);
      const selectedWarehouse = warehouses.find(w => w.id === selectedWarehouseId);

      if (!selectedLocation || !selectedZone || !selectedWarehouse) return;

      const qrData = {
        type: 'PRODUCT_LOCATION',
        sku: productSku,
        product_name: productName,
        warehouse_code: selectedWarehouse.warehouse_code,
        warehouse_name: selectedWarehouse.warehouse_name,
        zone_code: selectedZone.zone_code,
        zone_name: selectedZone.zone_name,
        location_code: selectedLocation.location_code,
        quantity: parseFloat(quantity),
        uom: productUom,
        lot_number: lotNumber || null,
        assigned_at: new Date().toISOString(),
      };

      const qrCodeUrl = await QRCode.toDataURL(JSON.stringify(qrData), {
        width: 300,
        margin: 2,
        errorCorrectionLevel: 'M',
      });

      setQrPreviewUrl(qrCodeUrl);
    } catch (err) {
      console.error('QR generation error:', err);
    }
  };

  const handleSave = async () => {
    if (!selectedLocationId || !quantity) {
      setError('Please fill all required fields');
      return;
    }

    if (parseFloat(quantity) <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Call API to assign product to location
      await inventoryService.assignProductToLocation({
        product_sku: productSku,
        location_id: selectedLocationId,
        quantity: parseFloat(quantity),
        lot_number: lotNumber || null,
      });

      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to assign location');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedWarehouseId('');
    setSelectedZoneId('');
    setSelectedLocationId('');
    setQuantity('');
    setLotNumber('');
    setQrPreviewUrl('');
    setError('');
    onClose();
  };

  const selectedLocation = locations.find(loc => loc.id === selectedLocationId);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Alocare Locație pentru {productName}
        <Typography variant="caption" display="block" color="text.secondary">
          SKU: {productSku}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {/* Warehouse Selection */}
          <FormControl fullWidth>
            <InputLabel>Depozit</InputLabel>
            <Select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              label="Depozit"
              disabled={loading}
            >
              {warehouses.map((wh) => (
                <MenuItem key={wh.id} value={wh.id}>
                  {wh.warehouse_code} - {wh.warehouse_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Zone Selection */}
          <FormControl fullWidth disabled={!selectedWarehouseId}>
            <InputLabel>Zonă</InputLabel>
            <Select
              value={selectedZoneId}
              onChange={(e) => setSelectedZoneId(e.target.value)}
              label="Zonă"
              disabled={loading || !selectedWarehouseId}
            >
              {zones.map((zone) => (
                <MenuItem key={zone.id} value={zone.id}>
                  {zone.zone_code} - {zone.zone_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Location Selection */}
          <FormControl fullWidth disabled={!selectedZoneId}>
            <InputLabel>Locație</InputLabel>
            <Select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              label="Locație"
              disabled={loading || !selectedZoneId}
            >
              {locations.length === 0 && selectedZoneId && (
                <MenuItem disabled>
                  <Typography variant="caption" color="error">
                    Nu există locații disponibile
                  </Typography>
                </MenuItem>
              )}
              {locations.map((loc) => (
                <MenuItem key={loc.id} value={loc.id}>
                  {loc.location_code}
                  {loc.aisle && ` (${loc.aisle}-${loc.rack}-${loc.shelf_level}-${loc.bin_position})`}
                  <Typography variant="caption" sx={{ ml: 1, color: 'success.main' }}>
                    • Available
                  </Typography>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Location Details */}
          {selectedLocation && (
            <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Detalii Locație
              </Typography>
              <Stack direction="row" spacing={2}>
                <Typography variant="body2">
                  <strong>Aisle:</strong> {selectedLocation.aisle || 'N/A'}
                </Typography>
                <Typography variant="body2">
                  <strong>Rack:</strong> {selectedLocation.rack || 'N/A'}
                </Typography>
                <Typography variant="body2">
                  <strong>Level:</strong> {selectedLocation.shelf_level || 'N/A'}
                </Typography>
                <Typography variant="body2">
                  <strong>Bin:</strong> {selectedLocation.bin_position || 'N/A'}
                </Typography>
              </Stack>
            </Box>
          )}

          <Divider />

          {/* Quantity */}
          <TextField
            label={`Cantitate (${productUom})`}
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            fullWidth
            required
            inputProps={{ min: 0, step: 'any' }}
            disabled={!selectedLocationId}
          />

          {/* Lot Number (Optional) */}
          <TextField
            label="Număr Lot (opțional)"
            value={lotNumber}
            onChange={(e) => setLotNumber(e.target.value)}
            fullWidth
            disabled={!selectedLocationId}
            helperText="Pentru tracking lot-uri de materiale"
          />

          {/* QR Code Preview */}
          {qrPreviewUrl && (
            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Previzualizare QR Code
              </Typography>
              <img src={qrPreviewUrl} alt="QR Code Preview" style={{ maxWidth: 200 }} />
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                QR-ul va fi generat automat la salvare
              </Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Anulează
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={loading || !selectedLocationId || !quantity}
          startIcon={loading && <CircularProgress size={20} />}
        >
          {loading ? 'Se salvează...' : 'Salvează și Generează QR'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
