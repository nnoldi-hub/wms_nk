// API Configuration
export const API_CONFIG = {
  BASE_URL: 'http://localhost:8000', // Kong Gateway proxy
  TIMEOUT: 30000,
  
  // Endpoints
  ENDPOINTS: {
    // Auth
    LOGIN: '/api/v1/auth/login',
    REGISTER: '/api/v1/auth/register',
    REFRESH: '/api/v1/auth/refresh',
    LOGOUT: '/api/v1/auth/logout',
    
    // Products
    PRODUCTS: '/api/v1/products',
    PRODUCT_BY_SKU: (sku) => `/api/v1/products/sku/${sku}`,
    
    // Locations
    LOCATIONS: '/api/v1/locations',
    LOCATION_BY_ID: (id) => `/api/v1/locations/${id}`,
    
    // Movements
    MOVEMENTS: '/api/v1/movements',
    MOVEMENTS_ADJUST: '/api/v1/movements/adjust',
  }
};

// App Configuration
export const APP_CONFIG = {
  APP_NAME: 'WMS-NKS',
  VERSION: '1.0.0',
  
  // Storage Keys
  STORAGE_KEYS: {
    TOKEN: '@wms_token',
    REFRESH_TOKEN: '@wms_refresh_token',
    USER: '@wms_user',
  },
  
  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  
  // Scanner
  SCANNER_CONFIG: {
    SCAN_TIMEOUT: 5000,
    AUTO_CLOSE: true,
  },
  
  // Theme Colors
  COLORS: {
    PRIMARY: '#2563eb',
    SECONDARY: '#64748b',
    SUCCESS: '#10b981',
    WARNING: '#f59e0b',
    ERROR: '#ef4444',
    BACKGROUND: '#f8fafc',
    CARD: '#ffffff',
    TEXT: '#1e293b',
    TEXT_SECONDARY: '#64748b',
    BORDER: '#e2e8f0',
  },
};
