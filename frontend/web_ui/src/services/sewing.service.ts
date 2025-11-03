import axios from 'axios';

const SEWING_API = 'http://localhost:3014';

export interface SewingOrder {
  id: string;
  order_number: string;
  product_sku: string;
  cutting_order_id?: string;
  quantity: number;
  actual_quantity?: number;
  defect_quantity?: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  worker_id?: string;
  quality_notes?: string;
  notes?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSewingOrderDto {
  product_sku: string;
  cutting_order_id?: string;
  quantity: number;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  notes?: string;
}

export interface UpdateSewingOrderDto {
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  worker_id?: string;
  actual_quantity?: number;
  defect_quantity?: number;
  quality_notes?: string;
  notes?: string;
}

class SewingService {
  async getAll(status?: string, limit = 50, offset = 0): Promise<SewingOrder[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());

    const response = await axios.get(`${SEWING_API}/api/v1/sewing/orders?${params}`);
    return response.data.data || response.data;
  }

  async getById(id: string): Promise<SewingOrder> {
    const response = await axios.get(`${SEWING_API}/api/v1/sewing/orders/${id}`);
    return response.data.data || response.data;
  }

  async create(order: CreateSewingOrderDto): Promise<SewingOrder> {
    const response = await axios.post(`${SEWING_API}/api/v1/sewing/orders`, order);
    return response.data.data || response.data;
  }

  async update(id: string, order: UpdateSewingOrderDto): Promise<SewingOrder> {
    const response = await axios.put(`${SEWING_API}/api/v1/sewing/orders/${id}`, order);
    return response.data.data || response.data;
  }

  async complete(id: string): Promise<SewingOrder> {
    const response = await axios.post(`${SEWING_API}/api/v1/sewing/orders/${id}/complete`);
    return response.data.data || response.data;
  }

  getStatuses(): string[] {
    return ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
  }

  getPriorities(): string[] {
    return ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
  }
}

export const sewingService = new SewingService();
