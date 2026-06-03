import React, { useState, useRef, useEffect } from 'react';
import {
  Animated, View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert, Dimensions,
  Modal, ScrollView,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons }     from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  collection, addDoc, updateDoc, doc,
  query, where, orderBy, getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db }        from '../../config/firebase';
import { useAuth }   from '../../context/AuthContext';
import { theme }     from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Types ─────────────────────────────────────────────────
interface PhotoItem {
  uri:    string;
  base64: string;
}

interface ChatMessage {
  id:              string;
  role:            'user' | 'assistant';
  text:            string | null;
  photoUris?:      string[];
  generatedImage?: string | null;
  isLoading?:      boolean;
  loadingStep?:    string;
  timestamp:       Date;
}

interface ChatSession {
  id:        string;
  title:     string;
  updatedAt: Date;
  preview:   string;
}

// ── Constants ─────────────────────────────────────────────
const CLAUDE_KEY  = () => process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';
const OPENAI_KEY  = () => process.env.EXPO_PUBLIC_OPENAI_API_KEY    ?? '';
const CHATS_COL   = 'aiChats';

const SYSTEM_PROMPT =
  `You are the official AI stylist for 613 Barbershop at ` +
  `598 Rideau St, Ottawa, ON K1N 6A2, near Rideau Centre in Ottawa. ` +
  `Help clients with hairstyle advice for all hair types and ethnicities, ` +
  `613 Barbershop services, prices, hair care tips, and booking guidance. ` +
  `Direct booking questions to the Book tab in the app. ` +
  `Services: Regular Haircut $25, Skin Fade/Taper $33, Bald and Beard Combo $45, Kids Cut $20. ` +
  `Hours: Monday to Saturday 9am to 7pm, Sunday 10am to 5pm. ` +
  `CRITICAL FORMATTING RULES: Never use markdown. No asterisks, no hashtags, no dashes, ` +
  `no bold text, no headers. Write exactly like a friendly barber texting a client. ` +
  `Short natural sentences. If listing services write each on its own line with no symbols. ` +
  `Keep replies under 100 words unless specifically asked for more detail. ` +
  `When a client uploads photos and describes a style, tell them you are generating a preview.`;

const WELCOME_TEXT =
  `Hey! I'm your AI stylist at 613 Barbershop.\n\n` +
  `✂️ Ask me anything about hairstyles\n` +
  `📍 613 Barbershop info, services & prices\n` +
  `📸 Upload a selfie + describe a style → I generate a preview\n\n` +
  `Want to see a new look on you? Upload your photo and tell me what you want!`;

const PRESETS = ['Skin fade', 'Box fade', 'Low taper', 'Mid taper', 'Loc fade', 'Buzz cut'];

// ── API helpers ───────────────────────────────────────────

/** Claude chat — text only */
const askClaude = async (
  history: { role: string; content: string }[],
): Promise<string | null> => {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'x-api-key':     CLAUDE_KEY(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system:     SYSTEM_PROMPT,
        messages:   history,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.content?.[0]?.text as string) ?? null;
  } catch (e) {
    console.error('Claude error:', e);
    return null;
  }
};

/**
 * gpt-image-1 edit — takes the REAL photo as input and
 * changes ONLY the hairstyle. Much more accurate than
 * generating from text (which creates a different person).
 */
const editHairStyle = async (
  photoUri:    string,
  stylePrompt: string,
): Promise<string | null> => {
  const key = OPENAI_KEY();
  if (!key) { console.error('OpenAI key missing'); return null; }

  try {
    const formData = new FormData();
    formData.append('model', 'gpt-image-1');
    formData.append(
      'prompt',
      `Change ONLY the hairstyle to: ${stylePrompt}. ` +
      `Preserve EVERYTHING else exactly — face, skin tone, expression, ` +
      `eyes, clothing, accessories, background, and lighting. ` +
      `Only the hair should change. Ultra realistic result.`,
    );
    // React Native FormData file append
    (formData as any).append('image', {
      uri:  photoUri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    });
    formData.append('n',    '1');
    formData.append('size', '1024x1024');

    const res = await fetch('https://api.openai.com/v1/images/edits', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${key}` },
      body:    formData,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('OpenAI edit failed:', res.status, err.slice(0, 200));
      return null;
    }

    const data = await res.json();
    // gpt-image-1 returns base64 by default
    const b64 = data?.data?.[0]?.b64_json as string | undefined;
    if (b64) return `data:image/png;base64,${b64}`;

    // Fallback: URL format (dall-e-2 style)
    return (data?.data?.[0]?.url as string) ?? null;
  } catch (e) {
    console.error('editHairStyle exception:', e);
    return null;
  }
};

// ── Firestore helpers ─────────────────────────────────────
const saveNewChat = async (
  userId: string,
  firstMessage: ChatMessage,
): Promise<string | null> => {
  try {
    const ref = await addDoc(collection(db, CHATS_COL), {
      userId,
      type:      'style',
      title:     firstMessage.text?.slice(0, 40) ?? 'Style Chat',
      messages:  [serializeMsg(firstMessage)],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (e) { console.error('saveNewChat:', e); return null; }
};

const appendMessages = async (
  chatId:   string,
  messages: ChatMessage[],
  title?:   string,
): Promise<void> => {
  try {
    const patch: Record<string, any> = {
      messages:  messages.map(serializeMsg),
      updatedAt: serverTimestamp(),
    };
    if (title) patch.title = title;
    await updateDoc(doc(db, CHATS_COL, chatId), patch);
  } catch (e) { console.error('appendMessages:', e); }
};

const serializeMsg = (m: ChatMessage) => ({
  id:             m.id,
  role:           m.role,
  text:           m.text ?? null,
  photoUris:      m.photoUris ?? [],
  generatedImage: m.generatedImage ?? null,
  timestamp:      m.timestamp.toISOString(),
});

const deserializeMsg = (raw: any): ChatMessage => ({
  id:             raw.id ?? Date.now().toString(),
  role:           raw.role,
  text:           raw.text ?? null,
  photoUris:      raw.photoUris ?? [],
  generatedImage: raw.generatedImage ?? null,
  isLoading:      false,
  timestamp:      new Date(raw.timestamp ?? Date.now()),
});

const loadChatSessions = async (userId: string): Promise<ChatSession[]> => {
  try {
    const q    = query(
      collection(db, CHATS_COL),
      where('userId', '==', userId),
      where('type',   '==', 'style'),
      orderBy('updatedAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id:        d.id,
        title:     data.title ?? 'Style Chat',
        updatedAt: data.updatedAt?.toDate() ?? new Date(),
        preview:   data.messages?.at(-1)?.text?.slice(0, 60) ?? '',
      };
    });
  } catch (e) { console.error('loadChatSessions:', e); return []; }
};

const loadChatMessages = async (chatId: string): Promise<ChatMessage[]> => {
  try {
    const snap = await getDocs(
      query(collection(db, CHATS_COL), where('__name__', '==', chatId)),
    );
    if (snap.empty) return [];
    const raw = snap.docs[0].data().messages ?? [];
    return raw.map(deserializeMsg);
  } catch (e) { console.error('loadChatMessages:', e); return []; }
};

// ── Component ─────────────────────────────────────────────
export default function StylesScreen() {
  const { user } = useAuth();

  // Chat state
  const [messages,     setMessages]     = useState<ChatMessage[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [inputText,    setInputText]    = useState('');
  const [pendingPhotos,setPendingPhotos] = useState<PhotoItem[]>([]);
  const [isSending,    setIsSending]    = useState(false);

  // History modal
  const [showHistory,   setShowHistory]   = useState(false);
  const [chatSessions,  setChatSessions]  = useState<ChatSession[]>([]);
  const [loadingHistory,setLoadingHistory]= useState(false);

  const flatRef = useRef<FlatList<ChatMessage>>(null);

  // Animated gold-glow border on the chat input when focused
  const inputFocus = useRef(new Animated.Value(0)).current;
  const inputAnimatedStyle = {
    borderColor: inputFocus.interpolate({
      inputRange:  [0, 1],
      outputRange: [theme.colors.border, theme.colors.gold],
    }),
  };

  // Load welcome message on mount
  useEffect(() => {
    const welcome: ChatMessage = {
      id:        'welcome',
      role:      'assistant',
      text:      WELCOME_TEXT,
      timestamp: new Date(),
    };
    setMessages([welcome]);
  }, []);

  // Auto scroll
  useEffect(() => {
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 150);
  }, [messages]);

  // ── Pick photos from gallery ───────────────────────────
  const pickPhotos = async () => {
    if (pendingPhotos.length >= 5) {
      Alert.alert('Max 5 photos', 'Remove a photo before adding another.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to upload selfies.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:    ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality:       0.8,
      base64:        true,
      // Allow multiple selection on supported platforms
      allowsMultipleSelection: true,
    });
    if (result.canceled) return;
    const newPhotos: PhotoItem[] = result.assets
      .slice(0, 5 - pendingPhotos.length)
      .filter(a => a.base64)
      .map(a => ({ uri: a.uri, base64: a.base64! }));
    setPendingPhotos(prev => [...prev, ...newPhotos].slice(0, 5));
  };

  // ── Take photo ─────────────────────────────────────────
  const takePhoto = async () => {
    if (pendingPhotos.length >= 5) {
      Alert.alert('Max 5 photos', 'Remove a photo before adding another.');
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take a selfie.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect:        [1, 1],
      quality:       0.8,
      base64:        true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    const { uri, base64 } = result.assets[0];
    setPendingPhotos(prev => [...prev, { uri, base64: base64! }].slice(0, 5));
  };

  const removePhoto = (index: number) => {
    setPendingPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // ── Update a message in state ──────────────────────────
  const patchMessage = (id: string, patch: Partial<ChatMessage>) =>
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));

  // ── Send ───────────────────────────────────────────────
  const handleSend = async () => {
    const text   = inputText.trim();
    const photos = [...pendingPhotos];
    if (!text && photos.length === 0) return;
    if (isSending) return;

    const userMsg: ChatMessage = {
      id:        Date.now().toString(),
      role:      'user',
      text:      text || null,
      photoUris: photos.map(p => p.uri),
      timestamp: new Date(),
    };

    const loadId = `loading-${Date.now()}`;
    const loadMsg: ChatMessage = {
      id:          loadId,
      role:        'assistant',
      text:        null,
      isLoading:   true,
      loadingStep: photos.length > 0 ? 'Analyzing your photo...' : 'Thinking...',
      timestamp:   new Date(),
    };

    const newMessages = [...messages, userMsg, loadMsg];
    setMessages(newMessages);
    setInputText('');
    setPendingPhotos([]);
    setIsSending(true);

    // Save to Firestore
    let chatId = currentChatId;
    if (!chatId && user?.id) {
      chatId = await saveNewChat(user.id, userMsg);
      if (chatId) setCurrentChatId(chatId);
    }

    try {
      // ── PATH A: Photos → Hair Try-On ───────────────────
      if (photos.length > 0) {
        // Use the first (best) photo for the edit
        const bestPhoto = photos[0];

        patchMessage(loadId, {
          loadingStep: `Generating your ${text || 'new look'}... (~30 seconds)`,
        });

        const resultUrl = await editHairStyle(
          bestPhoto.uri,
          text || 'modern clean hairstyle',
        );

        const responseText = resultUrl
          ? `Here is your preview! The AI has applied your style. ` +
            `Want to try a different variation or color? Just ask!`
          : `The style preview could not be generated right now. ` +
            `Please try again with a clearer front-facing photo.`;

        const finalMsg: Partial<ChatMessage> = {
          isLoading:      false,
          text:           responseText,
          generatedImage: resultUrl ?? null,
        };
        patchMessage(loadId, finalMsg);

        // Save both messages to Firestore
        if (chatId) {
          const allMsgs = [...newMessages.filter(m => m.id !== loadId),
            { ...loadMsg, ...finalMsg }];
          await appendMessages(chatId, allMsgs);
        }

      // ── PATH B: Text only → Claude chat ───────────────
      } else {
        const history = messages
          .filter(m => !m.isLoading && m.text)
          .concat(userMsg)
          .map(m => ({ role: m.role, content: m.text ?? '' }));

        const reply = await askClaude(history);

        const replyText = reply ?? 'Something went wrong. Please try again.';
        patchMessage(loadId, { isLoading: false, text: replyText });

        if (chatId) {
          const allMsgs = [...newMessages.filter(m => m.id !== loadId),
            { ...loadMsg, isLoading: false, text: replyText }];
          await appendMessages(
            chatId,
            allMsgs,
            text.slice(0, 40) || undefined,
          );
        }
      }
    } catch (e) {
      console.error('handleSend error:', e);
      patchMessage(loadId, {
        isLoading: false,
        text:      'Something went wrong. Please try again.',
      });
    } finally {
      setIsSending(false);
    }
  };

  // ── Start a new chat ───────────────────────────────────
  const startNewChat = () => {
    setCurrentChatId(null);
    setMessages([{
      id:        'welcome',
      role:      'assistant',
      text:      WELCOME_TEXT,
      timestamp: new Date(),
    }]);
    setShowHistory(false);
  };

  // ── Open history ────────────────────────────────────────
  const openHistory = async () => {
    setShowHistory(true);
    setLoadingHistory(true);
    if (user?.id) {
      const sessions = await loadChatSessions(user.id);
      setChatSessions(sessions);
    }
    setLoadingHistory(false);
  };

  // ── Resume a past chat ─────────────────────────────────
  const resumeChat = async (session: ChatSession) => {
    setShowHistory(false);
    setLoadingHistory(true);
    // For now load from Firestore by fetching the doc directly
    // (Simplified: just set title and ID, messages reload from doc)
    try {
      const q    = query(collection(db, CHATS_COL),
        where('__name__', '==', session.id));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const raw  = snap.docs[0].data().messages ?? [];
        const msgs = raw.map(deserializeMsg);
        setMessages(msgs.length > 0 ? msgs : [{
          id: 'welcome', role: 'assistant',
          text: WELCOME_TEXT, timestamp: new Date(),
        }]);
        setCurrentChatId(session.id);
      }
    } catch (e) {
      console.error('resumeChat error:', e);
    }
    setLoadingHistory(false);
  };

  // ── Render message ─────────────────────────────────────
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';

    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowBot]}>

        {!isUser && (
          <View style={styles.botAvatar}>
            <Ionicons name="cut" size={14} color={theme.colors.gold} />
          </View>
        )}

        <View style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleBot,
          item.isLoading && styles.bubbleLoading,
        ]}>

          {/* User photos grid */}
          {(item.photoUris ?? []).length > 0 && (
            <View style={styles.photoGrid}>
              {(item.photoUris ?? []).map((uri, i) => (
                <ExpoImage
                  key={i}
                  source={{ uri }}
                  style={[
                    styles.photoGridItem,
                    (item.photoUris ?? []).length === 1 && styles.photoGridItemFull,
                  ]}
                  contentFit="cover"
                  transition={250}
                />
              ))}
            </View>
          )}

          {/* Loading row */}
          {item.isLoading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={theme.colors.gold} />
              <Text style={styles.loadingText}>{item.loadingStep}</Text>
            </View>
          )}

          {/* Text */}
          {item.text ? (
            <Text style={[
              styles.bubbleText,
              isUser ? styles.bubbleTextUser : styles.bubbleTextBot,
            ]}>
              {item.text}
            </Text>
          ) : null}

          {/* Generated image */}
          {item.generatedImage && (
            <View style={styles.generatedWrap}>
              <ExpoImage
                source={{ uri: item.generatedImage }}
                style={styles.generatedImage}
                contentFit="cover"
                transition={400}
              />
              <Text style={styles.generatedLabel}>AI STYLE PREVIEW</Text>
            </View>
          )}

        </View>
      </View>
    );
  };

  // ── Render ─────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="cut" size={16} color={theme.colors.gold} />
          </View>
          <View>
            <Text style={styles.headerTitle}>STYLE WITH AI</Text>
            <Text style={styles.headerSub}>613 Barbershop · AI Stylist</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerBtn} onPress={openHistory}>
            <Ionicons name="time-outline" size={20} color={theme.colors.gold} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={startNewChat}>
            <Ionicons name="add-outline" size={22} color={theme.colors.gold} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Messages ── */}
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() =>
          flatRef.current?.scrollToEnd({ animated: true })
        }
      />

      {/* ── Preset chips ── */}
      {messages.length <= 2 && !isSending && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetsRow}
        >
          {PRESETS.map(p => (
            <TouchableOpacity
              key={p}
              style={styles.presetChip}
              onPress={() => setInputText(p)}
            >
              <Text style={styles.presetText}>{p}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Pending photos preview ── */}
      {pendingPhotos.length > 0 && (
        <View style={styles.pendingRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {pendingPhotos.map((p, i) => (
              <View key={i} style={styles.pendingThumbWrap}>
                <ExpoImage
                  source={{ uri: p.uri }}
                  style={styles.pendingThumb}
                  contentFit="cover"
                  transition={200}
                />
                <TouchableOpacity
                  style={styles.removePendingBtn}
                  onPress={() => removePhoto(i)}
                >
                  <Ionicons name="close-circle" size={18} color={theme.colors.error} />
                </TouchableOpacity>
              </View>
            ))}
            {pendingPhotos.length < 5 && (
              <TouchableOpacity style={styles.addMoreBtn} onPress={pickPhotos}>
                <Ionicons name="add" size={22} color={theme.colors.gold} />
                <Text style={styles.addMoreText}>{5 - pendingPhotos.length} more</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
          <Text style={styles.pendingHint}>
            {pendingPhotos.length} photo{pendingPhotos.length > 1 ? 's' : ''} ready →
            describe the style you want
          </Text>
        </View>
      )}

      {/* ── Input bar ── */}
      <View style={styles.inputBar}>
        <TouchableOpacity style={styles.inputIcon} onPress={takePhoto} disabled={isSending}>
          <Ionicons name="camera-outline" size={20} color={theme.colors.gold} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.inputIcon} onPress={pickPhotos} disabled={isSending}>
          <Ionicons name="images-outline" size={20} color={theme.colors.gold} />
        </TouchableOpacity>
        <Animated.View style={[styles.textInputWrap, inputAnimatedStyle]}>
          <TextInput
            style={styles.textInput}
            placeholder={
              pendingPhotos.length > 0
                ? 'Describe the style...'
                : 'Ask about styles or upload a selfie...'
            }
            placeholderTextColor={theme.colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={400}
            editable={!isSending}
            onFocus={() => { Animated.timing(inputFocus, { toValue: 1, duration: 180, useNativeDriver: false }).start(); }}
            onBlur={()  => { Animated.timing(inputFocus, { toValue: 0, duration: 220, useNativeDriver: false }).start(); }}
          />
        </Animated.View>
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!inputText.trim() && pendingPhotos.length === 0) && styles.sendBtnDisabled,
          ]}
          onPress={handleSend}
          disabled={isSending || (!inputText.trim() && pendingPhotos.length === 0)}
        >
          {isSending
            ? <ActivityIndicator size="small" color={theme.colors.textInverse} />
            : <Ionicons name="send" size={16} color={theme.colors.textInverse} />
          }
        </TouchableOpacity>
      </View>

      {/* ── History Modal ── */}
      <Modal visible={showHistory} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>CHAT HISTORY</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <Ionicons name="close" size={22} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.newChatBtn} onPress={startNewChat}>
              <Ionicons name="add-circle-outline" size={18} color={theme.colors.gold} />
              <Text style={styles.newChatBtnText}>NEW CHAT</Text>
            </TouchableOpacity>

            {loadingHistory ? (
              <ActivityIndicator
                color={theme.colors.gold} style={{ marginTop: 24 }}
              />
            ) : chatSessions.length === 0 ? (
              <Text style={styles.noHistoryText}>No past chats yet.</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {chatSessions.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={styles.sessionItem}
                    onPress={() => resumeChat(s)}
                  >
                    <View style={styles.sessionIcon}>
                      <Ionicons name="cut-outline" size={16} color={theme.colors.gold} />
                    </View>
                    <View style={styles.sessionInfo}>
                      <Text style={styles.sessionTitle} numberOfLines={1}>{s.title}</Text>
                      <Text style={styles.sessionPreview} numberOfLines={1}>{s.preview}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────
const IMG_THUMB = 72;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: theme.spacing.lg, paddingTop: theme.spacing.xxl,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  headerRight: { flexDirection: 'row', gap: theme.spacing.sm },
  headerIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.colors.goldMuted, borderWidth: 1, borderColor: theme.colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle:{ fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.md, color: theme.colors.gold, letterSpacing: 3 },
  headerSub:  { fontFamily: theme.fonts.body, fontSize: 10, color: theme.colors.textSecondary },
  headerBtn: {
    width: 36, height: 36, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.goldMuted, borderWidth: 1, borderColor: theme.colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },

  // Messages
  messageList: { padding: theme.spacing.md, paddingBottom: theme.spacing.xl, gap: theme.spacing.md },
  msgRow:      { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  msgRowUser:  { justifyContent: 'flex-end' },
  msgRowBot:   { justifyContent: 'flex-start', alignItems: 'flex-end' },
  botAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: theme.colors.goldMuted, borderWidth: 1, borderColor: theme.colors.gold,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  bubble: {
    maxWidth: '82%', borderRadius: theme.radius.lg,
    padding: theme.spacing.md, gap: theme.spacing.sm,
  },
  bubbleUser:    { backgroundColor: theme.colors.gold, borderBottomRightRadius: 4 },
  bubbleBot:     { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderBottomLeftRadius: 4 },
  bubbleLoading: { borderColor: theme.colors.gold },
  bubbleText:    { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.sm, lineHeight: 22 },
  bubbleTextUser:{ color: theme.colors.textInverse },
  bubbleTextBot: { color: theme.colors.textPrimary },

  // Photo grid in message
  photoGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 4,
    borderRadius: theme.radius.md, overflow: 'hidden',
  },
  photoGridItem: {
    width: 120, height: 120, borderRadius: theme.radius.sm,
  },
  photoGridItemFull: {
    width: '100%', height: 200, borderRadius: theme.radius.md,
  },

  // Loading
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  loadingText:{ fontFamily: theme.fonts.body, fontSize: theme.fontSizes.xs, color: theme.colors.textSecondary, flex: 1 },

  // Generated image
  generatedWrap:  { gap: 6 },
  generatedImage: { width: '100%', height: 280, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.gold },
  generatedLabel: { fontFamily: theme.fonts.heading, fontSize: 9, color: theme.colors.gold, letterSpacing: 2, textAlign: 'center' },

  // Presets
  presetsRow: { paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.xs, gap: theme.spacing.xs },
  presetChip: {
    paddingVertical: 6, paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.goldMuted, borderWidth: 1, borderColor: theme.colors.gold,
    borderRadius: theme.radius.full,
  },
  presetText: { fontFamily: theme.fonts.medium, fontSize: 11, color: theme.colors.gold, letterSpacing: 1 },

  // Pending photos
  pendingRow: { paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.xs, gap: 6 },
  pendingThumbWrap: { position: 'relative', marginRight: 8 },
  pendingThumb: { width: IMG_THUMB, height: IMG_THUMB, borderRadius: theme.radius.md, borderWidth: 1.5, borderColor: theme.colors.gold },
  removePendingBtn: { position: 'absolute', top: -6, right: -6 },
  addMoreBtn: {
    width: IMG_THUMB, height: IMG_THUMB, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.gold, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  addMoreText: { fontFamily: theme.fonts.medium, fontSize: 9, color: theme.colors.gold },
  pendingHint:{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.textMuted },

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.xs,
    padding: theme.spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 28 : theme.spacing.md,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  inputIcon: {
    width: 38, height: 38, alignItems: 'center', justifyContent: 'center',
    borderRadius: theme.radius.md, backgroundColor: theme.colors.goldMuted,
    borderWidth: 1, borderColor: theme.colors.gold,
  },
  textInputWrap: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  textInput: {
    minHeight: 38, maxHeight: 120,
    paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm,
    color: '#FFFFFF', fontFamily: theme.fonts.body, fontSize: theme.fontSizes.sm,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: theme.colors.gold,
    alignItems: 'center', justifyContent: 'center', ...theme.shadows.gold,
  },
  sendBtnDisabled: { opacity: 0.4 },

  // History modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: theme.colors.gold, padding: theme.spacing.xl,
    paddingBottom: 40, maxHeight: '75%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  modalTitle: { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.md, color: theme.colors.gold, letterSpacing: 3 },
  newChatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.gold,
    borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md,
  },
  newChatBtnText: { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.sm, color: theme.colors.gold, letterSpacing: 2 },
  noHistoryText:  { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.sm, color: theme.colors.textMuted, textAlign: 'center', marginTop: 24 },
  sessionItem: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
    padding: theme.spacing.md, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border, marginBottom: theme.spacing.sm,
  },
  sessionIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.colors.goldMuted, borderWidth: 1, borderColor: theme.colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  sessionInfo:   { flex: 1 },
  sessionTitle:  { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.sm, color: theme.colors.textPrimary, letterSpacing: 1 },
  sessionPreview:{ fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
});