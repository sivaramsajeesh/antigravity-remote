/**
 * MessageBubble – Renders a single chat message
 *
 * Visual styles differ by role:
 *  • user      → right-aligned, blue-purple gradient
 *  • assistant → left-aligned, dark translucent glass
 *  • system    → centered, small italic text
 *
 * Features:
 *  - Lightweight native Markdown rendering (zero external dependencies)
 *  - Streaming cursor animation (blinking "▌")
 *  - Long-press to copy content
 *  - Fade-in entrance animation
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

import { SimpleMarkdown } from './SimpleMarkdown';
import { Message } from '../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
  message: Message;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  // ---- Fade-in animation ----
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;

  // ---- Blinking cursor for streaming ----
  const cursorOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    if (message.isStreaming) {
      const blink = Animated.loop(
        Animated.sequence([
          Animated.timing(cursorOpacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(cursorOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      );
      blink.start();
      return () => blink.stop();
    } else {
      cursorOpacity.setValue(1);
    }
  }, [message.isStreaming, cursorOpacity]);

  // ---- Long-press to copy ----
  const handleLongPress = async () => {
    await Clipboard.setStringAsync(message.content);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // ---- Format timestamp ----
  const formattedTime = React.useMemo(() => {
    try {
      const date = new Date(message.timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }, [message.timestamp]);

  // ---- System messages ----
  if (message.role === 'system') {
    return (
      <Animated.View
        style={[
          styles.systemContainer,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <Text style={styles.systemText}>{message.content}</Text>
      </Animated.View>
    );
  }

  const isUser = message.role === 'user';

  return (
    <Animated.View
      style={[
        styles.row,
        isUser ? styles.rowUser : styles.rowAssistant,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Pressable
        onLongPress={handleLongPress}
        delayLongPress={400}
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
        ]}
      >
        {/* Content */}
        {isUser ? (
          <Text style={styles.userText}>{message.content}</Text>
        ) : (
          <View style={styles.markdownWrap}>
            <SimpleMarkdown content={message.content} />
            {/* Blinking cursor while streaming */}
            {message.isStreaming && (
              <Animated.Text
                style={[styles.cursor, { opacity: cursorOpacity }]}
              >
                ▌
              </Animated.Text>
            )}
          </View>
        )}

        {/* Timestamp */}
        <Text
          style={[
            styles.timestamp,
            isUser ? styles.timestampUser : styles.timestampAssistant,
          ]}
        >
          {formattedTime}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

export default React.memo(MessageBubble);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 12,
    marginVertical: 4,
    flexDirection: 'row',
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowAssistant: {
    justifyContent: 'flex-start',
  },

  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: '#4f46e5',
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderBottomLeftRadius: 4,
  },

  userText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 21,
  },

  markdownWrap: {
    flexDirection: 'column',
  },
  cursor: {
    color: '#a78bfa',
    fontSize: 16,
    marginTop: -4,
  },

  timestamp: {
    fontSize: 10,
    marginTop: 4,
  },
  timestampUser: {
    color: 'rgba(255, 255, 255, 0.55)',
    textAlign: 'right',
  },
  timestampAssistant: {
    color: 'rgba(255, 255, 255, 0.35)',
    textAlign: 'left',
  },

  // ---- System messages ----
  systemContainer: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 24,
  },
  systemText: {
    color: 'rgba(255, 255, 255, 0.40)',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
