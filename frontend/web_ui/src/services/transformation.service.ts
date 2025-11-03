import apiClient from './api';

const INVENTORY_API = 'http://localhost:3011';

export interface Transformation {
  id: string;
  transformation_number: string;
  transformation_type: 'CUT' | 'REPACK' | 'CONVERT' | 'SPLIT' | 'MERGE';
  source_batch_id: string;
  source_batch_number?: string;
  source_product_sku?: string;
  source_quantity_used: number;
  result_batch_id?: string;
  result_batch_number?: string;
  result_product_sku?: string;
  result_quantity?: number;
  waste_quantity?: number;
  waste_percent?: number;
  cutting_order_id?: string;
  notes?: string;
  created_at: string;
  created_by?: string;
}

export interface CreateTransformationDto {
  transformation_type: 'CUT' | 'REPACK' | 'CONVERT' | 'SPLIT' | 'MERGE';
  source_batch_id: string;
  source_quantity_used: number;
  result_batch_id?: string;
  result_product_sku?: string;
  result_quantity?: number;
  cutting_order_id?: string;
  notes?: string;
}

export interface TransformationStatistics {
  total_transformations: number;
  by_type: Array<{
    transformation_type: string;
    count: number;
    total_source_quantity: number;
    total_result_quantity: number;
    total_waste: number;
  }>;
  total_waste_quantity: number;
  average_waste_percent: number;
  last_30_days: Array<{
    date: string;
    count: number;
    waste_quantity: number;
  }>;
}

export interface TransformationTreeNode {
  batch_id: string;
  batch_number: string;
  product_sku: string;
  quantity: number;
  status: string;
  transformation_id?: string;
  transformation_type?: string;
  transformation_date?: string;
  children: TransformationTreeNode[];
}

class TransformationService {
  async getAll(
    type?: string,
    product_sku?: string,
    start_date?: string,
    end_date?: string,
    limit = 50,
    offset = 0
  ): Promise<Transformation[]> {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (product_sku) params.append('product_sku', product_sku);
    if (start_date) params.append('start_date', start_date);
    if (end_date) params.append('end_date', end_date);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());

    const response = await apiClient.get(`${INVENTORY_API}/api/v1/transformations?${params}`);
    return response.data.data || response.data;
  }

  async getById(id: string): Promise<Transformation> {
    const response = await apiClient.get(`${INVENTORY_API}/api/v1/transformations/${id}`);
    return response.data.data || response.data;
  }

  async create(transformation: CreateTransformationDto): Promise<Transformation> {
    const response = await apiClient.post(`${INVENTORY_API}/api/v1/transformations`, transformation);
    return response.data.data || response.data;
  }

  async getStatistics(): Promise<TransformationStatistics> {
    const response = await apiClient.get(`${INVENTORY_API}/api/v1/transformations/statistics`);
    return response.data.data || response.data;
  }

  async getTransformationTree(batchId: string): Promise<TransformationTreeNode> {
    const response = await apiClient.get(`${INVENTORY_API}/api/v1/transformations/tree/${batchId}`);
    return response.data.data || response.data;
  }

  getTypes(): string[] {
    return ['CUT', 'REPACK', 'CONVERT', 'SPLIT', 'MERGE'];
  }

  async setResult(id: string, resultBatchId: string, resultQuantity: number, notes?: string): Promise<Transformation> {
    const response = await apiClient.put(`${INVENTORY_API}/api/v1/transformations/${id}/result`, {
      result_batch_id: resultBatchId,
      result_quantity: resultQuantity,
      notes,
    });
    return response.data.data || response.data;
  }
}

export const transformationService = new TransformationService();
