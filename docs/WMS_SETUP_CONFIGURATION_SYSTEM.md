# 🎯 Sistem de Configurare și Setup WMS

## Viziune Generală

Sistemul WMS trebuie să permită configurarea completă a depozitului virtual să fie identic cu cel fizic, urmând un flux ghidat de setup inițial, apoi management continuu prin Admin Panel.

---

## 🧩 Module Principale

```
┌─────────────────────────────────────────────────────────────┐
│                    SETUP WIZARD                              │
│  (First-time configuration - Run once after deployment)     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    ADMIN PANEL                               │
│         (Ongoing management and configuration)               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  OPERATIONAL WMS                             │
│  (Daily operations: Receiving → Storage → Picking → Ship)   │
└─────────────────────────────────────────────────────────────┘
```

---

# 📋 PARTEA 1: Setup Wizard (First-Time Configuration)

## Wizard Steps (7 Pași)

### **Step 1: Company & Warehouse Info**

```typescript
interface CompanySetup {
  company_name: string;
  warehouse_name: string;
  warehouse_code: string;  // Ex: WH-NK-001
  address: {
    street: string;
    city: string;
    postal_code: string;
    country: string;
  };
  contact: {
    phone: string;
    email: string;
    manager_name: string;
  };
  timezone: string;        // Ex: Europe/Bucharest
  currency: string;        // Ex: RON
  measurement_system: 'METRIC' | 'IMPERIAL';
}
```

**UI:**
- Form simplu cu validare
- Map preview pentru adresă
- Language/currency selection

---

### **Step 2: Warehouse Layout & Dimensions**

```typescript
interface WarehouseLayout {
  total_area_sqm: number;
  height_meters: number;
  layout_type: 'SINGLE_FLOOR' | 'MULTI_FLOOR' | 'MEZZANINE';
  floors: Floor[];
}

interface Floor {
  floor_number: number;
  area_sqm: number;
  height_meters: number;
  name: string;  // Ex: "Ground Floor", "Floor 1"
}
```

**UI:**
- Visual grid builder
- Drag corners pentru dimensiuni
- 3D preview (optional)

---

### **Step 3: Warehouse Zones Definition**

Zonele logice ale depozitului conform fluxului de lucru.

```typescript
enum ZoneType {
  RECEIVING = 'RECEIVING',          // Zonă de primire mărfuri
  QUALITY_CONTROL = 'QC',           // Zonă control calitate
  STORAGE = 'STORAGE',              // Depozitare lungă durată
  PICKING = 'PICKING',              // Zonă de pregătire comenzi
  PACKING = 'PACKING',              // Zonă de ambalare
  SHIPPING = 'SHIPPING',            // Zonă de expediere
  RETURNS = 'RETURNS',              // Zonă de returnări
  QUARANTINE = 'QUARANTINE',        // Carantină (produse defecte)
  PRODUCTION = 'PRODUCTION',        // Zonă de producție/cutting
  STAGING = 'STAGING'               // Zonă de pregătire temporară
}

interface WarehouseZone {
  id: string;
  code: string;                     // Ex: RCV-01, STG-A, PICK-01
  name: string;
  zone_type: ZoneType;
  floor_number: number;
  coordinates: {
    x: number;                      // Coordonate pe hartă
    y: number;
    width: number;
    height: number;
  };
  capacity: {
    max_pallets?: number;
    max_volume_cubic_meters?: number;
  };
  temperature_controlled: boolean;
  restricted_access: boolean;       // Necesită autorizare specială
  assigned_users: string[];         // User IDs cu acces
}
```

**UI:**
- Visual map cu drag-and-drop zones
- Color-coded by zone_type
- Right panel pentru properties
- Template zones (Start with standard layout)

**Templates Predefinite:**
```
Standard Textile Warehouse:
┌──────────────────────────────────────┐
│  RECEIVING (RCV-01)  │  QC (QC-01)   │
├──────────────────────┼───────────────┤
│                      │               │
│    STORAGE (STG-A)   │ PRODUCTION    │
│    (Main Warehouse)  │  (PROD-01)    │
│                      │               │
├──────────────────────┼───────────────┤
│  PICKING (PICK-01)   │ PACKING       │
│                      │ (PACK-01)     │
├──────────────────────┴───────────────┤
│        SHIPPING (SHIP-01)            │
└──────────────────────────────────────┘
```

---

### **Step 4: Location Hierarchy & Naming Convention**

Sistema de locații ierarhică: Zone → Aisles → Racks → Shelves → Bins

```typescript
interface LocationNamingConvention {
  format: string;  // Ex: "{zone}-{aisle}{rack}-{shelf}{bin}"
  separator: string;  // Ex: "-"
  examples: string[];  // Ex: ["STG-A01-A1", "STG-A01-B2"]
}

interface LocationType {
  id: string;
  name: string;
  code: string;
  capacity_type: 'PALLET' | 'SHELF' | 'BIN' | 'FLOOR';
  max_weight_kg: number;
  max_volume_cubic_meters: number;
  dimensions: {
    width_cm: number;
    depth_cm: number;
    height_cm: number;
  };
}

interface Location {
  id: string;
  location_code: string;        // Ex: STG-A01-A1
  zone_id: string;
  location_type_id: string;
  
  // Hierarchy
  aisle?: string;               // Ex: A01, A02, B01
  rack?: string;                // Ex: 01, 02, 03
  shelf_level?: number;         // Ex: 1, 2, 3, 4
  bin_position?: string;        // Ex: A, B, C
  
  // Properties
  barcode: string;              // Generated barcode for scanning
  qr_code: string;              // Generated QR code
  
  // Capacity
  max_pallets: number;
  max_weight_kg: number;
  current_occupancy_percent: number;
  
  // Status
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'BLOCKED' | 'MAINTENANCE';
  is_pickable: boolean;         // Poate fi folosită pentru picking
  priority: number;             // 1=highest, folosit pentru optimizare rute
  
  // Physical properties
  temperature_controlled: boolean;
  requires_forklift: boolean;
  accessibility: 'GROUND' | 'LOW' | 'MEDIUM' | 'HIGH';
  
  // Tracking
  last_inventory_check: Date;
  assigned_products: string[];  // Product SKUs preferate pentru această locație
}
```

**UI: Location Builder Wizard**

**Step 4.1 - Define Naming Convention:**
```
Zone Prefix: [STG]  (Storage)
Aisle Format: [A][01-99]
Rack Format: [01-50]
Shelf Format: [A-E] (A=Ground, B=1m, C=2m, D=3m, E=4m)
Bin Format: [1-10]

Result Example: STG-A01-C3
                 │   │ │ │ └─ Bin 3
                 │   │ │ └─── Shelf C (2m height)
                 │   │ └───── Rack 01
                 │   └─────── Aisle A01
                 └─────────── Storage Zone
```

**Step 4.2 - Bulk Generate Locations:**
```
Zones: [Storage STG-A]
Aisles: A01 to A10 (10 aisles)
Racks per aisle: 20 racks (01-20)
Shelves per rack: 4 shelves (A, B, C, D)
Bins per shelf: 2 bins (1, 2)

Total Locations: 10 × 20 × 4 × 2 = 1,600 locations

Generate with Properties:
- Shelves A,B (Ground, 1m): Forklift Required, Max 500kg
- Shelves C,D (2m, 3m): Manual Access, Max 100kg
```

**Step 4.3 - Visual Map:**
```
Aisle A01:  [▓][░][▓][░][▓]...  (▓=Occupied, ░=Available)
Aisle A02:  [░][░][▓][▓][░]...
Aisle A03:  [▓][▓][░][░][░]...
...

Click location → Edit properties
Drag product → Assign to location
Right-click → Block/Maintenance
```

---

### **Step 5: Packaging Types & Units**

```typescript
interface PackagingType {
  id: string;
  code: string;              // DRUM, PALLET, BOX, ROLL
  name: string;              // "Tambur Textil", "Paleți EUR", "Cutie Carton"
  category: 'PRIMARY' | 'SECONDARY' | 'TERTIARY';
  
  // Dimensions
  dimensions: {
    width_cm: number;
    depth_cm: number;
    height_cm: number;
    weight_kg: number;        // Empty weight
    volume_liters: number;
  };
  
  // Capacity
  max_product_weight_kg: number;
  max_product_volume_liters: number;
  max_product_length_meters?: number;  // For rolls/drums
  
  // Standards
  is_standard: boolean;      // EUR pallet, ISO container, etc.
  standard_name?: string;    // "EUR Pallet 800x1200mm"
  
  // Handling
  requires_forklift: boolean;
  stackable: boolean;
  max_stack_height: number;
  
  // Reusability
  is_reusable: boolean;
  is_returnable: boolean;    // Client trebuie să returneze (ex: paleți)
  rental_cost_per_day?: number;
  
  // Tracking
  has_barcode: boolean;
  barcode_format?: string;   // Ex: "PKG-{TYPE}-{NUMBER}"
  
  // Inventory
  current_stock: number;     // Câte ambalaje libere avem
  min_stock_level: number;   // Alert când scade sub acest nivel
  cost_per_unit: number;     // Cost de achiziție
}
```

**Templates Predefinite:**

```typescript
const STANDARD_PACKAGING_TEMPLATES = [
  {
    code: 'EUR_PALLET',
    name: 'Paleți EUR 800x1200mm',
    dimensions: { width_cm: 80, depth_cm: 120, height_cm: 14.4, weight_kg: 25 },
    max_product_weight_kg: 1000,
    stackable: true,
    max_stack_height: 4,
    is_reusable: true,
    is_returnable: true
  },
  {
    code: 'DRUM_200L',
    name: 'Tambur Textil 200L',
    dimensions: { width_cm: 60, depth_cm: 60, height_cm: 90, weight_kg: 15 },
    max_product_length_meters: 500,
    is_reusable: true
  },
  {
    code: 'BOX_SMALL',
    name: 'Cutie Carton Mică 40x30x30cm',
    dimensions: { width_cm: 40, depth_cm: 30, height_cm: 30, weight_kg: 0.5 },
    max_product_weight_kg: 20,
    stackable: true,
    is_reusable: false
  },
  {
    code: 'ROLL_TUBE',
    name: 'Tub Carton pentru Role',
    dimensions: { width_cm: 10, depth_cm: 10, height_cm: 150, weight_kg: 1 },
    is_reusable: false
  }
];
```

**UI:**
- Grid cu toate packaging types
- Add New (from template sau custom)
- Visual preview cu dimensiuni 3D
- Inventory management pentru ambalaje
- Alert pentru stock scăzut

---

### **Step 6: Delivery Methods & Carriers**

```typescript
enum DeliveryMethod {
  COURIER = 'COURIER',              // Curier extern (FAN, DPD, UPS, etc.)
  INTERNAL_LOGISTICS = 'INTERNAL',  // Transport propriu cu mașină/camion
  CUSTOMER_PICKUP = 'PICKUP',       // Clientul vine să ridice
  DIRECT_DELIVERY = 'DIRECT',       // Livrare directă la client cu transport WMS
  DROP_SHIPPING = 'DROP_SHIP'       // Drop-shipping de la furnizor la client
}

interface ShippingCarrier {
  id: string;
  name: string;                     // Ex: "FAN Courier", "DPD Romania"
  code: string;                     // Ex: FAN, DPD, UPS
  carrier_type: 'COURIER' | 'FREIGHT' | 'POSTAL';
  
  // Contact
  contact: {
    phone: string;
    email: string;
    website: string;
    account_number?: string;        // Contul nostru la curier
  };
  
  // Services
  services: CarrierService[];
  
  // API Integration
  has_api_integration: boolean;
  api_credentials?: {
    api_key: string;
    api_secret: string;
    api_url: string;
  };
  
  // Pricing
  default_pricing_model: 'FLAT_RATE' | 'WEIGHT_BASED' | 'VOLUME_BASED' | 'ZONE_BASED';
  base_cost: number;
  cost_per_kg?: number;
  cost_per_km?: number;
  
  // Constraints
  max_weight_kg: number;
  max_dimensions: {
    length_cm: number;
    width_cm: number;
    height_cm: number;
  };
  
  // SLA
  standard_delivery_days: number;
  express_delivery_hours?: number;
  
  // Status
  is_active: boolean;
  preferred: boolean;               // Carrier preferat (folosit automat)
}

interface CarrierService {
  service_code: string;             // Ex: "STANDARD", "EXPRESS", "OVERNIGHT"
  service_name: string;             // Ex: "FAN Standard 24h", "DPD Express"
  delivery_time_hours: number;
  cost_multiplier: number;          // Ex: 1.0 = standard, 1.5 = express
  available_days: string[];         // ["Monday", "Tuesday", ...]
  cutoff_time: string;              // Ex: "16:00" (până când se acceptă comenzi)
}

interface DeliveryZone {
  id: string;
  name: string;                     // Ex: "București", "Ilfov", "Național"
  zone_type: 'LOCAL' | 'REGIONAL' | 'NATIONAL' | 'INTERNATIONAL';
  
  // Geographic coverage
  countries: string[];              // ISO country codes
  regions?: string[];               // Județe/Counties
  postal_codes?: string[];          // Postal code patterns
  cities?: string[];
  
  // Carriers
  available_carriers: {
    carrier_id: string;
    priority: number;               // 1=first choice
    estimated_days: number;
    cost_adjustment: number;        // +/- față de base cost
  }[];
  
  // Constraints
  min_order_value?: number;         // Comandă minimă pentru această zonă
  free_shipping_threshold?: number; // Valoare pentru transport gratuit
  max_delivery_days: number;
}

interface InternalVehicle {
  id: string;
  vehicle_code: string;             // Ex: "VAN-01", "TRUCK-02"
  vehicle_type: 'VAN' | 'TRUCK' | 'CAR' | 'MOTORCYCLE';
  
  // Details
  make: string;                     // Ex: "Mercedes Sprinter"
  model: string;
  license_plate: string;
  year: number;
  
  // Capacity
  max_weight_kg: number;
  max_volume_cubic_meters: number;
  max_pallets: number;
  
  // Features
  has_refrigeration: boolean;
  has_lift_gate: boolean;
  
  // Tracking
  gps_enabled: boolean;
  gps_device_id?: string;
  
  // Assignment
  assigned_driver_id?: string;
  current_status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
  current_location?: {
    latitude: number;
    longitude: number;
    last_update: Date;
  };
  
  // Costs
  cost_per_km: number;
  cost_per_hour: number;
  fuel_consumption_l_per_100km: number;
}
```

**UI: Delivery Configuration**

**Tab 1 - Carriers:**
```
┌─────────────────────────────────────────────────────────┐
│  Couriers Active:                        [+ Add Carrier] │
├─────────────────────────────────────────────────────────┤
│  ☑ FAN Courier           [Edit] [Test API] [Disable]    │
│     Standard: 24h, 15 RON base                           │
│     Express: 4h, 25 RON                                  │
│                                                           │
│  ☑ DPD Romania           [Edit] [Test API] [Disable]    │
│     Classic: 48h, 12 RON                                 │
│     Express: 24h, 20 RON                                 │
│                                                           │
│  ☐ UPS (Inactive)        [Edit] [Enable]                │
└─────────────────────────────────────────────────────────┘
```

**Tab 2 - Internal Fleet:**
```
┌─────────────────────────────────────────────────────────┐
│  Vehicles:                           [+ Add Vehicle]     │
├─────────────────────────────────────────────────────────┤
│  VAN-01  Mercedes Sprinter  [B-123-ABC]  ✓ Available    │
│    Driver: Ion Popescu     Max: 1000kg, 12 palets       │
│    Location: WH-NK-001     Fuel: 9.5L/100km            │
│                                          [Edit] [Track]  │
│                                                           │
│  TRUCK-01 MAN TGL  [B-456-DEF]  🔧 Maintenance          │
│    No driver assigned      Max: 5000kg, 33 palets       │
│                                          [Edit] [Track]  │
└─────────────────────────────────────────────────────────┘
```

**Tab 3 - Delivery Zones:**
```
┌─────────────────────────────────────────────────────────┐
│  Delivery Zones:                     [+ Add Zone]        │
├─────────────────────────────────────────────────────────┤
│  📍 București (Local)                                    │
│     Carriers: FAN (1), DPD (2), Internal (3)            │
│     Free shipping: > 500 RON                             │
│     Est. delivery: 24h                   [Edit] [Map]   │
│                                                           │
│  📍 Ilfov + Jud. limitrofe (Regional)                   │
│     Carriers: FAN (1), DPD (2)                          │
│     Free shipping: > 800 RON                             │
│     Est. delivery: 48h                   [Edit] [Map]   │
│                                                           │
│  📍 Național (National)                                  │
│     Carriers: DPD (1), FAN (2)                          │
│     Free shipping: > 1500 RON                            │
│     Est. delivery: 72h                   [Edit] [Map]   │
└─────────────────────────────────────────────────────────┘
```

---

### **Step 7: Review & Finish**

**Summary of Configuration:**

```
✓ Company: WMS NK
✓ Warehouse: WH-NK-001 (1,500 sqm)
✓ Zones: 8 zones configured
  - Receiving (RCV-01)
  - QC (QC-01)
  - Storage (STG-A, STG-B)
  - Production (PROD-01)
  - Packing (PACK-01)
  - Shipping (SHIP-01)

✓ Locations: 1,600 locations generated
  - Format: {ZONE}-{AISLE}{RACK}-{SHELF}{BIN}
  - Example: STG-A01-A1

✓ Packaging: 12 types configured
  - EUR Pallets: 150 in stock
  - Drums: 80 in stock
  - Boxes: 500 in stock

✓ Delivery Methods: 5 methods configured
  - FAN Courier (API integrated)
  - DPD Romania
  - Internal Fleet: 2 vehicles
  - Customer Pickup

✓ Workflows: Product flow configured
  Receiving → QC → Putaway → Storage → Picking → Packing → Shipping

[Finish Setup] [← Back] [Save as Template]
```

**Post-Setup Actions:**
- Generate barcodes pentru toate locations (PDF printabil)
- Generate QR codes pentru ambalaje
- Create admin user
- Send welcome email cu login credentials
- Redirect la Dashboard

---

# 🛠️ PARTEA 2: Admin Panel (Ongoing Management)

## Admin Dashboard Overview

```
┌─────────────────────────────────────────────────────────────┐
│  ⚙️ WMS Administration Panel                                │
├─────────────────────────────────────────────────────────────┤
│  📊 Quick Stats:                                             │
│    Total Locations: 1,600    Available: 1,234 (77%)        │
│    Active Products: 450       In Stock: 12,500 units       │
│    Today's Orders: 23         Pending Ship: 8              │
│    Warehouse Utilization: ████████░░ 82%                    │
└─────────────────────────────────────────────────────────────┘
```

## Admin Tabs

### **Tab 1: Warehouse Configuration**

**1.1 - Warehouse Info:**
- Edit basic info (name, address, contact)
- Multi-warehouse support (add new warehouses)
- Transfer rules between warehouses

**1.2 - Zones Management:**
```
Zone Editor:
┌────────────────────────────────────────┐
│  Visual Map                             │
│  ┌──────────┬──────────┐              │
│  │ RCV-01   │ QC-01    │              │
│  ├──────────┴──────────┤              │
│  │      STG-A          │              │
│  │                      │              │
│  └──────────────────────┘              │
│                                         │
│  [+ Add Zone] [Edit Selected] [Delete] │
└────────────────────────────────────────┘

Selected Zone: STG-A (Storage)
├─ Area: 800 sqm
├─ Capacity: 800 pallets
├─ Current Usage: 650 pallets (81%)
├─ Temperature: Ambient
└─ Access: All users

[Save Changes]
```

**1.3 - Zone Rules:**
- Product type restrictions (ce produse pot fi stocate)
- Auto-allocation rules (sistem alege automat locația)
- Priority rules pentru picking

---

### **Tab 2: Location Management**

**2.1 - Location Grid View:**
```
Filter: [Zone: STG-A ▼] [Status: All ▼] [Type: All ▼] [Search...]

┌──────────────┬────────┬──────────┬─────────────┬────────┐
│ Location     │ Zone   │ Type     │ Current     │ Status │
├──────────────┼────────┼──────────┼─────────────┼────────┤
│ STG-A01-A1   │ STG-A  │ Pallet   │ MAT-001     │ ✓ Occ  │
│ STG-A01-A2   │ STG-A  │ Pallet   │ Empty       │ ○ Avl  │
│ STG-A01-B1   │ STG-A  │ Shelf    │ MAT-003 (2) │ ✓ Occ  │
│ STG-A01-B2   │ STG-A  │ Shelf    │ Maintenance │ ✗ Blk  │
│ ...          │ ...    │ ...      │ ...         │ ...    │
└──────────────┴────────┴──────────┴─────────────┴────────┘

Bulk Actions: [☐ Select All] [Block] [Unblock] [Change Zone]
              [Export Barcodes] [Print Labels]
```

**2.2 - Location Details (Popup):**
```
Location: STG-A01-A1
├─ Zone: Storage A
├─ Aisle: A01, Rack: 01, Shelf: A (Ground)
├─ Dimensions: 120x80x200cm
├─ Max Weight: 500kg
├─ Current Occupancy: 1 pallet (MAT-001)
│  └─ Batch: BATCH-00001 (450m, DRUM T-2024-001)
├─ Accessibility: Forklift required
├─ Last inventory check: 2025-10-15 14:30
└─ Barcode: [🖼️ STG-A01-A1] [Print] [Generate QR]

[Edit Properties] [Block Location] [Move Contents]
```

**2.3 - Bulk Location Generator:**
- Add new aisles/racks/shelves
- Clone location patterns
- Auto-generate missing locations

---

### **Tab 3: Packaging Management**

**3.1 - Packaging Types:**
```
┌─────────────────────────────────────────────────────────┐
│  Packaging Inventory:                 [+ Add Type]       │
├─────────────────────────────────────────────────────────┤
│  🥁 DRUM (Tambur Textil)                                │
│     Stock: 75 / Min: 50  ⚠️ Order needed!              │
│     In Use: 120           Cost: 85 RON/unit            │
│     Reusable: Yes         [Edit] [Order] [History]     │
│                                                           │
│  📦 EUR_PALLET (Paleți EUR)                             │
│     Stock: 180 / Min: 100 ✓ OK                          │
│     In Use: 320           Rental: 2 RON/day            │
│     Returnable: Yes       [Edit] [Order] [History]     │
│                                                           │
│  📦 BOX_SMALL (Cutii Carton Mici)                       │
│     Stock: 450 / Min: 200 ✓ OK                          │
│     In Use: 50            Cost: 3 RON/unit             │
│     Reusable: No          [Edit] [Order] [History]     │
└─────────────────────────────────────────────────────────┘
```

**3.2 - Packaging Tracking:**
- Track individual packages (pentru returnabile)
- Damage reports
- Cleaning/maintenance schedule
- Rental tracking (client returnable pallets)

---

### **Tab 4: Delivery Configuration**

**4.1 - Carriers:**
- Add/edit/disable carriers
- Test API connections
- View rate cards
- Performance metrics (on-time delivery %, complaints)

**4.2 - Internal Fleet:**
- Add/edit vehicles
- Maintenance schedule
- Fuel tracking
- Driver assignments
- GPS tracking integration

**4.3 - Delivery Zones:**
- Edit zone boundaries (map editor)
- Adjust pricing by zone
- Set delivery time estimates
- Free shipping thresholds

**4.4 - Shipping Rules:**
```
Auto-Select Carrier Rules:
┌────────────────────────────────────────────────────────┐
│ Rule 1: Order < 30kg, București → FAN Express          │
│ Rule 2: Order > 30kg, București → Internal VAN-01     │
│ Rule 3: Order value > 1000 RON → Free shipping        │
│ Rule 4: Urgent orders → Always FAN Express            │
│ Rule 5: Default → Cheapest available carrier          │
└────────────────────────────────────────────────────────┘

[+ Add Rule] [Reorder Priority]
```

---

### **Tab 5: Workflow Configuration**

Product lifecycle workflow customization.

```typescript
enum WorkflowState {
  RECEIVING = 'RECEIVING',           // Primit la rampă
  QC_PENDING = 'QC_PENDING',        // Așteaptă control calitate
  QC_IN_PROGRESS = 'QC_IN_PROGRESS', // În control
  QC_APPROVED = 'QC_APPROVED',      // Aprobat
  QC_REJECTED = 'QC_REJECTED',      // Respins
  PUTAWAY_PENDING = 'PUTAWAY_PENDING', // Așteaptă plasare
  STORED = 'STORED',                // Stocat la locație
  PICKING_ALLOCATED = 'PICKING_ALLOCATED', // Alocat pentru comandă
  PICKING_IN_PROGRESS = 'PICKING_IN_PROGRESS', // Se preia
  PICKED = 'PICKED',                // Preluat
  PACKING_PENDING = 'PACKING_PENDING', // Așteaptă ambalare
  PACKING_IN_PROGRESS = 'PACKING_IN_PROGRESS', // Se ambalează
  PACKED = 'PACKED',                // Ambalat
  SHIPPING_PENDING = 'SHIPPING_PENDING', // Așteaptă ridicare
  SHIPPED = 'SHIPPED',              // Expediat
  DELIVERED = 'DELIVERED',          // Livrat
  RETURNED = 'RETURNED',            // Returnat
  QUARANTINE = 'QUARANTINE'         // În carantină
}

interface WorkflowTransition {
  from_state: WorkflowState;
  to_state: WorkflowState;
  required_role?: string;           // Doar anumite roluri pot face tranziția
  requires_approval?: boolean;
  auto_transition?: boolean;        // Se face automat
  conditions?: WorkflowCondition[];
  actions?: WorkflowAction[];       // Ce se întâmplă la tranziție
}

interface WorkflowAction {
  action_type: 'SEND_EMAIL' | 'UPDATE_LOCATION' | 'GENERATE_LABEL' | 'NOTIFY_USER' | 'CREATE_TASK';
  params: any;
}
```

**UI: Workflow Visual Editor**

```
┌─────────────────────────────────────────────────────────┐
│  Product Workflow States:                                │
│                                                           │
│   [RECEIVING] ──→ [QC_PENDING] ──→ [QC_IN_PROGRESS]    │
│                          │                ↓              │
│                          │         [QC_APPROVED]        │
│                          │                ↓              │
│                          │         [PUTAWAY_PENDING]    │
│                          │                ↓              │
│                          │         [STORED] ────────┐   │
│                          │                           │   │
│                          ↓                           │   │
│                   [QC_REJECTED] ──→ [QUARANTINE]    │   │
│                                                       │   │
│   ┌──────────────────────────────────────────────────┘   │
│   ↓                                                       │
│   [PICKING_ALLOCATED] ──→ [PICKING] ──→ [PICKED]       │
│                                            ↓              │
│                                     [PACKING_PENDING]    │
│                                            ↓              │
│                                     [PACKED]             │
│                                            ↓              │
│                                     [SHIPPING_PENDING]   │
│                                            ↓              │
│                                     [SHIPPED]            │
│                                            ↓              │
│                                     [DELIVERED]          │
│                                            │              │
│                                            ↓              │
│                                     [RETURNED] ──────────┤
│                                                           │
└─────────────────────────────────────────────────────────┘

Click state to edit transitions, conditions, and actions
[Export Workflow] [Import Template] [Reset to Default]
```

**Example Workflow Rules:**
```
State: QC_APPROVED → PUTAWAY_PENDING
├─ Auto-transition: Yes (immediately after QC approval)
├─ Actions:
│  ├─ Assign optimal location (based on product type, size, turnover)
│  ├─ Create putaway task for warehouse operator
│  ├─ Generate location barcode label
│  └─ Send notification to warehouse manager
└─ Required Role: QC Inspector

State: STORED → PICKING_ALLOCATED
├─ Trigger: When order is created
├─ Actions:
│  ├─ Reserve quantity in batch
│  ├─ Update location occupancy
│  ├─ Generate pick list
│  └─ Assign to picker (based on zone, workload)
└─ Required Role: System (automatic)

State: SHIPPED → DELIVERED
├─ Trigger: Manual confirmation or API from carrier
├─ Actions:
│  ├─ Send delivery confirmation email to customer
│  ├─ Update order status
│  ├─ Request customer feedback
│  └─ Release returnable packaging tracking
└─ Required Role: Shipping Manager or System
```

---

### **Tab 6: User & Role Management**

```typescript
enum UserRole {
  ADMIN = 'ADMIN',                  // Full access
  WAREHOUSE_MANAGER = 'MANAGER',    // Manage warehouse operations
  RECEIVING_CLERK = 'RECEIVING',    // Receive goods
  QC_INSPECTOR = 'QC',              // Quality control
  WAREHOUSE_OPERATOR = 'OPERATOR',  // Putaway, inventory
  PICKER = 'PICKER',                // Pick orders
  PACKER = 'PACKER',                // Pack orders
  SHIPPING_CLERK = 'SHIPPING',      // Ship orders
  DRIVER = 'DRIVER',                // Internal delivery driver
  VIEWER = 'VIEWER'                 // Read-only access
}

interface UserPermissions {
  user_id: string;
  role: UserRole;
  
  // Zone access
  accessible_zones: string[];       // Empty = all zones
  
  // Permissions
  can_receive: boolean;
  can_qc: boolean;
  can_putaway: boolean;
  can_pick: boolean;
  can_pack: boolean;
  can_ship: boolean;
  can_adjust_inventory: boolean;
  can_manage_locations: boolean;
  can_manage_users: boolean;
  can_view_reports: boolean;
  can_configure_system: boolean;
  
  // Mobile app access
  mobile_app_enabled: boolean;
  mobile_device_ids: string[];      // Registered devices
}
```

**UI:**
```
┌─────────────────────────────────────────────────────────┐
│  Users:                                  [+ Add User]    │
├─────────────────────────────────────────────────────────┤
│  👤 admin@wmsnk.ro                                       │
│     Role: Admin      Zones: All       Status: Active    │
│     Last login: 2025-10-29 08:15      [Edit] [Disable] │
│                                                           │
│  👤 ion.popescu@wmsnk.ro                                │
│     Role: Picker     Zones: STG-A     Status: Active    │
│     Last login: 2025-10-29 07:30      [Edit] [Disable] │
│     Mobile: ✓ Enabled (Device: Android SM-G998B)       │
│                                                           │
│  👤 maria.ionescu@wmsnk.ro                              │
│     Role: QC Inspector  Zones: QC-01  Status: Active    │
│     Last login: 2025-10-28 16:45      [Edit] [Disable] │
└─────────────────────────────────────────────────────────┘
```

---

### **Tab 7: Reports & Analytics**

Pre-configured reports:

1. **Warehouse Utilization Report**
   - Occupancy by zone/location
   - Trends over time
   - Heatmap visualization

2. **Inventory Accuracy Report**
   - System vs Physical inventory discrepancies
   - Cycle count results
   - Adjustment history

3. **Order Fulfillment Report**
   - Orders per day/week/month
   - Average pick time
   - Average pack time
   - On-time delivery %

4. **Shipping Cost Analysis**
   - Cost per carrier
   - Cost per delivery zone
   - ROI internal fleet vs couriers

5. **Product Movement Report**
   - Product velocity (fast/slow movers)
   - Location changes (how many times moved)
   - Optimal location suggestions

6. **Packaging Usage Report**
   - Packaging consumption
   - Reusable packaging turnover
   - Cost per package type

7. **Waste & Damage Report**
   - Waste during cutting/transformations
   - Damaged goods
   - Loss reasons

**UI: Report Generator**
```
┌─────────────────────────────────────────────────────────┐
│  Generate Report:                                        │
│  Report Type: [Warehouse Utilization ▼]                │
│  Period: [Last 30 days ▼]                               │
│  Zones: [All ▼]                                         │
│  Format: ○ PDF  ○ Excel  ● Web View                    │
│                                                           │
│  [Generate Report] [Schedule Email] [Export]            │
└─────────────────────────────────────────────────────────┘
```

---

# 🔄 PARTEA 3: Operational WMS (Daily Workflow)

## Complete Product Lifecycle

### **1. RECEIVING (Primire Mărfuri)**

**Process:**
```
1. Carrier arrives → Scan QR at gate
2. Receiving clerk opens "Receiving" module
3. Expected deliveries list (based on POs)
4. Scan product barcode → Auto-fill details
5. Enter quantity received
6. Select packaging type (drum, pallet, box)
7. Generate receiving label with barcode
8. System auto-assigns temporary location (RCV-01-TEMP-01)
9. Move to QC zone
```

**UI: Mobile App - Receiving Screen**
```
┌─────────────────────────────────────┐
│ 📦 Receiving                         │
├─────────────────────────────────────┤
│ Expected Today: 3 deliveries        │
│                                      │
│ PO-2025-001 - Supplier: TextilCo   │
│ ├─ MAT-001: 500m (Expected)        │
│ └─ Status: Pending                  │
│     [📷 Scan Product]               │
│                                      │
│ ─────────────────────────────────   │
│ Product: MAT-001                    │
│ Expected: 500m                      │
│ Received: [____] m                  │
│ Packaging: [DRUM ▼]                │
│ Condition: ○ Good ○ Damaged        │
│ Notes: [________________]           │
│                                      │
│ [✓ Confirm Receipt] [✗ Cancel]     │
└─────────────────────────────────────┘
```

---

### **2. QUALITY CONTROL**

**Process:**
```
1. QC Inspector gets notification
2. Open "QC Pending" queue
3. Scan product barcode
4. Perform inspections (visual, measurements, tests)
5. Record findings
6. Decision: APPROVE or REJECT
   - If REJECT → Move to QUARANTINE
   - If APPROVE → System suggests putaway location
```

**UI: QC Inspection Screen**
```
┌─────────────────────────────────────┐
│ 🔍 Quality Control                   │
├─────────────────────────────────────┤
│ Batch: BATCH-00125                  │
│ Product: MAT-001 (Material Textil)  │
│ Quantity: 500m                      │
│ Received: 2025-10-29 08:30          │
│                                      │
│ Inspection Checklist:               │
│ ☑ Visual inspection - OK            │
│ ☑ Color match - OK                  │
│ ☑ Width measurement: 150cm ✓        │
│ ☑ Texture check - OK                │
│ ☐ Tear test                         │
│                                      │
│ Defects Found: [None______]        │
│ Photos: [📷 Add Photo]              │
│                                      │
│ Decision:                            │
│ [✓ APPROVE] [✗ REJECT]              │
└─────────────────────────────────────┘
```

---

### **3. PUTAWAY (Plasare în Depozit)**

**Process:**
```
1. QC approved → System suggests optimal location
2. Warehouse operator gets putaway task
3. Load product on forklift
4. Navigate to suggested location
5. Scan location barcode to confirm
6. Place product
7. Scan product barcode to confirm
8. System updates: Batch status = STORED
```

**Location Selection Algorithm:**
```typescript
function suggestOptimalLocation(product: Product, batch: Batch): Location {
  const criteria = {
    // 1. Product-specific location preferences
    preferredLocations: product.preferred_locations,
    
    // 2. Product characteristics
    needsForklift: batch.unit_type === 'PALLET',
    isHeavy: batch.weight_kg > 100,
    isBulky: batch.dimensions.volume > 1.0,
    
    // 3. Turnover velocity
    isFastMover: product.avg_daily_orders > 10,
    isSlowMover: product.avg_daily_orders < 1,
    
    // 4. Similar products proximity (same category)
    category: product.category,
    
    // 5. Available capacity
    requiresCapacity: batch.dimensions
  };
  
  // Fast movers → Ground level, near picking zone
  // Slow movers → Higher shelves, deeper in storage
  // Heavy/Bulky → Ground level, forklift accessible
  
  return locationService.findOptimal(criteria);
}
```

**UI: Putaway Task**
```
┌─────────────────────────────────────┐
│ 📍 Putaway Task #PT-125             │
├─────────────────────────────────────┤
│ Product: MAT-001                    │
│ Batch: BATCH-00125 (500m, DRUM)    │
│ Current: RCV-01-TEMP-01             │
│                                      │
│ ➜ Suggested Location:               │
│   STG-A03-B2                        │
│   (Aisle A03, Rack 3, Shelf B)     │
│                                      │
│ [🗺️ View Map] [📷 Scan Location]   │
│                                      │
│ Alternative Locations:              │
│ - STG-A03-B3 (Same rack)           │
│ - STG-A04-B2 (Next aisle)          │
│                                      │
│ [✓ Confirm Putaway] [✗ Cancel]     │
└─────────────────────────────────────┘
```

---

### **4. STORAGE (Stocare)**

**Process:**
- Product is now stored at location
- System tracks:
  - Location occupancy
  - Batch aging
  - Inventory levels
- Background jobs:
  - Auto-reorder alerts
  - Cycle count scheduling
  - Slow mover identification

---

### **5. ORDER PICKING**

**Process:**
```
1. Customer order arrives
2. System allocates inventory (batch selection algorithm)
3. Generate pick list (optimized route)
4. Picker receives task on mobile app
5. Navigate to each location
6. Scan location → Scan product → Enter quantity
7. Place in cart/tote
8. Complete pick → Move to packing zone
```

**Pick List Optimization:**
```typescript
// S-shape routing through aisles
function generateOptimizedPickList(orderLines: OrderLine[]): PickTask[] {
  // 1. Group by zone
  // 2. Sort by aisle number
  // 3. Alternate direction per aisle (S-shape)
  // 4. Minimize travel distance
  
  return optimizedTasks;
}
```

**UI: Picking Screen**
```
┌─────────────────────────────────────┐
│ 📦 Pick Order #SO-2025-0156         │
├─────────────────────────────────────┤
│ Customer: Textile SRL               │
│ Priority: ⚡ HIGH                    │
│ Items: 3 / 5 picked                 │
│                                      │
│ Current Task:                       │
│ ➜ Go to: STG-A05-C3                │
│   Product: MAT-003                  │
│   Required: 120m                    │
│   Batch: BATCH-00087                │
│                                      │
│ [📷 Scan Location]                  │
│                                      │
│ Next Tasks:                         │
│ 1. STG-A08-B1 - MAT-005 (50m)      │
│ 2. STG-B02-A2 - MAT-012 (200m)     │
│                                      │
│ [✓ Confirm Pick] [⚠️ Issue]        │
└─────────────────────────────────────┘
```

---

### **6. PACKING**

**Process:**
```
1. Picked items arrive at packing station
2. Scan order barcode
3. Select packaging (box, pallet, custom)
4. Pack items + add documentation
5. Weigh package
6. Generate shipping label
7. Place in shipping zone
```

**UI: Packing Station**
```
┌─────────────────────────────────────┐
│ 📦 Packing Station 01               │
├─────────────────────────────────────┤
│ Order: #SO-2025-0156                │
│ Customer: Textile SRL               │
│ Shipping: FAN Courier Express       │
│                                      │
│ Items to Pack: (5 items)            │
│ ☑ MAT-001 - 80m                     │
│ ☑ MAT-003 - 120m                    │
│ ☑ MAT-005 - 50m                     │
│ ☐ MAT-007 - 30m                     │
│ ☐ MAT-012 - 200m                    │
│                                      │
│ Packaging:                           │
│ [BOX_MEDIUM ▼] Qty: [2]            │
│ [EUR_PALLET ▼] Qty: [1]            │
│                                      │
│ Weight: [___] kg                    │
│ Dimensions: [___]x[___]x[___] cm   │
│                                      │
│ [🖨️ Print Shipping Label]          │
│ [✓ Complete Packing]                │
└─────────────────────────────────────┘
```

---

### **7. SHIPPING**

**Process:**
```
1. Packed orders in shipping zone
2. Carrier pickup scheduled
3. Driver/Courier arrives
4. Scan packages to load
5. Confirm shipment
6. System sends tracking info to customer
7. Status: SHIPPED
```

**UI: Shipping Dashboard**
```
┌─────────────────────────────────────────────────────────┐
│ 🚚 Shipping Dashboard                                    │
├─────────────────────────────────────────────────────────┤
│ Today's Shipments: 23 orders                            │
│ ✓ Shipped: 15    📦 Ready: 8    ⏳ Pending Pack: 0    │
│                                                           │
│ Scheduled Pickups:                                       │
│ ├─ 14:00 - FAN Courier (12 packages)                   │
│ ├─ 16:00 - DPD (3 packages)                            │
│ └─ 16:30 - Internal VAN-01 (8 packages, local)         │
│                                                           │
│ Ready to Ship:                                           │
│ ┌───────────────────────────────────────────────────┐  │
│ │ #SO-2025-0156  Textile SRL   FAN Express  12.5kg │  │
│ │ [📷 Scan] [✓ Load]                                │  │
│ ├───────────────────────────────────────────────────┤  │
│ │ #SO-2025-0157  Design Co.    DPD Classic   8kg   │  │
│ │ [📷 Scan] [✓ Load]                                │  │
│ └───────────────────────────────────────────────────┘  │
│                                                           │
│ [🖨️ Print Manifests] [📧 Notify Carriers]              │
└─────────────────────────────────────────────────────────┘
```

---

### **8. RETURNS (Returnări)**

**Process:**
```
1. Customer initiates return
2. Return authorization (RMA) created
3. Customer ships back
4. Receive at returns zone (RETURNS-01)
5. QC inspection
6. Decision:
   - Restockable → Putaway back to storage
   - Damaged → Quarantine
   - Defective → Scrap/Vendor return
```

**UI: Returns Processing**
```
┌─────────────────────────────────────┐
│ ↩️ Process Return                    │
├─────────────────────────────────────┤
│ RMA: #RMA-2025-0023                 │
│ Original Order: #SO-2025-0142       │
│ Customer: Design Co.                │
│ Reason: Wrong color                 │
│                                      │
│ Items Returned:                     │
│ ☑ MAT-007 - 30m (Opened)           │
│ Condition: [Good ▼]                │
│                                      │
│ QC Decision:                        │
│ ○ Restock to Inventory              │
│ ○ Quarantine (Damaged)              │
│ ○ Scrap (Not Resalable)            │
│                                      │
│ Refund: ☑ Issue refund (450 RON)   │
│                                      │
│ [✓ Process Return] [✗ Cancel]      │
└─────────────────────────────────────┘
```

---

## 🎯 Auto-Optimization Features

### **1. Dynamic Location Assignment**

System learns over time:
- Fast-moving products → Move to golden zone (ground level, near picking)
- Slow-moving products → Move to upper shelves
- Seasonal products → Relocate based on demand

### **2. Pick Path Optimization**

- S-shape routing (most efficient for typical warehouse)
- Return routing (if picking multiple orders)
- Zone-based batch picking (group orders by zone)

### **3. Replenishment Alerts**

```typescript
// Auto-generate replenishment tasks
if (location.current_quantity < location.min_quantity) {
  createReplenishmentTask({
    from_location: bulkStorageLocation,
    to_location: pickingLocation,
    quantity: location.max_quantity - location.current_quantity
  });
}
```

### **4. Cycle Counting Schedule**

- ABC analysis: A items (high value) → Count weekly
- B items → Count monthly
- C items → Count quarterly

### **5. Expiry Management (FEFO - First Expired, First Out)**

For products with expiry dates:
```typescript
function selectBatchForPicking(product_sku: string): Batch {
  return batches
    .filter(b => b.product_sku === product_sku && b.current_quantity > 0)
    .sort((a, b) => a.expiry_date - b.expiry_date)
    [0];
}
```

---

# 📊 KPIs & Metrics Dashboard

```
┌─────────────────────────────────────────────────────────┐
│ 📈 WMS Performance Dashboard                            │
├─────────────────────────────────────────────────────────┤
│ Today's Overview:                                        │
│ ├─ Orders Shipped: 23 / 25 (92%)                       │
│ ├─ Picking Accuracy: 99.2%                             │
│ ├─ Avg Pick Time: 4.2 min/order                        │
│ ├─ Warehouse Utilization: 82%                          │
│ └─ Inventory Accuracy: 98.5%                           │
│                                                           │
│ Alerts: ⚠️                                              │
│ ├─ DRUM packaging stock low (75 / min 100)            │
│ ├─ 2 locations require cycle count                     │
│ └─ VAN-01 due for maintenance in 3 days               │
│                                                           │
│ Performance Trends: [Last 30 days]                      │
│ Orders: ▂▃▅▆▇▆▅▄▃▂▃▄▅▇█▇▆▅▄▃▂▃▄▅▆▇  (↗️ +12%)         │
│ Accuracy: ████████████████████████  (↗️ +2.3%)        │
│                                                           │
│ [View Detailed Reports] [Export Data]                  │
└─────────────────────────────────────────────────────────┘
```

---

# 🚀 Implementation Roadmap

## Phase 1: Database & Backend (2-3 weeks)
- [ ] Create all configuration tables
- [ ] Build API endpoints pentru setup wizard
- [ ] Build API endpoints pentru admin panel
- [ ] Implement location optimization algorithms
- [ ] Implement workflow state machine

## Phase 2: Setup Wizard (2 weeks)
- [ ] Multi-step wizard component
- [ ] Visual map builder pentru zones
- [ ] Bulk location generator
- [ ] Packaging types manager
- [ ] Delivery configuration
- [ ] Review & finish screen

## Phase 3: Admin Panel (3 weeks)
- [ ] Warehouse configuration UI
- [ ] Location management grid
- [ ] Packaging inventory tracker
- [ ] Delivery & carrier management
- [ ] Workflow visual editor
- [ ] User & permissions management
- [ ] Reports dashboard

## Phase 4: Operational WMS (4 weeks)
- [ ] Receiving mobile app
- [ ] QC inspection screens
- [ ] Putaway task manager
- [ ] Picking mobile app (optimized routes)
- [ ] Packing station UI
- [ ] Shipping dashboard
- [ ] Returns processing

## Phase 5: Advanced Features (2-3 weeks)
- [ ] Barcode/QR generation & printing
- [ ] 3D warehouse visualization
- [ ] GPS tracking integration pentru internal fleet
- [ ] Carrier API integrations (FAN, DPD, etc.)
- [ ] Auto-optimization algorithms
- [ ] Advanced reporting & analytics
- [ ] Mobile apps (iOS & Android)

---

**Total Estimated Time: 13-15 weeks pentru sistem complet**

Începem cu **Setup Wizard** și **Database Schema**?
