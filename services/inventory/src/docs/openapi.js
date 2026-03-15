// OpenAPI 3.0.3 specification for the WMS Inventory Service
// Exposed at GET /api-docs

const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'WMS Inventory Service API',
    version: '1.0.0',
    description:
      'Manages all inventory operations: products, locations, batches, movements, reception, picking, and orders.\n\n' +
      '**Authentication**: All routes (except `/health`, `/metrics`) require `Authorization: Bearer <JWT>`.\n\n' +
      '**Key Operational Flow**:\n' +
      '1. Create / import **Products** (`/api/v1/products`)\n' +
      '2. Create **Locations** (`/api/v1/locations`)\n' +
      '3. Create **Purchase Order** + **NIR (Goods Receipt)** → `confirm` it → **Batches** are created\n' +
      '4. Put-away batches to locations (`/api/v1/batches/:id` PUT)\n' +
      '5. Create **Sales Order** (`/api/v1/orders`) → **Allocate** picking job\n' +
      '6. Operator accepts job, picks items, completes job\n' +
      '7. Move to shipping zone → Shipment service takes over',
  },
  servers: [
    { url: 'http://localhost:3011', description: 'Local (direct)' },
    { url: 'http://localhost:8000/inventory', description: 'Through Kong gateway' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT issued by the auth service. Roles: admin, supervisor, operator.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string' },
        },
      },
      Product: {
        type: 'object',
        properties: {
          sku: { type: 'string', example: 'CABLU-NYY-3x2.5' },
          name: { type: 'string', example: 'Cablu NYY 3x2.5mm' },
          description: { type: 'string', nullable: true },
          uom: { type: 'string', example: 'm', description: 'Unit of measure' },
          lot_control: { type: 'boolean', example: true },
          weight_kg: { type: 'number', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      Location: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'A-01-01' },
          zone: { type: 'string', example: 'A', nullable: true },
          rack: { type: 'string', example: '01', nullable: true },
          position: { type: 'string', example: '01', nullable: true },
          capacity_m3: { type: 'number', nullable: true },
          allowed_types: { type: 'array', items: { type: 'string' }, nullable: true },
        },
      },
      Batch: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          batch_number: { type: 'string', example: 'LOT-2025-001' },
          product_sku: { type: 'string' },
          location_id: { type: 'string', nullable: true },
          quantity: { type: 'number', example: 500 },
          uom: { type: 'string', example: 'm' },
          status: { type: 'string', enum: ['pending_putaway', 'in_stock', 'partially_picked', 'depleted'] },
          expiry_date: { type: 'string', format: 'date', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      GoodsReceipt: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          nir_number: { type: 'string', example: 'NIR-2025-001' },
          supplier: { type: 'string' },
          status: { type: 'string', enum: ['draft', 'confirmed'] },
          lines: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                product_sku: { type: 'string' },
                quantity: { type: 'number' },
                uom: { type: 'string' },
                lot_number: { type: 'string', nullable: true },
              },
            },
          },
        },
      },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          order_number: { type: 'string', example: 'ORD-2025-001' },
          customer: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'in_picking', 'picked', 'ready_for_loading', 'shipped'] },
          lines: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                product_sku: { type: 'string' },
                quantity_ordered: { type: 'number' },
                uom: { type: 'string' },
              },
            },
          },
        },
      },
      PickJob: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          order_id: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'moved_to_shipping'] },
          assigned_to: { type: 'string', nullable: true },
          items: { type: 'array', items: { type: 'object' } },
        },
      },
      Movement: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          product_sku: { type: 'string' },
          from_location: { type: 'string', nullable: true },
          to_location: { type: 'string', nullable: true },
          quantity: { type: 'number' },
          movement_type: { type: 'string', enum: ['receipt', 'transfer', 'adjustment', 'pick', 'shipment'] },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    // ── System ─────────────────────────────────────────────────────────────
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        responses: {
          200: { description: 'Service healthy', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'healthy' }, database: { type: 'string' }, redis: { type: 'string' } } } } } },
          503: { description: 'Unhealthy' },
        },
      },
    },

    // ── Products ───────────────────────────────────────────────────────────
    '/api/v1/products': {
      get: {
        tags: ['Products'],
        summary: 'List products (paginated, searchable)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 50 } },
          { in: 'query', name: 'search', schema: { type: 'string', description: 'Partial match on sku or name' } },
          { in: 'query', name: 'category', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Product list', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Product' } } } } } } },
          401: { description: 'Not authenticated' },
        },
      },
      post: {
        tags: ['Products'],
        summary: 'Create product (admin/manager)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['sku', 'name'],
                properties: {
                  sku: { type: 'string', maxLength: 100, example: 'CABLU-NYY-3x2.5' },
                  name: { type: 'string', maxLength: 255 },
                  description: { type: 'string', nullable: true },
                  uom: { type: 'string', default: 'm' },
                  lot_control: { type: 'boolean', default: false },
                  weight_kg: { type: 'number', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Product created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Product' } } } },
          400: { description: 'Validation error' },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin/manager required' },
          409: { description: 'SKU already exists' },
        },
      },
    },
    '/api/v1/products/sku/{sku}': {
      parameters: [{ in: 'path', name: 'sku', required: true, schema: { type: 'string' } }],
      get: {
        tags: ['Products'],
        summary: 'Get product by SKU',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Product', content: { 'application/json': { schema: { $ref: '#/components/schemas/Product' } } } },
          401: { description: 'Not authenticated' },
          404: { description: 'Not found' },
        },
      },
      put: {
        tags: ['Products'],
        summary: 'Update product (admin/manager)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                minProperties: 1,
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  uom: { type: 'string' },
                  lot_control: { type: 'boolean' },
                  weight_kg: { type: 'number', nullable: true },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Updated' }, 400: { description: 'Validation error' }, 404: { description: 'Not found' } },
      },
      delete: {
        tags: ['Products'],
        summary: 'Delete product (admin)',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Deleted' }, 404: { description: 'Not found' } },
      },
    },
    '/api/v1/products/import': {
      post: {
        tags: ['Products'],
        summary: 'Bulk import products from CSV/Excel (admin/manager)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary', description: 'CSV or XLSX file' } } } } },
        },
        responses: {
          200: { description: 'Import result with created/skipped counts' },
          400: { description: 'Invalid file format' },
          403: { description: 'Admin/manager required' },
        },
      },
    },

    // ── Locations ──────────────────────────────────────────────────────────
    '/api/v1/locations': {
      get: {
        tags: ['Locations'],
        summary: 'List warehouse locations',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Location list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Location' } } } } } },
      },
      post: {
        tags: ['Locations'],
        summary: 'Create location (admin/manager)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['id'],
                properties: {
                  id: { type: 'string', example: 'A-01-01', description: 'Unique location code (e.g. zone-rack-position)' },
                  zone: { type: 'string', nullable: true },
                  rack: { type: 'string', nullable: true },
                  position: { type: 'string', nullable: true },
                  capacity_m3: { type: 'number', nullable: true },
                  allowed_types: { type: 'array', items: { type: 'string' }, nullable: true },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Location created' }, 400: { description: 'Validation error' }, 403: { description: 'Admin/manager required' } },
      },
    },
    '/api/v1/locations/{id}': {
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
      get: {
        tags: ['Locations'],
        summary: 'Get location by ID',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Location found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Location' } } } }, 404: { description: 'Not found' } },
      },
    },

    // ── Goods Receipts (NIR) ───────────────────────────────────────────────
    '/api/v1/goods-receipts': {
      get: {
        tags: ['Goods Receipts (NIR)'],
        summary: 'List goods receipts',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'status', schema: { type: 'string', enum: ['draft', 'confirmed'] } },
          { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
        ],
        responses: { 200: { description: 'List of NIRs' } },
      },
      post: {
        tags: ['Goods Receipts (NIR)'],
        summary: 'Create goods receipt draft',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['supplier', 'lines'],
                properties: {
                  nir_number: { type: 'string', description: 'Leave empty to auto-generate' },
                  supplier: { type: 'string' },
                  gestiune: { type: 'string', description: 'Warehouse section code' },
                  lines: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['product_sku', 'quantity'],
                      properties: {
                        product_sku: { type: 'string' },
                        quantity: { type: 'number' },
                        uom: { type: 'string', default: 'm' },
                        lot_number: { type: 'string', nullable: true },
                        expiry_date: { type: 'string', format: 'date', nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'NIR draft created' }, 400: { description: 'Validation error' } },
      },
    },
    '/api/v1/goods-receipts/{id}': {
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
      get: { tags: ['Goods Receipts (NIR)'], summary: 'Get NIR by ID', security: [{ bearerAuth: [] }], responses: { 200: { description: 'NIR detail' }, 404: { description: 'Not found' } } },
    },
    '/api/v1/goods-receipts/{id}/confirm': {
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
      post: {
        tags: ['Goods Receipts (NIR)'],
        summary: 'Confirm NIR — creates stock batches',
        description: 'Confirms the receipt and creates `Batch` records for each line. Batches are placed in `pending_putaway` status.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'NIR confirmed, batches created' },
          400: { description: 'Already confirmed or invalid' },
          404: { description: 'Not found' },
        },
      },
    },

    // ── Batches ────────────────────────────────────────────────────────────
    '/api/v1/batches': {
      get: {
        tags: ['Batches'],
        summary: 'List batches with filters',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'product_sku', schema: { type: 'string' } },
          { in: 'query', name: 'status', schema: { type: 'string', enum: ['pending_putaway', 'in_stock', 'partially_picked', 'depleted'] } },
          { in: 'query', name: 'location_id', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Batch list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Batch' } } } } } },
      },
      post: {
        tags: ['Batches'],
        summary: 'Create batch manually',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['product_sku', 'quantity'],
                properties: {
                  product_sku: { type: 'string' },
                  batch_number: { type: 'string', nullable: true, description: 'Auto-generated if omitted' },
                  quantity: { type: 'number' },
                  uom: { type: 'string', default: 'm' },
                  location_id: { type: 'string', nullable: true },
                  expiry_date: { type: 'string', format: 'date', nullable: true },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Batch created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Batch' } } } } },
      },
    },
    '/api/v1/batches/pending-putaway': {
      get: { tags: ['Batches'], summary: 'Batches awaiting putaway', security: [{ bearerAuth: [] }], responses: { 200: { description: 'List' } } },
    },
    '/api/v1/batches/statistics': {
      get: { tags: ['Batches'], summary: 'Batch statistics (totals by product/location)', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Statistics' } } },
    },
    '/api/v1/batches/product/{sku}': {
      parameters: [{ in: 'path', name: 'sku', required: true, schema: { type: 'string' } }],
      get: { tags: ['Batches'], summary: 'Get batches by product SKU', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Batches' } } },
    },
    '/api/v1/batches/{id}': {
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
      get: { tags: ['Batches'], summary: 'Get batch by ID', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Batch detail', content: { 'application/json': { schema: { $ref: '#/components/schemas/Batch' } } } }, 404: { description: 'Not found' } } },
      put: {
        tags: ['Batches'],
        summary: 'Update batch (e.g. assign location for putaway)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  location_id: { type: 'string', description: 'Assign putaway location' },
                  quantity: { type: 'number' },
                  status: { type: 'string', enum: ['pending_putaway', 'in_stock', 'depleted'] },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Updated' } },
      },
      delete: { tags: ['Batches'], summary: 'Soft delete batch', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Deleted' } } },
    },
    '/api/v1/batches/{id}/label.pdf': {
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
      get: { tags: ['Batches'], summary: 'Download batch label PDF', security: [{ bearerAuth: [] }], responses: { 200: { description: 'PDF file', content: { 'application/pdf': {} } } } },
    },

    // ── Movements ──────────────────────────────────────────────────────────
    '/api/v1/movements': {
      get: {
        tags: ['Movements'],
        summary: 'Movement history',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'product_sku', schema: { type: 'string' } },
          { in: 'query', name: 'movement_type', schema: { type: 'string', enum: ['receipt', 'transfer', 'adjustment', 'pick', 'shipment'] } },
          { in: 'query', name: 'from_date', schema: { type: 'string', format: 'date' } },
          { in: 'query', name: 'to_date', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: { description: 'Movement list', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Movement' } } } } } },
      },
      post: {
        tags: ['Movements'],
        summary: 'Register stock transfer between locations',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['product_sku', 'quantity', 'to_location'],
                properties: {
                  product_sku: { type: 'string' },
                  from_location: { type: 'string', nullable: true },
                  to_location: { type: 'string' },
                  quantity: { type: 'number' },
                  batch_id: { type: 'string', format: 'uuid', nullable: true },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Movement registered' }, 400: { description: 'Validation error' } },
      },
    },
    '/api/v1/movements/adjust': {
      post: {
        tags: ['Movements'],
        summary: 'Manual inventory adjustment (admin/manager)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['product_sku', 'quantity', 'location_id', 'reason'],
                properties: {
                  product_sku: { type: 'string' },
                  location_id: { type: 'string' },
                  quantity: { type: 'number', description: 'Positive = add, negative = remove' },
                  reason: { type: 'string', description: 'Adjustment reason for audit trail' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Adjustment recorded' }, 403: { description: 'Admin/manager required' } },
      },
    },

    // ── Orders ─────────────────────────────────────────────────────────────
    '/api/v1/orders': {
      get: {
        tags: ['Orders'],
        summary: 'List sales orders',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'status', schema: { type: 'string', enum: ['pending', 'in_picking', 'picked', 'ready_for_loading', 'shipped'] } },
          { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
        ],
        responses: { 200: { description: 'Order list' } },
      },
      post: {
        tags: ['Orders'],
        summary: 'Create sales order',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['customer', 'lines'],
                properties: {
                  order_number: { type: 'string', nullable: true, description: 'Auto-generated if omitted' },
                  customer: { type: 'string' },
                  delivery_date: { type: 'string', format: 'date', nullable: true },
                  lines: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['product_sku', 'quantity_ordered'],
                      properties: {
                        product_sku: { type: 'string' },
                        quantity_ordered: { type: 'number' },
                        uom: { type: 'string', default: 'm' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Order created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } } } },
      },
    },

    // ── Picking ────────────────────────────────────────────────────────────
    '/api/v1/orders/{id}/allocate': {
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Order ID' }],
      post: {
        tags: ['Picking'],
        summary: 'Allocate picking job from order',
        description: 'Creates a `PickJob` by allocating batch quantities for each order line (FEFO by default).',
        security: [{ bearerAuth: [] }],
        responses: {
          201: { description: 'Pick job created', content: { 'application/json': { schema: { $ref: '#/components/schemas/PickJob' } } } },
          400: { description: 'Insufficient stock or order already allocated' },
          404: { description: 'Order not found' },
        },
      },
    },
    '/api/v1/pick-jobs': {
      get: { tags: ['Picking'], summary: 'List pick jobs', security: [{ bearerAuth: [] }], parameters: [{ in: 'query', name: 'status', schema: { type: 'string' } }, { in: 'query', name: 'mine', schema: { type: 'integer', enum: [0, 1] }, description: '1 = only jobs assigned to the current user' }], responses: { 200: { description: 'Job list' } } },
    },
    '/api/v1/pick-jobs/{id}': {
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
      get: { tags: ['Picking'], summary: 'Get pick job detail', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Job detail' }, 404: { description: 'Not found' } } },
    },
    '/api/v1/pick-jobs/{id}/accept': {
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
      post: { tags: ['Picking'], summary: 'Operator accepts pick job', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Accepted' } } },
    },
    '/api/v1/pick-jobs/{id}/pick': {
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
      post: {
        tags: ['Picking'],
        summary: 'Record item pick scan',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['item_id', 'quantity_picked'],
                properties: {
                  item_id: { type: 'string', format: 'uuid' },
                  quantity_picked: { type: 'number' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Pick recorded' } },
      },
    },
    '/api/v1/pick-jobs/{id}/complete': {
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
      post: { tags: ['Picking'], summary: 'Complete pick job', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Job completed' } } },
    },
    '/api/v1/pick-jobs/{id}/move-to-shipping': {
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
      post: { tags: ['Picking'], summary: 'Move picked goods to shipping zone', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Moved to shipping' } } },
    },
    '/api/v1/pick-jobs/{id}/labels.pdf': {
      parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
      get: { tags: ['Picking'], summary: 'Download pick job labels PDF', security: [{ bearerAuth: [] }], responses: { 200: { description: 'PDF', content: { 'application/pdf': {} } } } },
    },
  },
};

module.exports = openapi;
