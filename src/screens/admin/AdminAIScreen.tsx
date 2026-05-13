import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator, ScrollView,
} from 'react-native';
import {
  collection, query, where, getDocs,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../constants/collections';
import { Booking } from '../../types';
import { theme } from '../../theme';

interface ChatMsg {
  role:    'user' | 'assistant';
  content: string;
}

interface Stats {
  totalBookings: number;
  monthRevenue: number;
  barberCount:  number;
  topService:   string;
  topBarber:    string;
}

const SUGGESTIONS = [
  'Revenue this month',
  'Top performing barber',
  'Booking trends',
  'Growth projections',
];

export default function AdminAIScreen() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input,    setInput]    = useState('');
  const [sending,  setSending]  = useState(false);
  const [stats,    setStats]    = useState<Stats>({
    totalBookings: 0,
    monthRevenue:  0,
    barberCount:   0,
    topService:    '—',
    topBarber:     '—',
  });
  const flatListRef = useRef<FlatList<ChatMsg>>(null);

  // ── Fetch business stats ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const loadStats = async () => {
      const bookingsSnap = await getDocs(collection(db, COLLECTIONS.BOOKINGS));
      const bookings: Booking[] = bookingsSnap.docs.map(d => ({
        id: d.id, ...d.data(),
        scheduledAt: d.data().scheduledAt?.toDate(),
        createdAt:   d.data().createdAt?.toDate(),
      } as Booking));

      const nonCancelled = bookings.filter(b => b.status !== 'cancelled');

      const now        = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthBookings = nonCancelled.filter(b => b.scheduledAt >= monthStart);
      const monthRevenue  = monthBookings.reduce(
        (sum, b) => sum + (b.servicePrice ?? 0), 0,
      );

      const serviceCounts = new Map<string, number>();
      nonCancelled.forEach(b => {
        if (!b.serviceName) return;
        serviceCounts.set(b.serviceName, (serviceCounts.get(b.serviceName) ?? 0) + 1);
      });
      const topService = Array.from(serviceCounts.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

      const barberRevenue = new Map<string, number>();
      nonCancelled.forEach(b => {
        if (!b.barberName) return;
        barberRevenue.set(
          b.barberName,
          (barberRevenue.get(b.barberName) ?? 0) + (b.servicePrice ?? 0),
        );
      });
      const topBarber = Array.from(barberRevenue.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

      const barbersQ = query(
        collection(db, COLLECTIONS.USERS),
        where('role', '==', 'barber'),
      );
      const barbersSnap = await getDocs(barbersQ);
      const barberCount = barbersSnap.size;

      if (cancelled) return;
      setStats({
        totalBookings: bookings.length,
        monthRevenue,
        barberCount,
        topService,
        topBarber,
      });
    };

    loadStats();
    return () => { cancelled = true; };
  }, []);

  // ── Send a message to Claude ───────────────────────────────
  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMsg: ChatMsg = { role: 'user', content: trimmed };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setSending(true);

    const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
    if (!apiKey) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content:
          'API key not configured. Set EXPO_PUBLIC_ANTHROPIC_API_KEY in .env and restart Expo.',
      }]);
      setSending(false);
      return;
    }

    const systemPrompt = `You are a business intelligence assistant for 613 Barbershop in Ottawa, Canada. You have access to the following real-time business data:
- Total bookings: ${stats.totalBookings}
- This month revenue: $${stats.monthRevenue}
- Active barbers: ${stats.barberCount}
- Most popular service: ${stats.topService}
- Top earning barber: ${stats.topBarber}

Answer questions about business performance, projections, and recommendations. Be concise, professional and data-driven. Format dollar amounts with $ prefix. Keep responses under 150 words.`;

    const conversationHistory = history.map(m => ({
      role:    m.role,
      content: m.content,
    }));

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':                              'application/json',
          'x-api-key':                                 apiKey,
          'anthropic-version':                         '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 1000,
          system:     systemPrompt,
          messages:   conversationHistory,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.content?.[0]?.text) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        }]);
        return;
      }

      const assistantMessage: string = data.content[0].text;
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: assistantMessage,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      }]);
    } finally {
      setSending(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const renderMessage = ({ item }: { item: ChatMsg }) => {
    const mine = item.role === 'user';
    return (
      <View style={[
        styles.msgWrapper,
        mine ? styles.msgWrapperMe : styles.msgWrapperThem,
      ]}>
        <View style={[
          styles.bubble,
          mine ? styles.bubbleMe : styles.bubbleThem,
        ]}>
          {mine ? (
            <Text style={[
              styles.bubbleText,
              styles.bubbleTextMe,
            ]}>
              {item.content}
            </Text>
          ) : (
            <Markdown style={{
              body: {
                color: theme.colors.textPrimary,
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes.md,
              },
              strong: {
                color: theme.colors.gold,
                fontFamily: theme.fonts.bold,
              },
              heading1: {
                color: theme.colors.gold,
                fontFamily: theme.fonts.heading,
                fontSize: theme.fontSizes.lg,
                letterSpacing: 2,
              },
              bullet_list: { color: theme.colors.textPrimary },
            }}>
              {item.content}
            </Markdown>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="sparkles" size={20} color={theme.colors.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>AI ASSISTANT</Text>
          <Text style={styles.headerSubtitle}>Business Intelligence</Text>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, i) => i.toString()}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <View style={styles.emptyIcon}>
              <Ionicons name="bulb-outline" size={32} color={theme.colors.gold} />
            </View>
            <Text style={styles.emptyTitle}>Ask anything about your business</Text>
            <Text style={styles.emptyText}>
              I have real-time data on bookings, revenue, barbers, and trends.
            </Text>
          </View>
        }
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
      />

      {/* Loading indicator */}
      {sending && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={theme.colors.gold} />
          <Text style={styles.loadingText}>Thinking…</Text>
        </View>
      )}

      {/* Suggestion chips */}
      {messages.length === 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.suggestionsRow}
        >
          {SUGGESTIONS.map(s => (
            <TouchableOpacity
              key={s}
              style={styles.suggestionChip}
              onPress={() => sendMessage(s)}
              disabled={sending}
            >
              <Ionicons name="flash-outline" size={12} color={theme.colors.gold} />
              <Text style={styles.suggestionText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask about revenue, bookings, projections…"
          placeholderTextColor={theme.colors.textMuted}
          multiline
          maxLength={500}
          editable={!sending}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!input.trim() || sending) && styles.sendBtnDisabled,
          ]}
          onPress={() => sendMessage(input)}
          disabled={!input.trim() || sending}
        >
          {sending
            ? <ActivityIndicator size="small" color={theme.colors.textInverse} />
            : <Ionicons name="send" size={18} color={theme.colors.textInverse} />
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.goldMuted,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xl,
    color: theme.colors.textPrimary,
    letterSpacing: 4,
  },
  headerSubtitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.gold,
    letterSpacing: 2,
    marginTop: 2,
  },
  messagesList: {
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    flexGrow: 1,
  },
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.goldMuted,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  emptyTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.textPrimary,
    letterSpacing: 2,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  msgWrapper: {
    maxWidth: '85%',
  },
  msgWrapperMe: {
    alignSelf: 'flex-end',
  },
  msgWrapperThem: {
    alignSelf: 'flex-start',
  },
  bubble: {
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  bubbleMe: {
    backgroundColor: theme.colors.gold,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    lineHeight: 22,
  },
  bubbleTextMe: {
    color: theme.colors.textInverse,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  loadingText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textMuted,
  },
  suggestionsRow: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    borderRadius: theme.radius.full,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    marginRight: theme.spacing.sm,
  },
  suggestionText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.gold,
    letterSpacing: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.md,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.gold,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
});