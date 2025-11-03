import axios from 'axios';

// Scanner Service is exposed at :3012 based on project docs
const SCANNER_API = 'http://localhost:3012';

export type EntityType = 'product' | 'location' | 'batch' | 'composite' | 'unknown';

export interface ValidateResult {
  valid: boolean;
  type: EntityType;
  id?: string;
  meta?: Record<string, unknown>;
}

export interface ScanResult {
  success: boolean;
  message?: string;
  entity?: {
    type: EntityType;
    id: string;
    meta?: Record<string, unknown>;
  };
  raw?: unknown;
}

class ScannerService {
  async validate(code: string): Promise<ValidateResult> {
    const response = await axios.get(`${SCANNER_API}/validate/${encodeURIComponent(code)}`);
    // Be defensive about shape
    const data = response.data?.data ?? response.data;
    return {
      valid: Boolean(data?.valid ?? true),
      type: (data?.type as EntityType) ?? 'unknown',
      id: data?.id,
      meta: data?.meta,
    };
  }

  async scan(code: string): Promise<ScanResult> {
    const response = await axios.post(`${SCANNER_API}/scan`, { code });
    const data = response.data?.data ?? response.data;
    return {
      success: Boolean(data?.success ?? true),
      message: data?.message,
      entity: data?.entity,
      raw: data,
    };
  }

  async history(userId: string) {
    const response = await axios.get(`${SCANNER_API}/history/${encodeURIComponent(userId)}`);
    return response.data?.data ?? response.data;
  }

  async stats() {
    const response = await axios.get(`${SCANNER_API}/stats`);
    return response.data?.data ?? response.data;
  }
}

export const scannerService = new ScannerService();
