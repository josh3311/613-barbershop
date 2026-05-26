import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Image, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert,
  Dimensions,
} from 'react-native';
import { Ionicons }     from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem  from 'expo-file-system/legacy';
import { theme }        from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Types ─────────────────────────────────────────────────
interface ChatMessage {
  id:               string;
  role:             'user' | 'assistant';
  text:             string | null;
  userPhotoUri?:    string | null;   // selfie the user uploaded
  generatedImages?: (string | null)[];  // 4 try-on results
  isLoading?:       boolean;
  loadingStep?:     string;
  timestamp:        Date;
}

// ── 613 Barbershop system prompt ─────────────────────────
const SYSTEM_PROMPT =
  `You are the official AI stylist for 613 Barbershop, located at ` +
  `598 Rideau St, Ottawa, ON K1N 6A2, Canada (steps from Rideau Centre mall). ` +
  `You help clients with modern hairstyle advice for all hair types and ethnicities, ` +
  `information about 613's services and atmosphere, hair care tips, ` +
  `and booking guidance (direct them to the Book tab in the app). ` +
  `Services: Regular Haircut $25, Skin Fade/Taper $33, Bald & Beard Combo, Kids Cut, and more. ` +
  `Hours: Mon–Sat 9am–7pm, Sun 10am–5pm. ` +
  `Be warm, professional, and concise. ` +
  `When a client shares a photo and describes a hairstyle, let them know you are ` +
  `generating a visual preview of their look.`;

// ── Welcome message ───────────────────────────────────────
const WELCOME: ChatMessage = {
  id:        'welcome',
  role:      'assistant',
  text:
    `Hey! I'm your AI stylist at 613 Barbershop. I can help you with:\n\n` +
    `✂️ Style recommendations for your face & hair type\n` +
    `📍 Info about 613 Barbershop (location, services, prices)\n` +
    `💡 Hair care tips\n\n` +
    `Want to see how a new style looks on you? Upload a selfie, ` +
    `describe the look you want, and I'll generate a preview!`,
  timestamp: new Date(),
};

// ── API helpers ───────────────────────────────────────────
const ANTHROPIC_KEY = () => process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';
const OPENAI_KEY    = () => process.env.EXPO_PUBLIC_OPENAI_API_KEY    ?? '';

/** Claude chat (text only) */
const claudeChat = async (
  history: { role: string; content: string }[],
): Promise<string | null> => {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':                              'application/json',
        'x-api-key':                                 ANTHROPIC_KEY(),
        'anthropic-version':                         '2023-06-01',
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
  } catch { return null; }
};

/**
 * Claude Vision — reverse-engineers a selfie into a detailed
 * preservation prompt (everything EXCEPT hair).
 */
const buildPreservationPrompt = async (base64: string): Promise<string | null> => {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':                              'application/json',
        'x-api-key':                                 ANTHROPIC_KEY(),
        'anthropic-version':                         '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{
          role:    'user',
          content: [
            {
              type:   'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
            },
            {
              type: 'text',
              text:
                'Analyze this selfie carefully. Create a detailed image generation prompt ' +
                'that describes EVERYTHING about this person EXCEPT their hair. Include:\n' +
                '- Approximate age and gender presentation\n' +
                '- Exact skin tone and texture\n' +
                '- Facial features (eye color/shape, nose, lips, jawline)\n' +
                '- Expression\n' +
                '- Clothing (colors, style, neckline)\n' +
                '- Accessories (jewelry, glasses — exact details)\n' +
                '- Lighting (direction, warmth, shadows)\n' +
                '- Background (colors, objects, setting)\n' +
                '- Camera angle and distance\n' +
                '- Photo style (selfie, candid, etc.)\n\n' +
                'Start with "Ultra photorealistic photograph of a" and be very specific. ' +
                'Do NOT mention hair at all. ' +
                'End with ", preserve exact facial identity, photorealistic, high detail, 4k". ' +
                'Return ONLY the prompt text, nothing else.',
            },
          ],
        }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.content?.[0]?.text as string)?.trim() ?? null;
  } catch { return null; }
};

/** DALL-E 3 — generate one image from a text prompt */
const generateImage = async (prompt: string): Promise<string | null> => {
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${OPENAI_KEY()}`,
      },
      body: JSON.stringify({
        model:   'dall-e-3',
        prompt,
        n:       1,
        size:    '1024x1024',
        quality: 'standard',
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.data?.[0]?.url as string) ?? null;
  } catch { return null; }
};

/** Build the 4 angle prompts and generate all images */
const generate360 = async (
  preservationPrompt: string,
  styleDescription:   string,
  onProgress:         (images: (string | null)[]) => void,
): Promise<(string | null)[]> => {
  const base   = `${preservationPrompt}, ${styleDescription}, natural realistic hair, seamless blend`;
  const angles = [
    `${base}, front-facing portrait`,
    `${base}, left side profile, head turned left`,
    `${base}, right side profile, head turned right`,
    `${base}, back of head view showing hairstyle detail`,
  ];

  const results: (string | null)[] = [null, null, null, null];

  // Generate all 4 in parallel
  await Promise.all(
    angles.map(async (prompt, i) => {
      const url = await generateImage(prompt);
      results[i] = url;
      onProgress([...results]);
    }),
  );

  return results;
};

// ── Component ─────────────────────────────────────────────
export default function StylesScreen() {
  const [messages,      setMessages]      = useState<ChatMessage[]>([WELCOME]);
  const [inputText,     setInputText]     = useState('');
  const [pendingPhoto,  setPendingPhoto]  = useState<{ uri: string; base64: string } | null>(null);
  const [isSending,     setIsSending]     = useState(false);

  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  // Auto-scroll on new message
  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  // ── Pick from gallery ────────────────────────────────
  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to upload a selfie.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const { uri, base64 } = result.assets[0];
      if (base64) setPendingPhoto({ uri, base64 });
    }
  };

  // ── Take photo ───────────────────────────────────────
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take a selfie.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const { uri, base64 } = result.assets[0];
      if (base64) setPendingPhoto({ uri, base64 });
    }
  };

  // ── Update loading message ───────────────────────────
  const updateLoadingMessage = (
    id: string,
    patch: Partial<ChatMessage>,
  ) => {
    setMessages(prev =>
      prev.map(m => m.id === id ? { ...m, ...patch } : m),
    );
  };

  // ── Send message ─────────────────────────────────────
  const handleSend = async () => {
    const text  = inputText.trim();
    const photo = pendingPhoto;
    if (!text && !photo) return;
    if (isSending) return;

    // Build user message
    const userMsg: ChatMessage = {
      id:           Date.now().toString(),
      role:         'user',
      text:         text || null,
      userPhotoUri: photo?.uri ?? null,
      timestamp:    new Date(),
    };

    // Add loading placeholder for assistant
    const loadingId = `loading-${Date.now()}`;
    const loadingMsg: ChatMessage = {
      id:          loadingId,
      role:        'assistant',
      text:        null,
      isLoading:   true,
      loadingStep: photo ? 'Analyzing your photo...' : 'Thinking...',
      timestamp:   new Date(),
    };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setInputText('');
    setPendingPhoto(null);
    setIsSending(true);

    try {
      // ── Path A: Photo + text → Hair Try-On ────────────
      if (photo) {
        // Step 1: Claude Vision → preservation prompt
        updateLoadingMessage(loadingId, { loadingStep: 'Analyzing your photo...' });
        const preservationPrompt = await buildPreservationPrompt(photo.base64);

        if (!preservationPrompt) {
          updateLoadingMessage(loadingId, {
            isLoading: false,
            text: 'Sorry, I could not analyze your photo. Please try a clearer selfie with good lighting.',
          });
          return;
        }

        // Step 2: Generate 4 images
        updateLoadingMessage(loadingId, {
          loadingStep: `Generating your ${text || 'new look'}... (this takes ~30 seconds)`,
        });

        const styleDesc = text || 'modern clean hairstyle';
        let partialImages: (string | null)[] = [null, null, null, null];

        const finalImages = await generate360(
          preservationPrompt,
          styleDesc,
          (partial) => {
            partialImages = partial;
            updateLoadingMessage(loadingId, {
              isLoading:       true,
              generatedImages: [...partial],
              loadingStep:
                `Generated ${partial.filter(Boolean).length}/4 views...`,
            });
          },
        );

        const successCount = finalImages.filter(Boolean).length;
        const responseText =
          successCount === 0
            ? `Sorry, I could not generate the try-on images. Please try again.`
            : `Here is your ${text || 'new look'} — ${successCount} views generated! ` +
              `Tap any image to see it in full. Want to try a different style or color?`;

        updateLoadingMessage(loadingId, {
          isLoading:       false,
          text:            responseText,
          generatedImages: finalImages,
        });

      // ── Path B: Text only → Claude chat ───────────────
      } else {
        const history = messages
          .filter(m => !m.isLoading && (m.text || m.userPhotoUri))
          .concat(userMsg)
          .map(m => ({
            role:    m.role,
            content: m.text ?? `[User sent a photo]`,
          }));

        const reply = await claudeChat(history);

        updateLoadingMessage(loadingId, {
          isLoading: false,
          text:      reply ?? 'Sorry, something went wrong. Please try again.',
        });
      }
    } catch (e) {
      console.error('Send error:', e);
      updateLoadingMessage(loadingId, {
        isLoading: false,
        text:      'Something went wrong. Please try again.',
      });
    } finally {
      setIsSending(false);
    }
  };

  // ── Render a single chat message ─────────────────────
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';

    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowBot]}>

        {/* Bot avatar */}
        {!isUser && (
          <View style={styles.botAvatar}>
            <Ionicons name="cut" size={16} color={theme.colors.gold} />
          </View>
        )}

        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot,
          item.isLoading && styles.bubbleLoading]}>

          {/* User selfie thumbnail */}
          {item.userPhotoUri && (
            <Image
              source={{ uri: item.userPhotoUri }}
              style={styles.userPhotoThumb}
              resizeMode="cover"
            />
          )}

          {/* Loading indicator */}
          {item.isLoading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={theme.colors.gold} />
              <Text style={styles.loadingStepText}>
                {item.loadingStep ?? 'Working on it...'}
              </Text>
            </View>
          )}

          {/* In-progress image grid (shows as images come in) */}
          {item.isLoading && item.generatedImages?.some(Boolean) && (
            <View style={styles.imageGrid}>
              {ANGLE_LABELS.map((label, i) => (
                <View key={i} style={styles.imageGridCell}>
                  {item.generatedImages?.[i] ? (
                    <Image
                      source={{ uri: item.generatedImages[i]! }}
                      style={styles.generatedImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <ActivityIndicator size="small" color={theme.colors.gold} />
                    </View>
                  )}
                  <Text style={styles.angleLabel}>{label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Text */}
          {item.text ? (
            <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextBot]}>
              {item.text}
            </Text>
          ) : null}

          {/* Final 360 image grid */}
          {!item.isLoading && item.generatedImages && item.generatedImages.some(Boolean) && (
            <View style={styles.imageGrid}>
              {ANGLE_LABELS.map((label, i) => (
                <View key={i} style={styles.imageGridCell}>
                  {item.generatedImages?.[i] ? (
                    <Image
                      source={{ uri: item.generatedImages[i]! }}
                      style={styles.generatedImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Ionicons name="image-outline" size={20} color={theme.colors.textMuted} />
                    </View>
                  )}
                  <Text style={styles.angleLabel}>{label}</Text>
                </View>
              ))}
            </View>
          )}

        </View>
      </View>
    );
  };

  // ── Quick style preset chips ─────────────────────────
  const PRESETS = [
    'Skin fade', 'Box fade', 'Low taper',
    'Mid taper', 'Loc fade', 'Buzz cut',
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="cut" size={18} color={theme.colors.gold} />
        </View>
        <View>
          <Text style={styles.headerTitle}>STYLE WITH AI</Text>
          <Text style={styles.headerSub}>613 Barbershop · AI Stylist</Text>
        </View>
      </View>

      {/* ── Messages ── */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
      />

      {/* ── Preset chips (only show when not sending) ── */}
      {!isSending && messages.length <= 2 && (
        <View style={styles.presetRow}>
          {PRESETS.map(p => (
            <TouchableOpacity
              key={p}
              style={styles.presetChip}
              onPress={() => setInputText(p)}
            >
              <Text style={styles.presetText}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Pending photo preview ── */}
      {pendingPhoto && (
        <View style={styles.pendingPhotoWrap}>
          <Image source={{ uri: pendingPhoto.uri }} style={styles.pendingPhoto} />
          <TouchableOpacity
            style={styles.removePendingPhoto}
            onPress={() => setPendingPhoto(null)}
          >
            <Ionicons name="close-circle" size={20} color={theme.colors.error} />
          </TouchableOpacity>
          <Text style={styles.pendingPhotoHint}>
            Describe the style you want →
          </Text>
        </View>
      )}

      {/* ── Input bar ── */}
      <View style={styles.inputBar}>
        {/* Camera */}
        <TouchableOpacity style={styles.inputIcon} onPress={takePhoto} disabled={isSending}>
          <Ionicons name="camera-outline" size={22} color={theme.colors.gold} />
        </TouchableOpacity>

        {/* Gallery */}
        <TouchableOpacity style={styles.inputIcon} onPress={pickFromGallery} disabled={isSending}>
          <Ionicons name="images-outline" size={22} color={theme.colors.gold} />
        </TouchableOpacity>

        {/* Text input */}
        <TextInput
          style={styles.textInput}
          placeholder={
            pendingPhoto
              ? 'Describe the style you want...'
              : 'Ask about styles, book, or upload a selfie...'
          }
          placeholderTextColor={theme.colors.textMuted}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={400}
          editable={!isSending}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />

        {/* Send */}
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!inputText.trim() && !pendingPhoto) && styles.sendBtnDisabled,
          ]}
          onPress={handleSend}
          disabled={isSending || (!inputText.trim() && !pendingPhoto)}
        >
          {isSending
            ? <ActivityIndicator size="small" color={theme.colors.textInverse} />
            : <Ionicons name="send" size={18} color={theme.colors.textInverse} />
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Angle labels for the 360 grid ─────────────────────────
const ANGLE_LABELS = ['FRONT', 'LEFT', 'RIGHT', 'BACK'];
const IMG_SIZE     = (SCREEN_WIDTH - 48 - 24) / 2; // 2 columns with gap

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },

  // ── Header ─────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
    padding: theme.spacing.lg, paddingTop: theme.spacing.xxl,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  headerIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: theme.colors.goldMuted, borderWidth: 1, borderColor: theme.colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.lg,
    color: theme.colors.gold, letterSpacing: 4,
  },
  headerSub: {
    fontFamily: theme.fonts.body, fontSize: theme.fontSizes.xs,
    color: theme.colors.textSecondary, marginTop: 2,
  },

  // ── Messages ────────────────────────────────────────────
  messageList: {
    padding: theme.spacing.md, paddingBottom: theme.spacing.xl, gap: theme.spacing.md,
  },
  msgRow:     { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowBot:  { justifyContent: 'flex-start', alignItems: 'flex-end' },

  botAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: theme.colors.goldMuted, borderWidth: 1, borderColor: theme.colors.gold,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  bubble: {
    maxWidth: '80%', borderRadius: theme.radius.lg,
    padding: theme.spacing.md, gap: theme.spacing.sm,
  },
  bubbleUser: {
    backgroundColor: theme.colors.gold,
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleLoading: { borderColor: theme.colors.gold },

  bubbleText: {
    fontFamily: theme.fonts.body, fontSize: theme.fontSizes.sm, lineHeight: 22,
  },
  bubbleTextUser: { color: theme.colors.textInverse },
  bubbleTextBot:  { color: theme.colors.textPrimary },

  // ── User selfie thumb ──────────────────────────────────
  userPhotoThumb: {
    width: '100%', height: 180, borderRadius: theme.radius.md,
    marginBottom: theme.spacing.xs,
  },

  // ── Loading ─────────────────────────────────────────────
  loadingRow: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
  },
  loadingStepText: {
    fontFamily: theme.fonts.body, fontSize: theme.fontSizes.xs,
    color: theme.colors.textSecondary, flex: 1,
  },

  // ── 360 image grid ──────────────────────────────────────
  imageGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    marginTop: theme.spacing.xs,
  },
  imageGridCell: {
    width: IMG_SIZE, alignItems: 'center', gap: 4,
  },
  generatedImage: {
    width: IMG_SIZE, height: IMG_SIZE, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  imagePlaceholder: {
    width: IMG_SIZE, height: IMG_SIZE, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background, borderWidth: 1,
    borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center',
  },
  angleLabel: {
    fontFamily: theme.fonts.heading, fontSize: 9,
    color: theme.colors.gold, letterSpacing: 2,
  },

  // ── Preset chips ────────────────────────────────────────
  presetRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.xs,
  },
  presetChip: {
    paddingVertical: 6, paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.goldMuted, borderWidth: 1, borderColor: theme.colors.gold,
    borderRadius: theme.radius.full,
  },
  presetText: {
    fontFamily: theme.fonts.medium, fontSize: theme.fontSizes.xs,
    color: theme.colors.gold, letterSpacing: 1,
  },

  // ── Pending photo ────────────────────────────────────────
  pendingPhotoWrap: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.xs,
  },
  pendingPhoto: {
    width: 52, height: 52, borderRadius: theme.radius.md,
    borderWidth: 1.5, borderColor: theme.colors.gold,
  },
  removePendingPhoto: { position: 'absolute', top: -6, left: 42 },
  pendingPhotoHint: {
    fontFamily: theme.fonts.body, fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted, flex: 1,
  },

  // ── Input bar ───────────────────────────────────────────
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.xs,
    padding: theme.spacing.md, paddingBottom: Platform.OS === 'ios' ? 28 : theme.spacing.md,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  inputIcon: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    borderRadius: theme.radius.md, backgroundColor: theme.colors.goldMuted,
    borderWidth: 1, borderColor: theme.colors.gold,
  },
  textInput: {
    flex: 1, minHeight: 40, maxHeight: 120,
    backgroundColor: theme.colors.background, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm,
    color: '#FFFFFF', fontFamily: theme.fonts.body, fontSize: theme.fontSizes.sm,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: theme.colors.gold,
    alignItems: 'center', justifyContent: 'center', ...theme.shadows.gold,
  },
  sendBtnDisabled: { opacity: 0.4 },
});