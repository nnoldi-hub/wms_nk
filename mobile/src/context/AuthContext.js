import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';
import { APP_CONFIG } from '../config/config';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user from storage on mount
  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const token = await AsyncStorage.getItem(APP_CONFIG.STORAGE_KEYS.TOKEN);
      const userData = await AsyncStorage.getItem(APP_CONFIG.STORAGE_KEYS.USER);
      
      if (token && userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const response = await authAPI.login(username, password);
      const { accessToken, refreshToken, user: userData } = response.data;

      // Save to storage
      await AsyncStorage.multiSet([
        [APP_CONFIG.STORAGE_KEYS.TOKEN, accessToken],
        [APP_CONFIG.STORAGE_KEYS.REFRESH_TOKEN, refreshToken],
        [APP_CONFIG.STORAGE_KEYS.USER, JSON.stringify(userData)],
      ]);

      setUser(userData);
      return { success: true, user: userData };
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed';
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout API failed:', error);
    } finally {
      // Clear storage and state
      await AsyncStorage.multiRemove([
        APP_CONFIG.STORAGE_KEYS.TOKEN,
        APP_CONFIG.STORAGE_KEYS.REFRESH_TOKEN,
        APP_CONFIG.STORAGE_KEYS.USER,
      ]);
      setUser(null);
    }
  };

  const register = async (userData) => {
    try {
      const response = await authAPI.register(userData);
      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed';
      return { success: false, error: message };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        register,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
