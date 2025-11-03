import apiClient from './api';

const INVENTORY_API = 'http://localhost:3011';

export interface ImportRow {
  product_name?: string;
  sku?: string;
  quantity?: string | number;
  unit?: string;
  association?: string;
  package_status?: string;
}

export const setupService = {
  async importProducts(rows: ImportRow[]) {
    const response = await apiClient.post(`${INVENTORY_API}/api/v1/import-produse`, { rows });
    return response.data?.data ?? response.data;
  },
};
