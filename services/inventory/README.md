# Inventory Service

Advanced Warehouse Management System - Inventory Service

## Features

- ✅ **Product Management** - CRUD operations for products with SKU tracking
- ✅ **Location Management** - Hierarchical warehouse location tracking (warehouse → zone → aisle → rack → shelf → bin)
- ✅ **Inventory Movements** - Track all inventory transfers between locations
- ✅ **Inventory Adjustments** - Manual inventory corrections with audit trail
- ✅ **Real-time Stock Levels** - Accurate inventory quantities per location
- ✅ **Audit Logging** - Complete audit trail for all operations
- ✅ **Role-based Access** - Admin, Manager, Operator, Scanner roles
- ✅ **Pagination & Search** - Efficient data retrieval
- ✅ **Prometheus Metrics** - Performance monitoring
- ✅ **Winston Logging** - Structured logging

## API Endpoints

### Products

```
GET    /api/v1/products                 - Get all products (paginated, searchable)
GET    /api/v1/products/sku/:sku        - Get product by SKU
POST   /api/v1/products                 - Create product (admin/manager)
PUT    /api/v1/products/sku/:sku        - Update product (admin/manager)
```

### Locations

```
GET    /api/v1/locations                - Get all locations
GET    /api/v1/locations/:id            - Get location by ID
POST   /api/v1/locations                - Create location (admin/manager)
```

### Movements

```
GET    /api/v1/movements                - Get movement history
POST   /api/v1/movements                - Create movement (transfer)
POST   /api/v1/movements/adjust         - Adjust inventory (manual correction)
```

### System

```
GET    /health                          - Health check
GET    /metrics                         - Prometheus metrics
```

## Request Examples

### Create Product

```bash
POST /api/v1/products
Authorization: Bearer <token>
Content-Type: application/json

{
  "sku": "PROD-001",
  "name": "Product Name",
  "description": "Product description",
  "unit": "PCS",
  "min_stock": 10,
  "max_stock": 1000
}
```

### Transfer Inventory

```bash
POST /api/v1/movements
Authorization: Bearer <token>
Content-Type: application/json

{
  "product_sku": "PROD-001",
  "from_location_id": "uuid-here",
  "to_location_id": "uuid-here",
  "quantity": 50,
  "reason": "Restocking",
  "notes": "Moving from storage to picking area"
}
```

### Adjust Inventory

```bash
POST /api/v1/movements/adjust
Authorization: Bearer <token>
Content-Type: application/json

{
  "product_sku": "PROD-001",
  "location_id": "uuid-here",
  "new_quantity": 100,
  "reason": "Physical count correction",
  "notes": "Annual inventory count"
}
```

### Search Products

```bash
GET /api/v1/products?search=widget&page=1&limit=50
Authorization: Bearer <token>
```

## Authentication

All endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

Get your token from the Auth Service login endpoint.

## Authorization Roles

- **admin** - Full access to all operations
- **manager** - Can create/update products, locations, and adjust inventory
- **operator** - Can create movements and view data
- **scanner** - Can view data only (for mobile scanning devices)

## Environment Variables

```env
PORT=3000
NODE_ENV=development

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=wms_nks
DB_USER=wms_admin
DB_PASSWORD=wms_secure_pass_2025

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis_pass_2025

# JWT
JWT_SECRET=wms_jwt_secret_key_2025
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run in production mode
npm start

# Run tests
npm test

# Lint code
npm run lint
```

## Database Schema

### Products Table
- `id` (UUID, PK)
- `sku` (VARCHAR, UNIQUE)
- `name` (VARCHAR)
- `description` (TEXT)
- `unit` (VARCHAR) - PCS, KG, LITER, etc.
- `min_stock` (INTEGER)
- `max_stock` (INTEGER)
- `is_active` (BOOLEAN)
- `created_by` (UUID, FK to users)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Locations Table
- `id` (UUID, PK)
- `name` (VARCHAR, UNIQUE)
- `type` (ENUM: WAREHOUSE, ZONE, AISLE, RACK, SHELF, BIN)
- `capacity` (INTEGER)
- `zone`, `aisle`, `rack`, `shelf`, `bin` (VARCHAR) - Hierarchical identifiers
- `is_active` (BOOLEAN)
- `created_by` (UUID, FK to users)
- `created_at` (TIMESTAMP)

### Inventory Items Table
- `id` (UUID, PK)
- `product_id` (UUID, FK to products)
- `location_id` (UUID, FK to locations)
- `quantity` (INTEGER)
- `reserved_quantity` (INTEGER) - For orders
- `created_by` (UUID, FK to users)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- UNIQUE constraint on (product_id, location_id)

### Movements Table
- `id` (UUID, PK)
- `product_id` (UUID, FK to products)
- `from_location_id` (UUID, FK to locations, nullable)
- `to_location_id` (UUID, FK to locations, nullable)
- `quantity` (INTEGER)
- `type` (ENUM: TRANSFER, ADJUSTMENT, RECEIPT, SHIPMENT)
- `reason` (VARCHAR)
- `notes` (TEXT)
- `performed_by` (UUID, FK to users)
- `created_at` (TIMESTAMP)

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "field_name",
      "message": "Validation message"
    }
  ]
}
```

## Monitoring

- **Health Check**: `GET /health` - Returns service health status
- **Metrics**: `GET /metrics` - Prometheus-compatible metrics
- **Logging**: Winston structured logs to console (JSON format)

## Performance

- Database connection pooling enabled
- Redis caching for frequently accessed data
- Efficient pagination with LIMIT/OFFSET
- Indexed queries for fast lookups
- Transaction support for data consistency

## Security

- JWT token authentication
- Role-based authorization
- Input validation with Joi
- SQL injection protection with parameterized queries
- Audit logging for all operations

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test
npm test -- products.test.js
```

## Troubleshooting

### Service not starting
```bash
# Check database connection
docker-compose logs postgres

# Check Redis connection
docker-compose logs redis

# View service logs
docker-compose logs inventory-service
```

### Token errors
Make sure your JWT token is valid and not expired. Get a new token from Auth Service if needed.

### Database errors
Ensure the database schema is initialized with all required tables. Check `docker/init-scripts/01-init-databases.sql`.

## Contributing

1. Create a feature branch
2. Make your changes
3. Write tests
4. Submit a pull request

## License

Proprietary - WMS-NKS Team
