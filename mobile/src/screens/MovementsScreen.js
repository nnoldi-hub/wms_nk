import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { movementsAPI, productsAPI, locationsAPI } from '../services/api';
import { APP_CONFIG } from '../config/config';

const MovementsScreen = ({ route, navigation }) => {
  const { productSku, fromLocationId, toLocationId } = route.params || {};

  // Form state
  const [movementType, setMovementType] = useState('TRANSFER');
  const [productInput, setProductInput] = useState(productSku || '');
  const [fromLocation, setFromLocation] = useState(fromLocationId || '');
  const [toLocation, setToLocation] = useState(toLocationId || '');
  const [quantity, setQuantity] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Product and location validation
  const [productDetails, setProductDetails] = useState(null);
  const [fromLocationDetails, setFromLocationDetails] = useState(null);
  const [toLocationDetails, setToLocationDetails] = useState(null);

  useEffect(() => {
    if (productInput) {
      validateProduct();
    }
  }, [productInput]);

  useEffect(() => {
    if (fromLocation) {
      validateFromLocation();
    }
  }, [fromLocation]);

  useEffect(() => {
    if (toLocation) {
      validateToLocation();
    }
  }, [toLocation]);

  const validateProduct = async () => {
    try {
      setLoading(true);
      const response = await productsAPI.getBySKU(productInput);
      if (response.data.success) {
        setProductDetails(response.data.data);
      }
    } catch (error) {
      setProductDetails(null);
    } finally {
      setLoading(false);
    }
  };

  const validateFromLocation = async () => {
    try {
      setLoading(true);
      const response = await locationsAPI.getById(fromLocation);
      if (response.data.success) {
        setFromLocationDetails(response.data.data);
      }
    } catch (error) {
      setFromLocationDetails(null);
    } finally {
      setLoading(false);
    }
  };

  const validateToLocation = async () => {
    try {
      setLoading(true);
      const response = await locationsAPI.getById(toLocation);
      if (response.data.success) {
        setToLocationDetails(response.data.data);
      }
    } catch (error) {
      setToLocationDetails(null);
    } finally {
      setLoading(false);
    }
  };

  const handleScanProduct = () => {
    navigation.navigate('Scanner', {
      returnScreen: 'Movements',
      scanType: 'product',
    });
  };

  const handleScanFromLocation = () => {
    navigation.navigate('Scanner', {
      returnScreen: 'Movements',
      scanType: 'fromLocation',
    });
  };

  const handleScanToLocation = () => {
    navigation.navigate('Scanner', {
      returnScreen: 'Movements',
      scanType: 'toLocation',
    });
  };

  const validateForm = () => {
    if (!productInput.trim()) {
      Alert.alert('Validation Error', 'Product SKU is required');
      return false;
    }

    if (!productDetails) {
      Alert.alert('Validation Error', 'Product not found. Please check the SKU.');
      return false;
    }

    if (movementType === 'TRANSFER') {
      if (!fromLocation.trim()) {
        Alert.alert('Validation Error', 'From Location is required for transfers');
        return false;
      }
      if (!toLocation.trim()) {
        Alert.alert('Validation Error', 'To Location is required for transfers');
        return false;
      }
      if (!fromLocationDetails) {
        Alert.alert('Validation Error', 'From Location not found');
        return false;
      }
      if (!toLocationDetails) {
        Alert.alert('Validation Error', 'To Location not found');
        return false;
      }
    }

    if (movementType === 'RECEIPT' && !toLocation.trim()) {
      Alert.alert('Validation Error', 'To Location is required for receipts');
      return false;
    }

    if (movementType === 'SHIPMENT' && !fromLocation.trim()) {
      Alert.alert('Validation Error', 'From Location is required for shipments');
      return false;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Validation Error', 'Quantity must be greater than 0');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);

      const movementData = {
        movement_type: movementType,
        product_sku: productInput,
        quantity: parseFloat(quantity),
        notes: notes.trim() || undefined,
        lot_number: lotNumber.trim() || undefined,
      };

      if (fromLocation.trim()) {
        movementData.from_location_id = fromLocation.trim();
      }

      if (toLocation.trim()) {
        movementData.to_location_id = toLocation.trim();
      }

      const response = await movementsAPI.create(movementData);

      if (response.data.success) {
        Alert.alert(
          'Success',
          'Movement created successfully',
          [
            {
              text: 'View History',
              onPress: () => navigation.navigate('History'),
            },
            {
              text: 'New Movement',
              onPress: () => {
                setProductInput('');
                setFromLocation('');
                setToLocation('');
                setQuantity('');
                setLotNumber('');
                setNotes('');
                setProductDetails(null);
                setFromLocationDetails(null);
                setToLocationDetails(null);
              },
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to create movement'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Create Stock Movement</Text>

        {/* Movement Type */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Movement Type *</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={movementType}
              onValueChange={(itemValue) => setMovementType(itemValue)}
              style={styles.picker}
            >
              <Picker.Item label="Transfer" value="TRANSFER" />
              <Picker.Item label="Receipt" value="RECEIPT" />
              <Picker.Item label="Shipment" value="SHIPMENT" />
              <Picker.Item label="Adjustment" value="ADJUSTMENT" />
            </Picker>
          </View>
        </View>

        {/* Product */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Product SKU *</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.inputFlex]}
              value={productInput}
              onChangeText={setProductInput}
              placeholder="Enter or scan product SKU"
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={styles.scanButton}
              onPress={handleScanProduct}
            >
              <Text style={styles.scanButtonText}>📷</Text>
            </TouchableOpacity>
          </View>
          {productDetails && (
            <View style={styles.validation}>
              <Text style={styles.validationSuccess}>
                ✓ {productDetails.name}
              </Text>
            </View>
          )}
          {productInput && !productDetails && !loading && (
            <View style={styles.validation}>
              <Text style={styles.validationError}>✗ Product not found</Text>
            </View>
          )}
        </View>

        {/* From Location */}
        {(movementType === 'TRANSFER' || movementType === 'SHIPMENT') && (
          <View style={styles.formGroup}>
            <Text style={styles.label}>From Location *</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputFlex]}
                value={fromLocation}
                onChangeText={setFromLocation}
                placeholder="Enter or scan location ID"
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={styles.scanButton}
                onPress={handleScanFromLocation}
              >
                <Text style={styles.scanButtonText}>📷</Text>
              </TouchableOpacity>
            </View>
            {fromLocationDetails && (
              <View style={styles.validation}>
                <Text style={styles.validationSuccess}>
                  ✓ {fromLocationDetails.zone} → {fromLocationDetails.rack} → {fromLocationDetails.position}
                </Text>
              </View>
            )}
            {fromLocation && !fromLocationDetails && !loading && (
              <View style={styles.validation}>
                <Text style={styles.validationError}>✗ Location not found</Text>
              </View>
            )}
          </View>
        )}

        {/* To Location */}
        {(movementType === 'TRANSFER' || movementType === 'RECEIPT') && (
          <View style={styles.formGroup}>
            <Text style={styles.label}>To Location *</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.inputFlex]}
                value={toLocation}
                onChangeText={setToLocation}
                placeholder="Enter or scan location ID"
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={styles.scanButton}
                onPress={handleScanToLocation}
              >
                <Text style={styles.scanButtonText}>📷</Text>
              </TouchableOpacity>
            </View>
            {toLocationDetails && (
              <View style={styles.validation}>
                <Text style={styles.validationSuccess}>
                  ✓ {toLocationDetails.zone} → {toLocationDetails.rack} → {toLocationDetails.position}
                </Text>
              </View>
            )}
            {toLocation && !toLocationDetails && !loading && (
              <View style={styles.validation}>
                <Text style={styles.validationError}>✗ Location not found</Text>
              </View>
            )}
          </View>
        )}

        {/* Quantity */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Quantity *</Text>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            placeholder="Enter quantity"
            keyboardType="numeric"
          />
        </View>

        {/* Lot Number */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Lot Number</Text>
          <TextInput
            style={styles.input}
            value={lotNumber}
            onChangeText={setLotNumber}
            placeholder="Optional lot number"
            autoCapitalize="characters"
          />
        </View>

        {/* Notes */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional notes"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Create Movement</Text>
          )}
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
  card: {
    backgroundColor: APP_CONFIG.COLORS.CARD,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: APP_CONFIG.COLORS.BORDER,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: APP_CONFIG.COLORS.TEXT,
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: APP_CONFIG.COLORS.TEXT,
    marginBottom: 8,
  },
  input: {
    backgroundColor: APP_CONFIG.COLORS.BACKGROUND,
    borderWidth: 1,
    borderColor: APP_CONFIG.COLORS.BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: APP_CONFIG.COLORS.TEXT,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputFlex: {
    flex: 1,
    marginRight: 8,
  },
  scanButton: {
    backgroundColor: APP_CONFIG.COLORS.PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  scanButtonText: {
    fontSize: 20,
  },
  pickerWrapper: {
    backgroundColor: APP_CONFIG.COLORS.BACKGROUND,
    borderWidth: 1,
    borderColor: APP_CONFIG.COLORS.BORDER,
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    color: APP_CONFIG.COLORS.TEXT,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  validation: {
    marginTop: 4,
  },
  validationSuccess: {
    fontSize: 13,
    color: APP_CONFIG.COLORS.SUCCESS,
  },
  validationError: {
    fontSize: 13,
    color: APP_CONFIG.COLORS.ERROR,
  },
  submitButton: {
    backgroundColor: APP_CONFIG.COLORS.PRIMARY,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MovementsScreen;
