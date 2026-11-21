/**
 * App.tsx – Root Entry Point for Antigravity Remote
 *
 * Configures Navigation, dark theme, and Status Bar.
 */

import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { ChatScreen } from './src/screens/ChatScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

export type RootStackParamList = {
  Chat: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const customDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0a0d16',
    card: '#0f1320',
    text: '#ffffff',
    border: 'rgba(255, 255, 255, 0.08)',
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={customDarkTheme}>
        <Stack.Navigator
          initialRouteName="Chat"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#0f1320',
            },
            headerTintColor: '#ffffff',
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 17,
            },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={({ navigation }) => ({
              title: '🚀 Antigravity Remote',
              headerRight: () => (
                <Pressable
                  onPress={() => navigation.navigate('Settings')}
                  style={styles.headerButton}
                  hitSlop={12}
                >
                  <Ionicons name="settings-outline" size={22} color="#cbd5e1" />
                </Pressable>
              ),
            })}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              title: 'Settings & Connection',
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    padding: 6,
    borderRadius: 8,
  },
});
