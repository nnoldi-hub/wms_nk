import axios from 'axios';

const SHIPMENTS_API = 'http://localhost:3016';

export interface Shipment {
  id: string;
  shipment_number: string;
  status: string;
  carrier?: string;
  tracking_number?: string;
  created_at: string;
}

class ShipmentsService {
  async getAll(status?: string) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    const res = await axios.get(`${SHIPMENTS_API}/api/v1/shipments?${params.toString()}`);
    return res.data?.data ?? res.data;
  }
}

export const shipmentsService = new ShipmentsService();
