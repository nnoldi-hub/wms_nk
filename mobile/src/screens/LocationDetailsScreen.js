import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { locationsAPI } from '../services/api';
import { APP_CONFIG } from '../config/config';

const LocationDetailsScreen = ({ route, navigation }) => {
  const { locationId, scannedCode } = route.params || {};
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLocation();
  }, [locationId, scannedCode]);

  const loadLocation = async () => {
    const id = locationId || scannedCode;
    if (!id) {
      Alert.alert('Error', 'No location ID provided');
      navigation.goBack();
      return;
    }

    try {
      const response = await locationsAPI.getById(id);
      if (response.data.success) {
        setLocation(response.data.data);
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to load location');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={APP_CONFIG.COLORS.PRIMARY} />
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>Location not found</Text>
      </View>
    );
  }

  const totalQuantity = location.products?.reduce(
    (sum, prod) => sum + parseFloat(prod.quantity || 0), 
    0
  ) || 0;
  const isActive = location.is_active !== false;
  const productCount = location.products?.length || 0;

  return (
    <ScrollView style={styles.container}>
      {/* Header Card */}
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.locationId}>{location.id}</Text>
          <View style={[styles.badge, !isActive && styles.badgeInactive]}>
            <Text style={styles.badgeText}>
              {isActive ? 'ACTIVE' : 'INACTIVE'}
            </Text>
          </View>
        </View>

        {/* Location Path */}
        <View style={styles.path}>
          {location.zone && (
            <View style={styles.pathItem}>
              <Text style={styles.pathLabel}>Zone</Text>
              <Text style={styles.pathValue}>{location.zone}</Text>
            </View>
          )}
          {location.rack && (
            <>
              <Text style={styles.pathArrow}>→</Text>
              <View style={styles.pathItem}>
                <Text style={styles.pathLabel}>Rack</Text>
                <Text style={styles.pathValue}>{location.rack}</Text>
              </View>
            </>
          )}
          {location.position && (
            <>
              <Text style={styles.pathArrow}>→</Text>
              <View style={styles.pathItem}>
                <Text style={styles.pathLabel}>Position</Text>
                <Text style={styles.pathValue}>{location.position}</Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Location Info */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Location Information</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Status:</Text>
          <Text style={[
            styles.infoValue,
            { color: isActive ? APP_CONFIG.COLORS.SUCCESS : APP_CONFIG.COLORS.ERROR }
          ]}>
            {isActive ? 'Active' : 'Inactive'}
          </Text>
        </View>

        {location.capacity_m3 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Capacity:</Text>
            <Text style={styles.infoValue}>{location.capacity_m3} m³</Text>
          </View>
        )}

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Products:</Text>
          <Text style={styles.infoValue}>{productCount}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Total Quantity:</Text>
          <Text style={styles.infoValue}>{totalQuantity.toFixed(2)}</Text>
        </View>

        {location.allowed_types && location.allowed_types.length > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Allowed Types:</Text>
            <Text style={styles.infoValue}>
              {location.allowed_types.join(', ')}
            </Text>
          </View>
        )}
      </View>

      {/* Products in Location */}
      {location.products && location.products.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Products ({location.products.length})
          </Text>
          {location.products.map((product, index) => (
            <TouchableOpacity
              key={index}
              style={styles.productItem}
              onPress={() => navigation.navigate('ProductDetails', { 
                productSku: product.product_sku 
              })}
            >
              <View style={styles.productInfo}>
                <Text style={styles.productSku}>{product.product_sku}</Text>
                {product.lot_number && (
                  <Text style={styles.lotNumber}>Lot: {product.lot_number}</Text>
                )}
                {product.expiry_date && (
                  <Text style={styles.expiryDate}>
                    Exp: {new Date(product.expiry_date).toLocaleDateString()}
                  </Text>
                )}
              </View>
              <View style={styles.productQty}>
                <Text style={styles.qtyValue}>{product.quantity}</Text>
                {parseFloat(product.reserved_qty) > 0 && (
                  <Text style={styles.reserved}>
                    ({product.reserved_qty} reserved)
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Empty Location */}
      {(!location.products || location.products.length === 0) && (
        <View style={styles.card}>
          <View style={styles.emptyLocation}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyText}>This location is empty</Text>
          </View>
        </View>
      )}

      {/* Actions */}
      {isActive && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.moveFromButton]}
            onPress={() => navigation.navigate('Movements', { 
              fromLocationId: location.id 
            })}
          >
            <Text style={styles.actionButtonText}>Move Stock From Here</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.moveToButton]}
            onPress={() => navigation.navigate('Movements', { 
              toLocationId: location.id 
            })}
          >
            <Text style={styles.actionButtonText}>Move Stock To Here</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_CONFIG.COLORS.BACKGROUND,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: APP_CONFIG.COLORS.BACKGROUND,
  },
  errorText: {
    fontSize: 16,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
  },
  card: {
    backgroundColor: APP_CONFIG.COLORS.CARD,
    margin: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: APP_CONFIG.COLORS.BORDER,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationId: {
    fontSize: 24,
    fontWeight: 'bold',
    color: APP_CONFIG.COLORS.PRIMARY,
  },
  badge: {
    backgroundColor: APP_CONFIG.COLORS.SUCCESS,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  badgeInactive: {
    backgroundColor: APP_CONFIG.COLORS.TEXT_SECONDARY,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  path: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    backgroundColor: APP_CONFIG.COLORS.BACKGROUND,
    padding: 12,
    borderRadius: 8,
  },
  pathItem: {
    marginRight: 8,
  },
  pathLabel: {
    fontSize: 11,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    textTransform: 'uppercase',
  },
  pathValue: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_CONFIG.COLORS.TEXT,
  },
  pathArrow: {
    fontSize: 18,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: APP_CONFIG.COLORS.TEXT,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 15,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: APP_CONFIG.COLORS.TEXT,
    flex: 1,
    textAlign: 'right',
  },
  productItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: APP_CONFIG.COLORS.BORDER,
  },
  productInfo: {
    flex: 1,
  },
  productSku: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_CONFIG.COLORS.PRIMARY,
    marginBottom: 4,
  },
  lotNumber: {
    fontSize: 13,
    color: APP_CONFIG.COLORS.WARNING,
    marginBottom: 2,
  },
  expiryDate: {
    fontSize: 12,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
  },
  productQty: {
    alignItems: 'flex-end',
  },
  qtyValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: APP_CONFIG.COLORS.SUCCESS,
  },
  reserved: {
    fontSize: 11,
    color: APP_CONFIG.COLORS.WARNING,
    marginTop: 2,
  },
  emptyLocation: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
  },
  actions: {
    padding: 16,
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  moveFromButton: {
    backgroundColor: APP_CONFIG.COLORS.WARNING,
  },
  moveToButton: {
    backgroundColor: APP_CONFIG.COLORS.SUCCESS,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default LocationDetailsScreen;
