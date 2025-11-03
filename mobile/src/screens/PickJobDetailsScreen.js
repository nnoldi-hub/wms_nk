import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { pickingAPI } from '../services/api';
import { APP_CONFIG } from '../config/config';

const ItemRow = ({ item, onPick }) => {
  const remaining = Number(item.requested_qty) - Number(item.picked_qty);
  return (
    <View style={styles.itemRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle}>{item.product_sku} {item.lot_label ? `(lot: ${item.lot_label})` : ''}</Text>
        <Text style={styles.itemSub}>Cerut: {item.requested_qty} {item.uom} · Cules: {item.picked_qty}</Text>
      </View>
      <TouchableOpacity style={[styles.pickBtn, remaining <= 0 && styles.pickBtnDisabled]} disabled={remaining <= 0} onPress={() => onPick(item)}>
        <Text style={[styles.pickBtnText, remaining <= 0 && styles.pickBtnTextDisabled]}>+1</Text>
      </TouchableOpacity>
    </View>
  );
};

const PickJobDetailsScreen = ({ route, navigation }) => {
  const { id } = route.params;
  const [job, setJob] = useState(null);
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const resp = await pickingAPI.get(id);
    const data = resp.data?.data || resp.data || resp;
    setJob(data.job);
    setItems(data.items || []);
  }, [id]);

  useEffect(() => {
    navigation.setOptions({ title: 'Job ' + (job?.number || '') });
  }, [job, navigation]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const acceptJob = async () => {
    await pickingAPI.accept(id);
    await load();
  };

  const pickPlusOne = async (item) => {
    await pickingAPI.pick(id, { item_id: item.id, qty: 1 });
    await load();
  };

  const allDone = items.length > 0 && items.every((it) => Number(it.picked_qty) >= Number(it.requested_qty));

  const completeJob = async () => {
    await pickingAPI.complete(id, {});
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{job?.number}</Text>
        <Text style={[styles.badge, styles[`badge_${job?.status}`] || styles.badge_DEFAULT]}>{job?.status}</Text>
      </View>
      {job?.assigned_to && <Text style={styles.sub}>Asignat: {job.assigned_to}</Text>}
      <View style={styles.actions}>
        {job?.status === 'NEW' && (
          <TouchableOpacity style={styles.primaryBtn} onPress={acceptJob}>
            <Text style={styles.primaryBtnText}>Acceptă jobul</Text>
          </TouchableOpacity>
        )}
        {allDone && job?.status !== 'COMPLETED' && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={completeJob}>
            <Text style={styles.secondaryBtnText}>Finalizează</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={({ item }) => <ItemRow item={item} onPick={pickPlusOne} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
        ListHeaderComponent={<Text style={styles.section}>Articole</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_CONFIG.COLORS.BACKGROUND },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: APP_CONFIG.COLORS.CARD, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: APP_CONFIG.COLORS.BORDER },
  title: { fontSize: 18, fontWeight: '700', color: APP_CONFIG.COLORS.TEXT },
  sub: { paddingHorizontal: 12, paddingVertical: 6, color: APP_CONFIG.COLORS.TEXT_SECONDARY },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, overflow: 'hidden', color: 'white', fontSize: 12 },
  badge_DEFAULT: { backgroundColor: APP_CONFIG.COLORS.SECONDARY },
  badge_NEW: { backgroundColor: '#3b82f6' },
  badge_ASSIGNED: { backgroundColor: '#a855f7' },
  badge_IN_PROGRESS: { backgroundColor: '#f59e0b' },
  badge_COMPLETED: { backgroundColor: '#10b981' },
  badge_CANCELLED: { backgroundColor: '#ef4444' },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 12, paddingVertical: 8 },
  primaryBtn: { backgroundColor: APP_CONFIG.COLORS.PRIMARY, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  primaryBtnText: { color: 'white', fontWeight: '700' },
  secondaryBtn: { backgroundColor: '#e5e7eb', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  secondaryBtnText: { color: APP_CONFIG.COLORS.TEXT, fontWeight: '700' },
  section: { marginTop: 8, marginBottom: 8, paddingHorizontal: 12, color: APP_CONFIG.COLORS.TEXT_SECONDARY },
  itemRow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: APP_CONFIG.COLORS.CARD, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: APP_CONFIG.COLORS.BORDER },
  itemTitle: { fontWeight: '700', color: APP_CONFIG.COLORS.TEXT },
  itemSub: { marginTop: 4, color: APP_CONFIG.COLORS.TEXT_SECONDARY },
  pickBtn: { backgroundColor: APP_CONFIG.COLORS.SUCCESS, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  pickBtnDisabled: { backgroundColor: '#a7f3d0' },
  pickBtnText: { color: 'white', fontWeight: '700' },
  pickBtnTextDisabled: { color: '#064e3b' },
});

export default PickJobDetailsScreen;
