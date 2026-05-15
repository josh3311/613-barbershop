import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator, ScrollView,
} from 'react-native';
import {
  collection, query, where, orderBy,
  onSnapshot, addDoc, updateDoc, doc,
  serverTimestamp, getDocs,
} from 'firebase/firestore';
import { Ionicons }    from '@expo/vector-icons';
import Markdown        from 'react-native-markdown-display';
import { db }          from '../../config/firebase';
import { useAuth }     from '../../context/AuthContext';
import { COLLECTIONS } from '../../constants/collections';
import { AiChatMessage, AiChatSession, Service } from '../../types';
import { theme }       from '../../theme';

const AI_CHATS = 'aiChats'; // add to COLLECTIONS constant

const SUGGESTIONS = [
  'What styles suit my face?',
  'How do I book an appointment?',
  'What services do you offer?',
  'How much does a fade cost?',
];

export default function AIStylistChatScreen() {
  const { user } = useAuth();
  const flatListRef = useRef<FlatList<AiChatMessage>>(null);

  const [sessions,  setSessions]  = useState<AiChatSession[]>([]);
  const [current,   setCurrent]   = useState<AiChatSession | null>(null);
  const [input,     setInput]     = useState('');
  const [sending,   setSending]   = useState(false);
  const [services,  setServices]  = useState<Service[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // ── Load services for AI context ───────────────────────
  useEffect(() => {
    getDocs(collection(db, COLLECTIONS.SERVICES)).then(snap => {
      setServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
    }).catch(() => {});
  }, []);

  // ── Subscribe to user's chat sessions ──────────────────
  useEffect(() => {
    if (!user?.id) return;
    const q = query(
      collection(db, AI_CHATS),
      where('userId', '==', user.id),
      orderBy('updatedAt', 'desc'),
    );
    return onSnapshot(q, (snap) => {
      const loaded = snap.docs.map(d => ({
        id: d.id, ...d.data(),
        createdAt: d.data().createdAt?.toDate(),
        updatedAt: d.data().updatedAt?.toDate(),
      } as AiChatSession));
      setSessions(loaded);
      setLoadingSessions(false);
      // Keep current session in sync
      if (current) {
        const updated = loaded.find(s => s.id === current.id);
        if (updated) setCurrent(updated);
      }
    });
  }, [user?.id]);

  // ── Build system prompt with live business data ─────────
  const buildSystemPrompt = useCallback((): string => {
    const serviceList = services.length > 0
      ? services.map(s => `• ${s.name} — $${s.price} (${s.durationMin} min): ${s.description}`).join('\n')
      : '• Skin fade/taper — $33\n• Haircut — $28\n• Beard trim — $15\n• Bald & Beard Combo — $40';

    return (
      `You are a friendly AI stylist assistant for 613 Barbershop in Ottawa, Canada. ` +
      `You help clients discover their perfect hairstyle and learn about the shop.\n\n` +
      `ABOUT 613 BARBERSHOP:\n` +
      `Located in Ottawa, Canada. Premium barbershop experience with expert barbers.\n\n` +
      `OUR SERVICES & PRICING:\n${serviceList}\n\n` +
      `HOW TO BOOK:\n` +
      `Tap the "Book" tab → choose a service → pick a barber → select date/time → confirm.\n` +
      `Clients can also attach an AI try-on style from the Styles tab.\n\n` +
      `YOUR ROLE:\n` +
      `- Recommend hairstyles based on face shape, hair texture, and lifestyle\n` +
      `- Answer questions about our services and pricing\n` +
      `- Guide clients on how to use the app\n` +
      `- Give aftercare and maintenance tips\n` +
      `- Be warm, professional, and concise (under 150 words per reply)\n\n` +
      `Always encourage clients to try the AI try-on feature in the Styles tab.`
    );
  }, [services]);

  // ── Create a new session ───────────────────────────────
  const createSession = async (firstMessage: string): Promise<AiChatSession> => {
    const title = firstMessage.length > 40
      ? firstMessage.substring(0, 40) + '...'
      : firstMessage;

    const ref = await addDoc(collection(db, AI_CHATS), {
      userId:    user!.id,
      title,
      messages:  [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      id:        ref.id,
      userId:    user!.id,
      title,
      messages:  [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  };

  // ── Send message ───────────────────────────────────────
  const sendMessage = async (text: string, sessionOverride?: AiChatSession) => {
    const trimmed = text.trim();
    if (!trimmed || sending || !user?.id) return;

    setInput('');
    setSending(true);

    try {
      // If no current session, create one
      let session = sessionOverride ?? current;
      if (!session) {
        session = await createSession(trimmed);
        setCurrent(session);
      }

      const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
      if (!apiKey) {
        appendMessage(session, {
          role: 'assistant',
          content: 'API key not configured.',
          createdAt: new Date().toISOString(),
        });
        return;
      }

      const userMsg: AiChatMessage = {
        role: 'user', content: trimmed, createdAt: new Date().toISOString(),
      };

      const updatedMessages = [...session.messages, userMsg];
      const optimisticSession = { ...session, messages: updatedMessages };
      setCurrent(optimisticSession);

      // Call Claude
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
          max_tokens: 400,
          system:     buildSystemPrompt(),
          messages:   updatedMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await response.json();
      const replyText: string = data?.content?.[0]?.text ?? 'Sorry, something went wrong.';

      const assistantMsg: AiChatMessage = {
        role: 'assistant', content: replyText, createdAt: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, assistantMsg];
      const finalSession  = { ...optimisticSession, messages: finalMessages };
      setCurrent(finalSession);

      // Persist to Firestore
      await updateDoc(doc(db, AI_CHATS, session.id), {
        messages:  finalMessages,
        updatedAt: serverTimestamp(),
      });

      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      // network error — show inline
    } finally {
      setSending(false);
    }
  };

  const appendMessage = (session: AiChatSession, msg: AiChatMessage) => {
    setCurrent(prev => prev ? { ...prev, messages: [...prev.messages, msg] } : prev);
  };

  const formatDate = (date: Date) =>
    date?.toLocaleDateString([], { month: 'short', day: 'numeric' }) ?? '';

  // ─────────────────────────────────────────────────────────
  // RENDER: session list
  // ─────────────────────────────────────────────────────────
  if (!current) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="cut" size={20} color={theme.colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>AI STYLIST</Text>
            <Text style={styles.headerSub}>Your personal style advisor</Text>
          </View>
          <TouchableOpacity
            style={styles.newChatBtn}
            onPress={() => sendMessage('Hello! What can you help me with?')}
          >
            <Ionicons name="add" size={20} color={theme.colors.gold} />
          </TouchableOpacity>
        </View>

        {loadingSessions ? (
          <ActivityIndicator color={theme.colors.gold} size="large" style={{ flex: 1 }} />
        ) : sessions.length === 0 ? (
          <View style={styles.emptyList}>
            <View style={styles.emptyIcon}>
              <Ionicons name="cut-outline" size={32} color={theme.colors.gold} />
            </View>
            <Text style={styles.emptyTitle}>Your AI Stylist</Text>
            <Text style={styles.emptyText}>
              Ask about hairstyles, services, pricing, or how to get the most out of 613 Barbershop.
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionsWrap}
            >
              {SUGGESTIONS.map(s => (
                <TouchableOpacity
                  key={s}
                  style={styles.suggestionChip}
                  onPress={() => sendMessage(s)}
                >
                  <Ionicons name="flash-outline" size={12} color={theme.colors.gold} />
                  <Text style={styles.suggestionText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.startBtn} onPress={() => sendMessage('Hello!')}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.colors.textInverse} />
              <Text style={styles.startBtnText}>START A CHAT</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.sessionList}>
            <Text style={styles.sectionLabel}>PREVIOUS CHATS</Text>
            {sessions.map(s => (
              <TouchableOpacity
                key={s.id}
                style={styles.sessionCard}
                onPress={() => setCurrent(s)}
              >
                <View style={styles.sessionIcon}>
                  <Ionicons name="chatbubble-outline" size={16} color={theme.colors.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sessionTitle} numberOfLines={1}>{s.title}</Text>
                  <Text style={styles.sessionDate}>{formatDate(s.updatedAt)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────
  // RENDER: active chat conversation
  // ─────────────────────────────────────────────────────────
  const renderMsg = ({ item }: { item: AiChatMessage }) => {
    const mine = item.role === 'user';
    return (
      <View style={[styles.msgWrapper, mine ? styles.msgMe : styles.msgThem]}>
        <View style={[styles.bubble, mine ? styles.bubbleMe : styles.bubbleThem]}>
          {mine ? (
            <Text style={[styles.bubbleText, styles.bubbleTextMe]}>{item.content}</Text>
          ) : (
            <Markdown style={{
              body:   { color: theme.colors.textPrimary, fontFamily: theme.fonts.body, fontSize: theme.fontSizes.md },
              strong: { color: theme.colors.gold, fontFamily: theme.fonts.bold },
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
    >
      {/* Chat header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setCurrent(null)}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.gold} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{current.title}</Text>
          <Text style={styles.headerSub}>AI Stylist</Text>
        </View>
        <TouchableOpacity
          style={styles.newChatBtn}
          onPress={() => { setCurrent(null); }}
        >
          <Ionicons name="add" size={20} color={theme.colors.gold} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={current.messages}
        keyExtractor={(_, i) => i.toString()}
        renderItem={renderMsg}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyChatInline}>
            <Text style={styles.emptyText}>Ask me anything about your style or the shop!</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsWrap}>
              {SUGGESTIONS.map(s => (
                <TouchableOpacity key={s} style={styles.suggestionChip} onPress={() => sendMessage(s)}>
                  <Ionicons name="flash-outline" size={12} color={theme.colors.gold} />
                  <Text style={styles.suggestionText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        }
      />

      {sending && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={theme.colors.gold} />
          <Text style={styles.loadingText}>Thinking…</Text>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask about styles, prices, booking…"
          placeholderTextColor={theme.colors.textMuted}
          multiline
          maxLength={400}
          editable={!sending}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
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
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
    padding: theme.spacing.lg, paddingTop: theme.spacing.xxl,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  headerIcon: {
    width: 44, height: 44, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.goldMuted, borderWidth: 1, borderColor: theme.colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.xl, color: theme.colors.textPrimary, letterSpacing: 3 },
  headerSub:   { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.xs, color: theme.colors.gold, letterSpacing: 1, marginTop: 2 },
  backBtn: {
    width: 36, height: 36, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.goldMuted, borderWidth: 1, borderColor: theme.colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  newChatBtn: {
    width: 36, height: 36, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.goldMuted, borderWidth: 1, borderColor: theme.colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  // session list
  sessionList: { padding: theme.spacing.lg, gap: theme.spacing.sm },
  sectionLabel: { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.xs, color: theme.colors.textMuted, letterSpacing: 3, marginBottom: theme.spacing.xs },
  sessionCard: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.md,
    ...theme.shadows.md,
  },
  sessionIcon: {
    width: 36, height: 36, borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.goldMuted, borderWidth: 1, borderColor: theme.colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  sessionTitle: { fontFamily: theme.fonts.bold, fontSize: theme.fontSizes.sm, color: theme.colors.textPrimary },
  sessionDate:  { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.xs, color: theme.colors.textMuted, marginTop: 2 },
  // empty states
  emptyList: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl, gap: theme.spacing.lg },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: theme.colors.goldMuted, borderWidth: 1, borderColor: theme.colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle:   { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.xl, color: theme.colors.textPrimary, letterSpacing: 2 },
  emptyText:    { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.sm, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyChatInline: { paddingTop: 40, paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md, alignItems: 'center' },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
    backgroundColor: theme.colors.gold, borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.xl,
    ...theme.shadows.gold,
  },
  startBtnText: { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.sm, color: theme.colors.textInverse, letterSpacing: 2 },
  suggestionsWrap: { gap: theme.spacing.sm, paddingHorizontal: theme.spacing.xs },
  suggestionChip: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.gold,
    borderRadius: theme.radius.full, paddingVertical: theme.spacing.xs, paddingHorizontal: theme.spacing.md,
  },
  suggestionText: { fontFamily: theme.fonts.medium, fontSize: theme.fontSizes.xs, color: theme.colors.gold, letterSpacing: 1 },
  // chat messages
  messagesList: { padding: theme.spacing.lg, gap: theme.spacing.sm, flexGrow: 1 },
  msgWrapper:   { maxWidth: '85%' },
  msgMe:        { alignSelf: 'flex-end' },
  msgThem:      { alignSelf: 'flex-start' },
  bubble: { borderRadius: theme.radius.lg, paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md },
  bubbleMe: { backgroundColor: theme.colors.gold, borderBottomRightRadius: 4 },
  bubbleThem: {
    backgroundColor: theme.colors.surface, borderWidth: 1,
    borderColor: theme.colors.border, borderBottomLeftRadius: 4,
  },
  bubbleText:   { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.md, lineHeight: 22 },
  bubbleTextMe: { color: theme.colors.textInverse },
  loadingRow:   { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm },
  loadingText:  { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.sm, color: theme.colors.textMuted },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm,
    padding: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  input: {
    flex: 1, backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl,
    borderWidth: 1, borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm,
    color: theme.colors.textPrimary, fontFamily: theme.fonts.body, fontSize: theme.fontSizes.md, maxHeight: 120,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.colors.gold, alignItems: 'center', justifyContent: 'center', ...theme.shadows.gold,
  },
  sendBtnDisabled: { opacity: 0.4 },
});