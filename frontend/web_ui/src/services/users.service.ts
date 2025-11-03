import apiClient from './api';

// Auth Service runs on port 3010 (Docker mapped from internal 3000)
const AUTH_API = 'http://localhost:3010';

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'operator';
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateUserDto {
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'manager' | 'operator';
  is_active?: boolean;
}

export interface UpdateUserDto {
  email?: string;
  password?: string;
  role?: 'admin' | 'manager' | 'operator';
  is_active?: boolean;
}

export const usersService = {
  getAll: async (search?: string, role?: string) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (role) params.append('role', role);
    
    const response = await apiClient.get(`${AUTH_API}/api/v1/users?${params.toString()}`);
    return response.data.data || response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`${AUTH_API}/api/v1/users/${id}`);
    return response.data.data || response.data;
  },

  create: async (user: CreateUserDto) => {
    const response = await apiClient.post(`${AUTH_API}/api/v1/users`, user);
    return response.data.data || response.data;
  },

  update: async (id: string, user: UpdateUserDto) => {
    const response = await apiClient.put(`${AUTH_API}/api/v1/users/${id}`, user);
    return response.data.data || response.data;
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`${AUTH_API}/api/v1/users/${id}`);
    return response.data.data || response.data;
  },

  getRoles: () => {
    return ['admin', 'manager', 'operator'];
  },
};
