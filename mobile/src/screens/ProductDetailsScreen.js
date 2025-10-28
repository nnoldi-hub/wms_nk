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
import { productsAPI } from '../services/api';
import { APP_CONFIG } from '../config/config';

const ProductDetailsScreen = ({ route, navigation }) => {
  const { productSku, scannedCode } = route.params || {};
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProduct();
  }, [productSku, scannedCode]);

  const loadProduct = async () => {
    const sku = productSku || scannedCode;
    if (!sku) {
      Alert.alert('Error', 'No product SKU provided');
      navigation.goBack();
      return;
    }

    try {
      const response = await productsAPI.getBySKU(sku);
      if (response.data.success) {
        setProduct(response.data.data);
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to load product');
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

  if (!product) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>Product not found</Text>
      </View>
    );
  }

  const totalQuantity = product.locations?.reduce((sum, loc) => sum + parseFloat(loc.quantity || 0), 0) || 0;

  return (
    <ScrollView style={styles.container}>
      {/* Header Card */}
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.sku}>{product.sku}</Text>
          <View style={[styles.badge, product.lot_control && styles.badgeLotControl]}>
            <Text style={styles.badgeText}>
              {product.lot_control ? 'LOT CONTROL' : 'BULK'}
            </Text>
          </View>
        </View>
        
        <Text style={styles.name}>{product.name}</Text>
        
        {product.description && (
          <Text style={styles.description}>{product.description}</Text>
        )}
      </View>

      {/* Stock Info */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Stock Information</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Total Quantity:</Text>
          <Text style={styles.infoValue}>{totalQuantity} {product.uom}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Unit of Measure:</Text>
          <Text style={styles.infoValue}>{product.uom}</Text>
        </View>
        {product.locations && product.locations.length > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Locations:</Text>
            <Text style={styles.infoValue}>{product.locations.length}</Text>
          </View>
        )}
      </View>

      {/* Dimensions */}
      {(product.weight_kg || product.length_cm || product.width_cm || product.height_cm) && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Dimensions</Text>
          {product.weight_kg && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Weight:</Text>
              <Text style={styles.infoValue}>{product.weight_kg} kg</Text>
            </View>
          )}
          {product.length_cm && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Length:</Text>
              <Text style={styles.infoValue}>{product.length_cm} cm</Text>
            </View>
          )}
          {product.width_cm && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Width:</Text>
              <Text style={styles.infoValue}>{product.width_cm} cm</Text>
            </View>
          )}
          {product.height_cm && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Height:</Text>
              <Text style={styles.infoValue}>{product.height_cm} cm</Text>
            </View>
          )}
        </View>
      )}

      {/* Locations List */}
      {product.locations && product.locations.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Locations ({product.locations.length})</Text>
          {product.locations.map((location, index) => (
            <TouchableOpacity
              key={index}
              style={styles.locationItem}
              onPress={() => navigation.navigate('LocationDetails', { locationId: location.location_id })}
            >
              <View>
                <Text style={styles.locationName}>
                  {location.zone}/{location.rack}/{location.position}
                </Text>
                {location.lot_number && (
                  <Text style={styles.lotNumber}>Lot: {location.lot_number}</Text>
                )}
                {location.expiry_date && (
                  <Text style={styles.expiryDate}>
                    Exp: {new Date(location.expiry_date).toLocaleDateString()}
                  </Text>
                )}
              </View>
              <View style={styles.locationQty}>
                <Text style={styles.qtyValue}>{location.quantity}</Text>
                <Text style={styles.qtyUnit}>{product.uom}</Text>
                {parseFloat(location.reserved_qty) > 0 && (
                  <Text style={styles.reserved}>({location.reserved_qty} reserved)</Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.moveButton]}
          onPress={() => navigation.navigate('Movements', { productSku: product.sku })}
        >
          <Text style={styles.actionButtonText}>Move Stock</Text>
        </TouchableOpacity>
      </View>
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
    marginBottom: 12,
  },
  sku: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_CONFIG.COLORS.PRIMARY,
  },
  badge: {
    backgroundColor: APP_CONFIG.COLORS.SECONDARY,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  badgeLotControl: {
    backgroundColor: APP_CONFIG.COLORS.WARNING,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: APP_CONFIG.COLORS.TEXT,
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    lineHeight: 24,
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
  },
  locationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: APP_CONFIG.COLORS.BORDER,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_CONFIG.COLORS.TEXT,
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
  locationQty: {
    alignItems: 'flex-end',
  },
  qtyValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: APP_CONFIG.COLORS.SUCCESS,
  },
  qtyUnit: {
    fontSize: 12,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
  },
  reserved: {
    fontSize: 11,
    color: APP_CONFIG.COLORS.WARNING,
    marginTop: 2,
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
  moveButton: {
    backgroundColor: APP_CONFIG.COLORS.PRIMARY,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProductDetailsScreen;
