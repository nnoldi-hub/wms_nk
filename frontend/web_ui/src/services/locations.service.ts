import apiClient from './api';

const INVENTORY_API = 'http://localhost:3011';

export interface Location {
  id: string;
  zone: string;
  rack: string;
  position: string;
  is_active: boolean;
}

class LocationsService {
  async getAll(isActive: 'true' | 'false' | 'all' = 'true'): Promise<Location[]> {
    const params = new URLSearchParams();
    params.append('is_active', isActive);
    const res = await apiClient.get(`${INVENTORY_API}/api/v1/locations?${params.toString()}`);
    return res.data?.data ?? res.data;
  }
}

export const locationsService = new LocationsService();
