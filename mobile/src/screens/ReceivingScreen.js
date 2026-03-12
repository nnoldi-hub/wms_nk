import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { suggestAPI, movementsAPI, productsAPI } from '../services/api';
import { APP_CONFIG } from '../config/config';

// Depozit implicit - poate fi preluat din context/config
const DEFAULT_WAREHOUSE_ID = '00000000-0000-0000-0000-000000000001';

const ReceivingScreen = ({ navigation }) => {
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState('');
  const [uom, setUom] = useState('BUC');
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [product, setProduct] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState(null);

  // Caută produsul automat când SKU-ul e complet (Enter sau blur)
  const lookupProduct = async () => {
    if (!sku.trim()) return;
    try {
      const resp = await productsAPI.getBySKU(sku.trim());
      const p = resp.data?.data || resp.data;
      setProduct(p);
    } catch {
      setProduct(null);
    }
  };

  const getSuggestion = async () => {
    if (!sku.trim() || !quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) {
      Alert.alert('Date incomplete', 'Introduceți SKU-ul produsului și cantitatea.');
      return;
    }

    setLoading(true);
    setSuggestion(null);
    setSelectedLocationId(null);

    try {
      const payload = {
        warehouse_id: DEFAULT_WAREHOUSE_ID,
        product_sku: sku.trim(),
        quantity: Number(quantity),
        uom,
        product: product ? { name: product.name, category: product.category } : undefined,
        limit: 5,
      };

      const resp = await suggestAPI.putaway(payload);
      const data = resp.data?.data || resp.data;
      setSuggestion(data);
      if (data?.suggestions?.length > 0) {
        setSelectedLocationId(data.suggestions[0].location_id);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Eroare motor de reguli';
      Alert.alert('Eroare sugestie', msg);
    } finally {
      setLoading(false);
    }
  };

  const confirmReceiving = async () => {
    if (!selectedLocationId) {
      Alert.alert('Locație lipsă', 'Selectați o locație destinație.');
      return;
    }

    setSaving(true);
    try {
      await movementsAPI.adjust({
        product_sku: sku.trim(),
        location_id: selectedLocationId,
        quantity: Number(quantity),
        uom,
        reason: 'RECEIVING',
        notes: suggestion?.rule_applied
          ? `Regula aplicată: ${suggestion.rule_applied}`
          : 'Recepție marfă',
      });

      Alert.alert('Succes', 'Marfa a fost recepționată și plasată.', [
        {
          text: 'OK',
          onPress: () => {
            setSku('');
            setQuantity('');
            setSuggestion(null);
            setProduct(null);
            setSelectedLocationId(null);
          },
        },
      ]);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Eroare la salvare';
      Alert.alert('Eroare', msg);
    } finally {
      setSaving(false);
    }
  };

  const ruleInfo = suggestion?.rule_applied || suggestion?.suggestions?.[0]?.applied_rule;

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Input Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Detalii produs recepționat</Text>

        <Text style={styles.label}>SKU Produs *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: SKU-001"
          placeholderTextColor={APP_CONFIG.COLORS.TEXT_SECONDARY}
          value={sku}
          onChangeText={setSku}
          autoCapitalize="characters"
          returnKeyType="done"
          onBlur={lookupProduct}
          onSubmitEditing={lookupProduct}
        />

        {product && (
          <View style={styles.productBadge}>
            <Text style={styles.productName}>{product.name || product.sku}</Text>
            {product.category && (
              <Text style={styles.productCategory}>{product.category}</Text>
            )}
          </View>
        )}

        <Text style={styles.label}>Cantitate *</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 8 }]}
            placeholder="0"
            placeholderTextColor={APP_CONFIG.COLORS.TEXT_SECONDARY}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, { width: 80 }]}
            placeholder="UOM"
            placeholderTextColor={APP_CONFIG.COLORS.TEXT_SECONDARY}
            value={uom}
            onChangeText={setUom}
            autoCapitalize="characters"
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, loading && styles.btnDisabled]}
          onPress={getSuggestion}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.primaryBtnText}>🔍 Obține sugestie locație</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Suggestions */}
      {suggestion && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Locații sugerate</Text>

          {ruleInfo && (
            <View style={styles.ruleTag}>
              <Text style={styles.ruleTagText}>⚡ Regula: {ruleInfo}</Text>
            </View>
          )}

          {suggestion.suggestions?.length === 0 && (
            <Text style={styles.emptyText}>
              Nicio locație sugerată. Alegeți manual.
            </Text>
          )}

          {suggestion.suggestions?.map((s, idx) => (
            <TouchableOpacity
              key={s.location_id || idx}
              style={[
                styles.locationCard,
                selectedLocationId === s.location_id && styles.locationCardSelected,
              ]}
              onPress={() => setSelectedLocationId(s.location_id)}
            >
              <View style={styles.locationHeader}>
                <Text style={styles.locationCode}>
                  {s.zone_code ? `${s.zone_code} / ` : ''}
                  {s.location_code}
                </Text>
                {s.score !== undefined && (
                  <Text style={styles.scoreTag}>Scor: {s.score}</Text>
                )}
              </View>
              {s.suggestion_label && (
                <Text style={styles.suggestionLabel}>{s.suggestion_label}</Text>
              )}
              <View style={styles.locationMeta}>
                {s.available_capacity !== undefined && (
                  <Text style={styles.metaText}>
                    Capacitate disponibilă: {s.available_capacity}
                  </Text>
                )}
                {s.current_stock !== undefined && (
                  <Text style={styles.metaText}>Stoc curent: {s.current_stock}</Text>
                )}
              </View>
              {selectedLocationId === s.location_id && (
                <Text style={styles.selectedMark}>✓ Selectat</Text>
              )}
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.confirmBtn, saving && styles.btnDisabled]}
            onPress={confirmReceiving}
            disabled={saving || !selectedLocationId}
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.confirmBtnText}>✅ Confirmă recepție</Text>
            )}
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
    padding: 12,
  },
  card: {
    backgroundColor: APP_CONFIG.COLORS.CARD,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: APP_CONFIG.COLORS.BORDER,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: APP_CONFIG.COLORS.TEXT,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: APP_CONFIG.COLORS.BACKGROUND,
    borderWidth: 1,
    borderColor: APP_CONFIG.COLORS.BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: APP_CONFIG.COLORS.TEXT,
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productBadge: {
    backgroundColor: '#eff6ff',
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  productName: {
    color: '#1d4ed8',
    fontWeight: '600',
    fontSize: 14,
  },
  productCategory: {
    color: '#3b82f6',
    fontSize: 12,
    marginTop: 2,
  },
  primaryBtn: {
    backgroundColor: APP_CONFIG.COLORS.PRIMARY,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryBtnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
  confirmBtn: {
    backgroundColor: APP_CONFIG.COLORS.SUCCESS,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  confirmBtnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  ruleTag: {
    backgroundColor: '#fef3c7',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  ruleTagText: {
    color: '#92400e',
    fontSize: 13,
    fontWeight: '600',
  },
  locationCard: {
    borderWidth: 1,
    borderColor: APP_CONFIG.COLORS.BORDER,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    backgroundColor: APP_CONFIG.COLORS.BACKGROUND,
  },
  locationCardSelected: {
    borderColor: APP_CONFIG.COLORS.PRIMARY,
    backgroundColor: '#eff6ff',
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationCode: {
    fontWeight: '700',
    fontSize: 15,
    color: APP_CONFIG.COLORS.TEXT,
  },
  scoreTag: {
    backgroundColor: '#dbeafe',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 12,
    color: '#1d4ed8',
  },
  suggestionLabel: {
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    fontSize: 12,
    marginTop: 4,
  },
  locationMeta: {
    marginTop: 6,
    gap: 2,
  },
  metaText: {
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    fontSize: 12,
  },
  selectedMark: {
    color: APP_CONFIG.COLORS.PRIMARY,
    fontWeight: '700',
    marginTop: 4,
    fontSize: 13,
  },
  emptyText: {
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    paddingVertical: 12,
  },
});

export default ReceivingScreen;
