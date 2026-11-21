/**
 * ChatScreen – Main conversation screen for Antigravity Remote
 *
 * Provides real-time chat with the Antigravity agent running on your laptop.
 * Streams responses token-by-token, renders Markdown, and supports history retrieval.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import InputBar from '../components/InputBar';
import MessageBubble from '../components/MessageBubble';
import StatusIndicator from '../components/StatusIndicator';
import { WebSocketService } from '../services/websocket';
import {
  AppSettings,
  ConnectionStatus,
  Message,
  WebSocketMessageInbound,
} from '../types';

const SETTINGS_KEY = '@antigravity_settings';
const DEFAULT_HOST = '192.168.1.100';
const DEFAULT_PORT = '8765';

interface ChatScreenProps {
  navigation: any;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ navigation }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [agentActive, setAgentActive] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [settings, setSettings] = useState<AppSettings>({
    serverHost: DEFAULT_HOST,
    serverPort: DEFAULT_PORT,
  });

  const flatListRef = useRef<FlatList<Message>>(null);
  const wsServiceRef = useRef<WebSocketService | null>(null);

  // Load saved settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const saved = await AsyncStorage.getItem(SETTINGS_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as AppSettings;
          setSettings(parsed);
          initWebSocket(parsed.serverHost, parsed.serverPort);
        } else {
          initWebSocket(DEFAULT_HOST, DEFAULT_PORT);
        }
      } catch (e) {
        initWebSocket(DEFAULT_HOST, DEFAULT_PORT);
      }
    };

    loadSettings();

    return () => {
      wsServiceRef.current?.disconnect();
    };
  }, []);

  // Listen for navigation focus to re-connect if host changed in settings
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      try {
        const saved = await AsyncStorage.getItem(SETTINGS_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as AppSettings;
          if (
            parsed.serverHost !== settings.serverHost ||
            parsed.serverPort !== settings.serverPort
          ) {
            setSettings(parsed);
            initWebSocket(parsed.serverHost, parsed.serverPort);
          }
        }
      } catch (e) {
        // ignore
      }
    });

    return unsubscribe;
  }, [navigation, settings]);

  const initWebSocket = (host: string, port: string) => {
    const url = `ws://${host}:${port}/ws`;
    const ws = WebSocketService.resetInstance(url);
    wsServiceRef.current = ws;

    ws.onStatusChange = (newStatus) => {
      setStatus(newStatus);
    };

    ws.onConnect = () => {
      fetchHistory(host, port);
    };

    ws.onMessage = (msg: WebSocketMessageInbound) => {
      handleIncomingMessage(msg);
    };

    ws.connect();
  };

  const handleIncomingMessage = (msg: WebSocketMessageInbound) => {
    switch (msg.type) {
      case 'status':
        setAgentActive(msg.agent_active);
        break;

      case 'response_start':
        setIsStreaming(true);
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: '',
            timestamp: new Date().toISOString(),
            isStreaming: true,
          },
        ]);
        break;

      case 'token':
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          const lastMsg = updated[lastIdx];

          if (lastMsg.role === 'assistant' && lastMsg.isStreaming) {
            updated[lastIdx] = {
              ...lastMsg,
              content: lastMsg.content + msg.content,
            };
          }
          return updated;
        });
        break;

      case 'response_end':
        setIsStreaming(false);
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          const lastMsg = updated[lastIdx];

          if (lastMsg.role === 'assistant') {
            updated[lastIdx] = {
              ...lastMsg,
              content: msg.full_response || lastMsg.content,
              isStreaming: false,
            };
          }
          return updated;
        });
        break;

      case 'error':
        setIsStreaming(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `system-err-${Date.now()}`,
            role: 'system',
            content: `⚠️ Error: ${msg.message}`,
            timestamp: new Date().toISOString(),
          },
        ]);
        break;

      default:
        break;
    }
  };

  // Fetch conversation history from REST API
  const fetchHistory = async (host = settings.serverHost, port = settings.serverPort) => {
    try {
      setRefreshing(true);
      const res = await fetch(`http://${host}:${port}/api/history`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.history) && data.history.length > 0) {
          const loaded: Message[] = data.history.map((item: any, idx: number) => ({
            id: `history-${idx}-${Date.now()}`,
            role: item.role,
            content: item.content,
            timestamp: new Date().toISOString(),
            isStreaming: false,
          }));
          setMessages(loaded);
        }
      }
    } catch (e) {
      // Offline / history not reachable
    } finally {
      setRefreshing(false);
    }
  };

  const handleSend = useCallback(
    (text: string) => {
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);

      const sent = wsServiceRef.current?.send({
        type: 'message',
        content: text,
      });

      if (!sent) {
        setMessages((prev) => [
          ...prev,
          {
            id: `system-warn-${Date.now()}`,
            role: 'system',
            content: '⚠️ Message could not be sent. Please check connection.',
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    },
    [wsServiceRef]
  );

  const handleReconnect = () => {
    wsServiceRef.current?.connect();
  };

  // Auto-scroll when messages update
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <StatusIndicator
        status={status}
        host={settings.serverHost}
        port={settings.serverPort}
        onReconnect={handleReconnect}
      />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          contentContainerStyle={[
            styles.messageList,
            messages.length === 0 && styles.emptyList,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchHistory()}
              tintColor="#6366f1"
              colors={['#6366f1']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="rocket-outline" size={40} color="#818cf8" />
              </View>
              <Text style={styles.emptyTitle}>Antigravity Remote</Text>
              <Text style={styles.emptySubtitle}>
                Control your laptop's AI coding assistant from anywhere in your home.
              </Text>
              <View style={styles.emptyHints}>
                <Text style={styles.hintItem}>• "List all files in workspace"</Text>
                <Text style={styles.hintItem}>• "Run git status and show diff"</Text>
                <Text style={styles.hintItem}>• "Fix the bug in main.py"</Text>
              </View>
            </View>
          }
        />

        <InputBar onSend={handleSend} disabled={isStreaming || status !== 'connected'} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0d16',
  },
  keyboardContainer: {
    flex: 1,
  },
  messageList: {
    paddingVertical: 12,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.55)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyHints: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  hintItem: {
    color: '#94a3b8',
    fontSize: 13,
    marginVertical: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
