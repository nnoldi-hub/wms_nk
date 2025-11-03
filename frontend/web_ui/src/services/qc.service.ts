import axios from 'axios';

const QC_API = 'http://localhost:3015';

export interface QCInspection {
  id: string;
  inspection_number: string;
  sewing_order_id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'PASSED' | 'FAILED' | 'RECHECK';
  defects_found: number;
  severity: 'NONE' | 'MINOR' | 'MAJOR' | 'CRITICAL' | null;
  inspector_id: string | null;
  inspection_notes: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface CreateQCInspectionDto {
  sewing_order_id: string;
  inspector_id?: string;
  defects_found?: number;
  severity?: 'NONE' | 'MINOR' | 'MAJOR' | 'CRITICAL';
  inspection_notes?: string;
  notes?: string;
}

export interface UpdateQCInspectionDto {
  defects_found?: number;
  severity?: 'NONE' | 'MINOR' | 'MAJOR' | 'CRITICAL';
  inspection_notes?: string;
  notes?: string;
}

const qcService = {
  getAll: async (status?: string) => {
    const response = await axios.get(`${QC_API}/api/v1/qc/inspections`, {
      params: { status }
    });
    return response.data.data || response.data;
  },

  getById: async (id: string) => {
    const response = await axios.get(`${QC_API}/api/v1/qc/inspections/${id}`);
    return response.data.data || response.data;
  },

  create: async (data: CreateQCInspectionDto) => {
    const response = await axios.post(`${QC_API}/api/v1/qc/inspections`, data);
    return response.data.data || response.data;
  },

  update: async (id: string, data: UpdateQCInspectionDto) => {
    const response = await axios.put(`${QC_API}/api/v1/qc/inspections/${id}`, data);
    return response.data.data || response.data;
  },

  pass: async (id: string, notes?: string) => {
    const response = await axios.post(`${QC_API}/api/v1/qc/inspections/${id}/pass`, { notes });
    return response.data.data || response.data;
  },

  fail: async (id: string, notes?: string) => {
    const response = await axios.post(`${QC_API}/api/v1/qc/inspections/${id}/fail`, { notes });
    return response.data.data || response.data;
  }
};

export default qcService;
