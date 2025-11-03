# 📦 Product Location Assignment & QR Generation Workflow

**Date:** October 31, 2025  
**Feature:** Product Import, Location Assignment, QR Generation

---

## 🎯 Overview

This document describes the workflow for importing products, assigning them to warehouse locations, and generating QR codes for tracking.

---

## 🔄 Workflow Diagram

```
┌──────────────────┐
│  Import Products │
│  (CSV/Excel/Manual)│
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Select Warehouse│
│  & Zone          │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Choose Available│
│  Location        │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Set Quantity    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Generate QR Code│
│  (SKU + Location)│
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Create Inventory│
│  Movement Record │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Update Location │
│  Status: OCCUPIED│
└──────────────────┘
```

---

## 📊 Database Schema

### Products Table (Existing)
```sql
CREATE TABLE products (
  sku VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  uom VARCHAR(20) DEFAULT 'm',
  lot_control BOOLEAN DEFAULT false,
  weight_kg DECIMAL(10,3),
  length_cm DECIMAL(10,2),
  width_cm DECIMAL(10,2),
  height_cm DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Inventory Items Table (New/Enhanced)
```sql
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_sku VARCHAR(100) REFERENCES products(sku),
  warehouse_id UUID REFERENCES warehouses(id),
  zone_id UUID REFERENCES warehouse_zones(id),
  location_id UUID REFERENCES locations(id),
  quantity DECIMAL(10,3) NOT NULL,
  reserved_qty DECIMAL(10,3) DEFAULT 0,
  lot_number VARCHAR(100),
  expiry_date DATE,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  qr_code_data TEXT, -- JSON with SKU + Location info
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT positive_quantity CHECK (quantity >= 0),
  CONSTRAINT positive_reserved CHECK (reserved_qty >= 0)
);

CREATE INDEX idx_inventory_items_product ON inventory_items(product_sku);
CREATE INDEX idx_inventory_items_location ON inventory_items(location_id);
CREATE INDEX idx_inventory_items_warehouse ON inventory_items(warehouse_id);
```

### Inventory Movements Table (Existing)
```sql
CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_sku VARCHAR(100) REFERENCES products(sku),
  location_id UUID REFERENCES locations(id),
  movement_type VARCHAR(20) NOT NULL, -- 'IN', 'OUT', 'TRANSFER', 'ADJUSTMENT'
  quantity DECIMAL(10,3) NOT NULL,
  lot_number VARCHAR(100),
  expiry_date DATE,
  reference_document VARCHAR(100),
  notes TEXT,
  performed_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🎨 Frontend Components

### 1. Product Import Dialog
**File:** `frontend/web_ui/src/components/ProductImportDialog.tsx`

**Features:**
- Upload CSV/Excel file
- Preview imported data (first 10 rows)
- Validate SKU uniqueness
- Show import errors
- Bulk import to database

**CSV Format:**
```csv
sku,name,description,uom,weight_kg,lot_control
BTN-001,Button White 15mm,White plastic button,pcs,0.001,false
FABRIC-001,Cotton Fabric Blue,100% cotton fabric,m,0.250,true
```

### 2. Location Assignment Dialog
**File:** `frontend/web_ui/src/components/LocationAssignmentDialog.tsx`

**Features:**
- Select Warehouse (dropdown)
- Select Zone (filtered by warehouse)
- Select Location (filtered by zone, only AVAILABLE)
- Enter quantity
- View location details (aisle, rack, level, bin)
- Generate QR preview before saving

**Workflow:**
```typescript
// Step 1: User adds/imports product
Product: { sku: 'BTN-001', name: 'Button White 15mm' }

// Step 2: Select location
Warehouse: 'Main Warehouse'
Zone: 'Zone A - Raw Materials'
Location: '01-01-01-01' (Available)
Quantity: 1000 pcs

// Step 3: Generate QR
QR Data: {
  sku: 'BTN-001',
  name: 'Button White 15mm',
  location_code: '01-01-01-01',
  warehouse: 'Main Warehouse',
  zone: 'Zone A',
  quantity: 1000,
  unit: 'pcs',
  timestamp: '2025-10-31T14:00:00Z'
}

// Step 4: Create inventory record
inventory_items: {
  product_sku: 'BTN-001',
  location_id: <uuid>,
  quantity: 1000,
  qr_code_data: <json>
}

// Step 5: Update location status
locations: {
  id: <uuid>,
  status: 'OCCUPIED'
}
```

### 3. QR Code Generator Component
**File:** `frontend/web_ui/src/components/ProductQRGenerator.tsx`

**Features:**
- Generate QR with product + location data
- Display QR code with label (SKU, Name, Location)
- Print layout (4 QR codes per A4 page)
- Batch print for multiple products

**QR Code Format:**
```json
{
  "type": "PRODUCT_LOCATION",
  "sku": "BTN-001",
  "product_name": "Button White 15mm",
  "warehouse_code": "WH-001",
  "zone_code": "ZONE-A",
  "location_code": "01-01-01-01",
  "quantity": 1000,
  "uom": "pcs",
  "lot_number": "LOT-2025-001",
  "expiry_date": "2026-12-31",
  "assigned_at": "2025-10-31T14:00:00Z"
}
```

---

## 🔧 Backend API Endpoints

### 1. Import Products (Bulk)
```
POST /api/v1/products/import
Content-Type: multipart/form-data

Request:
- file: CSV/Excel file

Response:
{
  "success": true,
  "imported": 45,
  "skipped": 2,
  "errors": [
    { "row": 3, "sku": "BTN-005", "error": "Duplicate SKU" }
  ]
}
```

### 2. Assign Product to Location
```
POST /api/v1/inventory/assign-location

Request:
{
  "product_sku": "BTN-001",
  "location_id": "uuid",
  "quantity": 1000,
  "lot_number": "LOT-2025-001",
  "expiry_date": "2026-12-31"
}

Response:
{
  "success": true,
  "inventory_item_id": "uuid",
  "qr_code_data": { ... },
  "location_updated": true
}
```

### 3. Get Available Locations
```
GET /api/v1/locations/available?warehouse_id=uuid&zone_id=uuid

Response:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "location_code": "01-01-01-01",
      "aisle": "01",
      "rack": "01",
      "level": 1,
      "bin": "01",
      "status": "AVAILABLE",
      "zone_name": "Zone A"
    }
  ]
}
```

### 4. Generate QR Code
```
POST /api/v1/inventory/generate-qr

Request:
{
  "inventory_item_id": "uuid"
}

Response:
{
  "success": true,
  "qr_data": { ... },
  "qr_image_url": "data:image/png;base64,..."
}
```

---

## 💡 Use Cases

### Use Case 1: Manual Product Entry with Location
**Actor:** Warehouse Manager  
**Flow:**
1. Click "Add Product" button
2. Fill product details (SKU, Name, Weight, etc.)
3. Click "Assign Location"
4. Select Warehouse → Zone → Available Location
5. Enter quantity
6. Preview QR code
7. Save → Product created + Location assigned + QR generated

### Use Case 2: Bulk Import with Auto-Assignment
**Actor:** Warehouse Manager  
**Flow:**
1. Click "Import Products" button
2. Upload CSV with 50 products
3. System validates data
4. Select default warehouse + zone
5. System auto-assigns to available locations (FIFO)
6. Review assignment summary
7. Confirm → 50 products created + QR codes generated
8. Print all QR labels

### Use Case 3: Move Product to Different Location
**Actor:** Warehouse Operator  
**Flow:**
1. Scan product QR (BTN-001 at 01-01-01-01)
2. Select "Move to Location"
3. Scan destination QR (01-02-03-04)
4. Enter quantity to move
5. Confirm → Inventory movement created
6. Old location status: AVAILABLE (if empty)
7. New location status: OCCUPIED
8. Generate new QR for new location

---

## 🎯 Business Rules

### Location Assignment Rules
1. ✅ Product can be stored in **multiple locations** (distributed inventory)
2. ✅ Location can hold **multiple products** (mixed storage)
3. ✅ Location status changes:
   - `AVAILABLE` → `OCCUPIED` when product assigned
   - `OCCUPIED` → `AVAILABLE` when all products removed
4. ❌ Cannot assign to `BLOCKED` or `MAINTENANCE` locations
5. ✅ Reserved quantity cannot exceed available quantity

### QR Code Rules
1. ✅ Each inventory item has unique QR code
2. ✅ QR contains: SKU + Location + Quantity + Lot + Expiry
3. ✅ QR updated when product moved to new location
4. ✅ QR printable in label format (58mm × 40mm)

### Import Rules
1. ✅ SKU must be unique (primary key)
2. ✅ CSV validation before import
3. ✅ Skip duplicates or update existing
4. ✅ Log all import errors
5. ✅ Rollback on critical errors

---

## 📊 Analytics & Reports

### Stock by Location Report
```sql
SELECT 
  w.warehouse_name,
  wz.zone_name,
  l.location_code,
  p.sku,
  p.name,
  ii.quantity,
  p.uom,
  ii.lot_number,
  ii.expiry_date
FROM inventory_items ii
JOIN products p ON ii.product_sku = p.sku
JOIN locations l ON ii.location_id = l.id
JOIN warehouse_zones wz ON l.zone_id = wz.id
JOIN warehouses w ON wz.warehouse_id = w.id
WHERE ii.quantity > 0
ORDER BY w.warehouse_name, wz.zone_name, l.location_code;
```

### Low Stock Alert
```sql
SELECT 
  p.sku,
  p.name,
  SUM(ii.quantity) as total_stock,
  COUNT(DISTINCT ii.location_id) as location_count
FROM products p
LEFT JOIN inventory_items ii ON p.sku = ii.product_sku
GROUP BY p.sku, p.name
HAVING SUM(ii.quantity) < 100 OR SUM(ii.quantity) IS NULL
ORDER BY total_stock ASC NULLS FIRST;
```

---

## 🚀 Implementation Priority

### Phase 1 (High Priority - Week 1)
- ✅ Location Assignment Dialog
- ✅ Generate QR for Product + Location
- ✅ Backend: Assign location endpoint
- ✅ Backend: Update location status

### Phase 2 (Medium Priority - Week 2)
- ⏳ CSV Import functionality
- ⏳ Validate CSV data
- ⏳ Bulk location assignment
- ⏳ Print QR labels in batch

### Phase 3 (Low Priority - Week 3)
- ⏳ Move product between locations
- ⏳ Split product quantity
- ⏳ Merge products at same location
- ⏳ Stock by location report

---

## 🧪 Testing Scenarios

### Test 1: Manual Product + Location Assignment
```
Given: Empty warehouse with 10 available locations
When: Add product "BTN-001" with 1000 pcs to location "01-01-01-01"
Then: 
  - Product created in database
  - Inventory item created with location link
  - Location status = OCCUPIED
  - QR code generated
  - QR contains correct SKU + Location
```

### Test 2: CSV Import with 50 Products
```
Given: CSV file with 50 products
When: Import CSV and auto-assign to Zone A
Then:
  - 50 products created
  - 50 inventory items created
  - 50 locations marked OCCUPIED
  - 50 QR codes generated
  - Import summary shows 50 success, 0 errors
```

### Test 3: Product in Multiple Locations
```
Given: Product "FABRIC-001" exists
When: Assign 500m to location "01-01-01-01" and 300m to "01-02-03-04"
Then:
  - 2 inventory items created
  - Total stock = 800m
  - 2 locations marked OCCUPIED
  - 2 different QR codes generated
```

---

## 📝 Next Steps

1. **Create migration** for `inventory_items` table enhancements
2. **Implement Location Assignment Dialog** (React component)
3. **Add API endpoints** for location assignment
4. **Implement QR generation** with product + location data
5. **Add CSV import** functionality
6. **Create batch QR printing** feature

---

**Status:** 📋 Planning Complete - Ready for Implementation  
**Estimated Effort:** 2-3 weeks (3 phases)  
**Dependencies:** Warehouse Configuration module (✅ Complete)
