/**
 * SimpleMarkdown.tsx
 *
 * Lightweight, zero-dependency Markdown renderer designed specifically for React 19 & Expo 58.
 * Supports:
 *  - Fenced code blocks with dark background and monospaced font
 *  - Inline code `code`
 *  - Headings (# H1, ## H2, ### H3)
 *  - Bold (**text**) and Italic (*text*)
 *  - Bullet lists (- item)
 *  - Paragraphs & line breaks
 */

import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

interface SimpleMarkdownProps {
  content: string;
}

export const SimpleMarkdown: React.FC<SimpleMarkdownProps> = ({ content }) => {
  if (!content) return null;

  // Split by code blocks first
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <View style={styles.container}>
      {parts.map((part, index) => {
        if (!part) return null;

        // Code block
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).trim().split('\n');
          // First line might be language identifier (e.g. ```python)
          let codeText = lines.join('\n');
          if (lines.length > 1 && !lines[0].includes(' ') && lines[0].length < 15) {
            codeText = lines.slice(1).join('\n');
          }

          return (
            <View key={index} style={styles.codeBlock}>
              <Text style={styles.codeText}>{codeText}</Text>
            </View>
          );
        }

        // Regular markdown text (paragraphs, headings, lists)
        const lines = part.split('\n');
        return (
          <View key={index}>
            {lines.map((line, lineIdx) => {
              const trimmed = line.trim();

              // Heading 1
              if (trimmed.startsWith('# ')) {
                return (
                  <Text key={lineIdx} style={styles.h1}>
                    {renderInline(trimmed.slice(2))}
                  </Text>
                );
              }

              // Heading 2
              if (trimmed.startsWith('## ')) {
                return (
                  <Text key={lineIdx} style={styles.h2}>
                    {renderInline(trimmed.slice(3))}
                  </Text>
                );
              }

              // Heading 3
              if (trimmed.startsWith('### ')) {
                return (
                  <Text key={lineIdx} style={styles.h3}>
                    {renderInline(trimmed.slice(4))}
                  </Text>
                );
              }

              // Bullet list
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return (
                  <View key={lineIdx} style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>
                      {renderInline(trimmed.slice(2))}
                    </Text>
                  </View>
                );
              }

              // Blank line
              if (!trimmed) {
                return <View key={lineIdx} style={styles.spacer} />;
              }

              // Regular paragraph
              return (
                <Text key={lineIdx} style={styles.paragraph}>
                  {renderInline(line)}
                </Text>
              );
            })}
          </View>
        );
      })}
    </View>
  );
};

/** Parse inline markdown: `code`, **bold**, *italic* */
function renderInline(text: string): React.ReactNode[] {
  // Regex to match inline tokens
  const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  const segments = text.split(tokenRegex);

  return segments.map((seg, idx) => {
    if (!seg) return null;

    // Inline code: `text`
    if (seg.startsWith('`') && seg.endsWith('`') && seg.length >= 2) {
      return (
        <Text key={idx} style={styles.inlineCode}>
          {seg.slice(1, -1)}
        </Text>
      );
    }

    // Bold: **text**
    if (seg.startsWith('**') && seg.endsWith('**') && seg.length >= 4) {
      return (
        <Text key={idx} style={styles.bold}>
          {seg.slice(2, -2)}
        </Text>
      );
    }

    // Italic: *text*
    if (seg.startsWith('*') && seg.endsWith('*') && seg.length >= 2) {
      return (
        <Text key={idx} style={styles.italic}>
          {seg.slice(1, -1)}
        </Text>
      );
    }

    return <Text key={idx}>{seg}</Text>;
  });
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
  },
  paragraph: {
    color: '#e2e8f0',
    fontSize: 15,
    lineHeight: 22,
    marginVertical: 2,
  },
  h1: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  h2: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 4,
  },
  h3: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 2,
  },
  bold: {
    color: '#ffffff',
    fontWeight: '700',
  },
  italic: {
    color: '#cbd5e1',
    fontStyle: 'italic',
  },
  inlineCode: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    color: '#c084fc',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  codeBlock: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 10,
    marginVertical: 6,
  },
  codeText: {
    color: '#e2e8f0',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    lineHeight: 19,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 2,
    paddingLeft: 4,
  },
  bulletDot: {
    color: '#818cf8',
    fontSize: 16,
    marginRight: 6,
    lineHeight: 22,
  },
  bulletText: {
    color: '#e2e8f0',
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  spacer: {
    height: 6,
  },
});
