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
import { productsAPI } from '../services/api';
import { APP_CONFIG } from '../config/config';

const ProductsScreen = ({ navigation }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async (isRefresh = false) => {
    if (loading || (!hasMore && !isRefresh)) return;

    const currentPage = isRefresh ? 1 : page;
    setLoading(true);

    try {
      const response = await productsAPI.getAll({
        page: currentPage,
        limit: APP_CONFIG.DEFAULT_PAGE_SIZE,
        search: search || undefined,
      });

      if (response.data.success) {
        const newProducts = response.data.data;
        setProducts(isRefresh ? newProducts : [...products, ...newProducts]);
        setHasMore(newProducts.length === APP_CONFIG.DEFAULT_PAGE_SIZE);
        setPage(currentPage + 1);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    loadProducts(true);
  }, []);

  const handleSearch = () => {
    setPage(1);
    setHasMore(true);
    setProducts([]);
    loadProducts(true);
  };

  const renderProduct = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('ProductDetails', { productSku: item.sku })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.sku}>{item.sku}</Text>
        <View style={[styles.badge, item.lot_control && styles.badgeLotControl]}>
          <Text style={styles.badgeText}>
            {item.lot_control ? 'LOT' : 'BULK'}
          </Text>
        </View>
      </View>
      
      <Text style={styles.name}>{item.name}</Text>
      
      {item.description && (
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
      )}

      <View style={styles.cardFooter}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Total Qty</Text>
          <Text style={styles.statValue}>{item.total_quantity || 0} {item.uom}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Locations</Text>
          <Text style={styles.statValue}>{item.total_count || 0}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

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
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search products..."
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>🔍</Text>
        </TouchableOpacity>
      </View>

      {/* Products List */}
      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={(item) => item.sku}
        contentContainerStyle={styles.list}
        onEndReached={() => loadProducts(false)}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          !loading && (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No products found</Text>
            </View>
          )
        }
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
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sku: {
    fontSize: 14,
    fontWeight: '600',
    color: APP_CONFIG.COLORS.PRIMARY,
  },
  badge: {
    backgroundColor: APP_CONFIG.COLORS.SECONDARY,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeLotControl: {
    backgroundColor: APP_CONFIG.COLORS.WARNING,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: APP_CONFIG.COLORS.TEXT,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
    marginBottom: 12,
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
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
  },
});

export default ProductsScreen;
