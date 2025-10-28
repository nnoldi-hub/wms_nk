# WMS-NKS Mobile App

React Native mobile application for warehouse operators to manage inventory operations.

## Features

### ✅ Implemented
- **Authentication** - Login with JWT tokens
- **Dashboard** - Quick access menu with role-based actions
- **Barcode Scanner** - Camera-based QR/Barcode scanning
- **Products** - View, search, and browse all products
- **Product Details** - Complete product information with stock levels per location
- **Navigation** - Bottom tabs and stack navigation
- **API Integration** - Full integration with Kong Gateway (port 8000)
- **Token Management** - Automatic token refresh on expiry
- **Offline Support** - AsyncStorage for local data persistence

### 🚧 In Progress (Placeholders Ready)
- **Locations Screen** - Browse warehouse locations
- **Location Details** - View location contents and capacity
- **Movements Screen** - Create stock transfers
- **History Screen** - View movement history

## Screenshots

```
Login → Dashboard → Scanner → Products → Details
  ↓         ↓          ↓          ↓          ↓
[JWT]   [4 Tiles]  [Camera]  [List]   [Stock Info]
                                         [Locations]
                                         [Actions]
```

## Tech Stack

- **Framework**: React Native (Expo SDK 51)
- **Navigation**: React Navigation 6
- **State Management**: React Context API
- **HTTP Client**: Axios
- **Form Handling**: Formik + Yup
- **Storage**: AsyncStorage
- **Camera**: expo-camera
- **Barcode**: expo-barcode-scanner

## Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI
- iOS Simulator (Mac) or Android Emulator
- Running WMS backend services (Kong Gateway on port 8000)

## Installation

```bash
# Navigate to mobile directory
cd mobile

# Install dependencies
npm install

# Or with yarn
yarn install
```

## Configuration

Update API endpoint in `src/config/config.js`:

```javascript
export const API_CONFIG = {
  BASE_URL: 'http://localhost:8000', // Kong Gateway
  // For Android emulator: 'http://10.0.2.2:8000'
  // For iOS simulator: 'http://localhost:8000'
  // For physical device: 'http://YOUR_IP:8000'
};
```

## Running the App

### Development Mode

```bash
# Start Expo development server
npm start

# Or
expo start
```

Then choose platform:
- Press `i` for iOS Simulator
- Press `a` for Android Emulator
- Scan QR code with Expo Go app on physical device

### Platform-Specific

```bash
# iOS
npm run ios

# Android
npm run android

# Web
npm run web
```

## Project Structure

```
mobile/
├── App.js                          # Root component
├── app.json                        # Expo configuration
├── package.json                    # Dependencies
├── babel.config.js                 # Babel configuration
└── src/
    ├── config/
    │   └── config.js              # App configuration
    ├── context/
    │   └── AuthContext.js         # Authentication context
    ├── navigation/
    │   └── AppNavigator.js        # Navigation setup
    ├── screens/
    │   ├── LoginScreen.js         # Login with JWT
    │   ├── HomeScreen.js          # Dashboard menu
    │   ├── ScannerScreen.js       # Barcode scanner
    │   ├── ProductsScreen.js      # Products list
    │   ├── ProductDetailsScreen.js # Product details
    │   ├── LocationsScreen.js     # Locations (placeholder)
    │   ├── LocationDetailsScreen.js # Location details (placeholder)
    │   ├── MovementsScreen.js     # Create movement (placeholder)
    │   └── HistoryScreen.js       # Movement history (placeholder)
    └── services/
        └── api.js                 # API client with interceptors
```

## API Endpoints Used

### Authentication
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh token
- `POST /api/v1/auth/logout` - Logout

### Products
- `GET /api/v1/products` - List products (paginated, searchable)
- `GET /api/v1/products/sku/:sku` - Get product details

### Locations
- `GET /api/v1/locations` - List locations
- `GET /api/v1/locations/:id` - Get location details

### Movements
- `GET /api/v1/movements` - Movement history
- `POST /api/v1/movements` - Create movement
- `POST /api/v1/movements/adjust` - Adjust inventory

## Features Walkthrough

### 1. Login
- Enter username and password
- JWT tokens stored in AsyncStorage
- Automatic navigation to dashboard

### 2. Dashboard
- Role-based menu tiles
- Quick access to main features
- User info display
- Logout button

### 3. Scanner
- Camera access with permissions
- Real-time barcode/QR scanning
- Automatic product/location lookup
- Navigate to details on successful scan

### 4. Products
- Paginated list with infinite scroll
- Search by SKU/name/description
- Pull-to-refresh
- Tap to view details

### 5. Product Details
- Complete product information
- Stock levels by location
- Lot numbers and expiry dates
- Reserved quantity tracking
- Move stock action button

## Testing

### Test Users
```
Admin:
- Username: admin
- Password: Admin123!
- Role: admin (full access)

Operator:
- Username: operator1
- Password: Operator123!
- Role: operator (limited access)
```

### Test Flow
1. Login with admin/Admin123!
2. Scan product PROD-001
3. View product details and locations
4. Browse products list
5. Search for specific products
6. Navigate back to dashboard

## Troubleshooting

### Camera Permissions
```
Error: Camera permission not granted
Solution: Allow camera permission in device settings
```

### Network Connection
```
Error: Network Error
Solution: 
- Check backend services are running (Kong on port 8000)
- For Android emulator, use http://10.0.2.2:8000
- For physical device, use your computer's IP address
- Ensure device and computer are on same network
```

### Token Expiry
```
Error: 401 Unauthorized
Solution: App automatically refreshes token, or logout/login again
```

### Build Errors
```bash
# Clear cache
expo start -c

# Reinstall dependencies
rm -rf node_modules
npm install
```

## Development Workflow

### Adding New Screens
1. Create screen component in `src/screens/`
2. Import in `AppNavigator.js`
3. Add to Stack.Navigator or Tab.Navigator
4. Add navigation actions from other screens

### Adding API Endpoints
1. Define endpoint in `src/config/config.js`
2. Create API function in `src/services/api.js`
3. Use in screen components with try/catch

### Styling Guidelines
- Use colors from `APP_CONFIG.COLORS`
- Follow existing card/button patterns
- Maintain consistent spacing (16px base)
- Use StyleSheet.create for performance

## Next Steps

### Priority Features
1. **Implement LocationsScreen** - Browse warehouse locations
2. **Implement MovementsScreen** - Create stock transfers with form
3. **Implement HistoryScreen** - View movement history with filters
4. **Add Adjust Inventory** - Manual stock corrections
5. **Add Notifications** - Push notifications for important events
6. **Add Offline Mode** - Queue operations when offline
7. **Add Multi-language** - i18n support

### Enhancements
- [ ] Biometric authentication (Face ID/Touch ID)
- [ ] Dark mode support
- [ ] Landscape mode for tablets
- [ ] Print labels functionality
- [ ] Export data to CSV
- [ ] Batch scanning mode
- [ ] Voice commands
- [ ] Analytics dashboard

## Building for Production

### Android APK
```bash
# Build APK
expo build:android

# Or with EAS Build
eas build --platform android
```

### iOS IPA
```bash
# Build IPA (requires Apple Developer account)
expo build:ios

# Or with EAS Build
eas build --platform ios
```

## Environment Variables

Create `.env` file:
```
API_BASE_URL=http://YOUR_IP:8000
API_TIMEOUT=30000
```

## Performance Tips

- Use `FlatList` for long lists (already implemented)
- Implement pagination (already implemented)
- Optimize images with expo-image
- Use React.memo for expensive components
- Debounce search inputs
- Cache API responses

## Contributing

1. Create feature branch
2. Implement feature with tests
3. Follow existing code style
4. Update documentation
5. Submit pull request

## License

Proprietary - WMS-NKS Team

## Support

For issues or questions:
- Check troubleshooting section
- Review API documentation
- Contact backend team for API issues
