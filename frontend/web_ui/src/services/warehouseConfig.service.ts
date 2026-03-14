import axios from 'axios';

const WC_BASE_URL = 'http://localhost:3020';
const WC_TOKEN_KEY = 'wcAccessToken';

const wcClient = axios.create({
  baseURL: WC_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

wcClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(WC_TOKEN_KEY) || localStorage.getItem('accessToken');
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
  // Back-compat aliases
  async getWarehouses(params?: Record<string, unknown>) {
    return this.listWarehouses(params);
  },
  async listZones(warehouseId: string, params?: Record<string, unknown>) {
    const { data } = await wcClient.get(`/api/v1/warehouses/${warehouseId}/zones`, { params });
    return data;
  },
  async getZones(warehouseId: string, params?: Record<string, unknown>) {
    return this.listZones(warehouseId, params);
  },
  async listLocations(zoneId: string, params?: Record<string, unknown>) {
    const { data } = await wcClient.get(`/api/v1/zones/${zoneId}/locations`, { params });
    return data;
  },
  async getLocations(zoneId: string, params?: Record<string, unknown>) {
    return this.listLocations(zoneId, params);
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
  async patchLocationCoordinates(locationId: string, coords: { coord_x: number | null; coord_y: number | null; coord_z?: number; path_cost?: number }) {
    const { data } = await wcClient.patch(`/api/v1/locations/${locationId}/coordinates`, coords);
    return data;
  },
  async updateLocationCapacity(locationId: string, payload: {
    max_weight_kg?: number | null;
    max_volume_m3?: number | null;
    min_length_m?: number | null;
    max_length_m?: number | null;
    allowed_categories?: string[] | null;
    allowed_packaging?: string[] | null;
    suggestion_label?: string | null;
    restriction_note?: string | null;
  }) {
    const { data } = await wcClient.patch(`/api/v1/locations/${locationId}/capacity`, payload);
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

  // --- WMS Rules (Rule Engine) ---
  async listRules(params?: { scope?: string; is_active?: boolean }) {
    const { data } = await wcClient.get('/api/v1/rules', { params });
    return data;
  },
  async getRule(id: string) {
    const { data } = await wcClient.get(`/api/v1/rules/${id}`);
    return data;
  },
  async createRule(payload: {
    name: string; description?: string; scope: string; rule_type: string;
    priority?: number; is_active?: boolean;
    conditions?: unknown[]; actions?: unknown[];
  }) {
    const { data } = await wcClient.post('/api/v1/rules', payload);
    return data;
  },
  async updateRule(id: string, payload: Partial<{
    name: string; description: string; scope: string; rule_type: string;
    priority: number; is_active: boolean;
    conditions: unknown[]; actions: unknown[];
  }>) {
    const { data } = await wcClient.put(`/api/v1/rules/${id}`, payload);
    return data;
  },
  async deleteRule(id: string) {
    const { data } = await wcClient.delete(`/api/v1/rules/${id}`);
    return data;
  },
  async evaluateRule(payload: { rule_id?: string; scope: string; context: Record<string, unknown> }) {
    const { data } = await wcClient.post('/api/v1/rules/evaluate', payload);
    return data;
  },
  async suggestPicking(payload: { product_sku: string; requested_qty: number; uom: string; product?: Record<string, unknown> }) {
    const { data } = await wcClient.post('/api/v1/suggest/picking', payload);
    return data;
  },
  async suggestPutaway(payload: { warehouse_id: string; product_sku: string; product?: Record<string, unknown>; quantity?: number }) {
    const { data } = await wcClient.post('/api/v1/suggest/putaway', payload);
    return data;
  },
  async suggestCutting(payload: { product_sku: string; requested_qty: number; uom: string; warehouse_id?: string; product?: Record<string, unknown> }) {
    const { data } = await wcClient.post('/api/v1/suggest/cutting', payload);
    return data;
  },
  async reorderRules(updates: Array<{ id: string; priority: number }>) {
    const { data } = await wcClient.put('/api/v1/rules/reorder', updates);
    return data;
  },
  async getRuleVersions(id: string) {
    const { data } = await wcClient.get(`/api/v1/rules/${id}/versions`);
    return data;
  },
  async restoreRuleVersion(id: string, version: number) {
    const { data } = await wcClient.post(`/api/v1/rules/${id}/restore/${version}`);
    return data;
  },
  async simulateRules(payload: { scope: string; context: Record<string, unknown>; include_inactive?: boolean }) {
    const { data } = await wcClient.post('/api/v1/rules/simulate', payload);
    return data;
  },
  async detectRuleConflicts(scope?: string) {
    const { data } = await wcClient.get('/api/v1/rules/detect-conflicts', { params: scope ? { scope } : {} });
    return data;
  },

  // --- Reports: Rule Engine ---
  async reportPickingEfficiency(params?: { from?: string; to?: string }) {
    const { data } = await wcClient.get('/api/v1/reports/rule-engine/picking-efficiency', { params });
    return data;
  },
  async reportUnderusedLocations(params?: { days?: number; warehouse_id?: string; limit?: number }) {
    const { data } = await wcClient.get('/api/v1/reports/rule-engine/underused-locations', { params });
    return data;
  },
  async reportLargeRemnants(params?: { min_meters?: number; max_percent?: number; inactive_days?: number; limit?: number }) {
    const { data } = await wcClient.get('/api/v1/reports/rule-engine/large-remnants', { params });
    return data;
  },

  // --- Audit Log ---
  async listAuditLog(params?: { operation_type?: string; rule_id?: string; blocked?: boolean; from?: string; to?: string; limit?: number; offset?: number }) {
    const { data } = await wcClient.get('/api/v1/rules/audit-log', { params });
    return data;
  },
  async auditLogStats(params?: { from?: string; to?: string }) {
    const { data } = await wcClient.get('/api/v1/rules/audit-log/stats', { params });
    return data;
  },

    // --- Validare configurare (Faza 2.3) ---
  async validateConfig(params?: { warehouse_id?: string }) {
    const { data } = await wcClient.get('/api/v1/rules/validate', { params });
    return data;
  },
  async validateConfigSummary(params?: { warehouse_id?: string }) {
    const { data } = await wcClient.get('/api/v1/rules/validate/summary', { params });
    return data;
  },
  // --- Validator Setup Wizard (Faza 3.2) ---
  async validateSetupCheck(params?: { warehouse_id?: string }) {
    const { data } = await wcClient.get('/api/v1/validate/setup-check', { params });
    return data;
  },

  // --- Reguli Dinamice (Faza 4.1) ---
  async getDynamicAlerts(params?: {
    warehouse_id?: string;
    zone_full_threshold?: number;
    reel_low_threshold?: number;
    rotation_days?: number;
    high_rotation_picks?: number;
    expiry_warning_days?: number;
  }) {
    const { data } = await wcClient.get('/api/v1/rules/dynamic/alerts', { params });
    return data;
  },

  // --- Audit Log (Faza 6.1) ---
  async getAuditLog(params?: Record<string, string | number>) {
    const { data } = await wcClient.get('/api/v1/rules/audit-log', { params });
    return data;
  },
  async getAuditStats(params?: { from?: string; to?: string }) {
    const { data } = await wcClient.get('/api/v1/rules/audit-log/stats', { params });
    return data;
  },

  // --- Ops Audit (wms_ops_audit — locații, loturi, picking) ---
  async getOpsAudit(params?: Record<string, string | number>) {
    const { data } = await wcClient.get('/api/v1/audit/events', { params });
    return data;
  },
  async getOpsAuditStats(params?: { from?: string; to?: string }) {
    const { data } = await wcClient.get('/api/v1/audit/events/stats', { params });
    return data;
  },
  // --- UI Activity Log (Faza 6.3) ---
  async postUiEvent(payload: {
    action_type: string;
    entity_type?: string;
    entity_id?: string;
    entity_code?: string;
    extra_info?: Record<string, unknown>;
  }) {
    const { data } = await wcClient.post('/api/v1/audit/ui-event', payload);
    return data;
  },
};

export default warehouseConfigService;

