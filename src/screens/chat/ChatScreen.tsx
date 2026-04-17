import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatService } from '@/services/chat.service';
import { useAuth } from '@/hooks/useAuth';
import { ChatMessage } from '@/types/chat.types';
import { ChatRouteParams } from '@/navigation/types';
import { safeFormatTime } from '@/utils/date.utils';

const C = {
  bg:       '#0A0A0A',
  card:     '#141414',
  border:   '#252525',
  gold:     '#D4AF37',
  white:    '#FFFFFF',
  sub:      '#888888',
  muted:    '#444444',
  bubbleMe: '#2A2410',
  bubbleThem: '#1E1E1E',
} as const;

type RootChatProps = NativeStackScreenProps<{ Chat: ChatRouteParams }, 'Chat'>;

export default function ChatScreen({ route, navigation }: RootChatProps): React.JSX.Element {
  const { clientId, clientName, barberId, barberName } = route.params;
  const insets = useSafeAreaInsets();
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? '';

  const peerName = uid === clientId ? barberName : clientName;

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await ChatService.ensureConversation(clientId, barberId);
    if (!res.success || !res.data) {
      setError(res.success ? 'Could not open chat.' : res.error);
      setLoading(false);
      return;
    }
    setConversationId(res.data);
    setLoading(false);
  }, [clientId, barberId]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!conversationId) return;
    const unsub = ChatService.subscribeToMessages(
      conversationId,
      (list) => {
        setMessages(list);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
      },
      () => setError('Could not load messages.'),
    );
    return unsub;
  }, [conversationId]);

  async function handleSend(): Promise<void> {
    if (!conversationId || !uid) return;
    const t = input.trim();
    if (!t) return;
    setSending(true);
    setInput('');
    const res = await ChatService.sendMessage(conversationId, uid, t);
    setSending(false);
    if (!res.success) {
      setInput(t);
      setError(res.error);
    }
  }

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <ActivityIndicator size="large" color={C.gold} />
        <Text style={styles.loadText}>Opening conversation…</Text>
      </View>
    );
  }

  if (error && !conversationId) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <Ionicons name="alert-circle-outline" size={40} color="#CF6679" />
        <Text style={styles.errText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => void bootstrap()}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 0}
    >
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={C.gold} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{peerName}</Text>
          <Text style={styles.headerSub}>MESSAGES</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.headerLine} />

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: 12 }]}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          try {
            const mine = item.senderId === uid;
            return (
              <View style={[styles.row, mine ? styles.rowMe : styles.rowThem]}>
                <View style={[styles.bubble, mine ? styles.bubbleMe : styles.bubbleThem]}>
                  <Text style={styles.bubbleText}>{item.text}</Text>
                  <Text style={styles.timeText}>{safeFormatTime(item.createdAt)}</Text>
                </View>
              </View>
            );
          } catch {
            return null;
          }
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>No messages yet. Say hello.</Text>
        }
      />

      {error ? (
        <Text style={styles.bannerErr}>{error}</Text>
      ) : null}

      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 12 }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message…"
          placeholderTextColor={C.muted}
          multiline
          maxLength={2000}
          editable={!sending}
        />
        <TouchableOpacity
          style={[styles.sendBtn, sending && styles.sendBtnBusy]}
          onPress={() => void handleSend()}
          disabled={sending || !input.trim()}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          {sending ? (
            <ActivityIndicator size="small" color={C.bg} />
          ) : (
            <Ionicons name="send" size={20} color={C.bg} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },
  center:       { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loadText:     { color: C.sub, fontSize: 14 },
  errText:      { color: '#CF6679', textAlign: 'center', fontSize: 14 },
  retryBtn:     { marginTop: 8, backgroundColor: C.gold, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryBtnText: { color: C.bg, fontWeight: '800' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 10,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: C.white },
  headerSub:   { fontSize: 9, color: C.gold, letterSpacing: 2, fontWeight: '700', marginTop: 2 },
  headerLine:  { height: 1, marginHorizontal: 16, backgroundColor: C.gold, opacity: 0.2 },

  listContent: { paddingHorizontal: 14, paddingTop: 12 },
  row:    { marginBottom: 10, maxWidth: '88%' },
  rowMe:  { alignSelf: 'flex-end' },
  rowThem:{ alignSelf: 'flex-start' },
  bubble: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  bubbleMe:   { backgroundColor: C.bubbleMe, borderColor: C.gold + '44' },
  bubbleThem: { backgroundColor: C.bubbleThem },
  bubbleText: { fontSize: 15, color: C.white, lineHeight: 20 },
  timeText:   { fontSize: 10, color: C.sub, marginTop: 6, alignSelf: 'flex-end' },

  empty: { textAlign: 'center', color: C.sub, marginTop: 40, fontSize: 14 },
  bannerErr: { color: '#CF6679', fontSize: 12, paddingHorizontal: 16, paddingBottom: 4 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.card,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: C.white,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnBusy: { opacity: 0.7 },
});
