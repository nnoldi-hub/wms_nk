import axios from 'axios';

const INVENTORY_API_URL = 'http://localhost:3011/api/v1';

// Create axios instance
const inventoryClient = axios.create({
  baseURL: INVENTORY_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token interceptor
inventoryClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface AssignLocationDto {
  product_sku: string;
  location_id: string;
  quantity: number;
  lot_number?: string | null;
  expiry_date?: string | null;
}

export interface InventoryItem {
  id: string;
  product_sku: string;
  warehouse_id: string;
  zone_id: string;
  location_id: string;
  quantity: number;
  reserved_qty: number;
  lot_number?: string;
  expiry_date?: string;
  qr_code_data: any;
  received_at: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  product_sku: string;
  location_id: string;
  movement_type: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT';
  quantity: number;
  lot_number?: string;
  expiry_date?: string;
  reference_document?: string;
  notes?: string;
  performed_by: string;
  created_at: string;
}

class InventoryService {
  /**
   * Assign product to a warehouse location
   */
  async assignProductToLocation(data: AssignLocationDto): Promise<{
    success: boolean;
    inventory_item: InventoryItem;
    qr_code_data: any;
    location_updated: boolean;
  }> {
    const response = await inventoryClient.post('/inventory/assign-location', data);
    return response.data;
  }

  /**
   * Get inventory items for a product
   */
  async getProductInventory(productSku: string): Promise<InventoryItem[]> {
    const response = await inventoryClient.get(`/inventory/product/${productSku}`);
    return response.data.data;
  }

  /**
   * Get inventory items for a location
   */
  async getLocationInventory(locationId: string): Promise<InventoryItem[]> {
    const response = await inventoryClient.get(`/inventory/location/${locationId}`);
    return response.data.data;
  }

  /**
   * Get all inventory movements for a product
   */
  async getProductMovements(productSku: string): Promise<InventoryMovement[]> {
    const response = await inventoryClient.get(`/inventory/movements/${productSku}`);
    return response.data.data;
  }

  /**
   * Create inventory movement (IN/OUT/TRANSFER/ADJUSTMENT)
   */
  async createMovement(movement: Partial<InventoryMovement>): Promise<InventoryMovement> {
    const response = await inventoryClient.post('/inventory/movements', movement);
    return response.data.data;
  }

  /**
   * Move product from one location to another
   */
  async transferProduct(data: {
    product_sku: string;
    from_location_id: string;
    to_location_id: string;
    quantity: number;
    lot_number?: string;
    notes?: string;
  }): Promise<{
    success: boolean;
    movement: InventoryMovement;
    updated_locations: string[];
  }> {
    const response = await inventoryClient.post('/inventory/transfer', data);
    return response.data;
  }

  /**
   * Get stock summary by warehouse/zone/location
   */
  async getStockSummary(filters?: {
    warehouse_id?: string;
    zone_id?: string;
    location_id?: string;
  }): Promise<{
    total_products: number;
    total_locations: number;
    total_quantity: number;
    items: Array<{
      product_sku: string;
      product_name: string;
      location_code: string;
      quantity: number;
      uom: string;
    }>;
  }> {
    const response = await inventoryClient.get('/inventory/stock-summary', {
      params: filters,
    });
    return response.data.data;
  }

  /**
   * Generate QR code for inventory item
   */
  async generateQRCode(inventoryItemId: string): Promise<{
    qr_data: any;
    qr_image_url: string;
  }> {
    const response = await inventoryClient.get(`/inventory/qr/${inventoryItemId}`);
    return response.data;
  }

  /**
   * Get low stock alerts
   */
  async getLowStockAlerts(threshold: number = 100): Promise<Array<{
    product_sku: string;
    product_name: string;
    total_stock: number;
    location_count: number;
  }>> {
    const response = await inventoryClient.get('/inventory/low-stock', {
      params: { threshold },
    });
    return response.data.data;
  }
}

export const inventoryService = new InventoryService();
