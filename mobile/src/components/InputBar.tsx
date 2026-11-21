/**
 * InputBar – Message composition bar at the bottom of the chat
 *
 * Features:
 *  - Multi-line TextInput that grows up to 4 lines
 *  - Send button with an arrow icon (highlights when text is present)
 *  - Disabled state while the agent is responding
 *  - Dark themed with subtle border
 *  - Safe-area bottom padding
 */

import React, { useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface InputBarProps {
  /** Called when the user presses Send */
  onSend: (text: string) => void;
  /** True while the assistant is streaming a response */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const InputBar: React.FC<InputBarProps> = ({ onSend, disabled = false }) => {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');

  const canSend = text.trim().length > 0 && !disabled;

  /** Send the current text and clear the input */
  const handleSend = useCallback(() => {
    if (!canSend) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSend(text.trim());
    setText('');
  }, [canSend, onSend, text]);

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, 8) },
      ]}
    >
      <View style={styles.inputRow}>
        {/* Text input */}
        <TextInput
          style={[styles.input, disabled && styles.inputDisabled]}
          value={text}
          onChangeText={setText}
          placeholder="Ask Antigravity…"
          placeholderTextColor="rgba(255,255,255,0.30)"
          multiline
          maxLength={4000}
          numberOfLines={1}
          textAlignVertical="center"
          editable={!disabled}
          returnKeyType="default"
          blurOnSubmit={false}
          // Let the input grow up to ~4 lines before scrolling
          // (each line ≈ 20pt, so max height ≈ 80 + padding)
        />

        {/* Send button */}
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          style={({ pressed }) => [
            styles.sendButton,
            canSend ? styles.sendButtonActive : styles.sendButtonInactive,
            pressed && canSend && styles.sendButtonPressed,
          ]}
          hitSlop={8}
        >
          <Ionicons
            name="arrow-up"
            size={20}
            color={canSend ? '#ffffff' : 'rgba(255,255,255,0.25)'}
          />
        </Pressable>
      </View>
    </View>
  );
};

export default React.memo(InputBar);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0f1320',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },

  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    color: '#e2e8f0',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 100, // ~4 lines
    minHeight: 40,
  },
  inputDisabled: {
    opacity: 0.5,
  },

  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    marginBottom: 2,
  },
  sendButtonActive: {
    backgroundColor: '#6366f1',
  },
  sendButtonInactive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sendButtonPressed: {
    backgroundColor: '#4f46e5',
    transform: [{ scale: 0.92 }],
  },
});
