import axios from 'axios';

export interface PickJob {
  id: string;
  number: string;
  order_id?: string;
  status: 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | string;
  assigned_to?: string | null;
  assigned_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
}

const INVENTORY_API = 'http://localhost:3011/api/v1';

const client = axios.create({ baseURL: INVENTORY_API });
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    const headers = (config.headers ?? {}) as Record<string, string>;
    headers.Authorization = `Bearer ${token}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config.headers = headers as any;
  }
  return config;
});

class PickingService {
  async list(opts?: { page?: number; limit?: number; status?: string; mine?: boolean; order_id?: string }) {
    const params: Record<string, unknown> = {};
    if (opts?.page) params.page = opts.page;
    if (opts?.limit) params.limit = opts.limit;
    if (opts?.status) params.status = opts.status;
    if (opts?.mine) params.mine = 1;
    if (opts?.order_id) params.order_id = opts.order_id;
    const response = await client.get('/pick-jobs', { params });
    return response.data as { success: boolean; data: PickJob[]; pagination?: { page: number; limit: number; total: number } };
  }

  async getJob(id: string) {
    const response = await client.get(`/pick-jobs/${id}`);
    return response.data as { success: boolean; data: { job: PickJob; items: Array<{ id: string; product_sku: string; requested_qty: number; picked_qty: number; status: string; uom?: string; lot_label?: string }> } };
  }

  async pick(id: string, payload: { item_id?: string; sku?: string; qty: number; lot_label?: string }) {
    const response = await client.post(`/pick-jobs/${id}/pick`, payload);
    return response.data;
  }

  async accept(id: string) {
    const response = await client.post(`/pick-jobs/${id}/accept`);
    return response.data;
  }

  async complete(id: string, force = false) {
    const response = await client.post(`/pick-jobs/${id}/complete`, { force });
    return response.data;
  }

  getLabelsUrl(id: string) {
    return `${INVENTORY_API}/pick-jobs/${id}/labels.pdf`;
  }

  async openLabels(id: string) {
    const response = await client.get(`/pick-jobs/${id}/labels.pdf`, { responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  }
}

export const pickingService = new PickingService();
