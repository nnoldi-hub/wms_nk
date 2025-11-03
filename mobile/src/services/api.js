import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, APP_CONFIG } from '../config/config';

// Create axios instance
const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem(APP_CONFIG.STORAGE_KEYS.TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retrying, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem(APP_CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
        if (refreshToken) {
          const response = await axios.post(
            `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.REFRESH}`,
            { refreshToken }
          );

          const { accessToken } = response.data;
          await AsyncStorage.setItem(APP_CONFIG.STORAGE_KEYS.TOKEN, accessToken);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, logout user
        await AsyncStorage.multiRemove([
          APP_CONFIG.STORAGE_KEYS.TOKEN,
          APP_CONFIG.STORAGE_KEYS.REFRESH_TOKEN,
          APP_CONFIG.STORAGE_KEYS.USER,
        ]);
        // Navigate to login (will be handled by navigation)
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// API Methods
export const authAPI = {
  login: (username, password) =>
    api.post(API_CONFIG.ENDPOINTS.LOGIN, { username, password }),
  
  register: (userData) =>
    api.post(API_CONFIG.ENDPOINTS.REGISTER, userData),
  
  logout: () =>
    api.post(API_CONFIG.ENDPOINTS.LOGOUT),
};

export const productsAPI = {
  getAll: (params) =>
    api.get(API_CONFIG.ENDPOINTS.PRODUCTS, { params }),
  
  getBySKU: (sku) =>
    api.get(API_CONFIG.ENDPOINTS.PRODUCT_BY_SKU(sku)),
  
  create: (productData) =>
    api.post(API_CONFIG.ENDPOINTS.PRODUCTS, productData),
  
  update: (sku, productData) =>
    api.put(API_CONFIG.ENDPOINTS.PRODUCT_BY_SKU(sku), productData),
};

export const locationsAPI = {
  getAll: (params) =>
    api.get(API_CONFIG.ENDPOINTS.LOCATIONS, { params }),
  
  getById: (id) =>
    api.get(API_CONFIG.ENDPOINTS.LOCATION_BY_ID(id)),
  
  create: (locationData) =>
    api.post(API_CONFIG.ENDPOINTS.LOCATIONS, locationData),
};

export const movementsAPI = {
  getHistory: (params) =>
    api.get(API_CONFIG.ENDPOINTS.MOVEMENTS, { params }),
  
  create: (movementData) =>
    api.post(API_CONFIG.ENDPOINTS.MOVEMENTS, movementData),
  
  adjust: (adjustmentData) =>
    api.post(API_CONFIG.ENDPOINTS.MOVEMENTS_ADJUST, adjustmentData),
};

export const pickingAPI = {
  list: (params) =>
    api.get(API_CONFIG.ENDPOINTS.PICK_JOBS, { params }),

  get: (id) =>
    api.get(API_CONFIG.ENDPOINTS.PICK_JOB_BY_ID(id)),

  accept: (id) =>
    api.post(API_CONFIG.ENDPOINTS.PICK_JOB_ACCEPT(id)),

  pick: (id, payload) =>
    api.post(API_CONFIG.ENDPOINTS.PICK_JOB_PICK(id), payload),

  complete: (id, payload) =>
    api.post(`${API_CONFIG.ENDPOINTS.PICK_JOB_BY_ID(id)}/complete`, payload || {}),
};

export default api;
