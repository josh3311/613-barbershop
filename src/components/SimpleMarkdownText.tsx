import React from 'react';
import { Text, StyleSheet, TextStyle, StyleProp } from 'react-native';

type Props = {
  text: string;
  style?: StyleProp<TextStyle>;
};

/**
 * Minimal markdown: **bold**, *italic*, line breaks.
 */
export default function SimpleMarkdownText({ text, style }: Props): React.JSX.Element {
  const lines = text.split('\n');
  let gKey = 0;
  const nextKey = (): string => `m${gKey++}`;
  return (
    <Text style={[styles.base, style]}>
      {lines.map((line, lineIdx) => (
        <React.Fragment key={`L${lineIdx}`}>
          {lineIdx > 0 ? '\n' : null}
          {parseLine(line, nextKey)}
        </React.Fragment>
      ))}
    </Text>
  );
}

function parseLine(line: string, nextKey: () => string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const boldParts = line.split('**');
  for (let i = 0; i < boldParts.length; i++) {
    const chunk = boldParts[i];
    if (i % 2 === 1) {
      nodes.push(
        <Text key={nextKey()} style={styles.bold}>
          {parseItalicsInPlain(chunk, nextKey)}
        </Text>,
      );
    } else {
      nodes.push(...parseItalicsInPlain(chunk, nextKey));
    }
  }
  return nodes;
}

function parseItalicsInPlain(s: string, nextKey: () => string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let buf = '';
  let italic = false;
  const flush = (): void => {
    if (!buf) return;
    out.push(
      <Text key={nextKey()} style={italic ? styles.italic : undefined}>
        {buf}
      </Text>,
    );
    buf = '';
  };

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '*' && (i + 1 >= s.length || s[i + 1] !== '*') && (i === 0 || s[i - 1] !== '*')) {
      flush();
      italic = !italic;
    } else {
      buf += ch;
    }
  }
  flush();
  return out;
}

const styles = StyleSheet.create({
  base: { fontSize: 15, color: '#FFFFFF', lineHeight: 21 },
  bold: { fontWeight: '800', color: '#FFFFFF' },
  italic: { fontStyle: 'italic', color: '#FFFFFF' },
});
