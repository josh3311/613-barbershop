import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  Image, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { theme } from '../../theme';

interface ChatMsg {
  role:    'user' | 'assistant';
  content: string;
}

// Minimal nav typing for the screens this one reaches. Avoids `any` and
// doesn't clash with the (currently untyped) ClientNavigator stack.
type StyleChatNavParams = {
  BookingFlow: {
    savedStyle?: {
      name:               string;
      description?:       string;
      referenceImageUrl?: string;
      tryOnImageUrl?:     string;
    };
  };
  AddToBooking: undefined;
};

interface Props {
  navigation: NativeStackNavigationProp<StyleChatNavParams>;
}

interface ClaudeResponse {
  content?: Array<{ text?: string }>;
}

const SUGGESTIONS: string[] = [
  'How should I style this at home?',
  'What products work best?',
  'How often should I get this trimmed?',
];

const FALLBACK_REPLY = 'Sorry, something went wrong. Please try again.';

export default function StyleChatScreen({ navigation }: Props) {
  const { user } = useAuth();
  const savedStyle = user?.savedStyle;

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input,    setInput]    = useState<string>('');
  const [sending,  setSending]  = useState<boolean>(false);
  const flatListRef = useRef<FlatList<ChatMsg>>(null);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending || !savedStyle) return;

    const userMsg: ChatMsg = { role: 'user', content: trimmed };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setSending(true);

    const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
    if (!apiKey) {
      setMessages(prev => [...prev, { role: 'assistant', content: FALLBACK_REPLY }]);
      setSending(false);
      return;
    }

    const systemPrompt =
      `You are a barber consultant at 613 Barbershop Ottawa. The user's saved style is: ` +
      `${savedStyle.name}. Description: ${savedStyle.description ?? 'no description'}. ` +
      `Answer questions about this style in plain English. No markdown, no asterisks, ` +
      `no bullet points. Keep answers short and conversational like a barber would talk. ` +
      `If asked about booking, tell them to tap the BOOK THIS STYLE button below.`;

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
          max_tokens: 600,
          system:     systemPrompt,
          messages:   conversationHistory,
        }),
      });

      const data = (await response.json()) as ClaudeResponse;
      const replyText = data.content?.[0]?.text;

      if (!response.ok || typeof replyText !== 'string') {
        setMessages(prev => [...prev, { role: 'assistant', content: FALLBACK_REPLY }]);
        return;
      }

      setMessages(prev => [...prev, { role: 'assistant', content: replyText }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: FALLBACK_REPLY }]);
    } finally {
      setSending(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleBookThisStyle = () => {
    if (!savedStyle) return;
    navigation.navigate('BookingFlow', {
      savedStyle: {
        name:              savedStyle.name,
        description:       savedStyle.description,
        referenceImageUrl: savedStyle.referenceImageUrl,
        tryOnImageUrl:     savedStyle.tryOnImageUrl,
      },
    });
  };

  const handleAddToExisting = () => {
    navigation.navigate('AddToBooking');
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
          <Text style={[
            styles.bubbleText,
            mine ? styles.bubbleTextMe : styles.bubbleTextThem,
          ]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  // ── Render ─────────────────────────────────────────────────
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
          <Ionicons name="chevron-back" size={24} color={theme.colors.gold} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>STYLE CHAT</Text>
        <View style={styles.headerSpacer} />
      </View>

      {!savedStyle ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            Analyze your face first in the Styles tab
          </Text>
        </View>
      ) : (
        <>
          {/* Slim header strip */}
          <View style={styles.styleHeader}>
            <View style={styles.styleHeaderLeft}>
              <Text style={styles.styleHeaderLabel}>SELECTED STYLE</Text>
              <Text style={styles.styleHeaderName} numberOfLines={1}>
                {savedStyle.name.toUpperCase()}
              </Text>
            </View>
            {savedStyle.generatedImageUrl ? (
              <Image
                source={{ uri: savedStyle.generatedImageUrl }}
                style={styles.styleHeaderThumb}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.styleHeaderThumbFallback}>
                <Ionicons name="cut" size={20} color="#444" />
              </View>
            )}
          </View>

          {/* Chat messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(_, i) => i.toString()}
            renderItem={renderMessage}
            style={styles.messagesFlatList}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Text style={styles.emptyChatTitle}>
                  Ask anything about your style.
                </Text>
                <View style={styles.chipRow}>
                  {SUGGESTIONS.map(s => (
                    <TouchableOpacity
                      key={s}
                      style={styles.chip}
                      onPress={() => sendMessage(s)}
                      disabled={sending}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.chipText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            }
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
          />

          {sending && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={theme.colors.gold} />
              <Text style={styles.loadingText}>Thinking…</Text>
            </View>
          )}

          {/* Input row */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask about your style…"
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
              {sending ? (
                <ActivityIndicator size="small" color={theme.colors.textInverse} />
              ) : (
                <Ionicons name="send" size={18} color={theme.colors.textInverse} />
              )}
            </TouchableOpacity>
          </View>

          {/* Sticky bottom action buttons */}
          <View style={styles.actionsBar}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleBookThisStyle}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>BOOK THIS STYLE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={handleAddToExisting}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryBtnText}>ADD TO EXISTING BOOKING</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop:        theme.spacing.xxl,
    paddingBottom:     theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    width:           40,
    height:          40,
    borderRadius:    theme.radius.md,
    backgroundColor: theme.colors.surface,
    alignItems:      'center',
    justifyContent:  'center',
  },
  headerTitle: {
    flex:          1,
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.xxl,
    color:         theme.colors.gold,
    letterSpacing: 4,
    textAlign:     'center',
  },
  headerSpacer: {
    width: 40,
  },

  // Empty state when no savedStyle exists
  emptyState: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        theme.spacing.lg,
  },
  emptyStateText: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.md,
    color:      theme.colors.textSecondary,
    textAlign:  'center',
  },

  // Slim selected-style header strip
  styleHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   '#141414',
    borderWidth:       1,
    borderColor:       '#252525',
    borderRadius:      10,
    paddingHorizontal: 14,
    paddingVertical:   10,
    marginHorizontal:  16,
    marginBottom:      8,
  },
  styleHeaderLeft: {
    flex:        1,
    marginRight: 10,
  },
  styleHeaderLabel: {
    fontFamily:    theme.fonts.heading,
    fontSize:      10,
    color:         theme.colors.gold,
    letterSpacing: 3,
    marginBottom:  2,
  },
  styleHeaderName: {
    fontFamily:    theme.fonts.heading,
    fontSize:      16,
    color:         theme.colors.textPrimary,
    letterSpacing: 1,
  },
  styleHeaderThumb: {
    width:        52,
    height:       52,
    borderRadius: 8,
    borderWidth:  1,
    borderColor:  theme.colors.gold,
  },
  styleHeaderThumbFallback: {
    width:           52,
    height:          52,
    borderRadius:    8,
    borderWidth:     1,
    borderColor:     '#333',
    backgroundColor: '#1A1A1A',
    alignItems:      'center',
    justifyContent:  'center',
  },

  // Chat list
  messagesFlatList: {
    flex: 1,
  },
  messagesList: {
    padding:  theme.spacing.lg,
    gap:      theme.spacing.sm,
    flexGrow: 1,
  },
  emptyChat: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'flex-start',
    paddingTop:     theme.spacing.lg,
    gap:            theme.spacing.md,
  },
  emptyChatTitle: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.md,
    color:      theme.colors.textSecondary,
    textAlign:  'center',
  },
  chipRow: {
    width:         '100%',
    gap:           theme.spacing.sm,
  },
  chip: {
    backgroundColor:   theme.colors.surface,
    borderWidth:       1,
    borderColor:       theme.colors.gold,
    borderRadius:      theme.radius.full,
    paddingVertical:   theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    alignItems:        'center',
  },
  chipText: {
    fontFamily:    theme.fonts.medium,
    fontSize:      theme.fontSizes.sm,
    color:         theme.colors.gold,
    letterSpacing: 1,
  },

  // Message bubbles
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
    borderRadius:      theme.radius.lg,
    paddingVertical:   theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  bubbleMe: {
    backgroundColor:         theme.colors.gold,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor:        theme.colors.surface,
    borderWidth:            1,
    borderColor:            theme.colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.md,
    lineHeight: 22,
  },
  bubbleTextMe: {
    color: theme.colors.textInverse,
  },
  bubbleTextThem: {
    color: theme.colors.textPrimary,
  },

  // Loading row
  loadingRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical:   theme.spacing.sm,
  },
  loadingText: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.sm,
    color:      theme.colors.textMuted,
  },

  // Input row
  inputRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: 16,
    paddingVertical:   10,
    borderTopWidth:    1,
    borderTopColor:    '#252525',
    backgroundColor:   '#1A1A1A',
  },
  input: {
    flex:              1,
    backgroundColor:   '#252525',
    borderRadius:      20,
    paddingHorizontal: 14,
    paddingVertical:   10,
    color:             theme.colors.textPrimary,
    fontFamily:        theme.fonts.body,
    fontSize:          14,
    maxHeight:         120,
  },
  sendBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: theme.colors.gold,
    alignItems:      'center',
    justifyContent:  'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },

  // Sticky bottom action buttons
  actionsBar: {
    paddingHorizontal: 16,
    paddingBottom:     16,
    gap:               8,
    backgroundColor:   theme.colors.background,
  },
  primaryBtn: {
    height:          50,
    backgroundColor: theme.colors.gold,
    borderRadius:    10,
    alignItems:      'center',
    justifyContent:  'center',
  },
  primaryBtnText: {
    fontFamily:    theme.fonts.heading,
    fontSize:      15,
    color:         theme.colors.textInverse,
    letterSpacing: 2,
  },
  secondaryBtn: {
    height:         46,
    borderWidth:    1,
    borderColor:    theme.colors.gold,
    borderRadius:   10,
    alignItems:     'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily:    theme.fonts.heading,
    fontSize:      14,
    color:         theme.colors.gold,
    letterSpacing: 2,
  },
});
