// OpenAPI 3.0.3 specification for the WMS Auth Service
// Exposed at GET /api-docs (via swagger-ui-express)

const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'WMS Auth Service API',
    version: '1.0.0',
    description:
      'Authentication and user-management API for the WMS platform.\n\n' +
      '**Workflow**:\n' +
      '1. `POST /api/v1/auth/login` → receive `accessToken` + `refreshToken`\n' +
      '2. Pass `Authorization: Bearer <accessToken>` on every secured request\n' +
      '3. When the access token expires, call `POST /api/v1/auth/refresh`\n' +
      '4. Call `POST /api/v1/auth/logout` to revoke all refresh tokens',
  },
  servers: [
    { url: 'http://localhost:3010', description: 'Local (direct)' },
    { url: 'http://localhost:8000/auth', description: 'Through Kong gateway' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          '1. Call POST /api/v1/auth/login to get an access token.\n' +
          '2. Click "Authorize" and paste the token value (without "Bearer ").',
      },
    },
    schemas: {
      // ── Shared ──────────────────────────────────────────────────────────────
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Invalid credentials' },
        },
      },
      UserSummary: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          username: { type: 'string', example: 'ion.popescu' },
          email: { type: 'string', format: 'email', example: 'ion@wms.example' },
          role: { type: 'string', enum: ['admin', 'supervisor', 'operator'], example: 'operator' },
        },
      },
      UserDetail: {
        allOf: [
          { $ref: '#/components/schemas/UserSummary' },
          {
            type: 'object',
            properties: {
              is_active: { type: 'boolean', example: true },
              last_login: { type: 'string', format: 'date-time', nullable: true },
              created_at: { type: 'string', format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time', nullable: true },
            },
          },
        ],
      },
      TokenPair: {
        type: 'object',
        properties: {
          accessToken: { type: 'string', description: 'JWT access token (15 min default)' },
          refreshToken: { type: 'string', description: 'JWT refresh token (7 days default, stored in Redis)' },
          expiresIn: { type: 'string', example: '15m' },
        },
        required: ['accessToken', 'refreshToken'],
      },
    },
  },
  paths: {
    // ── Health ─────────────────────────────────────────────────────────────
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        description: 'Verifies PostgreSQL and Redis connectivity.',
        responses: {
          200: {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'healthy' },
                    timestamp: { type: 'string', format: 'date-time' },
                    uptime: { type: 'number' },
                    database: { type: 'string', example: 'connected' },
                    redis: { type: 'string', example: 'connected' },
                  },
                },
              },
            },
          },
          503: { description: 'Service unavailable', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    // ── Auth ───────────────────────────────────────────────────────────────
    '/api/v1/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a new user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'email', 'password'],
                properties: {
                  username: { type: 'string', minLength: 3, maxLength: 50, example: 'ion.popescu' },
                  email: { type: 'string', format: 'email', example: 'ion@wms.example' },
                  password: { type: 'string', minLength: 8, example: 'SecurePass!1' },
                  role: { type: 'string', enum: ['admin', 'supervisor', 'operator'], default: 'operator' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'User created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'User created successfully' },
                    user: { $ref: '#/components/schemas/UserSummary' },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          409: { description: 'Username or email already exists', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/v1/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Login and obtain tokens',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                  username: { type: 'string', example: 'admin' },
                  password: { type: 'string', example: 'SecurePass!1' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Successful login',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/TokenPair' },
                    {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/UserSummary' },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: { description: 'Validation error' },
          401: { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/v1/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Refresh access token',
        description: 'Exchanges a valid refresh token for a new token pair. The used refresh token is revoked (rotation).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                  refreshToken: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'New token pair issued',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/TokenPair' } } },
          },
          400: { description: 'Missing refreshToken' },
          401: { description: 'Invalid or expired refresh token', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/api/v1/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Logout (revoke refresh tokens)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Logged out successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { message: { type: 'string', example: 'Logged out successfully' } },
                },
              },
            },
          },
          401: { description: 'Not authenticated' },
        },
      },
    },

    '/api/v1/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current authenticated user',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Current user profile',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { user: { $ref: '#/components/schemas/UserDetail' } },
                },
              },
            },
          },
          401: { description: 'Not authenticated' },
        },
      },
    },

    // ── Users ──────────────────────────────────────────────────────────────
    '/api/v1/users': {
      get: {
        tags: ['Users'],
        summary: 'List all users (admin only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 50 } },
          { in: 'query', name: 'role', schema: { type: 'string', enum: ['admin', 'supervisor', 'operator'] } },
          { in: 'query', name: 'search', schema: { type: 'string', description: 'Partial match on username or email' } },
        ],
        responses: {
          200: {
            description: 'Paginated user list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/UserDetail' } },
                    pagination: {
                      type: 'object',
                      properties: {
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        total: { type: 'integer' },
                        pages: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin role required' },
        },
      },
      post: {
        tags: ['Users'],
        summary: 'Create user (admin only)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'email', 'password'],
                properties: {
                  username: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  role: { type: 'string', enum: ['admin', 'supervisor', 'operator'], default: 'operator' },
                  is_active: { type: 'boolean', default: true },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'User created', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/UserDetail' } } } } } },
          400: { description: 'Validation error' },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin role required' },
          409: { description: 'Username or email already exists' },
        },
      },
    },

    '/api/v1/users/{id}': {
      parameters: [
        { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      get: {
        tags: ['Users'],
        summary: 'Get user by ID',
        description: 'Admins can fetch any user. Non-admins can only fetch their own profile.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'User found', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/UserDetail' } } } } } },
          401: { description: 'Not authenticated' },
          403: { description: "Forbidden \u2014 cannot view another user's profile" },
          404: { description: 'User not found' },
        },
      },
      put: {
        tags: ['Users'],
        summary: 'Update user',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  role: { type: 'string', enum: ['admin', 'supervisor', 'operator'] },
                  is_active: { type: 'boolean' },
                  password: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'User updated' },
          401: { description: 'Not authenticated' },
          403: { description: 'Insufficient permissions' },
          404: { description: 'User not found' },
        },
      },
      delete: {
        tags: ['Users'],
        summary: 'Delete (deactivate) user (admin only)',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'User deleted/deactivated' },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin role required' },
          404: { description: 'User not found' },
        },
      },
    },

    '/api/v1/users/{id}/permissions': {
      parameters: [
        { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
      ],
      get: {
        tags: ['Users'],
        summary: 'Get user permissions',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Permissions list' },
          401: { description: 'Not authenticated' },
          404: { description: 'User not found' },
        },
      },
      put: {
        tags: ['Users'],
        summary: 'Update user permissions (admin only)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  permissions: { type: 'array', items: { type: 'string' }, example: ['inventory.read', 'orders.write'] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Permissions updated' },
          401: { description: 'Not authenticated' },
          403: { description: 'Admin role required' },
        },
      },
    },
  },
};

module.exports = openapi;
