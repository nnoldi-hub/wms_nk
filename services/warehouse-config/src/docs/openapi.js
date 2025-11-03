// OpenAPI spec exposed at /api-docs

const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'WMS Warehouse Config API',
    version: '1.0.0',
    description: 'Configuration and setup APIs for WMS: warehouses, zones, locations, packaging, carriers, vehicles, delivery zones, workflows, and settings.'
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local (Direct)' },
    { url: 'http://localhost:8000/warehouse-config', description: 'Through Kong' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'How to authorize:\n1) In non-production, call POST /dev/token to mint a token (optionally set x-dev-secret header if DEV_TOOL_SECRET is configured).\n2) Click the “Authorize” button in Swagger UI.\n3) Paste ONLY the token value (without the word “Bearer”).\n4) Execute secured requests.'
      }
    },
    schemas: {
      // Dev token mint (non-production only)
      DevMintTokenRequest: {
        type: 'object',
        properties: {
          role: { type: 'string', enum: ['admin', 'manager', 'user'], example: 'admin' },
          id: { type: 'string', format: 'uuid', nullable: true },
          email: { type: 'string', format: 'email', nullable: true },
          expiresIn: { type: 'string', pattern: '^[0-9]+(s|m|h|d)$', example: '8h', nullable: true }
        }
      },
      DevMintTokenResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              token: { type: 'string', description: 'JWT to be used as Authorization: Bearer <token>' },
              payload: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  email: { type: 'string', format: 'email' },
                  role: { type: 'string', enum: ['admin', 'manager', 'user'] }
                }
              }
            },
            required: ['token']
          }
        },
        required: ['success', 'data']
      },
      // Shared
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, example: 1 },
          limit: { type: 'integer', minimum: 1, example: 25 },
          total: { type: 'integer', minimum: 0, example: 123 }
        },
        required: ['page', 'limit', 'total']
      },
      Error: {
        type: 'object',
        properties: {
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          message: { type: 'string', example: 'Invalid request' },
          details: { type: 'object', additionalProperties: true }
        },
        required: ['code', 'message']
      },

      // Domain models (minimal fields aligned to sort/filter options)
      Warehouse: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          warehouse_code: { type: 'string' },
          warehouse_name: { type: 'string' },
          company_name: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        },
        required: ['id', 'warehouse_code', 'warehouse_name']
      },
      Zone: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          warehouse_id: { type: 'string', format: 'uuid' },
          zone_code: { type: 'string' },
          zone_name: { type: 'string' },
          zone_type: { type: 'string' },
          is_active: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        },
        required: ['id', 'warehouse_id', 'zone_code', 'zone_name']
      },
      Location: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          zone_id: { type: 'string', format: 'uuid' },
          location_code: { type: 'string' },
          aisle: { type: 'integer' },
          rack: { type: 'integer' },
          shelf_level: { type: 'integer' },
          bin_position: { type: 'integer' },
          location_type: { type: 'string' },
          status: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        },
        required: ['id', 'zone_id', 'location_code']
      },
      Vehicle: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          warehouse_id: { type: 'string', format: 'uuid' },
          vehicle_code: { type: 'string' },
          current_status: { type: 'string' },
          year: { type: 'integer' },
          has_refrigeration: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        },
        required: ['id', 'vehicle_code']
      },
      DeliveryZone: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          warehouse_id: { type: 'string', format: 'uuid' },
          zone_code: { type: 'string' },
          zone_name: { type: 'string' },
          zone_type: { type: 'string' },
          geometry: { type: 'object', additionalProperties: true },
          is_active: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        },
        required: ['id', 'warehouse_id', 'zone_code', 'zone_name']
      },
      Carrier: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          carrier_code: { type: 'string' },
          carrier_name: { type: 'string' },
          carrier_type: { type: 'string' },
          is_active: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        },
        required: ['id', 'carrier_code', 'carrier_name']
      },
      CarrierService: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          carrier_id: { type: 'string', format: 'uuid' },
          service_code: { type: 'string' },
          service_name: { type: 'string' },
          service_type: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        },
        required: ['id', 'carrier_id', 'service_code']
      },
      PackagingType: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          category: { type: 'string' },
          packaging_code: { type: 'string' },
          packaging_name: { type: 'string' },
          is_reusable: { type: 'boolean' },
          is_active: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        },
        required: ['id', 'packaging_code', 'packaging_name']
      },
      PackagingInstance: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          packaging_type_id: { type: 'string', format: 'uuid' },
          barcode: { type: 'string' },
          status: { type: 'string' },
          current_location_id: { type: 'string', format: 'uuid' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        },
        required: ['id', 'packaging_type_id', 'barcode']
      },
      Setting: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          warehouse_id: { type: 'string', format: 'uuid' },
          setting_category: { type: 'string' },
          setting_key: { type: 'string' },
          setting_value: { type: 'object', additionalProperties: true },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        },
        required: ['id', 'warehouse_id', 'setting_key']
      },

      // Response envelopes
      WarehouseListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'array', items: { $ref: '#/components/schemas/Warehouse' } },
          pagination: { $ref: '#/components/schemas/Pagination' }
        },
        required: ['success', 'data', 'pagination']
      },
      VehicleListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'array', items: { $ref: '#/components/schemas/Vehicle' } },
          pagination: { $ref: '#/components/schemas/Pagination' }
        },
        required: ['success', 'data', 'pagination']
      },
      ZoneListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'array', items: { $ref: '#/components/schemas/Zone' } },
          pagination: { $ref: '#/components/schemas/Pagination' }
        },
        required: ['success', 'data', 'pagination']
      },
      LocationListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'array', items: { $ref: '#/components/schemas/Location' } },
          pagination: { $ref: '#/components/schemas/Pagination' }
        },
        required: ['success', 'data', 'pagination']
      },
      CarrierListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'array', items: { $ref: '#/components/schemas/Carrier' } },
          pagination: { $ref: '#/components/schemas/Pagination' }
        },
        required: ['success', 'data', 'pagination']
      },
      CarrierServiceListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'array', items: { $ref: '#/components/schemas/CarrierService' } },
          pagination: { $ref: '#/components/schemas/Pagination' }
        },
        required: ['success', 'data', 'pagination']
      },
      PackagingTypeListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'array', items: { $ref: '#/components/schemas/PackagingType' } },
          pagination: { $ref: '#/components/schemas/Pagination' }
        },
        required: ['success', 'data', 'pagination']
      },
      PackagingInstanceListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'array', items: { $ref: '#/components/schemas/PackagingInstance' } },
          pagination: { $ref: '#/components/schemas/Pagination' }
        },
        required: ['success', 'data', 'pagination']
      },
      SettingListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'array', items: { $ref: '#/components/schemas/Setting' } },
          pagination: { $ref: '#/components/schemas/Pagination' }
        },
        required: ['success', 'data', 'pagination']
      }
    },
    responses: {
      ErrorResponse: {
        description: 'Error response',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: { $ref: '#/components/schemas/Error' }
              },
              required: ['success', 'error']
            }
          }
        }
      }
    }
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/metrics': {
      get: {
        summary: 'Prometheus metrics',
        description: 'Exposes process and HTTP metrics in Prometheus text format. Intended for internal scraping only.',
        tags: ['system'],
        security: [],
        responses: {
          '200': {
            description: 'Metrics payload',
            content: {
              'text/plain': {
                schema: { type: 'string', description: 'Prometheus metrics text exposition format' }
              }
            }
          }
        }
      }
    },
    '/auth/me': {
      get: {
        summary: 'Current authenticated user',
        tags: ['auth'],
        responses: {
          '200': {
            description: 'Authenticated user payload',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        user: {
                          type: 'object',
                          properties: {
                            id: { type: 'string', example: '00000000-0000-0000-0000-000000000000' },
                            email: { type: 'string', example: 'dev-admin@example.com' },
                            role: { type: 'string', example: 'admin' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/ErrorResponse' }
        }
      }
    },
    '/dev/token': {
      post: {
        summary: 'Mint a development JWT (non-production only)',
        description: 'Available only when NODE_ENV != production. Optionally secured by DEV_TOOL_SECRET via x-dev-secret header.',
        tags: ['dev'],
        security: [],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DevMintTokenRequest' },
              example: { role: 'manager', email: 'dev-manager@example.com', expiresIn: '8h' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Token minted',
            headers: {
              'Warning': { description: 'Non-production endpoint. Do not enable in production.', schema: { type: 'string' } }
            },
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/DevMintTokenResponse' } }
            }
          },
          '401': { $ref: '#/components/responses/ErrorResponse' },
          '403': { $ref: '#/components/responses/ErrorResponse' }
        }
      }
    },
    '/health': {
      get: {
        summary: 'Service health check',
        tags: ['system'],
        security: [],
        responses: {
          '200': {
            description: 'Service is healthy'
          }
        }
      }
    },
    '/ready': {
      get: {
        summary: 'Service readiness check',
        description: 'Checks connectivity to core dependencies (PostgreSQL and Redis). Returns 200 if all are OK, otherwise 503.',
        tags: ['system'],
        security: [],
        responses: {
          '200': { description: 'All dependencies are reachable' },
          '503': { description: 'One or more dependencies are unavailable' }
        }
      }
    },
    '/api/v1/warehouses': {
      get: {
        summary: 'List warehouses',
        tags: ['warehouses'],
        parameters: [
          { name: 'company_name', in: 'query', schema: { type: 'string' }, description: 'Filter by company name (ILIKE %value%)' },
          { name: 'is_active', in: 'query', schema: { type: 'boolean' }, description: 'Filter active/inactive; default active only' },
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Text search in code/name/company' },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['created_at','updated_at','warehouse_code','warehouse_name','company_name'] } },
          { name: 'sortDir', in: 'query', schema: { type: 'string', enum: ['asc','desc'] } }
        ],
        responses: {
          '200': {
            description: 'List of warehouses',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/WarehouseListResponse' } }
            }
          },
          '400': { $ref: '#/components/responses/ErrorResponse' },
          '401': { $ref: '#/components/responses/ErrorResponse' }
        }
      }
    },
    '/api/v1/vehicles': {
      get: {
        summary: 'List vehicles',
        tags: ['vehicles'],
        parameters: [
          { name: 'warehouse_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'has_refrigeration', in: 'query', schema: { type: 'boolean' } },
          { name: 'is_active', in: 'query', schema: { type: 'boolean' }, description: 'Filter active/inactive; default active only' },
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search in vehicle_code/license_plate/make/model' },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 }, description: 'Page number (default 1)' },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 }, description: 'Page size (default 25)' },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['vehicle_code','created_at','updated_at','current_status','year'] } },
          { name: 'sortDir', in: 'query', schema: { type: 'string', enum: ['asc','desc'] }, description: 'Sort direction' }
        ],
        responses: {
          '200': {
            description: 'List of vehicles',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/VehicleListResponse' } } }
          },
          '400': { $ref: '#/components/responses/ErrorResponse' },
          '401': { $ref: '#/components/responses/ErrorResponse' }
        }
      }
    },
    '/api/v1/warehouses/{warehouseId}/zones': {
      get: {
        summary: 'List zones for a warehouse',
        tags: ['zones'],
        parameters: [
          { name: 'warehouseId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'zone_type', in: 'query', schema: { type: 'string' } },
          { name: 'is_active', in: 'query', schema: { type: 'boolean' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['zone_code','zone_name','zone_type','created_at','updated_at'] } },
          { name: 'sortDir', in: 'query', schema: { type: 'string', enum: ['asc','desc'] } }
        ],
        responses: {
          '200': {
            description: 'List of zones',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ZoneListResponse' } } }
          },
          '400': { $ref: '#/components/responses/ErrorResponse' },
          '401': { $ref: '#/components/responses/ErrorResponse' }
        }
      }
    },
    '/api/v1/zones/{zoneId}/locations': {
      get: {
        summary: 'List locations for a zone',
        tags: ['locations'],
        parameters: [
          { name: 'zoneId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'location_type', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['aisle','rack','shelf_level','bin_position','created_at','updated_at','location_code'] } },
          { name: 'sortDir', in: 'query', schema: { type: 'string', enum: ['asc','desc'] } }
        ],
        responses: {
          '200': {
            description: 'List of locations',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LocationListResponse' } } }
          },
          '400': { $ref: '#/components/responses/ErrorResponse' },
          '401': { $ref: '#/components/responses/ErrorResponse' }
        }
      }
    },
    '/api/v1/carriers': {
      get: {
        summary: 'List carriers',
        tags: ['carriers'],
        parameters: [
          { name: 'carrier_type', in: 'query', schema: { type: 'string' } },
          { name: 'is_active', in: 'query', schema: { type: 'boolean' } },
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search in carrier_name/code' },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['carrier_name','carrier_code','created_at','updated_at','carrier_type'] } },
          { name: 'sortDir', in: 'query', schema: { type: 'string', enum: ['asc','desc'] } }
        ],
        responses: {
          '200': {
            description: 'List of carriers',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CarrierListResponse' } } }
          },
          '400': { $ref: '#/components/responses/ErrorResponse' },
          '401': { $ref: '#/components/responses/ErrorResponse' }
        }
      }
    },
    '/api/v1/carriers/{carrierId}/services': {
      get: {
        summary: 'List services for a carrier',
        tags: ['carriers'],
        parameters: [
          { name: 'carrierId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['service_name','service_code','service_type','created_at','updated_at'] } },
          { name: 'sortDir', in: 'query', schema: { type: 'string', enum: ['asc','desc'] } }
        ],
        responses: {
          '200': {
            description: 'List of carrier services',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CarrierServiceListResponse' } } }
          },
          '400': { $ref: '#/components/responses/ErrorResponse' },
          '401': { $ref: '#/components/responses/ErrorResponse' }
        }
      }
    },
    '/api/v1/packaging/types': {
      get: {
        summary: 'List packaging types',
        tags: ['packaging'],
        parameters: [
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'is_reusable', in: 'query', schema: { type: 'boolean' } },
          { name: 'is_active', in: 'query', schema: { type: 'boolean' } },
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search in packaging_name/code' },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['category','packaging_name','packaging_code','created_at','updated_at'] } },
          { name: 'sortDir', in: 'query', schema: { type: 'string', enum: ['asc','desc'] } }
        ],
        responses: {
          '200': {
            description: 'List of packaging types',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PackagingTypeListResponse' } } }
          },
          '400': { $ref: '#/components/responses/ErrorResponse' },
          '401': { $ref: '#/components/responses/ErrorResponse' }
        }
      }
    },
    '/api/v1/packaging/instances': {
      get: {
        summary: 'List package instances',
        tags: ['packaging'],
        parameters: [
          { name: 'packaging_type_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'current_location_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['created_at','updated_at','status','barcode'] } },
          { name: 'sortDir', in: 'query', schema: { type: 'string', enum: ['asc','desc'] } }
        ],
        responses: {
          '200': {
            description: 'List of package instances',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PackagingInstanceListResponse' } } }
          },
          '400': { $ref: '#/components/responses/ErrorResponse' },
          '401': { $ref: '#/components/responses/ErrorResponse' }
        }
      }
    },
    '/api/v1/warehouses/{warehouseId}/delivery-zones': {
      get: {
        summary: 'List delivery zones for a warehouse',
        tags: ['delivery-zones'],
        parameters: [
          { name: 'warehouseId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'zone_type', in: 'query', schema: { type: 'string' } },
          { name: 'is_active', in: 'query', schema: { type: 'boolean' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['zone_code','zone_name','zone_type','created_at','updated_at'] } },
          { name: 'sortDir', in: 'query', schema: { type: 'string', enum: ['asc','desc'] } }
        ],
        responses: {
          '200': {
            description: 'List of delivery zones',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ZoneListResponse' } } }
          },
          '400': { $ref: '#/components/responses/ErrorResponse' },
          '401': { $ref: '#/components/responses/ErrorResponse' }
        }
      }
    },
    '/api/v1/warehouses/{warehouseId}/settings': {
      get: {
        summary: 'List settings for a warehouse',
        tags: ['settings'],
        parameters: [
          { name: 'warehouseId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['setting_category','setting_key','created_at','updated_at'] } },
          { name: 'sortDir', in: 'query', schema: { type: 'string', enum: ['asc','desc'] } }
        ],
        responses: {
          '200': {
            description: 'List of settings',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SettingListResponse' } } }
          },
          '400': { $ref: '#/components/responses/ErrorResponse' },
          '401': { $ref: '#/components/responses/ErrorResponse' }
        }
      }
    }
  }
};

module.exports = openapi;
