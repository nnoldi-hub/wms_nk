import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { locationsAPI } from '../services/api';
import { APP_CONFIG } from '../config/config';

const LocationsScreen = ({ navigation }) => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterZone, setFilterZone] = useState('');

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async (isRefresh = false) => {
    if (loading && !isRefresh) return;

    setLoading(true);

    try {
      const response = await locationsAPI.getAll({
        zone: filterZone || undefined,
        search: search || undefined,
      });

      if (response.data.success) {
        setLocations(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load locations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadLocations(true);
  }, [search, filterZone]);

  const handleSearch = () => {
    loadLocations(true);
  };

  const getOccupancyColor = (itemCount) => {
    if (itemCount === 0) return APP_CONFIG.COLORS.TEXT_SECONDARY;
    if (itemCount < 3) return APP_CONFIG.COLORS.SUCCESS;
    if (itemCount < 5) return APP_CONFIG.COLORS.WARNING;
    return APP_CONFIG.COLORS.ERROR;
  };

  const renderLocation = ({ item }) => {
    const itemCount = parseInt(item.item_count) || 0;
    const totalQty = parseFloat(item.total_quantity) || 0;
    const isActive = item.is_active !== false;

    return (
      <TouchableOpacity
        style={[styles.card, !isActive && styles.cardInactive]}
        onPress={() => navigation.navigate('LocationDetails', { locationId: item.id })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.locationInfo}>
            <Text style={styles.locationId}>{item.id}</Text>
            {!isActive && (
              <View style={styles.inactiveBadge}>
                <Text style={styles.inactiveBadgeText}>INACTIVE</Text>
              </View>
            )}
          </View>
          <View style={[styles.occupancyBadge, { backgroundColor: getOccupancyColor(itemCount) }]}>
            <Text style={styles.occupancyText}>{itemCount} items</Text>
          </View>
        </View>

        <View style={styles.locationPath}>
          {item.zone && (
            <View style={styles.pathSegment}>
              <Text style={styles.pathLabel}>Zone</Text>
              <Text style={styles.pathValue}>{item.zone}</Text>
            </View>
          )}
          {item.rack && (
            <>
              <Text style={styles.pathSeparator}>→</Text>
              <View style={styles.pathSegment}>
                <Text style={styles.pathLabel}>Rack</Text>
                <Text style={styles.pathValue}>{item.rack}</Text>
              </View>
            </>
          )}
          {item.position && (
            <>
              <Text style={styles.pathSeparator}>→</Text>
              <View style={styles.pathSegment}>
                <Text style={styles.pathLabel}>Position</Text>
                <Text style={styles.pathValue}>{item.position}</Text>
              </View>
            </>
          )}
        </View>

        {item.allowed_types && item.allowed_types.length > 0 && (
          <View style={styles.allowedTypes}>
            <Text style={styles.allowedTypesLabel}>Allowed:</Text>
            <Text style={styles.allowedTypesText} numberOfLines={1}>
              {item.allowed_types.join(', ')}
            </Text>
          </View>
        )}

        <View style={styles.cardFooter}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Total Quantity</Text>
            <Text style={styles.statValue}>{totalQty.toFixed(2)}</Text>
          </View>
          {item.capacity_m3 && (
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Capacity</Text>
              <Text style={styles.statValue}>{item.capacity_m3} m³</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>📍</Text>
        <Text style={styles.emptyText}>No locations found</Text>
        {(search || filterZone) && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => {
              setSearch('');
              setFilterZone('');
              loadLocations(true);
            }}
          >
            <Text style={styles.clearButtonText}>Clear Filters</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search & Filter Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search locations..."
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>🔍</Text>
        </TouchableOpacity>
      </View>

      {/* Zone Filter */}
      <View style={styles.filterContainer}>
        <Text style={styles.filterLabel}>Filter by Zone:</Text>
        <TextInput
          style={styles.filterInput}
          placeholder="All zones"
          value={filterZone}
          onChangeText={setFilterZone}
          onSubmitEditing={handleSearch}
        />
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statsItem}>
          <Text style={styles.statsValue}>{locations.length}</Text>
          <Text style={styles.statsLabel}>Total</Text>
        </View>
        <View style={styles.statsItem}>
          <Text style={styles.statsValue}>
            {locations.filter(l => l.is_active !== false).length}
          </Text>
          <Text style={styles.statsLabel}>Active</Text>
        </View>
        <View style={styles.statsItem}>
          <Text style={styles.statsValue}>
            {locations.filter(l => parseInt(l.item_count) > 0).length}
          </Text>
          <Text style={styles.statsLabel}>Occupied</Text>
        </View>
      </View>

      {/* Locations List */}
      {loading && !refreshing ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={APP_CONFIG.COLORS.PRIMARY} />
        </View>
      ) : (
        <FlatList
          data={locations}
          renderItem={renderLocation}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[APP_CONFIG.COLORS.PRIMARY]}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_CONFIG.COLORS.BACKGROUND,
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: APP_CONFIG.COLORS.CARD,
    borderBottomWidth: 1,
    borderBottomColor: APP_CONFIG.COLORS.BORDER,
  },
  searchInput: {
    flex: 1,
    backgroundColor: APP_CONFIG.COLORS.BACKGROUND,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    marginRight: 8,
  },
  searchButton: {
    backgroundColor: APP_CONFIG.COLORS.PRIMARY,
    borderRadius: 8,
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    fontSize: 20,
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: APP_CONFIG.COLORS.CARD,
    borderBottomWidth: 1,
    borderBottomColor: APP_CONFIG.COLORS.BORDER,
  },
  filterLabel: {
    fontSize: 14,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    marginRight: 12,
  },
  filterInput: {
    flex: 1,
    backgroundColor: APP_CONFIG.COLORS.BACKGROUND,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: APP_CONFIG.COLORS.CARD,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: APP_CONFIG.COLORS.BORDER,
  },
  statsItem: {
    flex: 1,
    alignItems: 'center',
  },
  statsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: APP_CONFIG.COLORS.PRIMARY,
  },
  statsLabel: {
    fontSize: 12,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    marginTop: 4,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: APP_CONFIG.COLORS.CARD,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: APP_CONFIG.COLORS.BORDER,
    borderLeftWidth: 4,
    borderLeftColor: APP_CONFIG.COLORS.SUCCESS,
  },
  cardInactive: {
    borderLeftColor: APP_CONFIG.COLORS.TEXT_SECONDARY,
    opacity: 0.7,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationId: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_CONFIG.COLORS.PRIMARY,
    marginRight: 8,
  },
  inactiveBadge: {
    backgroundColor: APP_CONFIG.COLORS.TEXT_SECONDARY,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  inactiveBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  occupancyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  occupancyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  locationPath: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  pathSegment: {
    marginRight: 8,
  },
  pathLabel: {
    fontSize: 10,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    textTransform: 'uppercase',
  },
  pathValue: {
    fontSize: 14,
    fontWeight: '600',
    color: APP_CONFIG.COLORS.TEXT,
  },
  pathSeparator: {
    fontSize: 16,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    marginRight: 8,
  },
  allowedTypes: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: APP_CONFIG.COLORS.BACKGROUND,
    padding: 8,
    borderRadius: 6,
  },
  allowedTypesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    marginRight: 8,
  },
  allowedTypesText: {
    fontSize: 12,
    color: APP_CONFIG.COLORS.TEXT,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: APP_CONFIG.COLORS.BORDER,
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: APP_CONFIG.COLORS.TEXT,
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    marginBottom: 16,
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
});

export default LocationsScreen;
