import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { movementsAPI } from '../services/api';
import { APP_CONFIG } from '../config/config';

const HistoryScreen = ({ navigation }) => {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filterProduct, setFilterProduct] = useState('');
  const [filterLocation, setFilterLocation] = useState('');

  useEffect(() => {
    loadMovements(true);
  }, []);

  const loadMovements = async (reset = false) => {
    if (loading || (!hasMore && !reset)) return;

    try {
      setLoading(true);
      const currentPage = reset ? 1 : page;

      const response = await movementsAPI.getHistory({
        page: currentPage,
        limit: APP_CONFIG.PAGINATION.DEFAULT_PAGE_SIZE,
        product_sku: filterProduct || undefined,
        location_id: filterLocation || undefined,
      });

      if (response.data.success) {
        const newMovements = response.data.data;
        setMovements(reset ? newMovements : [...movements, ...newMovements]);
        setHasMore(newMovements.length === APP_CONFIG.PAGINATION.DEFAULT_PAGE_SIZE);
        setPage(currentPage + 1);
      }
    } catch (error) {
      console.error('Failed to load movements:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    await loadMovements(true);
    setRefreshing(false);
  };

  const handleSearch = () => {
    setPage(1);
    setHasMore(true);
    loadMovements(true);
  };

  const handleClearFilters = () => {
    setFilterProduct('');
    setFilterLocation('');
    setPage(1);
    setHasMore(true);
    loadMovements(true);
  };

  const getMovementTypeColor = (type) => {
    switch (type) {
      case 'TRANSFER':
        return APP_CONFIG.COLORS.PRIMARY;
      case 'RECEIPT':
        return APP_CONFIG.COLORS.SUCCESS;
      case 'SHIPMENT':
        return APP_CONFIG.COLORS.ERROR;
      case 'ADJUSTMENT':
        return APP_CONFIG.COLORS.WARNING;
      default:
        return APP_CONFIG.COLORS.TEXT_SECONDARY;
    }
  };

  const renderMovement = ({ item }) => {
    const typeColor = getMovementTypeColor(item.movement_type);
    const timestamp = new Date(item.created_at).toLocaleString();

    return (
      <TouchableOpacity
        style={styles.movementCard}
        onPress={() => {
          // Could navigate to movement details
          // navigation.navigate('MovementDetails', { movementId: item.id })
        }}
      >
        <View style={[styles.typeIndicator, { backgroundColor: typeColor }]} />
        
        <View style={styles.movementContent}>
          <View style={styles.movementHeader}>
            <View style={[styles.typeBadge, { backgroundColor: typeColor }]}>
              <Text style={styles.typeText}>{item.movement_type}</Text>
            </View>
            <Text style={styles.timestamp}>{timestamp}</Text>
          </View>

          <View style={styles.movementInfo}>
            <Text style={styles.productSku}>{item.product_sku}</Text>
            <Text style={styles.quantity}>
              {item.quantity > 0 ? '+' : ''}{item.quantity}
            </Text>
          </View>

          {item.from_location_id && (
            <View style={styles.locationRow}>
              <Text style={styles.locationLabel}>From:</Text>
              <Text style={styles.locationValue}>{item.from_location_id}</Text>
            </View>
          )}

          {item.to_location_id && (
            <View style={styles.locationRow}>
              <Text style={styles.locationLabel}>To:</Text>
              <Text style={styles.locationValue}>{item.to_location_id}</Text>
            </View>
          )}

          {item.lot_number && (
            <Text style={styles.lotNumber}>Lot: {item.lot_number}</Text>
          )}

          {item.notes && (
            <Text style={styles.notes} numberOfLines={2}>
              {item.notes}
            </Text>
          )}

          {item.username && (
            <Text style={styles.username}>By: {item.username}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading && movements.length === 0) {
      return null;
    }

    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyText}>No movements found</Text>
        {(filterProduct || filterLocation) && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearFilters}
          >
            <Text style={styles.clearButtonText}>Clear Filters</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderFooter = () => {
    if (!loading) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={APP_CONFIG.COLORS.PRIMARY} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Filters */}
      <View style={styles.filters}>
        <View style={styles.filterRow}>
          <TextInput
            style={[styles.filterInput, styles.filterInputWide]}
            value={filterProduct}
            onChangeText={setFilterProduct}
            placeholder="Filter by product SKU..."
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleSearch}
          >
            <Text style={styles.searchButtonText}>🔍</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filterRow}>
          <TextInput
            style={[styles.filterInput, styles.filterInputWide]}
            value={filterLocation}
            onChangeText={setFilterLocation}
            placeholder="Filter by location..."
            autoCapitalize="characters"
          />
          {(filterProduct || filterLocation) && (
            <TouchableOpacity
              style={styles.clearFilterButton}
              onPress={handleClearFilters}
            >
              <Text style={styles.clearFilterText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Movements List */}
      <FlatList
        data={movements}
        renderItem={renderMovement}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={movements.length === 0 ? styles.emptyContainer : null}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={() => loadMovements(false)}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[APP_CONFIG.COLORS.PRIMARY]}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_CONFIG.COLORS.BACKGROUND,
  },
  filters: {
    backgroundColor: APP_CONFIG.COLORS.CARD,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: APP_CONFIG.COLORS.BORDER,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterInput: {
    backgroundColor: APP_CONFIG.COLORS.BACKGROUND,
    borderWidth: 1,
    borderColor: APP_CONFIG.COLORS.BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: APP_CONFIG.COLORS.TEXT,
  },
  filterInputWide: {
    flex: 1,
    marginRight: 8,
  },
  searchButton: {
    backgroundColor: APP_CONFIG.COLORS.PRIMARY,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  searchButtonText: {
    fontSize: 18,
  },
  clearFilterButton: {
    backgroundColor: APP_CONFIG.COLORS.TEXT_SECONDARY,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  clearFilterText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  movementCard: {
    backgroundColor: APP_CONFIG.COLORS.CARD,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: APP_CONFIG.COLORS.BORDER,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  typeIndicator: {
    width: 4,
  },
  movementContent: {
    flex: 1,
    padding: 12,
  },
  movementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  timestamp: {
    fontSize: 12,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
  },
  movementInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  productSku: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_CONFIG.COLORS.PRIMARY,
  },
  quantity: {
    fontSize: 18,
    fontWeight: 'bold',
    color: APP_CONFIG.COLORS.SUCCESS,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationLabel: {
    fontSize: 13,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    marginRight: 8,
    width: 40,
  },
  locationValue: {
    fontSize: 13,
    fontWeight: '600',
    color: APP_CONFIG.COLORS.TEXT,
  },
  lotNumber: {
    fontSize: 12,
    color: APP_CONFIG.COLORS.WARNING,
    marginTop: 4,
  },
  notes: {
    fontSize: 12,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    marginTop: 4,
    fontStyle: 'italic',
  },
  username: {
    fontSize: 11,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    marginTop: 6,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    marginBottom: 20,
  },
  clearButton: {
    backgroundColor: APP_CONFIG.COLORS.PRIMARY,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

export default HistoryScreen;
