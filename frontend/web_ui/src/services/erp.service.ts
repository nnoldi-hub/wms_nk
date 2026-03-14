import axios from 'axios';

const ERP_API = import.meta.env.VITE_ERP_API_URL ?? 'http://localhost:3018';

const client = axios.create({ baseURL: ERP_API });

client.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('accessToken');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export interface SyncStatus {
  isRunning: boolean;
  isDemo: boolean;
  syncInterval: number;
  lastSync: string | null;
  lastSyncType: string | null;
}

export interface SyncJob {
  id: string;
  type: string;
  status: string;
  records_synced: number;
  error_msg: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface ERPPo {
  id: string;
  erp_po_id: string;
  supplier_name: string | null;
  supplier_code: string | null;
  erp_status: string | null;
  order_date: string | null;
  expected_delivery: string | null;
  lines_json: unknown[];
  wms_order_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookLog {
  id: string;
  event_type: string;
  erp_po_id: string | null;
  status: string;
  error_msg: string | null;
  received_at: string;
}

const erpService = {
  getStatus: async (): Promise<SyncStatus> => {
    const res = await client.get('/api/v1/sync/status');
    return res.data;
  },

  getJobs: async (limit = 50): Promise<SyncJob[]> => {
    const res = await client.get(`/api/v1/sync/jobs?limit=${limit}`);
    return res.data.jobs ?? [];
  },

  getPOs: async (limit = 100): Promise<ERPPo[]> => {
    const res = await client.get(`/api/v1/sync/pos?limit=${limit}`);
    return res.data.pos ?? [];
  },

  getWebhookLogs: async (limit = 50): Promise<WebhookLog[]> => {
    const res = await client.get(`/api/v1/webhooks/logs?limit=${limit}`);
    return res.data.logs ?? [];
  },

  triggerSync: async (type: 'ALL' | 'PO_INBOUND' | 'NIR_OUTBOUND' | 'DELIVERY_OUTBOUND'): Promise<void> => {
    await client.post('/api/v1/sync/trigger', { type });
  },
};

export default erpService;
