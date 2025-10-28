import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { APP_CONFIG } from '../config/config';

const HistoryScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Movement History - Coming Soon</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: APP_CONFIG.COLORS.BACKGROUND,
  },
  text: {
    fontSize: 16,
    color: APP_CONFIG.COLORS.TEXT_SECONDARY,
  },
});

export default HistoryScreen;
