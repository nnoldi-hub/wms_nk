import axios from 'axios';

export interface OrderLine {
  id: string;
  product_sku: string;
  description?: string;
  requested_qty: number;
  uom: string;
  line_weight?: number;
  management_code?: string;
  lot_label?: string;
  requested_lengths?: string; // JSON string
  source_length_before_cut?: string | number | null;
  remaining_after_cut?: string | number | null;
}

export interface Order {
  id: string;
  number: string;
  partner_name?: string;
  customer_name?: string;
  delivery_address?: string;
  contact_name?: string;
  delivery_type?: string;
  agent_name?: string;
  total_weight?: number;
  status?: string;
  created_at?: string;
  lines?: OrderLine[];
}

const INVENTORY_API = 'http://localhost:3011/api/v1';

const client = axios.create({ baseURL: INVENTORY_API });
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    const headers = (config.headers ?? {}) as Record<string, string>;
    headers.Authorization = `Bearer ${token}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config.headers = headers as any;
  }
  return config;
});

class OrdersService {
  async list(opts?: { page?: number; limit?: number }): Promise<{ data: Order[]; pagination?: { total: number; page?: number; limit?: number } }> {
    const params: Record<string, unknown> = {};
    if (opts?.page) params.page = opts.page;
    if (opts?.limit) params.limit = opts.limit;
    const response = await client.get('/orders', { params });
    const body = response.data;
    if (body && typeof body === 'object' && 'data' in body) {
      const b = body as { data: unknown; pagination?: { total: number; page?: number; limit?: number } };
      return { data: b.data as Order[], pagination: b.pagination };
    }
    return { data: body as Order[] };
  }

  async get(id: string): Promise<{ order: Order; lines: OrderLine[] }> {
    const response = await client.get(`/orders/${id}`);
    const body = response.data;
    const payload = (body?.data || body) as { order: Order; lines: OrderLine[] };
    return payload;
  }

  async importCsv(formData: FormData) {
    const response = await client.post('/orders/import-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data?.data || response.data || response;
  }

  getPickNoteUrl(orderId: string) {
    return `${INVENTORY_API}/orders/${orderId}/pick-note.pdf`;
  }

  async allocatePickingJob(orderId: string): Promise<{ job: { id: string; number: string } } | unknown> {
    const response = await client.post(`/orders/${orderId}/allocate`);
    // Backend returns { success, data: { job, items_count } }
    const body = response.data;
    return body?.data || body;
  }

  async findPickJobByOrder(orderId: string): Promise<{ id: string; number: string } | null> {
    const response = await client.get('/pick-jobs', { params: { order_id: orderId, limit: 1, page: 1 } });
    const body = response.data;
    const data = (body?.data || []) as Array<{ id: string; number: string }>;
    return data.length ? data[0] : null;
  }

  getLabelsUrl(jobId: string) {
    return `${INVENTORY_API}/pick-jobs/${jobId}/labels.pdf`;
  }

  async openLabels(jobId: string) {
    // Use axios to include Authorization header and get the PDF as blob, then open
    const response = await client.get(`/pick-jobs/${jobId}/labels.pdf`, { responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Optionally revoke later
    setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  }
}

export const ordersService = new OrdersService();
