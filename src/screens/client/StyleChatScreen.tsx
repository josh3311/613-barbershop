import React, { useCallback, useEffect, useRef, useState, createElement } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Text as RNText,
  Modal,
  FlatList,
  Alert,
  Animated,
} from 'react-native';
import { Text, Snackbar, Portal } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import { StyleStackParamList } from '@/navigation/types';
import { db } from '@/config/firebase';
import { COLLECTIONS } from '@/constants/collections';
import { AIChatService, type StyleChatTurn } from '@/services/aiChat.service';
import {
  AIService,
  type ProfileAnalysisResult,
  type ProfileRecord,
  type StyleRecommendation,
} from '@/services/ai.service';
import { BookingService } from '@/services/booking.service';
import { useAuth } from '@/hooks/useAuth';
import {
  UnsplashService,
  STYLE_PHOTO_PLACEHOLDER_URL,
  stylePhotoHintsFromProfileRecord,
} from '@/services/unsplash.service';
import {
  createStyleChatSession,
  findTodaysStyleChat,
  listStyleChatSessions,
  mergeChatPhotoAnalysisIntoUser,
  titleFromFirstUserText,
  updateStyleChatSession,
} from '@/services/styleChat.service';
import { readImageAsBase64, inferImageMediaType } from '@/utils/imageBase64.utils';
import SimpleMarkdownText from '@/components/SimpleMarkdownText';
import {
  stripBookStyleMarkers,
  firstBookStyleName,
  findRecommendationByBookName,
  mentionedRecommendationPhotos,
  extractBarberNotesFromAssistantReply,
} from '@/utils/styleDisplay.utils';
import type { StyleChatSessionDoc } from '@/types/chat.types';
import { safeToDate } from '@/utils/date.utils';
import { colors, fonts, spacing, radius, shadows, icons, animations } from '@/theme';

const EMPTY_ANALYSIS: ProfileAnalysisResult = {
  success: true,
  profile: {},
  styles: { recommendations: [] },
};

const PHOTO_ANALYSIS_REPLY_INTRO =
  "I've analyzed your photo! Here's what I see working for you based on your features...\n\n";

// Error colors from spec
const ERROR_TEXT_COLOR = '#FF4444';
const ERROR_BG_COLOR = '#2A0A0A';
const ERROR_BORDER_COLOR = colors.gold;

type Props = NativeStackScreenProps<StyleStackParamList, 'StyleChat'>;

function shouldPersistImageUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (
    u.startsWith('data:') ||
    u.startsWith('blob:') ||
    u.startsWith('file:') ||
    u.startsWith('content:')
  ) {
    return false;
  }
  return true;
}

function toPersistableMessages(msgs: StyleChatTurn[]): Array<{
  role: StyleChatTurn['role'];
  content: string;
  imageUrl?: string;
  hidden?: boolean;
}> {
  return msgs.map((m) => ({
    role: m.role,
    content: m.content,
    ...(m.imageUrl && shouldPersistImageUrl(m.imageUrl) ? { imageUrl: m.imageUrl } : {}),
    ...(m.hidden ? { hidden: true } : {}),
  }));
}

function nextChatTitle(msgs: StyleChatTurn[]): string | undefined {
  const first = msgs.find(
    (m) =>
      m.role === 'user' &&
      !m.hidden &&
      (m.content.trim().length > 0 || Boolean((m.imageUrl ?? '').trim())),
  );
  if (!first) return undefined;
  if ((first.imageUrl ?? '').trim() && !first.content.trim()) return 'Photo';
  return titleFromFirstUserText(first.content);
}

function visibleStoredMessageCount(messages: StyleChatSessionDoc['messages'] | undefined): number {
  return (messages ?? []).filter((m) => !m.hidden).length;
}

export default function StyleChatScreen({ navigation, route }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { firebaseUser } = useAuth();
  const routeAnalysis = route.params?.analysis;
  const routePhotos = route.params?.recommendationPhotos;
  const scrollRef = useRef<ScrollView>(null);

  const [liveAnalysis, setLiveAnalysis] = useState<ProfileAnalysisResult>(
    () => routeAnalysis ?? EMPTY_ANALYSIS,
  );
  const [recommendationPhotos, setRecommendationPhotos] = useState<Record<string, string>>(
    () => routePhotos ?? {},
  );
  const [hydratingStyleProfile, setHydratingStyleProfile] = useState(() => !routeAnalysis);

  const recs: StyleRecommendation[] = React.useMemo(() => {
    const list = liveAnalysis.styles?.recommendations;
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  }, [liveAnalysis.styles]);

  const photoHints = React.useMemo(
    () => stylePhotoHintsFromProfileRecord(liveAnalysis.profile),
    [liveAnalysis.profile],
  );

  const [messages, setMessages] = useState<StyleChatTurn[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [input, setInput] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastSuccess, setToastSuccess] = useState(false);
  const webFileInputRef = useRef<HTMLInputElement | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRows, setHistoryRows] = useState<Array<{ id: string; data: StyleChatSessionDoc }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Animation values for message bubbles
  const messageAnims = useRef<Map<number, Animated.Value>>(new Map()).current;

  const messagesRef = useRef<StyleChatTurn[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  // Initialize animation values for new messages
  useEffect(() => {
    messages.forEach((_, idx) => {
      if (!messageAnims.has(idx)) {
        const anim = new Animated.Value(0);
        messageAnims.set(idx, anim);
        Animated.timing(anim, {
          toValue: 1,
          duration: animations.normal,
          useNativeDriver: true,
        }).start();
      }
    });
  }, [messages.length]);

  const getMessageStyle = (animValue: Animated.Value) => ({
    opacity: animValue,
    transform: [
      {
        translateY: animValue.interpolate({
          inputRange: [0, 1],
          outputRange: [animations.slideUp.from, animations.slideUp.to],
        }),
      },
    ],
  });

  // Load saved style profile when chat opens
  useEffect(() => {
    if (routeAnalysis) {
      setLiveAnalysis(routeAnalysis);
      setHydratingStyleProfile(false);
      return;
    }
    if (!firebaseUser?.uid) {
      setHydratingStyleProfile(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid));
        if (cancelled) return;
        const sp = snap.data()?.styleProfile as
          | { profile?: ProfileRecord; styles?: ProfileAnalysisResult['styles'] }
          | undefined;
        if (sp?.profile && sp?.styles?.recommendations) {
          setLiveAnalysis({
            success: true,
            profile: sp.profile,
            styles: sp.styles,
          });
        }
      } catch {
        // Silently fail - profile not required
      } finally {
        if (!cancelled) setHydratingStyleProfile(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [firebaseUser?.uid, routeAnalysis]);

  useEffect(() => {
    let cancelled = false;
    if (recs.length === 0) {
      setRecommendationPhotos({});
      return;
    }
    (async () => {
      try {
        const urls = await Promise.all(
          recs.map((r) => UnsplashService.getStylePhoto(r.style_name, photoHints)),
        );
        if (cancelled) return;
        const map: Record<string, string> = {};
        recs.forEach((r, i) => {
          map[r.style_name] = urls[i] ?? STYLE_PHOTO_PLACEHOLDER_URL;
        });
        setRecommendationPhotos(map);
      } catch {
        if (!cancelled) setRecommendationPhotos({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recs, photoHints]);

  // Initialize or load chat session
  useEffect(() => {
    if (!firebaseUser?.uid) {
      setSessionReady(true);
      return;
    }
    if (hydratingStyleProfile) return;
    let cancelled = false;
    (async () => {
      try {
        const existing = await findTodaysStyleChat(firebaseUser.uid);
        if (cancelled) return;
        if (existing) {
          setChatId(existing.id);
          const loaded = (existing.data.messages ?? []).map((m) => ({
            role: m.role,
            content: m.content,
            ...(m.imageUrl ? { imageUrl: m.imageUrl } : {}),
            ...(m.hidden ? { hidden: true } : {}),
          }));
          setMessages(loaded);
        } else {
          const id = await createStyleChatSession(firebaseUser.uid);
          if (cancelled) return;
          setChatId(id);
          setMessages([]);
        }
      } catch (e) {
        setErrorBanner(e instanceof Error ? e.message : 'Could not load your chat.');
      } finally {
        if (!cancelled) setSessionReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [firebaseUser?.uid, hydratingStyleProfile]);

  async function persistChat(msgs: StyleChatTurn[]): Promise<void> {
    if (!firebaseUser?.uid || !chatId) return;
    try {
      const title = nextChatTitle(msgs);
      await updateStyleChatSession(firebaseUser.uid, chatId, toPersistableMessages(msgs), title);
    } catch {
      // Silently fail - chat will retry on next message
    }
  }

  async function openHistory(): Promise<void> {
    if (!firebaseUser?.uid) return;
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const rows = await listStyleChatSessions(firebaseUser.uid);
      setHistoryRows(rows);
    } catch (e) {
      setErrorBanner(e instanceof Error ? e.message : 'Could not load history.');
    } finally {
      setHistoryLoading(false);
    }
  }

  function loadSession(row: { id: string; data: StyleChatSessionDoc }): void {
    setChatId(row.id);
    const loaded = (row.data.messages ?? []).map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.imageUrl ? { imageUrl: m.imageUrl } : {}),
      ...(m.hidden ? { hidden: true } : {}),
    }));
    setMessages(loaded);
    messagesRef.current = loaded;
    setHistoryOpen(false);
    scrollToEnd();
  }

  async function startNewChat(): Promise<void> {
    if (!firebaseUser?.uid) {
      setErrorBanner('Sign in to start a new chat.');
      return;
    }
    if (sending || photoBusy) return;
    setErrorBanner(null);
    try {
      const id = await createStyleChatSession(firebaseUser.uid);
      setChatId(id);
      setMessages([]);
      messagesRef.current = [];
      setHistoryOpen(false);
      scrollToEnd();
    } catch (e) {
      setErrorBanner(e instanceof Error ? e.message : 'Could not start a new chat.');
    }
  }

  async function sendUserMessage(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || sending || !sessionReady || !chatId) return;

    setErrorBanner(null);
    const userTurn: StyleChatTurn = { role: 'user', content: trimmed };
    const nextThread = [...messages, userTurn];
    setMessages(nextThread);
    setInput('');
    setSending(true);
    scrollToEnd();

    try {
      const reply = await AIChatService.sendStyleChatMessage(
        nextThread,
        liveAnalysis.profile,
        recs,
      );
      const withAssistant: StyleChatTurn[] = [...nextThread, { role: 'assistant', content: reply }];
      setMessages(withAssistant);
      await persistChat(withAssistant);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong. Try again.';
      setErrorBanner(msg);
      setMessages((m) => m.slice(0, -1));
      setInput(trimmed);
    } finally {
      setSending(false);
      scrollToEnd();
    }
  }

  async function addStyleToBooking(styleName: string, assistantRaw?: string): Promise<void> {
    if (!firebaseUser?.uid || bookingBusy) return;
    const reco = findRecommendationByBookName(styleName, recs);
    const photoURL =
      recommendationPhotos[styleName] ??
      recommendationPhotos[reco?.style_name ?? ''] ??
      STYLE_PHOTO_PLACEHOLDER_URL;
    const description =
      reco?.why_it_suits_you?.trim() ||
      `The look you picked: ${styleName}. Your barber can fine-tune it with you in the chair.`;
    const barberNotes =
      typeof assistantRaw === 'string' ? extractBarberNotesFromAssistantReply(assistantRaw) : null;

    setErrorBanner(null);
    setBookingBusy(true);
    try {
      const res = await BookingService.attachRequestedStyleForClient(firebaseUser.uid, {
        name: reco?.style_name ?? styleName,
        photoURL,
        description,
        ...(barberNotes ? { barberNotes } : {}),
      });

      if (!res.success) {
        setErrorBanner(res.error);
        return;
      }
      setToastSuccess(true);
      if (res.data.mode === 'booking') {
        setToast('Style added to your booking! Your barber will see it.');
      } else {
        setToast('Style saved! It will be attached to your next booking automatically');
      }
    } catch {
      setErrorBanner('Could not save style. Try again.');
    } finally {
      setBookingBusy(false);
    }
  }

  async function processPhotoAfterPick(
    uri: string,
    mime: string,
    base64Override?: string,
  ): Promise<void> {
    if (!firebaseUser?.uid || !chatId) return;

    const displayUri = uri;
    const prevSnapshot = [...messagesRef.current];
    const visiblePhotoTurn: StyleChatTurn = { role: 'user', content: '', imageUrl: displayUri };
    const withPhotoBubble = [...prevSnapshot, visiblePhotoTurn];
    setMessages(withPhotoBubble);
    messagesRef.current = withPhotoBubble;
    setPhotoBusy(true);
    setErrorBanner(null);
    scrollToEnd();

    try {
      const base64 =
        base64Override !== undefined && base64Override !== ''
          ? base64Override
          : await readImageAsBase64(uri);
      const mediaType = inferImageMediaType(uri, mime);
      const newAnalysis = await AIService.analyzeProfileFromBase64(base64, mediaType);
      await mergeChatPhotoAnalysisIntoUser(firebaseUser.uid, newAnalysis);
      setLiveAnalysis(newAnalysis);

      const newRecs = Array.isArray(newAnalysis.styles?.recommendations)
        ? newAnalysis.styles.recommendations
        : [];
      const followUp =
        'The client just uploaded a new photo. Updated analysis: ' +
        JSON.stringify(newAnalysis) +
        '. Based on this new photo combined with their existing profile, refine your recommendations. What new styles do you see working for them?';

      const internalTurn: StyleChatTurn = {
        role: 'user',
        content: followUp,
        hidden: true,
      };
      const threadForAi = [...prevSnapshot, visiblePhotoTurn, internalTurn];
      setMessages(threadForAi);
      messagesRef.current = threadForAi;
      setSending(true);

      const reply = await AIChatService.sendStyleChatMessage(
        threadForAi,
        newAnalysis.profile,
        newRecs,
      );
      const withAssistant: StyleChatTurn[] = [
        ...threadForAi,
        { role: 'assistant', content: PHOTO_ANALYSIS_REPLY_INTRO + reply },
      ];
      setMessages(withAssistant);
      messagesRef.current = withAssistant;
      await persistChat(withAssistant);
    } catch {
      setMessages(prevSnapshot);
      messagesRef.current = prevSnapshot;
      setErrorBanner("Couldn't analyze photo. Try again.");
    } finally {
      setPhotoBusy(false);
      setSending(false);
      scrollToEnd();
    }
  }

  async function handleWebFilePicked(file: File): Promise<void> {
    if (!firebaseUser?.uid || !chatId || photoBusy || sending || !sessionReady) return;
    setErrorBanner(null);
    const mime =
      file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg';
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const r = reader.result;
          if (typeof r !== 'string') reject(new Error('Failed to read image'));
          else resolve(r);
        };
        reader.onerror = () => reject(new Error('Failed to read image'));
        reader.readAsDataURL(file);
      });
      const comma = dataUrl.indexOf(',');
      const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
      await processPhotoAfterPick(dataUrl, mime, base64);
    } catch {
      setErrorBanner('Failed to read image. Try again.');
    }
  }

  async function pickAndAnalyzePhoto(fromCamera: boolean): Promise<void> {
    if (!firebaseUser?.uid || !chatId || photoBusy || sending || !sessionReady) return;

    setErrorBanner(null);
    if (fromCamera) {
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      if (!cam.granted) {
        setErrorBanner('Camera access is needed to take a photo.');
        return;
      }
    } else {
      const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!lib.granted) {
        setErrorBanner('Photo library access is needed to upload.');
        return;
      }
    }

    try {
      const picker = fromCamera
        ? ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [3, 4],
            quality: 0.85,
          })
        : ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [3, 4],
            quality: 0.85,
          });

      const result = await picker;
      if (result.canceled) return;
      const asset = result.assets[0];
      const uri = asset.uri;
      const mime = asset.mimeType ?? 'image/jpeg';

      await processPhotoAfterPick(uri, mime);
    } catch {
      setErrorBanner('Failed to pick image. Try again.');
    }
  }

  function openPhotoPicker(): void {
    if (Platform.OS === 'web') {
      webFileInputRef.current?.click();
      return;
    }
    Alert.alert('Add photo', 'Choose a source', [
      { text: 'Camera', onPress: () => void pickAndAnalyzePhoto(true) },
      { text: 'Photo library', onPress: () => void pickAndAnalyzePhoto(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function onWebFileInputChange(ev: unknown): void {
    const target = ev as { target?: HTMLInputElement | null };
    const input = target.target;
    const file = input?.files?.[0];
    if (input) input.value = '';
    if (file) void handleWebFilePicked(file);
  }

  // Button press animation
  const [pressedButton, setPressedButton] = useState<string | null>(null);

  const isSendDisabled = !input.trim() || sending || photoBusy || !sessionReady;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top + 8}
    >
      {Platform.OS === 'web'
        ? createElement('input', {
            ref: webFileInputRef,
            type: 'file',
            accept: 'image/*',
            style: {
              position: 'absolute',
              width: 0,
              height: 0,
              opacity: 0,
              overflow: 'hidden',
              pointerEvents: 'none',
            },
            onChange: onWebFileInputChange,
          })
        : null}

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={28} color={colors.white} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>AI Stylist</Text>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => void openHistory()}
            style={styles.headerIconBtn}
            accessibilityRole="button"
            accessibilityLabel="Chat history"
          >
            <Ionicons name="time-outline" size={24} color={colors.gold} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => void startNewChat()}
            style={styles.headerIconBtn}
            accessibilityRole="button"
            accessibilityLabel="New chat"
          >
            <Ionicons name="add-circle-outline" size={26} color={colors.gold} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={scrollToEnd}
        keyboardShouldPersistTaps="handled"
      >
        {!sessionReady ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.gold} />
            <Text style={styles.loadingText}>Loading your chat...</Text>
          </View>
        ) : null}

        {messages.length === 0 && sessionReady ? (
          <Animated.View style={[styles.welcomeCard, getMessageStyle(new Animated.Value(1))]}>
            <Text style={styles.welcomeTitle}>Ask anything</Text>
            <Text style={styles.welcomeBody}>
              Wondering which cut fits your routine, your face shape, or a special night out? Type
              below — plain language is perfect.
            </Text>
            <View style={styles.tipRow}>
              <Ionicons name="information-circle-outline" size={16} color={colors.gold} />
              <Text style={styles.tipText}>
                Upload more photos from different angles for better recommendations
              </Text>
            </View>
          </Animated.View>
        ) : null}

        {errorBanner ? (
          <View style={styles.errorBanner}>
            <RNText style={styles.errorBannerText}>{errorBanner}</RNText>
            <TouchableOpacity
              onPress={() => setErrorBanner(null)}
              style={styles.errorDismiss}
              accessibilityRole="button"
              accessibilityLabel="Dismiss error"
            >
              <RNText style={styles.errorDismissText}>Dismiss</RNText>
            </TouchableOpacity>
          </View>
        ) : null}

        {messages.map((msg, idx) => {
          if (msg.hidden) return null;
          const animValue = messageAnims.get(idx) || new Animated.Value(1);
          const isUser = msg.role === 'user';

          return (
            <Animated.View
              key={`${msg.role}-${idx}-${msg.imageUrl ?? ''}`}
              style={[
                styles.bubbleWrap,
                isUser ? styles.bubbleWrapUser : styles.bubbleWrapAssistant,
                getMessageStyle(animValue),
              ]}
            >
              <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
                {msg.imageUrl ? (
                  <Image
                    source={{ uri: msg.imageUrl }}
                    style={styles.msgImage}
                    resizeMode="cover"
                  />
                ) : null}

                {msg.role === 'assistant' ? (
                  <View style={styles.assistantContent}>
                    <SimpleMarkdownText text={stripBookStyleMarkers(msg.content)} />
                  </View>
                ) : msg.content.trim().length > 0 ? (
                  <RNText style={styles.bubbleUserText}>{msg.content}</RNText>
                ) : null}
              </View>

              {/* Action buttons for assistant messages */}
              {msg.role === 'assistant' && (
                <>
                  {(() => {
                    const display = stripBookStyleMarkers(msg.content);
                    const thumbs = mentionedRecommendationPhotos(
                      display,
                      recs,
                      recommendationPhotos,
                    );
                    if (thumbs.length === 0) return null;
                    return (
                      <View style={styles.thumbRow}>
                        {thumbs.map((t) => (
                          <Image key={t.name} source={{ uri: t.url }} style={styles.thumb} />
                        ))}
                      </View>
                    );
                  })()}
                  {(() => {
                    const raw = msg.content;
                    const bookName = firstBookStyleName(raw);
                    if (!bookName) return null;
                    return (
                      <TouchableOpacity
                        style={[
                          styles.bookBtn,
                          pressedButton === `book-${idx}` && { transform: [{ scale: 0.97 }] },
                        ]}
                        onPress={() => void addStyleToBooking(bookName, raw)}
                        onPressIn={() => setPressedButton(`book-${idx}`)}
                        onPressOut={() => setPressedButton(null)}
                        disabled={bookingBusy}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${bookName} to my next booking`}
                      >
                        {bookingBusy ? (
                          <ActivityIndicator color={colors.background} size="small" />
                        ) : (
                          <Text style={styles.bookBtnText}>Add {bookName} to my next booking</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })()}
                </>
              )}
            </Animated.View>
          );
        })}

        {(sending || photoBusy) && (
          <View style={styles.typingRow}>
            <ActivityIndicator size="small" color={colors.gold} />
            <Text style={styles.typingText}>
              {photoBusy ? 'Analyzing your photo...' : 'Stylist is typing...'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Input Bar */}
      <View style={[styles.inputBarContainer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <View
          style={[
            styles.inputBar,
            inputFocused && styles.inputBarFocused,
          ]}
        >
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={openPhotoPicker}
            disabled={!sessionReady || sending || photoBusy}
            accessibilityRole="button"
            accessibilityLabel="Attach photo"
          >
            <Ionicons name="image-outline" size={22} color={colors.gold} />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Ask about styles..."
            placeholderTextColor={colors.grey}
            value={input}
            onChangeText={setInput}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            editable={!sending && !photoBusy && sessionReady}
            multiline
            maxLength={2000}
          />

          <TouchableOpacity
            style={[styles.sendBtn, isSendDisabled && styles.sendBtnDisabled]}
            onPress={() => void sendUserMessage(input)}
            disabled={isSendDisabled}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <Ionicons
              name="send"
              size={18}
              color={isSendDisabled ? colors.grey : colors.background}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* History Modal */}
      <Modal
        visible={historyOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setHistoryOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.historySheet, { paddingBottom: insets.bottom + spacing.md }]}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Chat History</Text>
              <TouchableOpacity
                onPress={() => setHistoryOpen(false)}
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={26} color={colors.white} />
              </TouchableOpacity>
            </View>

            {historyLoading ? (
              <ActivityIndicator color={colors.gold} style={{ marginTop: spacing.xl }} />
            ) : (
              <FlatList
                data={historyRows}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingBottom: spacing.xl }}
                ListEmptyComponent={
                  <Text style={styles.historyEmpty}>No past sessions yet.</Text>
                }
                renderItem={({ item }) => {
                  const d = safeToDate(item.data.updatedAt);
                  const dateStr = d.toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  });
                  const msgCount = visibleStoredMessageCount(item.data.messages);
                  return (
                    <TouchableOpacity
                      style={styles.historyRow}
                      onPress={() => loadSession(item)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.historyDate}>{dateStr}</Text>
                      <Text style={styles.historyPreview} numberOfLines={2}>
                        {item.data.title || 'Chat'}
                      </Text>
                      <Text style={styles.historyMeta}>
                        {msgCount} {msgCount === 1 ? 'message' : 'messages'}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Toast */}
      <Portal>
        <Snackbar
          visible={!!toast}
          onDismiss={() => {
            setToast(null);
            setToastSuccess(false);
          }}
          duration={5000}
          style={toastSuccess ? styles.snackbarSuccess : styles.snackbar}
          action={{
            label: 'OK',
            textColor: toastSuccess ? colors.green : colors.gold,
            onPress: () => {
              setToast(null);
              setToastSuccess(false);
            },
          }}
        >
          {toast ?? ''}
        </Snackbar>
      </Portal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    fontSize: fonts.size['2xl'],
    fontFamily: fonts.heading,
    color: colors.white,
    letterSpacing: fonts.letterSpacing.wide,
    textAlign: 'center',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xl },

  // Loading
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  loadingText: { fontSize: fonts.size.md, color: colors.grey },

  // Welcome Card
  welcomeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  welcomeTitle: { fontSize: fonts.size.lg, fontFamily: fonts.bodyBold, color: colors.gold, marginBottom: spacing.sm },
  welcomeBody: { fontSize: fonts.size.md, color: colors.grey, lineHeight: fonts.lineHeight.relaxed * fonts.size.md, marginBottom: spacing.sm },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  tipText: { fontSize: fonts.size.sm, color: colors.gold, lineHeight: fonts.lineHeight.normal * fonts.size.sm, flex: 1 },

  // Error Banner - Spec: red #FF4444 text on #2A0A0A background with gold border
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    backgroundColor: ERROR_BG_COLOR,
    borderWidth: 1,
    borderColor: ERROR_BORDER_COLOR,
  },
  errorBannerText: {
    flex: 1,
    fontSize: fonts.size.md,
    fontFamily: fonts.bodySemiBold,
    color: ERROR_TEXT_COLOR,
    lineHeight: fonts.lineHeight.normal * fonts.size.md,
  },
  errorDismiss: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  errorDismissText: { fontSize: fonts.size.md, fontFamily: fonts.bodyBold, color: colors.gold },

  // Chat Bubbles
  bubbleWrap: { marginBottom: spacing.md, maxWidth: '100%' },
  bubbleWrapUser: { alignItems: 'flex-end' },
  bubbleWrapAssistant: { alignItems: 'flex-start' },

  bubble: { maxWidth: '85%', paddingVertical: spacing.sm, paddingHorizontal: spacing.md },

  // User bubble: gold #D4AF37 background, dark text, right-aligned, border-radius: 18px 18px 4px 18px
  bubbleUser: {
    backgroundColor: colors.gold,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
  },
  bubbleUserText: {
    fontSize: fonts.size.md,
    color: colors.background,
    lineHeight: fonts.lineHeight.normal * fonts.size.md,
    fontFamily: fonts.body,
  },

  // AI bubble: #1A1A1A background, white text, gold left border 2px, left-aligned, border-radius: 4px 18px 18px 18px
  bubbleAssistant: {
    backgroundColor: colors.surfaceRaised,
    borderLeftWidth: 2,
    borderLeftColor: colors.gold,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  assistantContent: { alignSelf: 'stretch' },

  // Photo in chat
  msgImage: {
    width: '100%',
    maxHeight: 200,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
    backgroundColor: colors.surface,
    alignSelf: 'center',
  },

  // Recommendation thumbnails
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm, marginLeft: 2 },
  thumb: { width: 96, height: 54, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },

  // Book button
  bookBtn: {
    marginTop: spacing.sm,
    alignSelf: 'stretch',
    backgroundColor: colors.gold,
    borderRadius: radius['2xl'],
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  bookBtnText: { fontSize: fonts.size.md, fontFamily: fonts.bodyBold, color: colors.background },

  // Typing indicator
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  typingText: { fontSize: fonts.size.sm, color: colors.grey },

  // Input Bar
  inputBarContainer: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  inputBarFocused: {
    borderColor: colors.gold,
  },
  attachBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    color: colors.white,
    fontSize: fonts.size.md,
    fontFamily: fonts.body,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-45deg' }],
  },
  sendBtnDisabled: {
    backgroundColor: colors.surfaceRaised,
  },

  // Snackbar
  snackbar: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  snackbarSuccess: {
    backgroundColor: 'rgba(46, 125, 50, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.25)',
  },

  // History Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.67)',
    justifyContent: 'flex-end',
  },
  historySheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '70%',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingTop: spacing.sm,
  },
  historyTitle: { fontSize: fonts.size.xl, fontFamily: fonts.bodyBold, color: colors.gold },
  historyEmpty: { color: colors.grey, textAlign: 'center', marginTop: spacing.xl },
  historyRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyDate: { fontSize: fonts.size.xs, color: colors.gold, fontFamily: fonts.bodyBold, marginBottom: spacing.xs },
  historyPreview: { fontSize: fonts.size.md, color: colors.white, marginBottom: spacing.xs },
  historyMeta: { fontSize: fonts.size.xs, color: colors.grey, fontFamily: fonts.bodySemiBold },
});
