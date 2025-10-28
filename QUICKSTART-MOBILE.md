# Quick Start Guide - WMS-NKS Mobile App

## Test Mobile App in 5 Minutes

### Prerequisites Check
```powershell
# 1. Verify backend services running
docker ps | Select-String "wms-auth|wms-inventory|wms-kong"

# Expected: 3 containers RUNNING
# - wms-auth (port 3010)
# - wms-inventory (port 3011)
# - wms-kong (port 8000)

# 2. Test Kong Gateway
Invoke-RestMethod -Uri http://localhost:8001 | Select-Object version
# Expected: version: 3.8.0
```

### Install & Run Mobile App

```bash
# Navigate to mobile directory
cd mobile

# Install dependencies (first time only)
npm install

# Start Expo development server
npm start
```

### Testing Options

#### Option 1: iOS Simulator (Mac Only)
```bash
# Press 'i' in Expo terminal
# Or run:
npm run ios
```

#### Option 2: Android Emulator
```bash
# Start Android emulator first, then:
# Press 'a' in Expo terminal
# Or run:
npm run android
```

#### Option 3: Physical Device (Recommended)
1. Install **Expo Go** app from App Store/Play Store
2. Scan QR code shown in terminal
3. App will load automatically

### Configuration for Physical Device

**IMPORTANT**: Update API endpoint for your network IP

1. Find your computer's IP address:
```powershell
# Windows
ipconfig | Select-String "IPv4"

# Expected output: 192.168.x.x
```

2. Edit `mobile/src/config/config.js`:
```javascript
export const API_CONFIG = {
  BASE_URL: 'http://192.168.x.x:8000', // Replace with YOUR IP
  // ...
};
```

3. Restart Expo:
```bash
# Press 'r' in Expo terminal to reload
```

### Test Flow

#### 1. Login
- **Username**: `admin`
- **Password**: `Admin123!`
- Tap **Login** button

Expected: Navigate to Dashboard

#### 2. Browse Products
- Tap **Products** tab (bottom navigation)
- See list of 5 products
- Pull down to refresh
- Tap search icon, type "PROD"

Expected: Filtered products

#### 3. View Product Details
- Tap on **PROD-001** card
- See product details
- See 2 locations with quantities
- See dimensions (weight, size)

Expected: Complete product information

#### 4. Scan Barcode
- Tap **Scanner** tab (bottom navigation)
- Allow camera permission if prompted
- Point camera at barcode/QR code
- Or scan: **PROD-001** (if you have test codes)

Expected: Automatic navigation to product details

#### 5. Dashboard
- Tap **Home** tab
- See 5 menu tiles
- See your username (admin)
- See role badge (ADMIN)

Expected: Dashboard with menu

### Creating Test QR Codes

Generate QR codes online for testing:
- URL: https://www.qr-code-generator.com/
- Text: `PROD-001`, `PROD-002`, `LOC-A01-R01-P01`, etc.
- Print or display on another device
- Scan with mobile app

### Troubleshooting

#### Cannot connect to API
```javascript
// For Android Emulator, use:
BASE_URL: 'http://10.0.2.2:8000'

// For iOS Simulator, use:
BASE_URL: 'http://localhost:8000'

// For Physical Device, use your computer's IP:
BASE_URL: 'http://192.168.1.100:8000' // CHANGE THIS
```

#### Camera not working
```
1. Go to device Settings
2. Find Expo Go app
3. Enable Camera permission
4. Restart app
```

#### Login fails
```powershell
# Test backend directly:
$body = @{ username = "admin"; password = "Admin123!" } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:8000/api/v1/auth/login -Method Post -Body $body -ContentType "application/json"

# Expected: accessToken, refreshToken, user object
```

#### Products not loading
```powershell
# Test products endpoint:
Invoke-RestMethod -Uri http://localhost:8000/api/v1/products

# Expected: 401 Unauthorized (need token - this is correct)

# Test with token:
$token = "YOUR_TOKEN_HERE"
$headers = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Uri http://localhost:8000/api/v1/products -Headers $headers

# Expected: success: true, data: [array of products]
```

### Network Setup for Physical Device

Both device and computer MUST be on same WiFi network:

1. **Computer**: Connect to WiFi (not Ethernet)
2. **Mobile Device**: Connect to SAME WiFi
3. **Find Computer IP**: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
4. **Update Mobile Config**: Change `BASE_URL` to `http://YOUR_IP:8000`
5. **Restart Expo**: Press `r` in terminal

### Development Tips

#### Hot Reload
- Shake device to open developer menu
- Tap "Reload" to refresh app
- Or press `r` in Expo terminal

#### Debug Console
- Open developer menu
- Tap "Debug Remote JS"
- Opens Chrome DevTools
- See console.log() outputs

#### Clear Cache
```bash
# If app behaves strangely:
expo start -c
```

### Next Steps After Testing

Once mobile app works:

1. **Implement MovementsScreen**
   - Create form for stock transfers
   - Select product, from/to location, quantity
   - Submit to API

2. **Implement HistoryScreen**
   - Show movement history
   - Filters by date, product, location
   - Pagination

3. **Implement LocationsScreen**
   - List all warehouse locations
   - Show capacity and contents
   - Navigate to details

4. **Add Offline Mode**
   - Queue operations when offline
   - Sync when connection restored

### Demo Data

Current test data in database:

**Products**:
- PROD-001 (Laptop Dell XPS 15) - 50 units in LOC-A01-R01-P01
- PROD-002 - Not in stock
- MAT-001, MAT-002, MAT-003 - Materials

**Locations**:
- LOC-A01-R01-P01 (40 units PROD-001)
- R01-A1 (10 units PROD-001)
- R01-A2, R02-B1, R02-B2, R03-C1 (empty)

**Movements**:
- ADJUSTMENT: +50 units PROD-001 to LOC-A01-R01-P01
- TRANSFER: 10 units from LOC-A01-R01-P01 to R01-A1

### Screenshots Expected

**Login Screen**:
- WMS-NKS title
- Username input
- Password input
- Login button
- Version number

**Dashboard**:
- User greeting: "Hello, admin"
- Role badge: "ADMIN"
- 5 tiles: Scan, Products, Locations, Movements, History
- Logout button

**Scanner**:
- Camera view
- Scan frame with corners
- "Align barcode within frame" text
- Back button (X)

**Products List**:
- Search bar with icon
- Product cards with SKU, name, quantity
- Pull-to-refresh
- Infinite scroll

**Product Details**:
- SKU badge
- Product name (large)
- Description
- Stock info card
- Dimensions card
- Locations list (zone/rack/position)
- "Move Stock" button

### Performance Check

App should:
- ✅ Load products in <2 seconds
- ✅ Navigate between screens instantly
- ✅ Scan barcodes within 1 second
- ✅ Login within 1 second
- ✅ Refresh products list within 1 second

If slower, check:
- Backend services health
- Network connection
- Device performance

### Support

**Common Issues**:
1. "Cannot connect" → Check IP address in config
2. "401 Unauthorized" → Token expired, login again
3. "Camera permission denied" → Enable in settings
4. "Expo Go not loading" → Ensure same WiFi network
5. "Products empty" → Check backend data exists

**Logs**:
```bash
# Expo logs
# Shown in terminal where you ran 'npm start'

# Backend logs
cd c:\Proiecte\WMS NK
.\scripts\wms.ps1 logs inventory

# Kong logs
docker logs wms-kong
```

**Success Criteria**:
- ✅ Login successful
- ✅ Dashboard shows menu
- ✅ Products list loads
- ✅ Product details displays
- ✅ Scanner opens camera
- ✅ Navigation works smoothly

---

## Ready to Start!

```bash
cd mobile
npm install
npm start

# Then scan QR code or press 'i' for iOS / 'a' for Android
```

🎉 **Enjoy testing WMS-NKS Mobile App!**
