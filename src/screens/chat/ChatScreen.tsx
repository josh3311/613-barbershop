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
import { colors, fonts, spacing, radius, icons } from '@/theme';

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
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <ActivityIndicator size="large" color={colors.gold} />
        <Text style={styles.loadText}>Opening conversation...</Text>
      </View>
    );
  }

  if (error && !conversationId) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <Ionicons name={icons.warning} size={40} color={colors.red} />
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
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name={icons.back} size={24} color={colors.gold} />
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
          placeholder="Type a message..."
          placeholderTextColor={colors.greyDark}
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
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Ionicons name={icons.send} size={20} color={colors.background} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: colors.background },
  center:       { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loadText:     { color: colors.grey, fontSize: fonts.size.md, fontFamily: fonts.body },
  errText:      { color: colors.red, textAlign: 'center', fontSize: fonts.size.md, fontFamily: fonts.body },
  retryBtn:     { marginTop: 8, backgroundColor: colors.gold, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.sm },
  retryBtnText: { color: colors.background, fontFamily: fonts.bodyBold },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 10,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontFamily: fonts.bodyBold, color: colors.white },
  headerSub:   { fontSize: 9, color: colors.gold, letterSpacing: 2, fontFamily: fonts.bodyBold, marginTop: 2 },
  headerLine:  { height: 1, marginHorizontal: 16, backgroundColor: colors.gold, opacity: 0.2 },

  listContent: { paddingHorizontal: 14, paddingTop: 12 },
  row:    { marginBottom: 10, maxWidth: '88%' },
  rowMe:  { alignSelf: 'flex-end' },
  rowThem:{ alignSelf: 'flex-start' },
  bubble: {
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleMe:   { backgroundColor: colors.gold + '15', borderColor: colors.gold + '44' },
  bubbleThem: { backgroundColor: colors.surfaceRaised },
  bubbleText: { fontSize: fonts.size.md, color: colors.white, lineHeight: 20, fontFamily: fonts.body },
  timeText:   { fontSize: 10, color: colors.grey, marginTop: 6, alignSelf: 'flex-end', fontFamily: fonts.body },

  empty: { textAlign: 'center', color: colors.grey, marginTop: 40, fontSize: fonts.size.md, fontFamily: fonts.body },
  bannerErr: { color: colors.red, fontSize: 12, paddingHorizontal: 16, paddingBottom: 4, fontFamily: fonts.body },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: fonts.size.md,
    color: colors.white,
    fontFamily: fonts.body,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnBusy: { opacity: 0.7 },
});
