import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../constants/collections';
import { useAuth } from '../../context/AuthContext';
import { theme } from '../../theme';
import type { FaceAnalysis, StyleRecommendation } from '../../types';

// ── Nav typing (local; ClientNavigator stack is currently untyped) ──
type StylesScreenNavParams = {
  BookingFlow: undefined;
  StyleChat:   undefined;
};
type StylesNav = NativeStackNavigationProp<StylesScreenNavParams>;

// ── Models ───────────────────────────────────────────────
const MODEL_HAIKU  = 'claude-haiku-4-5-20251001';
const MODEL_SONNET = 'claude-sonnet-4-6';

// ── System prompts ───────────────────────────────────────
const FACE_SYSTEM_PROMPT =
  'You are a professional barber consultant. ' +
  'Respond only in plain English. ' +
  'No markdown, no asterisks, no bullet points. ' +
  'Write short clear sentences.';

const STYLE_SYSTEM_PROMPT =
  'You are the world\'s best hairstyle consultant with 20 years experience ' +
  'across all hair types, ethnicities, face shapes, and head sizes. ' +
  'You recommend only modern styles from 2015 onwards. ' +
  'No vintage, no pre-2015 styles. ' +
  'You think deeply before recommending. ' +
  'You give specific, unique recommendations — never generic, never repetitive. ' +
  'Respond ONLY with valid JSON. No markdown. No fences.';

// ── User-prompt builders ─────────────────────────────────
const FACE_USER_PROMPT =
  'Analyze this person\'s face and hair carefully. ' +
  'Return ONLY a JSON object, no extra text, no markdown:\n' +
  '{\n' +
  '  "faceShape": string,\n' +
  '  "headSize": string,\n' +
  '  "hairTexture": string,\n' +
  '  "skinTone": string,\n' +
  '  "currentStyle": string,\n' +
  '  "faceSummary": string\n' +
  '}\n' +
  'faceShape: oval, round, square, heart, diamond, oblong, or triangle\n' +
  'headSize: small, medium, or large\n' +
  'hairTexture: coily, curly, wavy, straight, or locs\n' +
  'skinTone: light, medium, tan, dark, or deep\n' +
  'currentStyle: one sentence describing current hair\n' +
  'faceSummary: one friendly sentence a barber would say about this person\'s ' +
  'face and what works for them. Plain English, no markdown, conversational.';

const buildStylePrompt = (face: FaceAnalysis): string =>
  `This person has the following profile:\n` +
  `Face shape: ${face.faceShape}\n` +
  `Head size: ${face.headSize}\n` +
  `Hair texture: ${face.hairTexture}\n` +
  `Skin tone: ${face.skinTone}\n` +
  `Current style: ${face.currentStyle}\n\n` +
  `Think carefully about their specific combination of face shape + head size + hair texture.\n\n` +
  `Your task:\n` +
  `1. Find 4 COMPLETELY DIFFERENT modern hairstyles (2015-2026) that will make this ` +
  `specific person look their absolute best.\n` +
  `2. For each style, write a DETAILED FLUX IMAGE GENERATION PROMPT that will transform ` +
  `the person's selfie into that exact hairstyle.\n\n` +
  `Rules for the 4 styles:\n` +
  `- Each must be completely different from the others\n` +
  `- Mix styles: one bold, one clean/classic, one trendy 2024-2026, one versatile everyday\n` +
  `- Every style must specifically suit their face shape AND hair texture combination\n` +
  `- No two styles can be the same type of fade\n\n` +
  `Rules for the FLUX prompt (CRITICAL):\n` +
  `- The prompt transforms the person's ACTUAL SELFIE\n` +
  `- Must preserve their face, skin tone, facial features\n` +
  `- Only change the hair\n` +
  `- Be extremely specific: fade level (low/mid/high/skin), sides (tapered/faded/undercut), ` +
  `top length, top texture, front styling, edge details, finish\n` +
  `- Example of a good prompt: "Change the hair to a low skin fade on the sides with a sharp ` +
  `temple lineup, keeping 2-3 inches of coily natural texture on top styled into a defined ` +
  `twist-out, clean edges around the hairline, professional barbershop finish"\n\n` +
  `Return ONLY this JSON with no extra text:\n` +
  `{\n` +
  `  "styles": [\n` +
  `    {\n` +
  `      "name": "specific modern style name",\n` +
  `      "year": "year popularized 2015-2026",\n` +
  `      "shortDescription": "max 2 sentences, plain English, no markdown, describes the look",\n` +
  `      "whyItFits": "one sentence, mention their specific face shape AND hair texture by name",\n` +
  `      "fluxPrompt": "detailed FLUX transformation prompt (30-50 words, very specific about every aspect of the haircut)"\n` +
  `    }\n` +
  `  ]\n` +
  `}`;

// ── Internal types ────────────────────────────────────────
type LoadingStage = 'idle' | 'haiku' | 'sonnet' | 'flux' | 'done';

interface ClaudeResponse {
  content?: Array<{ text?: string }>;
}

interface ReplicatePrediction {
  id?:     string;
  status?: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[] | null;
  error?:  string | null;
}

// ── Helpers ───────────────────────────────────────────────
const extractJson = <T,>(text: string): T | null => {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
  }
  // If still wrapped in prose, slice from first { to last }.
  const start = cleaned.indexOf('{');
  const end   = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
};

const callClaude = async (
  model:     string,
  system:    string,
  messages:  unknown,
  maxTokens: number,
): Promise<string | null> => {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':                              'application/json',
        'x-api-key':                                 apiKey,
        'anthropic-version':                         '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages,
      }),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as ClaudeResponse;
    const text = data.content?.[0]?.text;
    return typeof text === 'string' ? text : null;
  } catch {
    return null;
  }
};

// Upload the selfie to ImgBB and return a hosted URL. We pass this URL to
// Replicate instead of an inline data-URI because base64 selfies routinely
// exceed Replicate's request-payload size limit. Returns a tagged result
// so the screen can surface the exact failure reason without console.log.
// Requires EXPO_PUBLIC_IMGBB_API_KEY in .env
const uploadToImgBB = async (
  base64: string,
): Promise<{ url: string | null; error: string | null }> => {
  try {
    const key = process.env.EXPO_PUBLIC_IMGBB_API_KEY;
    if (!key) return { url: null, error: 'IMGBB key missing' };

    const formData = new FormData();
    formData.append('image', base64);

    const res = await fetch(
      `https://api.imgbb.com/1/upload?key=${key}`,
      { method: 'POST', body: formData },
    );

    const data = (await res.json()) as {
      data?:  { url?: string };
      error?: { message?: string };
    };

    if (!res.ok || !data?.data?.url) {
      return {
        url:   null,
        error: `ImgBB error: ${data?.error?.message ?? res.status}`,
      };
    }

    return { url: data.data.url, error: null };
  } catch (e) {
    return { url: null, error: `ImgBB exception: ${String(e)}` };
  }
};

// Run one FLUX change-haircut prediction against the user's selfie.
// `imageUrl` must be an HTTPS URL (e.g. ImgBB-hosted) — sending base64 here
// busts Replicate's payload limit. Returns a tagged result so the screen
// can show the exact failure reason without console.log.
const generateStyleImage = async (
  fluxPrompt: string,
  imageUrl:   string,
): Promise<{ url: string | null; error: string | null }> => {
  const token = process.env.EXPO_PUBLIC_REPLICATE_API_TOKEN;
  if (!token) return { url: null, error: 'Replicate token missing' };

  try {
    const createRes = await fetch(
      'https://api.replicate.com/v1/models/flux-kontext-apps/change-haircut/predictions',
      {
        method:  'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          input: {
            input_image: imageUrl,
            prompt:      fluxPrompt,
          },
        }),
      },
    );
    if (!createRes.ok) {
      const errText = await createRes.text();
      return {
        url:   null,
        error: `Create failed ${createRes.status}: ${errText.slice(0, 100)}`,
      };
    }

    const prediction = (await createRes.json()) as ReplicatePrediction;
    if (prediction.status === 'succeeded' && prediction.output) {
      const out = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
      return { url: out, error: null };
    }
    const predId = prediction.id;
    if (!predId) return { url: null, error: 'No prediction id returned' };

    // Poll up to 20 × 3s = 60s.
    for (let i = 0; i < 20; i++) {
      await new Promise<void>(resolve => setTimeout(resolve, 4000));
      const pollRes = await fetch(
        `https://api.replicate.com/v1/predictions/${predId}`,
        {
          headers: {
            'Authorization': `Token ${token}`,
            'Content-Type':  'application/json',
          },
        },
      );
      if (!pollRes.ok) continue;
      const poll = (await pollRes.json()) as ReplicatePrediction;
      if (poll.status === 'succeeded' && poll.output) {
        const out = Array.isArray(poll.output) ? poll.output[0] : poll.output;
        return { url: out, error: null };
      }
      if (poll.status === 'failed' || poll.status === 'canceled') {
        return { url: null, error: `Poll failed: ${poll.error ?? 'unknown'}` };
      }
    }
    return { url: null, error: 'Timed out after 60s' };
  } catch (e) {
    return { url: null, error: `Exception: ${String(e)}` };
  }
};

// ── Component ─────────────────────────────────────────────
export default function StylesScreen() {
  const navigation = useNavigation<StylesNav>();
  const { user }   = useAuth();

  // Selfie
  const [selfieUri,    setSelfieUri]    = useState<string | null>(null);
  const [selfieBase64, setSelfieBase64] = useState<string | null>(null);
  // Hosted ImgBB URL — populated once before Stage 3 and reused by retries.
  const [selfieUrl,    setSelfieUrl]    = useState<string | null>(null);

  // Flow state
  const [loadingStage,    setLoadingStage]    = useState<LoadingStage>('idle');
  const [faceAnalysis,    setFaceAnalysis]    = useState<FaceAnalysis | null>(null);
  const [recommendations, setRecommendations] = useState<StyleRecommendation[]>([]);
  const [generatedImages, setGeneratedImages] = useState<(string | null)[]>([]);
  const [selectedStyle,    setSelectedStyle]    = useState<StyleRecommendation | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [fluxError, setFluxError] = useState<string | null>(null);
  const [saving,    setSaving]    = useState<boolean>(false);

  // ── Selfie picker ───────────────────────────────────────
  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Please allow photo access to upload a selfie.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:    ['images'],
      allowsEditing: true,
      aspect:        [1, 1],
      quality:       0.85,
      base64:        true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (!asset.base64 || !asset.uri) return;

    setSelfieUri(asset.uri);
    setSelfieBase64(asset.base64);
    setSelfieUrl(null);
    setFaceAnalysis(null);
    setRecommendations([]);
    setGeneratedImages([]);
    setSelectedStyle(null);
    setSelectedImageUrl(null);
    setError(null);
    setFluxError(null);
    setLoadingStage('idle');
  };

  // ── Stage helpers ───────────────────────────────────────
  const runFaceAnalysis = async (base64: string): Promise<FaceAnalysis | null> => {
    const text = await callClaude(
      MODEL_HAIKU,
      FACE_SYSTEM_PROMPT,
      [{
        role: 'user',
        content: [
          {
            type:   'image',
            source: {
              type:       'base64',
              media_type: 'image/jpeg',
              data:       base64,
            },
          },
          { type: 'text', text: FACE_USER_PROMPT },
        ],
      }],
      600,
    );
    if (!text) return null;
    const face = extractJson<FaceAnalysis>(text);
    if (!face?.faceShape || !face?.hairTexture) return null;
    return face;
  };

  const runStyleRecommendations = async (
    face: FaceAnalysis,
  ): Promise<StyleRecommendation[]> => {
    const text = await callClaude(
      MODEL_SONNET,
      STYLE_SYSTEM_PROMPT,
      [{ role: 'user', content: buildStylePrompt(face) }],
      2000,
    );
    if (!text) return [];
    const parsed = extractJson<unknown>(text);
    let candidate: unknown = parsed;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      candidate = obj.styles ?? obj.recommendations ?? parsed;
    }
    if (!Array.isArray(candidate)) return [];
    return candidate.filter(
      (r): r is StyleRecommendation =>
        !!r &&
        typeof r === 'object' &&
        typeof (r as StyleRecommendation).name === 'string' &&
        typeof (r as StyleRecommendation).fluxPrompt === 'string',
    );
  };

  // ── Main flow ───────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!selfieBase64) return;
    setError(null);
    setFluxError(null);
    setFaceAnalysis(null);
    setRecommendations([]);
    setGeneratedImages([]);
    setSelectedStyle(null);
    setSelectedImageUrl(null);
    setSelfieUrl(null);

    // Stage 1 — Haiku face analysis
    setLoadingStage('haiku');
    const face = await runFaceAnalysis(selfieBase64);
    if (!face) {
      setLoadingStage('idle');
      setError('Could not read your face. Please try a clearer selfie.');
      return;
    }
    setFaceAnalysis(face);

    // Stage 2 — Sonnet with retries (max 3 attempts, accept if ≥ 3 styles)
    setLoadingStage('sonnet');
    let recs: StyleRecommendation[] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      recs = await runStyleRecommendations(face);
      if (recs.length >= 3) break;
    }
    if (recs.length === 0) {
      setLoadingStage('idle');
      setError('Could not generate styles. Please try again.');
      return;
    }
    setRecommendations(recs);

    // Stage 3 — upload selfie to ImgBB, then run 4 FLUX calls in parallel.
    setLoadingStage('flux');
    const imgbbResult = await uploadToImgBB(selfieBase64);
    if (!imgbbResult.url) {
      setError(imgbbResult.error ?? 'Could not upload photo. Please try again.');
      setLoadingStage('idle');
      return;
    }
    setSelfieUrl(imgbbResult.url);

    const results: { url: string | null; error: string | null }[] = [];
    for (let i = 0; i < recs.length; i++) {
      if (i > 0) {
        await new Promise(r => setTimeout(r, 8000));
      }
      const result = await generateStyleImage(
        recs[i].fluxPrompt,
        imgbbResult.url ?? selfieUrl ?? '',
      );
      results.push(result);

      // Show cards as they generate one by one
      const partial = results.map(r => r.url);
      while (partial.length < recs.length) {
        partial.push(null);
      }
      setGeneratedImages([...partial]);
    }
    const images     = results.map(r => r.url);
    const firstError = results.find(r => r.error)?.error;
    setGeneratedImages(images);
    if (firstError) setFluxError(firstError);
    setLoadingStage('done');
  };

  // Retry a single FLUX generation for one card without re-running Stage 1/2.
  const retryImage = async (index: number) => {
    if (!selfieUrl) return;
    const rec = recommendations[index];
    if (!rec) return;
    const result = await generateStyleImage(rec.fluxPrompt, selfieUrl);
    setGeneratedImages(prev => {
      const next = [...prev];
      next[index] = result.url;
      return next;
    });
    if (result.error) setFluxError(result.error);
    else              setFluxError(null);
  };

  // ── Card → before/after ─────────────────────────────────
  const handleSelectStyle = (style: StyleRecommendation, imageUrl: string | null) => {
    setSelectedStyle(style);
    setSelectedImageUrl(imageUrl);
  };

  const handleSeeOtherStyles = () => {
    setSelectedStyle(null);
    setSelectedImageUrl(null);
  };

  // ── Save → Firestore ────────────────────────────────────
  const writeSavedStyle = async (
    style:    StyleRecommendation,
    imageUrl: string | null,
  ): Promise<boolean> => {
    if (!user?.id) return false;
    try {
      await updateDoc(doc(db, COLLECTIONS.USERS, user.id), {
        savedStyle: {
          name:              style.name,
          description:       style.shortDescription,
          whyItFits:         style.whyItFits,
          fluxPrompt:        style.fluxPrompt,
          generatedImageUrl: imageUrl ?? null,
          originalSelfieRef: selfieUri ?? null,
          savedAt:           serverTimestamp(),
        },
      });
      return true;
    } catch {
      return false;
    }
  };

  const handleSaveAndBook = async () => {
    if (!selectedStyle || saving) return;
    setSaving(true);
    const ok = await writeSavedStyle(selectedStyle, selectedImageUrl);
    setSaving(false);
    if (!ok) {
      setError('Could not save your style. Please try again.');
      return;
    }
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
  const handleUpdateStyle = () => pickImage();

  const isLoading =
    loadingStage === 'haiku' ||
    loadingStage === 'sonnet' ||
    loadingStage === 'flux';

  const savedThumbUrl =
    user?.savedStyle?.generatedImageUrl ??
    user?.savedStyle?.tryOnImageUrl ??
    null;

  // ── Render ──────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Selfie upload card (hidden when viewing before/after) ── */}
        {!selectedStyle ? (
          <View style={styles.uploadCard}>
            <Text style={styles.uploadTitle}>MY STYLE PROFILE</Text>
            <Text style={styles.uploadSubtitle}>
              Upload a selfie to see yourself in new styles
            </Text>

            <TouchableOpacity
              style={styles.uploadCircle}
              onPress={pickImage}
              activeOpacity={0.85}
            >
              {selfieUri ? (
                <Image source={{ uri: selfieUri }} style={styles.uploadImage} />
              ) : (
                <View style={styles.uploadEmpty}>
                  <Ionicons
                    name="person-circle-outline"
                    size={80}
                    color={theme.colors.textMuted}
                  />
                  <Text style={styles.uploadHint}>TAP TO UPLOAD</Text>
                </View>
              )}
            </TouchableOpacity>

            {selfieUri && !isLoading ? (
              <TouchableOpacity
                style={styles.analyzeBtn}
                onPress={handleAnalyze}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="color-wand"
                  size={18}
                  color={theme.colors.textInverse}
                />
                <Text style={styles.analyzeBtnText}>FIND MY PERFECT STYLES</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* ── Saved style banner (below upload card) ─── */}
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
                <Text style={styles.savedBannerName} numberOfLines={2}>
                  {user.savedStyle.name}
                </Text>
              </View>
            </View>
            <View style={styles.savedBannerButtons}>
              <TouchableOpacity
                style={[styles.savedBtn, styles.savedBtnPrimary]}
                onPress={handleBookSaved}
              >
                <Text style={styles.savedBtnPrimaryText}>BOOK IT</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.savedBtn, styles.savedBtnOutline]}
                onPress={handleUpdateStyle}
              >
                <Text style={styles.savedBtnOutlineText}>UPDATE STYLE</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* ── Loading card ──────────────────────────── */}
        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={theme.colors.gold} />
            <Text style={styles.loadingText}>
              {loadingStage === 'haiku'
                ? 'Reading your face shape...'
                : loadingStage === 'sonnet'
                  ? 'Finding styles that suit you...'
                  : 'Creating your 4 looks...'}
            </Text>
            {loadingStage === 'flux' ? (
              <Text style={styles.loadingSubtext}>This takes about 30 seconds</Text>
            ) : null}
          </View>
        ) : null}

        {/* ── Error ─────────────────────────────────── */}
        {error && !isLoading ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={22} color={theme.colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ── Face analysis (above cards) ───────────── */}
        {faceAnalysis && !selectedStyle && !isLoading ? (
          <View style={styles.faceCard}>
            <View style={styles.facePillRow}>
              <View style={styles.facePill}>
                <Text style={styles.facePillText}>
                  {faceAnalysis.faceShape.toUpperCase()}
                </Text>
              </View>
              <View style={styles.facePill}>
                <Text style={styles.facePillText}>
                  {faceAnalysis.hairTexture.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.faceSummary}>{faceAnalysis.faceSummary}</Text>
          </View>
        ) : null}

        {/* ── Style cards (horizontal scroll) ──────── */}
        {recommendations.length > 0 &&
          (loadingStage === 'flux' || loadingStage === 'done') &&
          !selectedStyle ? (
          <>
            <Text style={styles.sectionTitle}>YOUR 4 LOOKS</Text>
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recScroll}
            >
              {recommendations.map((rec, i) => {
                const imgUrl = generatedImages[i];
                return (
                  <View key={`${rec.name}-${i}`} style={styles.recCard}>
                    <View style={styles.recImageWrap}>
                      {imgUrl ? (
                        <Image
                          source={{ uri: imgUrl }}
                          style={styles.recImage}
                          resizeMode="cover"
                        />
                      ) : selfieUri ? (
                        <View style={styles.recFallbackWrap}>
                          <Image
                            source={{ uri: selfieUri }}
                            style={styles.recImage}
                            resizeMode="cover"
                          />
                          {loadingStage === 'flux' ? (
                            <View style={styles.recFallbackBadge}>
                              <Text style={styles.recFallbackText}>
                                Generating...
                              </Text>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.recFallbackBadge}
                              onPress={() => retryImage(i)}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.recFallbackText}>
                                Preview failed — tap to retry
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ) : (
                        <View style={styles.recImageFallback}>
                          <Ionicons name="cut" size={36} color={theme.colors.textMuted} />
                        </View>
                      )}
                      <View style={styles.recOverlay}>
                        <Text style={styles.recOverlayText} numberOfLines={2}>
                          {rec.name.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.recBody}>
                      <Text style={styles.recName} numberOfLines={2}>
                        {rec.name.toUpperCase()}
                      </Text>
                      <View style={styles.recYearBadge}>
                        <Text style={styles.recYearText}>{rec.year}</Text>
                      </View>
                      <Text style={styles.recShortDesc} numberOfLines={3}>
                        {rec.shortDescription}
                      </Text>
                      <Text style={styles.recWhyItFits} numberOfLines={2}>
                        {rec.whyItFits}
                      </Text>
                      <TouchableOpacity
                        style={styles.selectBtn}
                        onPress={() => handleSelectStyle(rec, imgUrl ?? null)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.selectBtnText}>SELECT THIS STYLE</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            <Text style={styles.scrollHint}>
              Swipe left to see all your looks
            </Text>
            {fluxError ? (
              <Text style={styles.fluxErrorText}>{fluxError}</Text>
            ) : null}
          </>
        ) : null}

        {/* ── Before / After view ───────────────────── */}
        {selectedStyle ? (
          <View style={styles.beforeAfterWrap}>
            <Text style={styles.transformTitle}>YOUR TRANSFORMATION</Text>

            <Text style={styles.beforeLabel}>BEFORE</Text>
            {selfieUri ? (
              <Image
                source={{ uri: selfieUri }}
                style={styles.beforeImage}
                resizeMode="cover"
              />
            ) : null}

            <Text style={styles.afterLabel}>AFTER</Text>
            {selectedImageUrl ? (
              <Image
                source={{ uri: selectedImageUrl }}
                style={styles.afterImage}
                resizeMode="cover"
              />
            ) : selfieUri ? (
              <Image
                source={{ uri: selfieUri }}
                style={styles.afterImage}
                resizeMode="cover"
              />
            ) : null}

            <Text style={styles.afterName}>{selectedStyle.name.toUpperCase()}</Text>

            <TouchableOpacity
              style={styles.saveBookBtn}
              onPress={handleSaveAndBook}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator size="small" color={theme.colors.textInverse} />
              ) : (
                <Text style={styles.saveBookBtnText}>SAVE & BOOK THIS STYLE</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.chatBtn}
              onPress={handleChatAbout}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Ionicons
                name="chatbubble-outline"
                size={16}
                color={theme.colors.gold}
              />
              <Text style={styles.chatBtnText}>CHAT ABOUT THIS STYLE</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.seeOtherBtn}
              onPress={handleSeeOtherStyles}
              activeOpacity={0.85}
            >
              <Text style={styles.seeOtherBtnText}>SEE OTHER STYLES</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    padding:       theme.spacing.md,
    paddingTop:    theme.spacing.xxl,
    paddingBottom: theme.spacing.xxl,
    gap:           theme.spacing.md,
  },

  // ── Saved banner ────────────────────────────────────────
  savedBanner: {
    backgroundColor: theme.colors.goldMuted,
    borderRadius:    theme.radius.md,
    borderWidth:     1,
    borderColor:     theme.colors.gold,
    padding:         theme.spacing.md,
    gap:             theme.spacing.sm,
  },
  savedBannerLabel: {
    fontFamily:    theme.fonts.heading,
    fontSize:      12,
    color:         theme.colors.gold,
    letterSpacing: 3,
  },
  savedBannerRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           theme.spacing.sm,
  },
  savedThumb: {
    width:        80,
    height:       80,
    borderRadius: 8,
    borderWidth:  1.5,
    borderColor:  theme.colors.gold,
  },
  savedThumbPlaceholder: {
    backgroundColor: theme.colors.card,
    alignItems:      'center',
    justifyContent:  'center',
  },
  savedBannerTextWrap: {
    flex: 1,
  },
  savedBannerName: {
    fontFamily:    theme.fonts.heading,
    fontSize:      18,
    color:         theme.colors.textPrimary,
    letterSpacing: 2,
  },
  savedBannerButtons: {
    flexDirection: 'row',
    gap:           theme.spacing.sm,
  },
  savedBtn: {
    flex:           1,
    height:         40,
    borderRadius:   8,
    alignItems:     'center',
    justifyContent: 'center',
  },
  savedBtnPrimary: {
    backgroundColor: theme.colors.gold,
  },
  savedBtnPrimaryText: {
    fontFamily:    theme.fonts.heading,
    fontSize:      13,
    color:         theme.colors.textInverse,
    letterSpacing: 2,
  },
  savedBtnOutline: {
    borderWidth: 1,
    borderColor: theme.colors.gold,
  },
  savedBtnOutlineText: {
    fontFamily:    theme.fonts.heading,
    fontSize:      13,
    color:         theme.colors.gold,
    letterSpacing: 2,
  },

  // ── Upload card ─────────────────────────────────────────
  uploadCard: {
    backgroundColor: theme.colors.surface,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     theme.colors.border,
    padding:         theme.spacing.lg,
    gap:             theme.spacing.md,
    alignItems:      'center',
  },
  uploadTitle: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.lg,
    color:         theme.colors.gold,
    letterSpacing: 4,
    alignSelf:     'flex-start',
  },
  uploadSubtitle: {
    fontFamily: theme.fonts.body,
    fontSize:   13,
    color:      theme.colors.textSecondary,
    alignSelf:  'flex-start',
    marginTop:  -theme.spacing.sm,
  },
  uploadCircle: {
    width:           180,
    height:          180,
    borderRadius:    90,
    backgroundColor: theme.colors.card,
    borderWidth:     2,
    borderColor:     theme.colors.gold,
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
  },
  uploadEmpty: {
    alignItems:     'center',
    justifyContent: 'center',
    gap:            theme.spacing.xs,
  },
  uploadImage: {
    width:        180,
    height:       180,
    borderRadius: 90,
  },
  uploadHint: {
    fontFamily:    theme.fonts.medium,
    fontSize:      11,
    color:         theme.colors.textMuted,
    letterSpacing: 2,
  },
  analyzeBtn: {
    width:           '100%',
    height:          52,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             theme.spacing.sm,
    backgroundColor: theme.colors.gold,
    borderRadius:    10,
    ...theme.shadows.gold,
  },
  analyzeBtnText: {
    fontFamily:    theme.fonts.heading,
    fontSize:      16,
    color:         theme.colors.textInverse,
    letterSpacing: 3,
  },

  // ── Loading card ────────────────────────────────────────
  loadingCard: {
    alignItems:      'center',
    backgroundColor: theme.colors.surface,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     theme.colors.border,
    paddingVertical: theme.spacing.xl,
    gap:             theme.spacing.sm,
  },
  loadingText: {
    fontFamily:    theme.fonts.body,
    fontSize:      14,
    color:         theme.colors.textPrimary,
    letterSpacing: 1,
  },
  loadingSubtext: {
    fontFamily: theme.fonts.body,
    fontSize:   12,
    color:      theme.colors.textMuted,
  },

  // ── Error ───────────────────────────────────────────────
  errorCard: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius:    theme.radius.md,
    borderWidth:     1,
    borderColor:     theme.colors.error,
    padding:         theme.spacing.md,
  },
  errorText: {
    flex:       1,
    fontFamily: theme.fonts.body,
    fontSize:   13,
    color:      theme.colors.error,
  },

  // ── Face analysis card ──────────────────────────────────
  faceCard: {
    backgroundColor: theme.colors.surface,
    borderRadius:    12,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.gold,
    padding:         theme.spacing.md,
    gap:             theme.spacing.sm,
  },
  facePillRow: {
    flexDirection: 'row',
    gap:           theme.spacing.sm,
    flexWrap:      'wrap',
  },
  facePill: {
    borderWidth:       1,
    borderColor:       theme.colors.gold,
    borderRadius:      20,
    paddingVertical:   3,
    paddingHorizontal: 10,
  },
  facePillText: {
    fontFamily:    theme.fonts.heading,
    fontSize:      11,
    color:         theme.colors.gold,
    letterSpacing: 2,
  },
  faceSummary: {
    fontFamily: theme.fonts.body,
    fontSize:   15,
    color:      theme.colors.textPrimary,
    lineHeight: 22,
  },

  // ── Section title ──────────────────────────────────────
  sectionTitle: {
    fontFamily:    theme.fonts.heading,
    fontSize:      14,
    color:         theme.colors.textSecondary,
    letterSpacing: 4,
    marginLeft:    theme.spacing.xs,
  },

  // ── Horizontal recommendation cards ────────────────────
  recScroll: {
    paddingHorizontal: 16,
    paddingVertical:   8,
    gap:               14,
    flexDirection:     'row',
  },
  recCard: {
    width:           270,
    backgroundColor: theme.colors.card,
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     theme.colors.border,
    overflow:        'hidden',
  },
  recImageWrap: {
    width:    '100%',
    height:   200,
    position: 'relative',
  },
  recImage: {
    width:                '100%',
    height:               200,
    borderTopLeftRadius:  14,
    borderTopRightRadius: 14,
  },
  recImageFallback: {
    width:                '100%',
    height:               200,
    backgroundColor:      theme.colors.background,
    alignItems:           'center',
    justifyContent:       'center',
    borderTopLeftRadius:  14,
    borderTopRightRadius: 14,
  },
  recFallbackWrap: {
    width:    '100%',
    height:   200,
    position: 'relative',
  },
  recFallbackBadge: {
    position:          'absolute',
    top:               theme.spacing.sm,
    left:              theme.spacing.sm,
    right:             theme.spacing.sm,
    backgroundColor:   theme.colors.overlay,
    paddingVertical:   4,
    paddingHorizontal: 8,
    borderRadius:      6,
    alignItems:        'center',
  },
  recFallbackText: {
    fontFamily: theme.fonts.body,
    fontSize:   11,
    color:      theme.colors.textSecondary,
  },
  recOverlay: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    backgroundColor:   theme.colors.overlay,
    paddingVertical:   8,
    paddingHorizontal: 10,
  },
  recOverlayText: {
    fontFamily: theme.fonts.heading,
    fontSize:   14,
    color:      theme.colors.gold,
    flexWrap:   'wrap',
  },
  recBody: {
    padding: 14,
    gap:     theme.spacing.xs,
  },
  recName: {
    fontFamily:    theme.fonts.heading,
    fontSize:      17,
    color:         theme.colors.textPrimary,
    letterSpacing: 1,
  },
  recYearBadge: {
    alignSelf:         'flex-start',
    borderWidth:       1,
    borderColor:       theme.colors.gold,
    borderRadius:      20,
    paddingVertical:   2,
    paddingHorizontal: 10,
  },
  recYearText: {
    fontFamily: theme.fonts.heading,
    fontSize:   12,
    color:      theme.colors.gold,
  },
  recShortDesc: {
    fontFamily: theme.fonts.body,
    fontSize:   12,
    color:      theme.colors.textSecondary,
    lineHeight: 18,
    marginTop:  6,
  },
  recWhyItFits: {
    fontFamily: theme.fonts.body,
    fontSize:   11,
    color:      theme.colors.textMuted,
    fontStyle:  'italic',
    marginTop:  4,
  },
  selectBtn: {
    height:          44,
    backgroundColor: theme.colors.gold,
    borderRadius:    8,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       12,
  },
  selectBtnText: {
    fontFamily:    theme.fonts.heading,
    fontSize:      14,
    color:         theme.colors.textInverse,
    letterSpacing: 2,
  },
  scrollHint: {
    fontFamily:    theme.fonts.body,
    fontSize:      12,
    color:         '#555',
    textAlign:     'center',
    marginTop:     8,
    letterSpacing: 1,
  },
  fluxErrorText: {
    fontFamily: theme.fonts.body,
    fontSize:   11,
    color:      '#E53935',
    textAlign:  'center',
    marginTop:  6,
    paddingHorizontal: theme.spacing.md,
  },

  // ── Before / After ─────────────────────────────────────
  beforeAfterWrap: {
    paddingHorizontal: theme.spacing.xs,
    gap:               theme.spacing.sm,
  },
  transformTitle: {
    fontFamily:    theme.fonts.heading,
    fontSize:      22,
    color:         theme.colors.gold,
    letterSpacing: 4,
    textAlign:     'center',
    marginBottom:  theme.spacing.md,
  },
  beforeLabel: {
    fontFamily:    theme.fonts.heading,
    fontSize:      13,
    color:         theme.colors.textSecondary,
    letterSpacing: 3,
    marginBottom:  6,
  },
  beforeImage: {
    width:        '100%',
    height:       320,
    borderRadius: 12,
  },
  afterLabel: {
    fontFamily:    theme.fonts.heading,
    fontSize:      13,
    color:         theme.colors.gold,
    letterSpacing: 3,
    marginTop:     16,
    marginBottom:  6,
  },
  afterImage: {
    width:        '100%',
    height:       320,
    borderRadius: 12,
    borderWidth:  2,
    borderColor:  theme.colors.gold,
  },
  afterName: {
    fontFamily:    theme.fonts.heading,
    fontSize:      18,
    color:         theme.colors.textPrimary,
    letterSpacing: 2,
    textAlign:     'center',
    marginTop:     theme.spacing.sm,
  },
  saveBookBtn: {
    height:          52,
    backgroundColor: theme.colors.gold,
    borderRadius:    10,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       theme.spacing.md,
    ...theme.shadows.gold,
  },
  saveBookBtnText: {
    fontFamily:    theme.fonts.heading,
    fontSize:      15,
    color:         theme.colors.textInverse,
    letterSpacing: 2,
  },
  chatBtn: {
    height:         48,
    borderWidth:    1,
    borderColor:    theme.colors.gold,
    borderRadius:   10,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            theme.spacing.sm,
  },
  chatBtnText: {
    fontFamily:    theme.fonts.heading,
    fontSize:      14,
    color:         theme.colors.gold,
    letterSpacing: 2,
  },
  seeOtherBtn: {
    height:         44,
    borderWidth:    1,
    borderColor:    '#444',
    borderRadius:   8,
    alignItems:     'center',
    justifyContent: 'center',
    marginTop:      8,
  },
  seeOtherBtnText: {
    fontFamily:    theme.fonts.heading,
    fontSize:      13,
    color:         '#888',
    letterSpacing: 2,
  },
});
