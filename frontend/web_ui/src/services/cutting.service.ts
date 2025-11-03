import axios from 'axios';

const CUTTING_API = 'http://localhost:3013';

export interface CuttingOrder {
  id: string;
  order_number: string;
  product_sku: string;
  quantity: number;
  actual_quantity?: number;
  waste_quantity?: number;
  pattern_id?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  worker_id?: string;
  notes?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCuttingOrderDto {
  product_sku: string;
  quantity: number;
  pattern_id?: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  notes?: string;
}

export interface UpdateCuttingOrderDto {
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  worker_id?: string;
  actual_quantity?: number;
  waste_quantity?: number;
  notes?: string;
}

class CuttingService {
  async getAll(status?: string, limit = 50, offset = 0): Promise<CuttingOrder[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());

    const response = await axios.get(`${CUTTING_API}/api/v1/cutting/orders?${params}`);
    return response.data.data || response.data;
  }

  async getById(id: string): Promise<CuttingOrder> {
    const response = await axios.get(`${CUTTING_API}/api/v1/cutting/orders/${id}`);
    return response.data.data || response.data;
  }

  async create(order: CreateCuttingOrderDto): Promise<CuttingOrder> {
    const response = await axios.post(`${CUTTING_API}/api/v1/cutting/orders`, order);
    return response.data.data || response.data;
  }

  async update(id: string, order: UpdateCuttingOrderDto): Promise<CuttingOrder> {
    const response = await axios.put(`${CUTTING_API}/api/v1/cutting/orders/${id}`, order);
    return response.data.data || response.data;
  }

  async complete(id: string): Promise<CuttingOrder> {
    const response = await axios.post(`${CUTTING_API}/api/v1/cutting/orders/${id}/complete`);
    return response.data.data || response.data;
  }

  getStatuses(): string[] {
    return ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
  }

  getPriorities(): string[] {
    return ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
  }
}

export const cuttingService = new CuttingService();
