import apiClient from './api';

// Inventory Service runs on port 3011 (Docker mapped from internal 3000)
const INVENTORY_API = 'http://localhost:3011';

export interface Product {
  sku: string;
  name: string;
  description?: string;
  weight_kg?: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
  uom: string;
  lot_control: boolean;
  created_at: string;
  updated_at: string;
  total_quantity?: number; // From backend aggregate
}

export interface CreateProductDto {
  sku: string;
  name: string;
  description?: string;
  uom?: string;
  lot_control?: boolean;
  weight_kg?: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
}

export const productsService = {
  // Fetch products with optional filters and configurable limit (default higher to avoid 50-item cap)
  getAll: async (search?: string, category?: string, limit: number = 1000, page?: number) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (category) params.append('category', category);
    if (limit) params.append('limit', String(limit));
    if (page) params.append('page', String(page));

    const query = params.toString();
    const url = `${INVENTORY_API}/api/v1/products${query ? `?${query}` : ''}`;
    const response = await apiClient.get(url);
    return response.data.data || response.data; // Handle {success, data} format
  },

  // Paginated list returning data and pagination meta when available
  list: async (opts: { search?: string; category?: string; page?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (opts.search) params.append('search', opts.search);
    if (opts.category) params.append('category', opts.category);
    if (opts.page) params.append('page', String(opts.page));
    if (opts.limit) params.append('limit', String(opts.limit));

    const url = `${INVENTORY_API}/api/v1/products${params.size ? `?${params.toString()}` : ''}`;
    const response = await apiClient.get(url);
    // If backend returns { success, data, pagination }
    if (response.data && typeof response.data === 'object' && 'data' in response.data) {
      return {
        data: response.data.data,
        pagination: response.data.pagination,
      };
    }
    // Fallback when backend returns raw array
    return { data: response.data, pagination: undefined };
  },

  getById: async (sku: string) => {
    const response = await apiClient.get(`${INVENTORY_API}/api/v1/products/sku/${sku}`);
    return response.data.data || response.data;
  },

  create: async (product: CreateProductDto) => {
    const response = await apiClient.post(`${INVENTORY_API}/api/v1/products`, product);
    return response.data.data || response.data;
  },

  update: async (sku: string, product: Partial<CreateProductDto>) => {
    const response = await apiClient.put(`${INVENTORY_API}/api/v1/products/sku/${sku}`, product);
    return response.data.data || response.data;
  },

  delete: async (sku: string) => {
    const response = await apiClient.delete(`${INVENTORY_API}/api/v1/products/sku/${sku}`);
    return response.data.data || response.data;
  },

  getCategories: async () => {
    const response = await apiClient.get(`${INVENTORY_API}/api/v1/products/categories`);
    return response.data.data || response.data; // Backend returns {success, data: [...]}
  },

  importProducts: async (formData: FormData) => {
    const response = await apiClient.post(`${INVENTORY_API}/api/v1/products/import`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data || response.data;
  },
};
