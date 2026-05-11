import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from 'react-native';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, serverTimestamp, doc, updateDoc,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { COLLECTIONS } from '../../constants/collections';
import { Message } from '../../types';
import { theme } from '../../theme';

interface Props {
  navigation: any;
  route:      any;
}

export default function ChatScreen({ navigation, route }: Props) {
  const { bookingId, recipientName } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text,     setText]     = useState('');
  const [loading,  setLoading]  = useState(true);
  const [sending,  setSending]  = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const q = query(
      collection(db, COLLECTIONS.MESSAGES),
      orderBy('createdAt', 'asc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs
        .map(d => ({
          id: d.id, ...d.data(),
          createdAt: d.data().createdAt?.toDate(),
        } as Message))
        .filter(m => m.bookingId === bookingId);
      setMessages(msgs);
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => unsub();
  }, [bookingId]);

  const handleSend = async () => {
    if (!text.trim() || !user || sending) return;
    setSending(true);
    const content = text.trim();
    setText('');
    try {
      await addDoc(collection(db, COLLECTIONS.MESSAGES), {
        bookingId,
        senderId:   user.id,
        senderName: user.displayName,
        content,
        createdAt:  serverTimestamp(),
        read:       false,
      });
    } catch (e) {
      setText(content);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (date: Date) => date?.toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit'
  }) ?? '';

  const isMe = (msg: Message) => msg.senderId === user?.id;

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const mine = isMe(item);
    const prev = messages[index - 1];
    const showName = !mine && (!prev || prev.senderId !== item.senderId);
    const showTime = !messages[index + 1] ||
      messages[index + 1].senderId !== item.senderId;

    return (
      <View style={[
        styles.msgWrapper,
        mine ? styles.msgWrapperMe : styles.msgWrapperThem,
      ]}>
        {showName && (
          <Text style={styles.senderName}>{item.senderName}</Text>
        )}
        <View style={[
          styles.bubble,
          mine ? styles.bubbleMe : styles.bubbleThem,
        ]}>
          <Text style={[
            styles.bubbleText,
            mine ? styles.bubbleTextMe : styles.bubbleTextThem,
          ]}>
            {item.content}
          </Text>
        </View>
        {showTime && (
          <Text style={[
            styles.timeText,
            mine ? styles.timeTextMe : styles.timeTextThem,
          ]}>
            {formatTime(item.createdAt)}
          </Text>
        )}
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
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={theme.colors.textPrimary}
          />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>
              {recipientName?.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.headerName}>
              {recipientName?.toUpperCase()}
            </Text>
            <Text style={styles.headerStatus}>Online</Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      {loading ? (
        <ActivityIndicator
          color={theme.colors.gold}
          style={styles.loader}
        />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Ionicons
                name="chatbubbles-outline"
                size={48}
                color={theme.colors.textMuted}
              />
              <Text style={styles.emptyChatText}>
                Start the conversation
              </Text>
            </View>
          }
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />
      )}

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          placeholderTextColor={theme.colors.textMuted}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!text.trim() || sending) && styles.sendBtnDisabled,
          ]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.textInverse,
  },
  headerName: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.md,
    color: theme.colors.textPrimary,
    letterSpacing: 2,
  },
  headerStatus: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.success,
  },
  loader: {
    flex: 1,
  },
  messagesList: {
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
    flexGrow: 1,
  },
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    gap: theme.spacing.md,
  },
  emptyChatText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textMuted,
  },
  msgWrapper: {
    maxWidth: '80%',
    marginBottom: theme.spacing.xs,
  },
  msgWrapperMe: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  msgWrapperThem: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  senderName: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    marginBottom: 2,
    marginLeft: theme.spacing.sm,
  },
  bubble: {
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    maxWidth: '100%',
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
  bubbleTextThem: {
    color: theme.colors.textPrimary,
  },
  timeText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  timeTextMe: {
    alignSelf: 'flex-end',
  },
  timeTextThem: {
    alignSelf: 'flex-start',
    marginLeft: theme.spacing.sm,
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