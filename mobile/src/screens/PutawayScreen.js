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
import { suggestAPI, movementsAPI, locationsAPI } from '../services/api';
import { APP_CONFIG } from '../config/config';

const DEFAULT_WAREHOUSE_ID = '00000000-0000-0000-0000-000000000001';

const PutawayScreen = ({ navigation }) => {
  const [step, setStep] = useState('input'); // 'input' | 'suggest' | 'confirm'
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState('');
  const [uom, setUom] = useState('BUC');
  const [sourceLocationCode, setSourceLocationCode] = useState('');
  const [sourceLocationId, setSourceLocationId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [selectedLocationCode, setSelectedLocationCode] = useState('');
  const [saving, setSaving] = useState(false);

  // Caută sursa după cod locație
  const lookupSourceLocation = async () => {
    if (!sourceLocationCode.trim()) return;
    try {
      const resp = await locationsAPI.getAll({ code: sourceLocationCode.trim(), limit: 1 });
      const list = resp.data?.data || resp.data || [];
      const loc = Array.isArray(list) ? list[0] : list;
      if (loc?.id) {
        setSourceLocationId(loc.id);
      } else {
        Alert.alert('Locație negăsită', `Codul ${sourceLocationCode} nu există.`);
      }
    } catch {
      // locația nu a fost găsită
    }
  };

  const getSuggestion = async () => {
    if (!sku.trim() || !quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) {
      Alert.alert('Date incomplete', 'Introduceți SKU-ul și cantitatea.');
      return;
    }

    setLoading(true);
    setSuggestion(null);
    setSelectedLocationId(null);
    setSelectedLocationCode('');

    try {
      const payload = {
        warehouse_id: DEFAULT_WAREHOUSE_ID,
        product_sku: sku.trim(),
        quantity: Number(quantity),
        uom,
        limit: 5,
      };

      const resp = await suggestAPI.putaway(payload);
      const data = resp.data?.data || resp.data;
      setSuggestion(data);
      if (data?.suggestions?.length > 0) {
        setSelectedLocationId(data.suggestions[0].location_id);
        setSelectedLocationCode(data.suggestions[0].location_code || '');
      }
      setStep('suggest');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Eroare motor de reguli';
      Alert.alert('Eroare sugestie', msg);
    } finally {
      setLoading(false);
    }
  };

  const confirmPutaway = async () => {
    if (!selectedLocationId) {
      Alert.alert('Locație lipsă', 'Selectați o locație destinație.');
      return;
    }

    setSaving(true);
    try {
      // Dacă avem și locație sursă, facem un transfer
      if (sourceLocationId) {
        await movementsAPI.create({
          product_sku: sku.trim(),
          from_location_id: sourceLocationId,
          to_location_id: selectedLocationId,
          quantity: Number(quantity),
          uom,
          movement_type: 'PUTAWAY',
          notes: suggestion?.rule_applied
            ? `Putaway regula: ${suggestion.rule_applied}`
            : 'Putaway manual',
        });
      } else {
        // Ajustare directă în locație destinație
        await movementsAPI.adjust({
          product_sku: sku.trim(),
          location_id: selectedLocationId,
          quantity: Number(quantity),
          uom,
          reason: 'PUTAWAY',
          notes: suggestion?.rule_applied
            ? `Putaway regula: ${suggestion.rule_applied}`
            : 'Putaway',
        });
      }

      Alert.alert(
        'Succes',
        `Produsul ${sku} a fost plasat la ${selectedLocationCode}.`,
        [
          {
            text: 'Nou putaway',
            onPress: () => {
              setSku('');
              setQuantity('');
              setSourceLocationCode('');
              setSourceLocationId(null);
              setSuggestion(null);
              setSelectedLocationId(null);
              setSelectedLocationCode('');
              setStep('input');
            },
          },
          { text: 'Acasă', onPress: () => navigation.goBack() },
        ]
      );
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Eroare la salvare';
      Alert.alert('Eroare', msg);
    } finally {
      setSaving(false);
    }
  };

  const ruleInfo =
    suggestion?.rule_applied || suggestion?.suggestions?.[0]?.applied_rule;

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Step 1: Input */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {step === 'input' ? '1. Detalii produs' : '✓ Detalii produs'}
        </Text>

        <Text style={styles.label}>SKU Produs *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: SKU-001"
          placeholderTextColor={APP_CONFIG.COLORS.TEXT_SECONDARY}
          value={sku}
          onChangeText={setSku}
          autoCapitalize="characters"
          editable={step === 'input'}
        />

        <Text style={styles.label}>Cantitate *</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 8 }]}
            placeholder="0"
            placeholderTextColor={APP_CONFIG.COLORS.TEXT_SECONDARY}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
            editable={step === 'input'}
          />
          <TextInput
            style={[styles.input, { width: 80 }]}
            placeholder="UOM"
            placeholderTextColor={APP_CONFIG.COLORS.TEXT_SECONDARY}
            value={uom}
            onChangeText={setUom}
            autoCapitalize="characters"
            editable={step === 'input'}
          />
        </View>

        <Text style={styles.label}>Locație sursă (opțional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: A-01-01"
          placeholderTextColor={APP_CONFIG.COLORS.TEXT_SECONDARY}
          value={sourceLocationCode}
          onChangeText={setSourceLocationCode}
          autoCapitalize="characters"
          onBlur={lookupSourceLocation}
          editable={step === 'input'}
        />
        {sourceLocationId && (
          <Text style={styles.foundText}>✓ Locație sursă găsită</Text>
        )}

        {step === 'input' && (
          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={getSuggestion}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.primaryBtnText}>🔍 Sugerează locație destinație</Text>
            )}
          </TouchableOpacity>
        )}

        {step === 'suggest' && (
          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={() => {
              setSuggestion(null);
              setStep('input');
            }}
          >
            <Text style={styles.outlineBtnText}>✏️ Modifică detalii</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Step 2: Suggestions */}
      {step === 'suggest' && suggestion && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>2. Alege locația destinație</Text>

          {ruleInfo && (
            <View style={styles.ruleTag}>
              <Text style={styles.ruleTagText}>⚡ Regula: {ruleInfo}</Text>
            </View>
          )}

          {suggestion.suggestions?.length === 0 && (
            <Text style={styles.emptyText}>
              Nicio locație automată. Introduceți manual codul locației:
            </Text>
          )}

          {suggestion.suggestions?.map((s, idx) => (
            <TouchableOpacity
              key={s.location_id || idx}
              style={[
                styles.locationCard,
                selectedLocationId === s.location_id && styles.locationCardSelected,
              ]}
              onPress={() => {
                setSelectedLocationId(s.location_id);
                setSelectedLocationCode(s.location_code || '');
              }}
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
              {s.available_capacity !== undefined && (
                <Text style={styles.metaText}>
                  Capacitate: {s.available_capacity}
                </Text>
              )}
              {selectedLocationId === s.location_id && (
                <Text style={styles.selectedMark}>✓ Selectat</Text>
              )}
            </TouchableOpacity>
          ))}

          {/* Override manual */}
          <Text style={[styles.label, { marginTop: 8 }]}>
            Sau introduceți codul locației manual:
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: B-02-03"
            placeholderTextColor={APP_CONFIG.COLORS.TEXT_SECONDARY}
            value={selectedLocationCode}
            onChangeText={setSelectedLocationCode}
            autoCapitalize="characters"
            onBlur={async () => {
              if (selectedLocationCode.trim()) {
                try {
                  const resp = await locationsAPI.getAll({
                    code: selectedLocationCode.trim(),
                    limit: 1,
                  });
                  const list = resp.data?.data || resp.data || [];
                  const loc = Array.isArray(list) ? list[0] : list;
                  if (loc?.id) setSelectedLocationId(loc.id);
                } catch {}
              }
            }}
          />

          <TouchableOpacity
            style={[styles.confirmBtn, saving && styles.btnDisabled]}
            onPress={confirmPutaway}
            disabled={saving || !selectedLocationId}
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.confirmBtnText}>✅ Confirmă putaway</Text>
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
  foundText: {
    color: APP_CONFIG.COLORS.SUCCESS,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
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
  outlineBtn: {
    borderWidth: 1,
    borderColor: APP_CONFIG.COLORS.PRIMARY,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  outlineBtnText: {
    color: APP_CONFIG.COLORS.PRIMARY,
    fontWeight: '600',
    fontSize: 14,
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
  metaText: {
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    fontSize: 12,
    marginTop: 4,
  },
  selectedMark: {
    color: APP_CONFIG.COLORS.PRIMARY,
    fontWeight: '700',
    marginTop: 4,
    fontSize: 13,
  },
  emptyText: {
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    marginBottom: 8,
  },
});

export default PutawayScreen;
