import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { APP_CONFIG } from '../config/config';

// Screens
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import ScannerScreen from '../screens/ScannerScreen';
import ProductsScreen from '../screens/ProductsScreen';
import ProductDetailsScreen from '../screens/ProductDetailsScreen';
import LocationsScreen from '../screens/LocationsScreen';
import LocationDetailsScreen from '../screens/LocationDetailsScreen';
import MovementsScreen from '../screens/MovementsScreen';
import HistoryScreen from '../screens/HistoryScreen';
import PickJobsScreen from '../screens/PickJobsScreen';
import PickJobDetailsScreen from '../screens/PickJobDetailsScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom Tab Navigator
const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: APP_CONFIG.COLORS.PRIMARY,
        tabBarInactiveTintColor: APP_CONFIG.COLORS.TEXT_SECONDARY,
        tabBarStyle: {
          backgroundColor: APP_CONFIG.COLORS.CARD,
          borderTopColor: APP_CONFIG.COLORS.BORDER,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Dashboard',
          headerShown: false,
          tabBarIcon: () => '🏠',
        }}
      />
      <Tab.Screen
        name="Products"
        component={ProductsScreen}
        options={{
          title: 'Products',
          headerStyle: { backgroundColor: APP_CONFIG.COLORS.CARD },
          headerTintColor: APP_CONFIG.COLORS.TEXT,
          tabBarIcon: () => '📦',
        }}
      />
      <Tab.Screen
        name="Scanner"
        component={ScannerScreen}
        options={{
          title: 'Scan',
          headerShown: false,
          tabBarIcon: () => '📷',
        }}
      />
      <Tab.Screen
        name="Jobs"
        component={PickJobsScreen}
        options={{
          title: 'Joburi',
          headerStyle: { backgroundColor: APP_CONFIG.COLORS.CARD },
          headerTintColor: APP_CONFIG.COLORS.TEXT,
          tabBarIcon: () => '🧾',
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: 'History',
          headerStyle: { backgroundColor: APP_CONFIG.COLORS.CARD },
          headerTintColor: APP_CONFIG.COLORS.TEXT,
          tabBarIcon: () => '📋',
        }}
      />
    </Tab.Navigator>
  );
};

// Main Navigation
const AppNavigator = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return null; // Or a loading screen
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: APP_CONFIG.COLORS.CARD },
          headerTintColor: APP_CONFIG.COLORS.TEXT,
        }}
      >
        {!isAuthenticated ? (
          // Auth Stack
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        ) : (
          // App Stack
          <>
            <Stack.Screen
              name="Main"
              component={TabNavigator}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ProductDetails"
              component={ProductDetailsScreen}
              options={{ title: 'Product Details' }}
            />
            <Stack.Screen
              name="Locations"
              component={LocationsScreen}
              options={{ title: 'Locations' }}
            />
            <Stack.Screen
              name="LocationDetails"
              component={LocationDetailsScreen}
              options={{ title: 'Location Details' }}
            />
            <Stack.Screen
              name="Movements"
              component={MovementsScreen}
              options={{ title: 'Create Movement' }}
            />
            <Stack.Screen
              name="PickJobDetails"
              component={PickJobDetailsScreen}
              options={{ title: 'Job' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
