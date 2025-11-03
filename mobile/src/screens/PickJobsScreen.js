import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { pickingAPI } from '../services/api';
import { APP_CONFIG } from '../config/config';

const FilterButton = ({ label, active, onPress }) => (
  <TouchableOpacity onPress={onPress} style={[styles.filterBtn, active && styles.filterBtnActive]}>
    <Text style={[styles.filterBtnText, active && styles.filterBtnTextActive]}>{label}</Text>
  </TouchableOpacity>
);

const JobItem = ({ item, onPress }) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={styles.title}>{item.number}</Text>
        <Text style={[styles.badge, styles[`badge_${item.status}`] || styles.badge_DEFAULT]}>{item.status}</Text>
      </View>
      <Text style={styles.sub}>Order: {item.order_id.slice(0, 8)}…</Text>
      {item.assigned_to ? <Text style={styles.sub}>Assigned to: {item.assigned_to}</Text> : null}
      <Text style={styles.sub}>Created: {new Date(item.created_at).toLocaleString()}</Text>
    </TouchableOpacity>
  );
};

const PickJobsScreen = ({ navigation }) => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('mine'); // mine | new | all

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter === 'mine') params.mine = 1;
      if (filter === 'new') params.status = 'NEW';
      params.limit = 50;
      const resp = await pickingAPI.list(params);
      const data = resp.data?.data || resp.data || resp;
      setJobs(Array.isArray(data) ? data : data?.data || []);
    } catch (e) {
      // noop
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchJobs();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <FilterButton label="Mele" active={filter === 'mine'} onPress={() => setFilter('mine')} />
        <FilterButton label="Noi" active={filter === 'new'} onPress={() => setFilter('new')} />
        <FilterButton label="Toate" active={filter === 'all'} onPress={() => setFilter('all')} />
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <JobItem item={item} onPress={() => navigation.navigate('PickJobDetails', { id: item.id })} />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={!loading ? (
          <Text style={{ textAlign: 'center', color: APP_CONFIG.COLORS.TEXT_SECONDARY, marginTop: 60 }}>Nu sunt joburi de culegere</Text>
        ) : null}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: APP_CONFIG.COLORS.BACKGROUND },
  filters: { flexDirection: 'row', justifyContent: 'space-around', padding: 10, backgroundColor: APP_CONFIG.COLORS.CARD, borderBottomColor: APP_CONFIG.COLORS.BORDER, borderBottomWidth: StyleSheet.hairlineWidth },
  filterBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#eef2ff' },
  filterBtnActive: { backgroundColor: APP_CONFIG.COLORS.PRIMARY },
  filterBtnText: { color: APP_CONFIG.COLORS.PRIMARY, fontWeight: '600' },
  filterBtnTextActive: { color: 'white' },
  card: { backgroundColor: APP_CONFIG.COLORS.CARD, borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: APP_CONFIG.COLORS.BORDER },
  title: { fontSize: 16, fontWeight: '700', color: APP_CONFIG.COLORS.TEXT },
  sub: { marginTop: 4, color: APP_CONFIG.COLORS.TEXT_SECONDARY },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, overflow: 'hidden', color: 'white', fontSize: 12 },
  badge_DEFAULT: { backgroundColor: APP_CONFIG.COLORS.SECONDARY },
  badge_NEW: { backgroundColor: '#3b82f6' },
  badge_ASSIGNED: { backgroundColor: '#a855f7' },
  badge_IN_PROGRESS: { backgroundColor: '#f59e0b' },
  badge_COMPLETED: { backgroundColor: '#10b981' },
  badge_CANCELLED: { backgroundColor: '#ef4444' },
});

export default PickJobsScreen;
