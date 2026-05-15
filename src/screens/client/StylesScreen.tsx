import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Image, ActivityIndicator,
  Dimensions, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  doc, updateDoc, serverTimestamp, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../constants/collections';
import { useAuth } from '../../context/AuthContext';
import { theme } from '../../theme';
import type { FaceAnalysis, StyleRecommendation } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Nav typing ────────────────────────────────────────────
type StylesScreenNavParams = {
  BookingFlow: undefined;
  StyleChat:   undefined;
};
type StylesNav = NativeStackNavigationProp<StylesScreenNavParams>;

// ── Saved style item (gallery entry) ─────────────────────
interface SavedStyleItem {
  id:                string;
  name:              string;
  description:       string;
  generatedImageUrl?: string | null;
  savedAt?:          string;
}

// ── Models ────────────────────────────────────────────────
const MODEL_HAIKU  = 'claude-haiku-4-5-20251001';
const MODEL_SONNET = 'claude-sonnet-4-6';

// ── Photo angle labels ────────────────────────────────────
const ANGLES      = ['FRONT', 'LEFT', 'RIGHT', 'TILT UP', 'TILT DOWN'] as const;
const ANGLE_HINTS = [
  'Face camera straight on',
  'Turn head left',
  'Turn head right',
  'Tilt head up slightly',
  'Tilt head down slightly',
];

// ── Local extended type ───────────────────────────────────
interface ExtendedFaceAnalysis extends FaceAnalysis {
  bestPhotoIndex?:  number;
  secondBestIndex?: number;
}

// ── System prompts ────────────────────────────────────────
const FACE_SYSTEM_PROMPT =
  'You are a professional hairstyle consultant. ' +
  'Respond only in plain English. ' +
  'No markdown, no asterisks, no bullet points. ' +
  'Write short clear sentences.';

const STYLE_SYSTEM_PROMPT =
  'You are the world\'s best hairstyle consultant with 20 years experience ' +
  'across all hair types, ethnicities, face shapes, and head sizes. ' +
  'You work with clients of every background — all hair textures and all ethnicities. ' +
  'You recommend only modern styles from 2015 onwards. ' +
  'No vintage, no pre-2015 styles. ' +
  'You think deeply before recommending. ' +
  'Respond ONLY with valid JSON. No markdown. No fences.';

const buildFacePrompt = (photoCount: number): string =>
  `Analyze all ${photoCount} photos of the same person carefully. ` +
  `Use all angles together for the most accurate analysis. ` +
  `Return ONLY a JSON object:\n` +
  `{\n` +
  `  "faceShape": "oval|round|square|heart|diamond|oblong|triangle",\n` +
  `  "headSize": "small|medium|large",\n` +
  `  "hairTexture": "coily|curly|wavy|straight|locs",\n` +
  `  "skinTone": "light|medium|tan|dark|deep",\n` +
  `  "currentStyle": "one sentence describing current hair",\n` +
  `  "faceSummary": "one friendly sentence a hairstylist would say. Plain English.",\n` +
  `  "bestPhotoIndex": 0,\n` +
  `  "secondBestIndex": 1\n` +
  `}\n` +
  `bestPhotoIndex: index (0 to ${photoCount - 1}) of the clearest front-facing photo\n` +
  `secondBestIndex: index (0 to ${photoCount - 1}) of the second clearest photo`;

const buildStylePrompt = (face: FaceAnalysis): string =>
  `This person has the following profile:\n` +
  `Face shape: ${face.faceShape}\n` +
  `Head size: ${face.headSize}\n` +
  `Hair texture: ${face.hairTexture}\n` +
  `Skin tone: ${face.skinTone}\n` +
  `Current style: ${face.currentStyle}\n\n` +
  `Find 4 COMPLETELY DIFFERENT modern hairstyles (2015-2026) that will make ` +
  `this specific person look their absolute best.\n\n` +
  `Rules for the 4 styles:\n` +
  `- Each must be completely different from the others\n` +
  `- Mix: one bold, one clean/classic, one trendy 2024-2026, one versatile everyday\n` +
  `- Every style must suit their face shape AND hair texture combination\n` +
  `- No two styles can be the same type\n` +
  `- Recommend styles for ALL hair types and ethnicities, not just one group\n\n` +
  `Rules for the hairstyle prompt (CRITICAL — goes directly to LightX hair AI):\n` +
  `- Write SHORT natural descriptions under 15 words — LightX works best with concise prompts\n` +
  `- Focus on the hair only: cut type, length, texture, fade level\n` +
  `- Use real barber/salon language — not art direction\n` +
  `- Always include the word "natural" to trigger LightX's realistic blend mode\n` +
  `- NEVER include face/skin preservation instructions — LightX handles that automatically\n` +
  `- Example good: "natural low skin fade, soft coily top, sharp lineup"\n` +
  `- Example good: "natural bob cut, straight sleek, blunt ends"\n` +
  `- Example good: "natural shoulder length box braids, dark brown"\n` +
  `- Example good: "natural textured crop, low taper fade, messy top"\n` +
  `- Example BAD: "preserve face, photorealistic, seamless blend" (do not add these)\n\n` +
  `Return ONLY this JSON:\n` +
  `{\n` +
  `  "styles": [\n` +
  `    {\n` +
  `      "name": "specific modern style name",\n` +
  `      "year": "year popularized 2015-2026",\n` +
  `      "shortDescription": "max 2 sentences, plain English",\n` +
  `      "whyItFits": "one sentence mentioning face shape AND hair texture",\n` +
  `      "fluxPrompt": "hairstyle description under 30 words"\n` +
  `    }\n` +
  `  ]\n` +
  `}`;

type LoadingStage = 'idle' | 'haiku' | 'sonnet' | 'flux' | 'done';

interface ClaudeResponse {
  content?: Array<{ text?: string }>;
}
interface LightXSubmitResponse { body?: { orderId?: string }; }
interface LightXPollResponse   { body?: { status?: string; output?: string }; }

const extractJson = <T,>(text: string): T | null => {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  }
  const start = cleaned.indexOf('{');
  const end   = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try { return JSON.parse(cleaned.slice(start, end + 1)) as T; } catch { return null; }
};

const callClaude = async (
  model: string, system: string, messages: unknown, maxTokens: number,
): Promise<string | null> => {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':                              'application/json',
        'x-api-key':                                 apiKey,
        'anthropic-version':                         '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as ClaudeResponse;
    const text = data.content?.[0]?.text;
    return typeof text === 'string' ? text : null;
  } catch { return null; }
};

const uploadToImgBB = async (base64: string): Promise<{ url: string | null; error: string | null }> => {
  try {
    const key = process.env.EXPO_PUBLIC_IMGBB_API_KEY;
    if (!key) return { url: null, error: 'ImgBB key missing' };
    const formData = new FormData();
    formData.append('image', base64);
    const res  = await fetch(`https://api.imgbb.com/1/upload?key=${key}`, { method: 'POST', body: formData });
    const data = (await res.json()) as { data?: { url?: string }; error?: { message?: string } };
    if (!res.ok || !data?.data?.url) return { url: null, error: `ImgBB error: ${data?.error?.message ?? res.status}` };
    return { url: data.data.url, error: null };
  } catch (e) { return { url: null, error: `ImgBB exception: ${String(e)}` }; }
};

const generateStyleImage = async (
  stylePrompt: string, imageUrl: string,
): Promise<{ url: string | null; error: string | null }> => {
  const key = process.env.EXPO_PUBLIC_LIGHTX_API_KEY;
  if (!key) return { url: null, error: 'LightX key missing' };
  try {
    const submitRes = await fetch('https://api.lightxeditor.com/external/api/v1/hairstyle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({
        imageUrl,
        textPrompt: `${stylePrompt}, natural real hair texture, seamless skin blend, realistic photograph, match original photo lighting`,
      }),
    });
    if (!submitRes.ok) {
      const errText = await submitRes.text();
      return { url: null, error: `LightX submit failed ${submitRes.status}: ${errText.slice(0, 120)}` };
    }
    const submitData = (await submitRes.json()) as LightXSubmitResponse;
    const orderId    = submitData?.body?.orderId;
    if (!orderId) return { url: null, error: 'No orderId returned from LightX' };

    for (let i = 0; i < 20; i++) {
      await new Promise<void>(resolve => setTimeout(resolve, 3000));
      const pollRes  = await fetch('https://api.lightxeditor.com/external/api/v1/order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key },
        body: JSON.stringify({ orderId }),
      });
      if (!pollRes.ok) continue;
      const pollData = (await pollRes.json()) as LightXPollResponse;
      const status   = pollData?.body?.status;
      const output   = pollData?.body?.output;
      if ((status === 'completed' || status === 'active') && output) return { url: output, error: null };
      if (status === 'failed') return { url: null, error: 'LightX generation failed' };
    }
    return { url: null, error: 'LightX timed out after 60s' };
  } catch (e) { return { url: null, error: `Exception: ${String(e)}` }; }
};

// ── Component ─────────────────────────────────────────────
export default function StylesScreen() {
  const navigation = useNavigation<StylesNav>();
  const { user }   = useAuth();

  const [selfieUris,    setSelfieUris]    = useState<(string | null)[]>(Array(5).fill(null));
  const [selfieBase64s, setSelfieBase64s] = useState<(string | null)[]>(Array(5).fill(null));
  const [selfieUrls,    setSelfieUrls]    = useState<(string | null)[]>(Array(5).fill(null));
  const [bestPhotoIndex, setBestPhotoIndex] = useState<number>(0);

  const [loadingStage,    setLoadingStage]    = useState<LoadingStage>('idle');
  const [faceAnalysis,    setFaceAnalysis]    = useState<FaceAnalysis | null>(null);
  const [recommendations, setRecommendations] = useState<StyleRecommendation[]>([]);
  const [generatedImages, setGeneratedImages] = useState<(string | null)[]>([]);
  const [selectedStyle,    setSelectedStyle]    = useState<StyleRecommendation | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [saving,   setSaving]   = useState<boolean>(false);

  // ── Gallery tab state ─────────────────────────────────
  const [galleryTab, setGalleryTab] = useState<'ai' | 'saved'>('ai');

  const uploadedCount = selfieUris.filter(Boolean).length;
  const canAnalyze    = uploadedCount >= 3;

  // Saved styles gallery from user doc
  const savedStylesGallery: SavedStyleItem[] =
    ((user as unknown as { savedStyles?: SavedStyleItem[] })?.savedStyles ?? [])
      .slice()
      .reverse(); // newest first

  const resetAnalysis = () => {
    setFaceAnalysis(null); setRecommendations([]); setGeneratedImages([]);
    setSelectedStyle(null); setSelectedImageUrl(null);
    setSelfieUrls(Array(5).fill(null)); setError(null); setGenError(null);
    setLoadingStage('idle'); setBestPhotoIndex(0);
  };

  const pickImageForSlot = async (slotIndex: number) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError('Please allow photo access to upload photos.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.80, base64: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (!asset.base64 || !asset.uri) return;
    setSelfieUris(prev => { const n = [...prev]; n[slotIndex] = asset.uri; return n; });
    setSelfieBase64s(prev => { const n = [...prev]; n[slotIndex] = asset.base64 ?? null; return n; });
    resetAnalysis();
  };

  const runFaceAnalysis = async (base64Array: (string | null)[]): Promise<ExtendedFaceAnalysis | null> => {
    const validPhotos = base64Array.map((b64, i) => ({ b64, i })).filter(x => x.b64 !== null);
    if (validPhotos.length === 0) return null;
    const angleLabels = ['front-facing','left side','right side','tilted up','tilted down'];
    const content: unknown[] = [];
    validPhotos.forEach(({ b64, i }) => {
      content.push({ type: 'text', text: `Photo ${i + 1} (${angleLabels[i]}):` });
      content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 as string } });
    });
    content.push({ type: 'text', text: buildFacePrompt(validPhotos.length) });
    const text = await callClaude(MODEL_HAIKU, FACE_SYSTEM_PROMPT, [{ role: 'user', content }], 700);
    if (!text) return null;
    const face = extractJson<ExtendedFaceAnalysis>(text);
    if (!face?.faceShape || !face?.hairTexture) return null;
    return face;
  };

  const runStyleRecommendations = async (face: FaceAnalysis): Promise<StyleRecommendation[]> => {
    const text = await callClaude(MODEL_SONNET, STYLE_SYSTEM_PROMPT, [{ role: 'user', content: buildStylePrompt(face) }], 2000);
    if (!text) return [];
    const parsed    = extractJson<unknown>(text);
    let   candidate: unknown = parsed;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      candidate = obj.styles ?? obj.recommendations ?? parsed;
    }
    if (!Array.isArray(candidate)) return [];
    return candidate.filter(
      (r): r is StyleRecommendation =>
        !!r && typeof r === 'object' &&
        typeof (r as StyleRecommendation).name === 'string' &&
        typeof (r as StyleRecommendation).fluxPrompt === 'string',
    );
  };

  const handleAnalyze = async () => {
    if (!canAnalyze) return;
    setError(null); setGenError(null); setFaceAnalysis(null); setRecommendations([]);
    setGeneratedImages([]); setSelectedStyle(null); setSelectedImageUrl(null);
    setSelfieUrls(Array(5).fill(null));

    setLoadingStage('haiku');
    const face = await runFaceAnalysis(selfieBase64s);
    if (!face) { setLoadingStage('idle'); setError('Could not read your face. Please try clearer photos.'); return; }
    const validCount = selfieBase64s.filter(Boolean).length;
    const best = Math.min(face.bestPhotoIndex ?? 0, validCount - 1);
    setBestPhotoIndex(best); setFaceAnalysis(face);

    setLoadingStage('sonnet');
    let recs: StyleRecommendation[] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      recs = await runStyleRecommendations(face);
      if (recs.length >= 3) break;
    }
    if (recs.length === 0) { setLoadingStage('idle'); setError('Could not generate styles. Please try again.'); return; }
    setRecommendations(recs);

    setLoadingStage('flux');
    const finalBest = Math.min(face.bestPhotoIndex ?? 0, selfieBase64s.length - 1);
    const b64Best   = selfieBase64s[finalBest];
    if (!b64Best) { setError('Missing photo. Please re-upload your photos.'); setLoadingStage('idle'); return; }

    const imgbbResult = await uploadToImgBB(b64Best);
    if (!imgbbResult.url) { setError(imgbbResult.error ?? 'Could not upload photo.'); setLoadingStage('idle'); return; }
    const newUrls = [...selfieUrls]; newUrls[finalBest] = imgbbResult.url; setSelfieUrls(newUrls);

    const results: { url: string | null; error: string | null }[] = [];
    for (let i = 0; i < recs.length; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 4000));
      const result = await generateStyleImage(recs[i].fluxPrompt, imgbbResult.url);
      results.push(result);
      const partial = results.map(r => r.url);
      while (partial.length < recs.length) partial.push(null);
      setGeneratedImages([...partial]);
    }
    const images = results.map(r => r.url);
    const firstError = results.find(r => r.error)?.error;
    setGeneratedImages(images);
    if (firstError) setGenError(firstError);
    setLoadingStage('done');
  };

  const retryImage = async (index: number) => {
    const url = selfieUrls[bestPhotoIndex];
    if (!url) return;
    const rec = recommendations[index];
    if (!rec) return;
    const result = await generateStyleImage(rec.fluxPrompt, url);
    setGeneratedImages(prev => { const n = [...prev]; n[index] = result.url; return n; });
    if (result.error) setGenError(result.error); else setGenError(null);
  };

  const handleSelectStyle = (style: StyleRecommendation, imageUrl: string | null) => {
    setSelectedStyle(style); setSelectedImageUrl(imageUrl);
  };
  const handleSeeOtherStyles = () => { setSelectedStyle(null); setSelectedImageUrl(null); };

  // ── Save style — also appends to savedStyles gallery array ──
  const writeSavedStyle = async (style: StyleRecommendation, imageUrl: string | null): Promise<boolean> => {
    if (!user?.id) return false;
    try {
      const galleryItem: SavedStyleItem = {
        id:                Date.now().toString(),
        name:              style.name,
        description:       style.shortDescription,
        generatedImageUrl: imageUrl ?? null,
        savedAt:           new Date().toISOString(),
      };
      await updateDoc(doc(db, COLLECTIONS.USERS, user.id), {
        // Keep single savedStyle for booking flow
        savedStyle: {
          name:              style.name,
          description:       style.shortDescription,
          whyItFits:         style.whyItFits,
          fluxPrompt:        style.fluxPrompt,
          generatedImageUrl: imageUrl ?? null,
          originalSelfieRef: selfieUris[bestPhotoIndex] ?? null,
          savedAt:           serverTimestamp(),
        },
        // Append to gallery array
        savedStyles: arrayUnion(galleryItem),
      });
      return true;
    } catch { return false; }
  };

  // ── Remove a style from gallery ───────────────────────
  const removeFromGallery = async (item: SavedStyleItem) => {
    if (!user?.id) return;
    Alert.alert('Remove Style', 'Remove this style from your saved looks?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await updateDoc(doc(db, COLLECTIONS.USERS, user.id), {
              savedStyles: arrayRemove(item),
            });
          } catch (e) { console.error('Remove style failed:', e); }
        },
      },
    ]);
  };

  const handleSaveAndBook = async () => {
    if (!selectedStyle || saving) return;
    setSaving(true);
    const ok = await writeSavedStyle(selectedStyle, selectedImageUrl);
    setSaving(false);
    if (!ok) { setError('Could not save. Please try again.'); return; }
    navigation.navigate('BookingFlow');
  };

  const handleChatAbout = async () => {
    if (!selectedStyle || saving) return;
    setSaving(true);
    await writeSavedStyle(selectedStyle, selectedImageUrl);
    setSaving(false);
    navigation.navigate('StyleChat');
  };

  const handleBookSaved   = () => navigation.navigate('BookingFlow');
  const handleUpdateStyle = () => resetAnalysis();

  const isLoading = loadingStage === 'haiku' || loadingStage === 'sonnet' || loadingStage === 'flux';

  const savedThumbUrl =
    user?.savedStyle?.generatedImageUrl ??
    (user?.savedStyle as { tryOnImageUrl?: string } | undefined)?.tryOnImageUrl ?? null;

  const bestSelfieUri = selfieUris[bestPhotoIndex] ?? selfieUris.find(Boolean) ?? null;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Upload card ───────────────────────────── */}
        {!selectedStyle ? (
          <View style={styles.uploadCard}>
            <Text style={styles.uploadTitle}>MY STYLE PROFILE</Text>
            <Text style={styles.uploadSubtitle}>
              Upload 5 photos from different angles for the most accurate AI analysis.
              For best results: stand 50cm from camera so your full head is visible.
            </Text>
            <View style={styles.slotsGrid}>
              <View style={styles.slotsRow}>
                {[0, 1, 2].map(i => (
                  <TouchableOpacity key={i} style={styles.slot} onPress={() => pickImageForSlot(i)} activeOpacity={0.8}>
                    {selfieUris[i] ? (
                      <Image source={{ uri: selfieUris[i]! }} style={styles.slotImage} />
                    ) : (
                      <View style={styles.slotEmpty}>
                        <Ionicons name="add-circle-outline" size={28} color={theme.colors.textMuted} />
                      </View>
                    )}
                    <Text style={[styles.slotLabel, selfieUris[i] ? styles.slotLabelDone : undefined]}>
                      {ANGLES[i]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={[styles.slotsRow, styles.slotsRowCenter]}>
                {[3, 4].map(i => (
                  <TouchableOpacity key={i} style={styles.slot} onPress={() => pickImageForSlot(i)} activeOpacity={0.8}>
                    {selfieUris[i] ? (
                      <Image source={{ uri: selfieUris[i]! }} style={styles.slotImage} />
                    ) : (
                      <View style={styles.slotEmpty}>
                        <Ionicons name="add-circle-outline" size={28} color={theme.colors.textMuted} />
                      </View>
                    )}
                    <Text style={[styles.slotLabel, selfieUris[i] ? styles.slotLabelDone : undefined]}>
                      {ANGLES[i]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.progressRow}>
              {Array(5).fill(null).map((_, i) => (
                <View key={i} style={[styles.progressDot, selfieUris[i] ? styles.progressDotFilled : undefined]} />
              ))}
              <Text style={styles.progressText}>
                {uploadedCount}/5{uploadedCount >= 5 ? ' — all 5 loaded!' : uploadedCount >= 3 ? ' — ready!' : ''}
              </Text>
            </View>
            {uploadedCount < 3 ? <Text style={styles.uploadHintText}>Upload at least 3 photos to start</Text> : null}
            {uploadedCount < 5 ? (
              <View style={styles.hintGrid}>
                {ANGLE_HINTS.map((hint, i) =>
                  selfieUris[i] ? null : (
                    <Text key={i} style={styles.hintItem}>{ANGLES[i]}: {hint}</Text>
                  )
                )}
              </View>
            ) : null}
            {canAnalyze && !isLoading ? (
              <TouchableOpacity style={styles.analyzeBtn} onPress={handleAnalyze} activeOpacity={0.85}>
                <Ionicons name="color-wand" size={18} color={theme.colors.textInverse} />
                <Text style={styles.analyzeBtnText}>FIND MY PERFECT STYLES</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* ── Saved style banner ────────────────────── */}
        {user?.savedStyle && !selectedStyle ? (
          <View style={styles.savedBanner}>
            <Text style={styles.savedBannerLabel}>YOUR SAVED STYLE</Text>
            <View style={styles.savedBannerRow}>
              {savedThumbUrl ? (
                <Image source={{ uri: savedThumbUrl }} style={styles.savedThumb} />
              ) : (
                <View style={[styles.savedThumb, styles.savedThumbPlaceholder]}>
                  <Ionicons name="cut" size={28} color={theme.colors.textMuted} />
                </View>
              )}
              <View style={styles.savedBannerTextWrap}>
                <Text style={styles.savedBannerName} numberOfLines={2}>{user.savedStyle.name}</Text>
              </View>
            </View>
            <View style={styles.savedBannerButtons}>
              <TouchableOpacity style={[styles.savedBtn, styles.savedBtnPrimary]} onPress={handleBookSaved}>
                <Text style={styles.savedBtnPrimaryText}>BOOK IT</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.savedBtn, styles.savedBtnOutline]} onPress={handleUpdateStyle}>
                <Text style={styles.savedBtnOutlineText}>UPDATE STYLE</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* ── SAVED STYLES GALLERY ─────────────────── */}
        {savedStylesGallery.length > 0 && !selectedStyle && !isLoading ? (
          <View style={styles.gallerySection}>
            <Text style={styles.gallerySectionTitle}>MY SAVED LOOKS</Text>

            {/* Tab switcher */}
            <View style={styles.galleryTabs}>
              <TouchableOpacity
                style={[styles.galleryTab, galleryTab === 'ai' && styles.galleryTabActive]}
                onPress={() => setGalleryTab('ai')}
              >
                <Text style={[styles.galleryTabText, galleryTab === 'ai' && styles.galleryTabTextActive]}>
                  AI RECOMMENDED
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.galleryTab, galleryTab === 'saved' && styles.galleryTabActive]}
                onPress={() => setGalleryTab('saved')}
              >
                <Text style={[styles.galleryTabText, galleryTab === 'saved' && styles.galleryTabTextActive]}>
                  SAVED PICTURES
                </Text>
              </TouchableOpacity>
            </View>

            {/* Both tabs show savedStylesGallery — same source, different label */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.galleryScroll}
            >
              {savedStylesGallery.map((item) => (
                <View key={item.id} style={styles.galleryCard}>
                  {item.generatedImageUrl ? (
                    <Image source={{ uri: item.generatedImageUrl }} style={styles.galleryImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.galleryImage, styles.galleryImagePlaceholder]}>
                      <Ionicons name="cut-outline" size={24} color={theme.colors.textMuted} />
                    </View>
                  )}
                  <View style={styles.galleryCardBody}>
                    <Text style={styles.galleryCardName} numberOfLines={2}>{item.name}</Text>
                    <View style={styles.galleryCardBtns}>
                      <TouchableOpacity
                        style={styles.galleryBookBtn}
                        onPress={handleBookSaved}
                      >
                        <Text style={styles.galleryBookBtnText}>BOOK</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.galleryRemoveBtn}
                        onPress={() => removeFromGallery(item)}
                      >
                        <Ionicons name="trash-outline" size={14} color={theme.colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* ── Loading card ──────────────────────────── */}
        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={theme.colors.gold} />
            <Text style={styles.loadingText}>
              {loadingStage === 'haiku' ? `Analyzing your ${uploadedCount} photos...`
                : loadingStage === 'sonnet' ? 'Finding styles that suit you...'
                : 'Creating your looks...'}
            </Text>
            {loadingStage === 'flux' ? <Text style={styles.loadingSubtext}>This takes about 30 seconds</Text> : null}
          </View>
        ) : null}

        {/* ── Error ─────────────────────────────────── */}
        {error && !isLoading ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={22} color={theme.colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ── Face analysis card ────────────────────── */}
        {faceAnalysis && !selectedStyle && !isLoading ? (
          <View style={styles.faceCard}>
            <View style={styles.facePillRow}>
              <View style={styles.facePill}><Text style={styles.facePillText}>{faceAnalysis.faceShape.toUpperCase()}</Text></View>
              <View style={styles.facePill}><Text style={styles.facePillText}>{faceAnalysis.hairTexture.toUpperCase()}</Text></View>
            </View>
            <Text style={styles.faceSummary}>{faceAnalysis.faceSummary}</Text>
          </View>
        ) : null}

        {/* ── Style cards ──────────────────────────── */}
        {recommendations.length > 0 && (loadingStage === 'flux' || loadingStage === 'done') && !selectedStyle ? (
          <>
            <Text style={styles.sectionTitle}>YOUR LOOKS</Text>
            <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recScroll}>
              {recommendations.map((rec, i) => {
                const imgUrl = generatedImages[i];
                return (
                  <View key={`${rec.name}-${i}`} style={styles.recCard}>
                    <View style={styles.recImageWrap}>
                      {imgUrl ? (
                        <Image source={{ uri: imgUrl }} style={styles.recImage} resizeMode="cover" />
                      ) : bestSelfieUri ? (
                        <View style={styles.recFallbackWrap}>
                          <Image source={{ uri: bestSelfieUri }} style={styles.recImage} resizeMode="cover" />
                          {loadingStage === 'flux' ? (
                            <View style={styles.recFallbackBadge}>
                              <Text style={styles.recFallbackText}>Generating...</Text>
                            </View>
                          ) : (
                            <TouchableOpacity style={styles.recFallbackBadge} onPress={() => retryImage(i)} activeOpacity={0.7}>
                              <Text style={styles.recFallbackText}>Preview failed — tap to retry</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ) : (
                        <View style={styles.recImageFallback}>
                          <Ionicons name="cut" size={36} color={theme.colors.textMuted} />
                        </View>
                      )}
                      <View style={styles.recOverlay}>
                        <Text style={styles.recOverlayText} numberOfLines={2}>{rec.name.toUpperCase()}</Text>
                      </View>
                    </View>
                    <View style={styles.recBody}>
                      <Text style={styles.recName} numberOfLines={2}>{rec.name.toUpperCase()}</Text>
                      <View style={styles.recYearBadge}><Text style={styles.recYearText}>{rec.year}</Text></View>
                      <Text style={styles.recShortDesc} numberOfLines={3}>{rec.shortDescription}</Text>
                      <Text style={styles.recWhyItFits} numberOfLines={2}>{rec.whyItFits}</Text>
                      <TouchableOpacity style={styles.selectBtn} onPress={() => handleSelectStyle(rec, imgUrl ?? null)} activeOpacity={0.85}>
                        <Text style={styles.selectBtnText}>SELECT THIS STYLE</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            <Text style={styles.scrollHint}>Swipe left to see all your looks</Text>
            {genError ? <Text style={styles.genErrorText}>{genError}</Text> : null}
          </>
        ) : null}

        {/* ── Before / After ───────────────────────── */}
        {selectedStyle ? (
          <View style={styles.beforeAfterWrap}>
            <Text style={styles.transformTitle}>YOUR TRANSFORMATION</Text>
            <Text style={styles.beforeLabel}>BEFORE</Text>
            {bestSelfieUri ? <Image source={{ uri: bestSelfieUri }} style={styles.beforeImage} resizeMode="cover" /> : null}
            <Text style={styles.afterLabel}>AFTER</Text>
            {selectedImageUrl ? (
              <Image source={{ uri: selectedImageUrl }} style={styles.afterImage} resizeMode="cover" />
            ) : bestSelfieUri ? (
              <Image source={{ uri: bestSelfieUri }} style={styles.afterImage} resizeMode="cover" />
            ) : null}
            <Text style={styles.afterName}>{selectedStyle.name.toUpperCase()}</Text>
            <TouchableOpacity style={styles.saveBookBtn} onPress={handleSaveAndBook} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator size="small" color={theme.colors.textInverse} /> : <Text style={styles.saveBookBtnText}>SAVE & BOOK THIS STYLE</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.chatBtn} onPress={handleChatAbout} disabled={saving} activeOpacity={0.85}>
              <Ionicons name="chatbubble-outline" size={16} color={theme.colors.gold} />
              <Text style={styles.chatBtnText}>CHAT ABOUT THIS STYLE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.seeOtherBtn} onPress={handleSeeOtherStyles} activeOpacity={0.85}>
              <Text style={styles.seeOtherBtnText}>SEE OTHER STYLES</Text>
            </TouchableOpacity>
          </View>
        ) : null}

      </ScrollView>
    </View>
  );
}

const SLOT_SIZE = Math.floor((SCREEN_WIDTH - 32 - 16) / 3);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll:    { padding: theme.spacing.md, paddingTop: theme.spacing.xxl, paddingBottom: theme.spacing.xxl, gap: theme.spacing.md },

  savedBanner:         { backgroundColor: theme.colors.goldMuted, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.gold, padding: theme.spacing.md, gap: theme.spacing.sm },
  savedBannerLabel:    { fontFamily: theme.fonts.heading, fontSize: 12, color: theme.colors.gold, letterSpacing: 3 },
  savedBannerRow:      { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  savedThumb:          { width: 80, height: 80, borderRadius: 8, borderWidth: 1.5, borderColor: theme.colors.gold },
  savedThumbPlaceholder: { backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' },
  savedBannerTextWrap: { flex: 1 },
  savedBannerName:     { fontFamily: theme.fonts.heading, fontSize: 18, color: theme.colors.textPrimary, letterSpacing: 2 },
  savedBannerButtons:  { flexDirection: 'row', gap: theme.spacing.sm },
  savedBtn:            { flex: 1, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  savedBtnPrimary:     { backgroundColor: theme.colors.gold },
  savedBtnPrimaryText: { fontFamily: theme.fonts.heading, fontSize: 13, color: theme.colors.textInverse, letterSpacing: 2 },
  savedBtnOutline:     { borderWidth: 1, borderColor: theme.colors.gold },
  savedBtnOutlineText: { fontFamily: theme.fonts.heading, fontSize: 13, color: theme.colors.gold, letterSpacing: 2 },

  // ── Saved Styles Gallery ─────────────────────────────
  gallerySection:      { gap: theme.spacing.sm },
  gallerySectionTitle: { fontFamily: theme.fonts.heading, fontSize: 14, color: theme.colors.gold, letterSpacing: 4 },
  galleryTabs:         { flexDirection: 'row', gap: theme.spacing.sm },
  galleryTab: {
    flex: 1, paddingVertical: theme.spacing.xs, alignItems: 'center',
    borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  galleryTabActive:    { borderColor: theme.colors.gold, backgroundColor: theme.colors.goldMuted },
  galleryTabText:      { fontFamily: theme.fonts.medium, fontSize: 11, color: theme.colors.textMuted, letterSpacing: 1 },
  galleryTabTextActive:{ color: theme.colors.gold },
  galleryScroll:       { gap: theme.spacing.md, paddingVertical: theme.spacing.sm },
  galleryCard: {
    width: 140, backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  galleryImage:           { width: 140, height: 160 },
  galleryImagePlaceholder:{ backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
  galleryCardBody:     { padding: theme.spacing.sm, gap: theme.spacing.xs },
  galleryCardName:     { fontFamily: theme.fonts.heading, fontSize: 11, color: theme.colors.textPrimary, letterSpacing: 1 },
  galleryCardBtns:     { flexDirection: 'row', gap: theme.spacing.xs, alignItems: 'center' },
  galleryBookBtn: {
    flex: 1, height: 30, backgroundColor: theme.colors.gold,
    borderRadius: theme.radius.sm, alignItems: 'center', justifyContent: 'center',
  },
  galleryBookBtnText:  { fontFamily: theme.fonts.heading, fontSize: 10, color: theme.colors.textInverse, letterSpacing: 1 },
  galleryRemoveBtn: {
    width: 30, height: 30, alignItems: 'center', justifyContent: 'center',
    borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.error,
  },

  uploadCard:     { backgroundColor: theme.colors.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.lg, gap: theme.spacing.md },
  uploadTitle:    { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.lg, color: theme.colors.gold, letterSpacing: 4 },
  uploadSubtitle: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, marginTop: -theme.spacing.sm },
  slotsGrid:      { gap: theme.spacing.sm },
  slotsRow:       { flexDirection: 'row', gap: 8 },
  slotsRowCenter: { justifyContent: 'center' },
  slot:           { width: SLOT_SIZE, height: SLOT_SIZE, borderRadius: 10, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  slotImage:      { width: SLOT_SIZE, height: SLOT_SIZE },
  slotEmpty:      { alignItems: 'center', justifyContent: 'center', flex: 1 },
  slotLabel:      { position: 'absolute', bottom: 4, fontFamily: theme.fonts.heading, fontSize: 9, color: theme.colors.textMuted, letterSpacing: 1, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 },
  slotLabelDone:  { color: theme.colors.gold },
  progressRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  progressDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.border, borderWidth: 1, borderColor: theme.colors.textMuted },
  progressDotFilled: { backgroundColor: theme.colors.gold, borderColor: theme.colors.gold },
  progressText:   { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary },
  uploadHintText: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textMuted, textAlign: 'center' },
  hintGrid:       { gap: 2 },
  hintItem:       { fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.textMuted },
  analyzeBtn:     { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, backgroundColor: theme.colors.gold, borderRadius: 10, ...theme.shadows.gold },
  analyzeBtnText: { fontFamily: theme.fonts.heading, fontSize: 16, color: theme.colors.textInverse, letterSpacing: 3 },
  loadingCard:    { alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, paddingVertical: theme.spacing.xl, gap: theme.spacing.sm },
  loadingText:    { fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.textPrimary, letterSpacing: 1 },
  loadingSubtext: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textMuted },
  errorCard:      { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.error, padding: theme.spacing.md },
  errorText:      { flex: 1, fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.error },
  faceCard:       { backgroundColor: theme.colors.surface, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: theme.colors.gold, padding: theme.spacing.md, gap: theme.spacing.sm },
  facePillRow:    { flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' },
  facePill:       { borderWidth: 1, borderColor: theme.colors.gold, borderRadius: 20, paddingVertical: 3, paddingHorizontal: 10 },
  facePillText:   { fontFamily: theme.fonts.heading, fontSize: 11, color: theme.colors.gold, letterSpacing: 2 },
  faceSummary:    { fontFamily: theme.fonts.body, fontSize: 15, color: theme.colors.textPrimary, lineHeight: 22 },
  sectionTitle:   { fontFamily: theme.fonts.heading, fontSize: 14, color: theme.colors.textSecondary, letterSpacing: 4, marginLeft: theme.spacing.xs },
  recScroll:      { paddingHorizontal: 16, paddingVertical: 8, gap: 14, flexDirection: 'row' },
  recCard:        { width: 270, backgroundColor: theme.colors.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' },
  recImageWrap:   { width: '100%', height: 200, position: 'relative' },
  recImage:       { width: '100%', height: 200, borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  recImageFallback: { width: '100%', height: 200, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  recFallbackWrap: { width: '100%', height: 200, position: 'relative' },
  recFallbackBadge: { position: 'absolute', top: theme.spacing.sm, left: theme.spacing.sm, right: theme.spacing.sm, backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, alignItems: 'center' },
  recFallbackText: { fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.textSecondary },
  recOverlay:     { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 8, paddingHorizontal: 10 },
  recOverlayText: { fontFamily: theme.fonts.heading, fontSize: 14, color: theme.colors.gold, flexWrap: 'wrap' },
  recBody:        { padding: 14, gap: theme.spacing.xs },
  recName:        { fontFamily: theme.fonts.heading, fontSize: 17, color: theme.colors.textPrimary, letterSpacing: 1 },
  recYearBadge:   { alignSelf: 'flex-start', borderWidth: 1, borderColor: theme.colors.gold, borderRadius: 20, paddingVertical: 2, paddingHorizontal: 10 },
  recYearText:    { fontFamily: theme.fonts.heading, fontSize: 12, color: theme.colors.gold },
  recShortDesc:   { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, lineHeight: 18, marginTop: 6 },
  recWhyItFits:   { fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.textMuted, fontStyle: 'italic', marginTop: 4 },
  selectBtn:      { height: 44, backgroundColor: theme.colors.gold, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  selectBtnText:  { fontFamily: theme.fonts.heading, fontSize: 14, color: theme.colors.textInverse, letterSpacing: 2 },
  scrollHint:     { fontFamily: theme.fonts.body, fontSize: 12, color: '#555', textAlign: 'center', marginTop: 8, letterSpacing: 1 },
  genErrorText:   { fontFamily: theme.fonts.body, fontSize: 11, color: '#E53935', textAlign: 'center', marginTop: 6, paddingHorizontal: theme.spacing.md },
  beforeAfterWrap: { paddingHorizontal: theme.spacing.xs, gap: theme.spacing.sm },
  transformTitle:  { fontFamily: theme.fonts.heading, fontSize: 22, color: theme.colors.gold, letterSpacing: 4, textAlign: 'center', marginBottom: theme.spacing.md },
  beforeLabel:     { fontFamily: theme.fonts.heading, fontSize: 13, color: theme.colors.textSecondary, letterSpacing: 3, marginBottom: 6 },
  beforeImage:     { width: '100%', height: 320, borderRadius: 12 },
  afterLabel:      { fontFamily: theme.fonts.heading, fontSize: 13, color: theme.colors.gold, letterSpacing: 3, marginTop: 16, marginBottom: 6 },
  afterImage:      { width: '100%', height: 320, borderRadius: 12, borderWidth: 2, borderColor: theme.colors.gold },
  afterName:       { fontFamily: theme.fonts.heading, fontSize: 18, color: theme.colors.textPrimary, letterSpacing: 2, textAlign: 'center', marginTop: theme.spacing.sm },
  saveBookBtn:     { height: 52, backgroundColor: theme.colors.gold, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: theme.spacing.md, ...theme.shadows.gold },
  saveBookBtnText: { fontFamily: theme.fonts.heading, fontSize: 15, color: theme.colors.textInverse, letterSpacing: 2 },
  chatBtn:         { height: 48, borderWidth: 1, borderColor: theme.colors.gold, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm },
  chatBtnText:     { fontFamily: theme.fonts.heading, fontSize: 14, color: theme.colors.gold, letterSpacing: 2 },
  seeOtherBtn:     { height: 44, borderWidth: 1, borderColor: '#444', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  seeOtherBtnText: { fontFamily: theme.fonts.heading, fontSize: 13, color: '#888', letterSpacing: 2 },
});