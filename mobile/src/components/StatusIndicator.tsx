/**
 * StatusIndicator – Connection status display
 *
 * Shows a colored dot + text indicating the WebSocket connection state.
 *  • Green  (pulsing) = connected
 *  • Yellow           = connecting
 *  • Red              = disconnected / error
 *
 * Tapping when disconnected triggers a reconnect.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ConnectionStatus } from '../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StatusIndicatorProps {
  status: ConnectionStatus;
  host?: string;
  port?: string;
  /** Called when the user taps the indicator while disconnected */
  onReconnect?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map connection status → dot colour */
const statusColor: Record<ConnectionStatus, string> = {
  connected: '#22c55e',
  connecting: '#facc15',
  disconnected: '#ef4444',
  error: '#ef4444',
};

/** Map connection status → human-readable label */
const statusLabel = (
  s: ConnectionStatus,
  host?: string,
  port?: string,
): string => {
  switch (s) {
    case 'connected':
      return host ? `Connected to ${host}:${port ?? '8765'}` : 'Connected';
    case 'connecting':
      return 'Connecting…';
    case 'disconnected':
      return 'Disconnected – tap to reconnect';
    case 'error':
      return 'Connection error – tap to retry';
  }
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  host,
  port,
  onReconnect,
}) => {
  // ---- Pulsing animation for the "connected" dot ----
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status === 'connected') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.35,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [status, pulseAnim]);

  const canTap = status === 'disconnected' || status === 'error';

  return (
    <Pressable
      onPress={canTap ? onReconnect : undefined}
      disabled={!canTap}
      style={({ pressed }) => [
        styles.container,
        pressed && canTap && styles.containerPressed,
      ]}
    >
      {/* Coloured dot */}
      <Animated.View
        style={[
          styles.dot,
          {
            backgroundColor: statusColor[status],
            opacity: status === 'connected' ? pulseAnim : 1,
          },
        ]}
      />

      {/* Label */}
      <Text style={styles.label} numberOfLines={1}>
        {statusLabel(status, host, port)}
      </Text>
    </Pressable>
  );
};

export default React.memo(StatusIndicator);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  containerPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },

  label: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    flexShrink: 1,
  },
});
