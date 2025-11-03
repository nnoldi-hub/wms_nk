import axios from 'axios';

const INVENTORY_API = 'http://localhost:3011';

export interface ProductUnit {
  id: string;
  code: string;
  name: string;
  category: string;
  conversion_factor?: number;
}

export interface Batch {
  id: string;
  batch_number: string;
  product_sku: string;
  product_name?: string;
  unit_id: string;
  unit_code?: string;
  unit_name?: string;
  initial_quantity: number;
  current_quantity: number;
  length_meters?: number;
  weight_kg?: number;
  status: 'INTACT' | 'CUT' | 'REPACKED' | 'EMPTY' | 'DAMAGED' | 'QUARANTINE';
  location_id?: string;
  location_code?: string;
  source_batch_id?: string;
  transformation_id?: string;
  received_at?: string;
  opened_at?: string;
  emptied_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBatchDto {
  product_sku: string;
  unit_id: string; // DRUM (tambur), PALLET, BOX, ROLL, METER, KG, PIECE
  initial_quantity: number;
  current_quantity?: number;
  length_meters?: number; // Pentru tamburi/suluri de material
  weight_kg?: number; // Pentru paleți/cutii
  status?: 'INTACT' | 'CUT' | 'REPACKED' | 'EMPTY' | 'DAMAGED' | 'QUARANTINE';
  location_id?: string; // R01-A1, R02-B5, etc.
  source_batch_id?: string; // Batch-ul sursă (dacă e rezultat dintr-o transformare)
  transformation_id?: string; // ID-ul transformării care l-a creat
  received_at?: string;
  notes?: string; // Ex: "Material pus pe Tambur T-2024-001"
}

export interface UpdateBatchDto {
  current_quantity?: number;
  status?: 'INTACT' | 'CUT' | 'REPACKED' | 'EMPTY' | 'DAMAGED' | 'QUARANTINE';
  location_id?: string;
  opened_at?: string;
  emptied_at?: string;
  notes?: string;
}

export interface BatchStatistics {
  total_batches: number;
  intact_batches: number;
  cut_batches: number;
  empty_batches: number;
  total_quantity: number;
  total_value?: number;
  by_status: Array<{
    status: string;
    count: number;
  }>;
  by_product: Array<{
    product_sku: string;
    product_name: string;
    count: number;
    total_quantity: number;
  }>;
}

export interface BatchSelectionParams {
  product_sku: string;
  required_quantity: number;
  required_length_meters?: number;
  method?: 'FIFO' | 'MIN_WASTE' | 'LOCATION_PROXIMITY';
  preferred_location?: string;
}

export interface SelectedBatch {
  batch: Batch;
  waste_quantity: number;
  waste_percent: number;
  perfect_match: boolean;
}

export interface BatchSelectionResult {
  selectedBatch: SelectedBatch;
  alternatives: SelectedBatch[];
  method: string;
}

class BatchService {
  async getAll(
    status?: string,
    product_sku?: string,
    location_id?: string,
    limit = 50,
    offset = 0
  ): Promise<Batch[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (product_sku) params.append('product_sku', product_sku);
    if (location_id) params.append('location_id', location_id);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());

    const response = await axios.get(`${INVENTORY_API}/api/v1/batches?${params}`);
    return response.data.data || response.data;
  }

  async getById(id: string): Promise<Batch> {
    const response = await axios.get(`${INVENTORY_API}/api/v1/batches/${id}`);
    return response.data.data || response.data;
  }

  async getByProduct(sku: string): Promise<Batch[]> {
    const response = await axios.get(`${INVENTORY_API}/api/v1/batches/product/${sku}`);
    return response.data.data || response.data;
  }

  async create(batch: CreateBatchDto): Promise<Batch> {
    const response = await axios.post(`${INVENTORY_API}/api/v1/batches`, batch);
    return response.data.data || response.data;
  }

  async update(id: string, batch: UpdateBatchDto): Promise<Batch> {
    const response = await axios.put(`${INVENTORY_API}/api/v1/batches/${id}`, batch);
    return response.data.data || response.data;
  }

  async delete(id: string): Promise<void> {
    await axios.delete(`${INVENTORY_API}/api/v1/batches/${id}`);
  }

  async getStatistics(): Promise<BatchStatistics> {
    const response = await axios.get(`${INVENTORY_API}/api/v1/batches/statistics`);
    return response.data.data || response.data;
  }

  async selectOptimalBatch(params: BatchSelectionParams): Promise<BatchSelectionResult> {
    const queryParams = new URLSearchParams();
    queryParams.append('product_sku', params.product_sku);
    queryParams.append('required_quantity', params.required_quantity.toString());
    if (params.required_length_meters) {
      queryParams.append('required_length_meters', params.required_length_meters.toString());
    }
    if (params.method) {
      queryParams.append('method', params.method);
    }
    if (params.preferred_location) {
      queryParams.append('preferred_location', params.preferred_location);
    }

    const response = await axios.get(`${INVENTORY_API}/api/v1/batches/select?${queryParams}`);
    return response.data.data || response.data;
  }

  getStatuses(): string[] {
    return ['INTACT', 'CUT', 'REPACKED', 'EMPTY', 'DAMAGED', 'QUARANTINE'];
  }

  getSelectionMethods(): string[] {
    return ['FIFO', 'MIN_WASTE', 'LOCATION_PROXIMITY'];
  }
}

export const batchService = new BatchService();
