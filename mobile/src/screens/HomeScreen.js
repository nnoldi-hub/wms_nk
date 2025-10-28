import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { APP_CONFIG } from '../config/config';

const HomeScreen = ({ navigation }) => {
  const { user, logout } = useAuth();

  const menuItems = [
    {
      id: 'scan',
      title: 'Scan Barcode',
      description: 'Scan product or location',
      icon: '📷',
      screen: 'Scanner',
      color: APP_CONFIG.COLORS.PRIMARY,
    },
    {
      id: 'products',
      title: 'Products',
      description: 'View all products',
      icon: '📦',
      screen: 'Products',
      color: APP_CONFIG.COLORS.SUCCESS,
    },
    {
      id: 'locations',
      title: 'Locations',
      description: 'View warehouse locations',
      icon: '📍',
      screen: 'Locations',
      color: APP_CONFIG.COLORS.WARNING,
    },
    {
      id: 'movements',
      title: 'Movements',
      description: 'Transfer inventory',
      icon: '🔄',
      screen: 'Movements',
      color: APP_CONFIG.COLORS.SECONDARY,
    },
    {
      id: 'history',
      title: 'History',
      description: 'View movement history',
      icon: '📋',
      screen: 'History',
      color: '#8b5cf6',
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello,</Text>
          <Text style={styles.userName}>{user?.username}</Text>
          <Text style={styles.userRole}>{user?.role?.toUpperCase()}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Menu Grid */}
      <ScrollView style={styles.content} contentContainerStyle={styles.grid}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.card, { borderLeftColor: item.color }]}
            onPress={() => navigation.navigate(item.screen)}
          >
            <Text style={styles.cardIcon}>{item.icon}</Text>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDescription}>{item.description}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_CONFIG.COLORS.BACKGROUND,
  },
  header: {
    backgroundColor: APP_CONFIG.COLORS.CARD,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: APP_CONFIG.COLORS.BORDER,
  },
  greeting: {
    fontSize: 16,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: APP_CONFIG.COLORS.TEXT,
    marginTop: 4,
  },
  userRole: {
    fontSize: 12,
    color: APP_CONFIG.COLORS.PRIMARY,
    fontWeight: '600',
    marginTop: 4,
  },
  logoutButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: APP_CONFIG.COLORS.ERROR,
  },
  logoutText: {
    color: APP_CONFIG.COLORS.ERROR,
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  grid: {
    padding: 16,
  },
  card: {
    backgroundColor: APP_CONFIG.COLORS.CARD,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: APP_CONFIG.COLORS.TEXT,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
  },
});

export default HomeScreen;
