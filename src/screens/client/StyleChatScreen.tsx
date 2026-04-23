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

const C = {
  bg: '#0A0A0A',
  card: '#161616',
  assistantBubble: '#1A1A1A',
  gold: '#D4AF37',
  goldBorder: '#D4AF3740',
  white: '#FFFFFF',
  sub: '#888888',
  border: '#222222',
  errText: '#FF4444',
  errBg: '#2A0A0A',
  errBorder: '#D4AF37',
  green: '#4CAF50',
} as const;

const EMPTY_ANALYSIS: ProfileAnalysisResult = {
  success: true,
  profile: {},
  styles: { recommendations: [] },
};

const PHOTO_ANALYSIS_REPLY_INTRO =
  "I've analyzed your photo! Here's what I see working for you based on your features...\n\n";

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

  const messagesRef = useRef<StyleChatTurn[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

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
    const title = nextChatTitle(msgs);
    await updateStyleChatSession(firebaseUser.uid, chatId, toPersistableMessages(msgs), title);
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
    const res = await BookingService.attachRequestedStyleForClient(firebaseUser.uid, {
      name: reco?.style_name ?? styleName,
      photoURL,
      description,
      ...(barberNotes ? { barberNotes } : {}),
    });
    setBookingBusy(false);

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
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Stylist</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => void startNewChat()}
            style={styles.headerIconBtn}
            accessibilityRole="button"
            accessibilityLabel="New chat"
          >
            <Ionicons name="add-circle-outline" size={26} color={C.gold} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => void openHistory()}
            style={styles.headerIconBtn}
            accessibilityRole="button"
            accessibilityLabel="Chat history"
          >
            <Ionicons name="time-outline" size={24} color={C.gold} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={scrollToEnd}
        keyboardShouldPersistTaps="handled"
      >
        {!sessionReady ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={C.gold} />
            <Text style={styles.loadingText}>Loading your chat…</Text>
          </View>
        ) : null}

        {messages.length === 0 && sessionReady ? (
          <View style={styles.hintCard}>
            <Text style={styles.hintTitle}>Ask anything</Text>
            <Text style={styles.hintBody}>
              Wondering which cut fits your routine, your face shape, or a special night out? Type
              below — plain language is perfect.
            </Text>
            <Text style={styles.tipText}>
              Tip: Upload more photos from different angles for better recommendations
            </Text>
          </View>
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
          return (
          <View
            key={`${msg.role}-${idx}-${msg.imageUrl ?? ''}`}
            style={[styles.bubbleWrap, msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}
          >
            <View
              style={[
                styles.bubble,
                msg.role === 'user' ? styles.bubbleUserInner : styles.bubbleAssistantInner,
              ]}
            >
              {msg.imageUrl ? (
                <Image source={{ uri: msg.imageUrl }} style={styles.msgImage} resizeMode="cover" />
              ) : null}
              {msg.role === 'assistant' ? (
                <View style={styles.assistantMdWrap}>
                  <SimpleMarkdownText text={stripBookStyleMarkers(msg.content)} />
                </View>
              ) : msg.content.trim().length > 0 ? (
                <View style={msg.content.length > 240 ? styles.userTextLongWrap : undefined}>
                  <RNText
                    style={msg.content.length > 240 ? styles.bubbleUserTextLong : styles.bubbleUserText}
                  >
                    {msg.content}
                  </RNText>
                </View>
              ) : null}
            </View>
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
                      style={styles.bookBtn}
                      onPress={() => void addStyleToBooking(bookName, raw)}
                      disabled={bookingBusy}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${bookName} to my next booking`}
                    >
                      {bookingBusy ? (
                        <ActivityIndicator color={C.bg} size="small" />
                      ) : (
                        <Text style={styles.bookBtnText}>Add {bookName} to my next booking</Text>
                      )}
                    </TouchableOpacity>
                  );
                })()}
              </>
            )}
          </View>
          );
        })}
        {(sending || photoBusy) && (
          <View style={styles.typingRow}>
            <ActivityIndicator size="small" color={C.gold} />
            <Text style={styles.typingText}>
              {photoBusy ? 'Analyzing your photo…' : 'Stylist is typing…'}
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity
          style={styles.attachBtn}
          onPress={openPhotoPicker}
          disabled={!sessionReady || sending || photoBusy}
          accessibilityRole="button"
          accessibilityLabel="Attach photo"
        >
          <Ionicons name="image-outline" size={22} color={C.gold} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Ask the stylist…"
          placeholderTextColor={C.sub}
          value={input}
          onChangeText={setInput}
          editable={!sending && !photoBusy && sessionReady}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending || photoBusy || !sessionReady) && styles.sendBtnOff]}
          onPress={() => void sendUserMessage(input)}
          disabled={!input.trim() || sending || photoBusy || !sessionReady}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          <Ionicons
            name="send"
            size={20}
            color={input.trim() && !sending && !photoBusy && sessionReady ? C.bg : C.sub}
          />
        </TouchableOpacity>
      </View>

      <Modal visible={historyOpen} animationType="slide" transparent onRequestClose={() => setHistoryOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.historySheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Chat history</Text>
              <TouchableOpacity onPress={() => setHistoryOpen(false)} accessibilityLabel="Close">
                <Ionicons name="close" size={26} color={C.white} />
              </TouchableOpacity>
            </View>
            {historyLoading ? (
              <ActivityIndicator color={C.gold} style={{ marginTop: 24 }} />
            ) : (
              <FlatList
                data={historyRows}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingBottom: 24 }}
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
            textColor: toastSuccess ? C.green : C.gold,
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
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: C.white,
    letterSpacing: 0.3,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  loadingText: { fontSize: 14, color: C.sub },
  hintCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 16,
  },
  hintTitle: { fontSize: 16, fontWeight: '800', color: C.gold, marginBottom: 8 },
  hintBody: { fontSize: 14, color: C.sub, lineHeight: 20, marginBottom: 10 },
  tipText: { fontSize: 13, color: C.gold, lineHeight: 18, fontStyle: 'italic' },
  bubbleWrap: { marginBottom: 14, maxWidth: '100%' },
  bubbleUser: { alignItems: 'flex-end' },
  bubbleAssistant: { alignItems: 'flex-start' },
  bubble: { maxWidth: '92%', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 },
  bubbleUserInner: { backgroundColor: C.gold },
  bubbleAssistantInner: {
    backgroundColor: C.assistantBubble,
    borderWidth: 1,
    borderColor: '#333333',
  },
  msgImage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: C.card,
    alignSelf: 'center',
  },
  assistantMdWrap: { alignSelf: 'stretch' },
  userTextLongWrap: {
    marginTop: 6,
    padding: 10,
    borderRadius: 10,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    alignSelf: 'stretch',
  },
  bubbleUserText: { fontSize: 15, color: C.bg, lineHeight: 21 },
  bubbleUserTextLong: { fontSize: 13, color: C.white, lineHeight: 19 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderRadius: 12,
    backgroundColor: C.errBg,
    borderWidth: 1,
    borderColor: C.errBorder,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: C.errText,
    lineHeight: 20,
  },
  errorDismiss: { paddingVertical: 4, paddingHorizontal: 8 },
  errorDismissText: { fontSize: 13, fontWeight: '700', color: C.gold },
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginLeft: 2 },
  thumb: { width: 96, height: 54, borderRadius: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.goldBorder },
  bookBtn: {
    marginTop: 10,
    alignSelf: 'stretch',
    backgroundColor: C.gold,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  bookBtnText: { fontSize: 14, fontWeight: '800', color: C.bg },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  typingText: { fontSize: 13, color: C.sub },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 6,
    backgroundColor: C.bg,
  },
  attachBtn: {
    width: 44,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.card,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    color: C.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnOff: { opacity: 0.35 },
  snackbar: { backgroundColor: '#2A2A2A', borderWidth: 1, borderColor: C.goldBorder },
  snackbarSuccess: {
    backgroundColor: '#0D200D',
    borderWidth: 1,
    borderColor: '#4CAF5040',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#000000AA',
    justifyContent: 'flex-end',
  },
  historySheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: C.goldBorder,
    maxHeight: '70%',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  historyTitle: { fontSize: 18, fontWeight: '800', color: C.gold },
  historyEmpty: { color: C.sub, textAlign: 'center', marginTop: 24 },
  historyRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  historyDate: { fontSize: 12, color: C.gold, fontWeight: '700', marginBottom: 4 },
  historyPreview: { fontSize: 15, color: C.white, marginBottom: 4 },
  historyMeta: { fontSize: 12, color: C.sub, fontWeight: '600' },
});
