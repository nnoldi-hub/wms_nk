import axios from 'axios';

const WC_BASE_URL = 'http://localhost:3020';
const WC_TOKEN_KEY = 'wcAccessToken';

const wcClient = axios.create({
  baseURL: WC_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

wcClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(WC_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const warehouseConfigService = {
  setToken(token: string) {
    localStorage.setItem(WC_TOKEN_KEY, token);
  },
  getToken() {
    return localStorage.getItem(WC_TOKEN_KEY);
  },
  async health() {
    const { data } = await wcClient.get('/health');
    return data;
  },
  async mintDevToken(role: 'admin' | 'manager' | 'user' = 'admin') {
    // Allow optional dev tool secret if backend requires it
    const fromLocal = typeof window !== 'undefined' ? localStorage.getItem('wcDevSecret') : null;
    const fromEnv = (import.meta as unknown as { env?: Record<string, unknown> })?.env?.['VITE_WC_DEV_SECRET'] as string | undefined;
    const secret = fromLocal || fromEnv
      || undefined;
    const { data } = await wcClient.post('/api/v1/dev/token', { role }, {
      headers: secret ? { 'x-dev-secret': String(secret) } : undefined,
    });
    const token = data?.data?.token as string;
    if (token) this.setToken(token);
    return token;
  },
  async listWarehouses(params?: Record<string, unknown>) {
    const { data } = await wcClient.get('/api/v1/warehouses', { params });
    return data;
  },
  async listZones(warehouseId: string, params?: Record<string, unknown>) {
    const { data } = await wcClient.get(`/api/v1/warehouses/${warehouseId}/zones`, { params });
    return data;
  },
  async listLocations(zoneId: string, params?: Record<string, unknown>) {
    const { data } = await wcClient.get(`/api/v1/zones/${zoneId}/locations`, { params });
    return data;
  },
  async deleteLocation(locationId: string) {
    const { data } = await wcClient.delete(`/api/v1/locations/${locationId}`);
    return data;
  },
  async updateLocation(locationId: string, payload: Partial<{
    location_code: string;
    aisle: string;
    rack: string;
    shelf_level: number;
    bin_position: string;
    location_type_id: string;
    status: string;
  }>) {
    const { data } = await wcClient.put(`/api/v1/locations/${locationId}`, payload);
    return data;
  },
  // --- Mutations for quick setup ---
  async createWarehouse(payload: {
    warehouse_code: string; warehouse_name: string; company_name: string;
    street?: string; city?: string; postal_code?: string; country?: string;
    phone?: string; email?: string; manager_name?: string;
    timezone?: string; currency?: string; measurement_system?: 'METRIC'|'IMPERIAL';
    total_area_sqm?: number; height_meters?: number; layout_type?: 'SINGLE_FLOOR'|'MULTI_FLOOR'|'MEZZANINE';
  }) {
    const { data } = await wcClient.post('/api/v1/warehouses', payload);
    return data;
  },
  async updateWarehouse(id: string, payload: Partial<{
    warehouse_name: string; company_name: string; street: string; city: string; postal_code: string; country: string; phone: string; email: string; manager_name: string; timezone: string; currency: string; measurement_system: 'METRIC'|'IMPERIAL'; total_area_sqm: number; height_meters: number; layout_type: 'SINGLE_FLOOR'|'MULTI_FLOOR'|'MEZZANINE'; is_active: boolean;
  }>) {
    const { data } = await wcClient.put(`/api/v1/warehouses/${id}`, payload);
    return data;
  },
  async deleteWarehouse(id: string) {
    const { data } = await wcClient.delete(`/api/v1/warehouses/${id}`);
    return data;
  },
  async createZone(payload: {
    warehouse_id: string; zone_code: string; zone_name: string; zone_type: 'RECEIVING'|'QC'|'STORAGE'|'PICKING'|'PACKING'|'SHIPPING'|'RETURNS'|'QUARANTINE'|'PRODUCTION'|'STAGING';
  }) {
    const { data } = await wcClient.post('/api/v1/zones', payload);
    return data;
  },
  async updateZone(id: string, payload: Partial<{ zone_name: string; zone_type: string; is_active: boolean }>) {
    const { data } = await wcClient.put(`/api/v1/zones/${id}`, payload);
    return data;
  },
  async deleteZone(id: string) {
    const { data } = await wcClient.delete(`/api/v1/zones/${id}`);
    return data;
  },
  async bulkCreateLocations(payload: {
    warehouse_id: string; zone_id: string; location_type_id: string;
    naming_pattern: { zone_prefix: string; aisle_start: string; aisle_end: string; rack_start: number; rack_end: number; shelf_levels: string[]; bins_per_shelf: number };
    properties?: { width_cm?: number; depth_cm?: number; height_cm?: number; max_weight_kg?: number; requires_forklift?: boolean; accessibility?: 'GROUND'|'LOW'|'MEDIUM'|'HIGH' };
  }) {
    const { data } = await wcClient.post('/api/v1/locations/bulk', payload);
    return data;
  },
  async completeSetup(warehouseId: string) {
    const { data } = await wcClient.post(`/api/v1/warehouses/${warehouseId}/complete-setup`, {});
    return data;
  },

  // --- Location Types ---
  async listLocationTypes(params?: Record<string, unknown>) {
    const { data } = await wcClient.get('/api/v1/location-types', { params });
    return data;
  },
  async createLocationType(payload: { code: string; name: string }) {
    const { data } = await wcClient.post('/api/v1/location-types', payload);
    return data;
  },
  async updateLocationType(id: string, payload: Partial<{ code: string; name: string }>) {
    const { data } = await wcClient.put(`/api/v1/location-types/${id}`, payload);
    return data;
  },
};

export default warehouseConfigService;
