/**
 * SettingsScreen – Configure connection to Antigravity backend server
 *
 * Allows user to configure the backend IP/Port, test connection,
 * start/stop the agent remotely, and view status.
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import { WebSocketService } from '../services/websocket';
import { AppSettings, ConnectionStatus } from '../types';

const SETTINGS_KEY = '@antigravity_settings';
const DEFAULT_HOST = '192.168.1.100';
const DEFAULT_PORT = '8765';

interface SettingsScreenProps {
  navigation: any;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const [host, setHost] = useState(DEFAULT_HOST);
  const [port, setPort] = useState(DEFAULT_PORT);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [agentActive, setAgentActive] = useState<boolean | null>(null);

  useEffect(() => {
    loadSettings();
    const ws = WebSocketService.getInstance();
    setConnectionStatus(ws.getStatus());
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as AppSettings;
        setHost(parsed.serverHost);
        setPort(parsed.serverPort);
        checkServerStatus(parsed.serverHost, parsed.serverPort);
      } else {
        checkServerStatus(DEFAULT_HOST, DEFAULT_PORT);
      }
    } catch (e) {
      // ignore
    }
  };

  const checkServerStatus = async (targetHost: string, targetPort: string) => {
    try {
      setLoading(true);
      const res = await fetch(`http://${targetHost}:${targetPort}/api/status`, {
        method: 'GET',
      });
      if (res.ok) {
        const data = await res.json();
        setAgentActive(data.agent_active);
      } else {
        setAgentActive(null);
      }
    } catch (e) {
      setAgentActive(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const trimmedHost = host.trim();
    const trimmedPort = port.trim();

    if (!trimmedHost || !trimmedPort) {
      Alert.alert('Validation Error', 'Please enter a valid host and port.');
      return;
    }

    try {
      const settings: AppSettings = {
        serverHost: trimmedHost,
        serverPort: trimmedPort,
      };
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Reconnect WebSocket to new target
      const url = `ws://${trimmedHost}:${trimmedPort}/ws`;
      const ws = WebSocketService.resetInstance(url);
      ws.connect();
      setConnectionStatus('connecting');

      checkServerStatus(trimmedHost, trimmedPort);
      Alert.alert('Saved', 'Server settings saved successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Error', 'Failed to save settings.');
    }
  };

  const toggleAgent = async (start: boolean) => {
    try {
      setActionLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const endpoint = start ? 'start' : 'stop';
      const res = await fetch(`http://${host.trim()}:${port.trim()}/api/agent/${endpoint}`, {
        method: 'POST',
      });
      if (res.ok) {
        setAgentActive(start);
        Alert.alert('Success', `Agent ${start ? 'started' : 'stopped'} successfully.`);
      } else {
        const err = await res.json();
        Alert.alert('Error', err.message || `Failed to ${endpoint} agent.`);
      }
    } catch (e: any) {
      Alert.alert('Error', `Could not reach server: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Section: Server Config */}
          <Text style={styles.sectionHeader}>SERVER CONNECTION</Text>
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Laptop IP / Hostname</Text>
              <TextInput
                style={styles.input}
                value={host}
                onChangeText={setHost}
                placeholder="e.g. 192.168.1.100"
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Port</Text>
              <TextInput
                style={styles.input}
                value={port}
                onChangeText={setPort}
                placeholder="8765"
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Action Buttons */}
          <Pressable style={styles.primaryButton} onPress={handleSave}>
            <Ionicons name="save-outline" size={18} color="#ffffff" style={styles.btnIcon} />
            <Text style={styles.primaryButtonText}>Save & Reconnect</Text>
          </Pressable>

          {/* Section: Status */}
          <Text style={styles.sectionHeader}>SERVER & AGENT STATUS</Text>
          <View style={styles.card}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>WebSocket Status</Text>
              <View style={styles.statusBadge}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        connectionStatus === 'connected'
                          ? '#22c55e'
                          : connectionStatus === 'connecting'
                          ? '#facc15'
                          : '#ef4444',
                    },
                  ]}
                />
                <Text style={styles.statusValue}>{connectionStatus.toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Antigravity Agent</Text>
              {loading ? (
                <ActivityIndicator size="small" color="#6366f1" />
              ) : (
                <Text
                  style={[
                    styles.statusValue,
                    { color: agentActive ? '#22c55e' : '#94a3b8' },
                  ]}
                >
                  {agentActive === true
                    ? 'RUNNING'
                    : agentActive === false
                    ? 'STOPPED'
                    : 'OFFLINE'}
                </Text>
              )}
            </View>
          </View>

          {/* Agent Controls */}
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.actionBtn, styles.startBtn]}
              onPress={() => toggleAgent(true)}
              disabled={actionLoading}
            >
              <Ionicons name="play" size={16} color="#22c55e" />
              <Text style={[styles.actionBtnText, { color: '#22c55e' }]}>Start Agent</Text>
            </Pressable>

            <Pressable
              style={[styles.actionBtn, styles.stopBtn]}
              onPress={() => toggleAgent(false)}
              disabled={actionLoading}
            >
              <Ionicons name="stop" size={16} color="#ef4444" />
              <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>Stop Agent</Text>
            </Pressable>
          </View>

          {/* Help Info Card */}
          <Text style={styles.sectionHeader}>HOW TO FIND YOUR LAPTOP'S IP</Text>
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={20} color="#818cf8" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoText}>
                On Windows, open PowerShell / CMD and run:
              </Text>
              <Text style={styles.codeSnippet}>ipconfig</Text>
              <Text style={styles.infoText}>
                Look for <Text style={styles.bold}>IPv4 Address</Text> under your active Wi-Fi adapter (e.g. 192.168.1.15). Make sure your phone and laptop are on the same Wi-Fi network.
              </Text>
            </View>
          </View>

          {/* App Version */}
          <Text style={styles.versionText}>Antigravity Remote v1.0.0</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0d16',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  inputGroup: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  label: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 6,
  },
  input: {
    color: '#ffffff',
    fontSize: 16,
    padding: 0,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginLeft: 16,
  },
  primaryButton: {
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  btnIcon: {
    marginRight: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  statusLabel: {
    color: '#cbd5e1',
    fontSize: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusValue: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  startBtn: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  stopBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  infoTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  infoText: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
  },
  codeSnippet: {
    color: '#a78bfa',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginVertical: 6,
    fontSize: 13,
  },
  bold: {
    fontWeight: '700',
    color: '#ffffff',
  },
  versionText: {
    textAlign: 'center',
    color: '#475569',
    fontSize: 12,
    marginTop: 32,
    marginBottom: 16,
  },
});
