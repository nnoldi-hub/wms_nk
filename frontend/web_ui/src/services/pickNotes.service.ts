import axios from 'axios';

const API = 'http://localhost:3011/api/v1';

const client = axios.create({
  baseURL: API,
  withCredentials: true,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface PickNoteLine {
  id: string;
  pick_note_id: string;
  line_number: number;
  product_name?: string;
  stock_code?: string;
  length_available?: number;
  quantity_to_pick: number;
  uom?: string;
  lot_number?: string;
  quantity_remaining?: number;
  weight?: number;
  requested_lengths?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  picking_item_id?: string;
}

export interface PickNote {
  id: string;
  erp_cmd_number: string;
  erp_date?: string;
  partner_name?: string;
  contact_person?: string;
  agent_name?: string;
  delivery_type?: string;
  total_weight?: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  source: 'ERP_AUTO' | 'ERP_WEBHOOK' | 'MANUAL_UPLOAD';
  picking_job_id?: string;
  notes?: string;
  line_count?: number;
  lines?: PickNoteLine[];
  created_at: string;
  updated_at: string;
}

export interface ImportPayload {
  erp_cmd_number: string;
  erp_date?: string;
  partner_name?: string;
  contact_person?: string;
  agent_name?: string;
  delivery_type?: string;
  total_weight?: number;
  notes?: string;
  lines: {
    product_name?: string;
    stock_code?: string;
    length_available?: number;
    quantity_to_pick: number;
    uom?: string;
    lot_number?: string;
    quantity_remaining?: number;
    weight?: number;
    requested_lengths?: string;
  }[];
}

export const pickNotesService = {
  async list(params?: { status?: string; source?: string; partner?: string; page?: number; limit?: number }) {
    const res = await client.get('/pick-notes', { params });
    return res.data as { success: boolean; data: PickNote[]; total: number; page: number; limit: number };
  },

  async getOne(id: string) {
    const res = await client.get(`/pick-notes/${id}`);
    return res.data as { success: boolean; data: PickNote };
  },

  async importJson(payload: ImportPayload) {
    const res = await client.post('/pick-notes/import-json', payload);
    return res.data as { success: boolean; data: PickNote; updated: boolean };
  },

  async generatePicking(
    id: string,
    options?: {
      assigned_to?: string;
      workers?: { username?: string }[];
      strategy?: 'round_robin' | 'by_weight';
    },
  ) {
    const res = await client.post(`/pick-notes/${id}/generate-picking`, options ?? {});
    return res.data as {
      success: boolean;
      message: string;
      data: {
        picking_job_id: string;
        job_number: string;
        items_count: number;
        total_jobs: number;
        jobs: { picking_job_id: string; job_number: string; assigned_to: string | null; items_count: number }[];
      };
    };
  },

  async cancel(id: string) {
    const res = await client.post(`/pick-notes/${id}/cancel`);
    return res.data as { success: boolean; data: PickNote };
  },
};

