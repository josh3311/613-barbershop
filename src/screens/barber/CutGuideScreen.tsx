import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Image,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { BarberStackParams } from '../../navigation/types';
import { theme } from '../../theme';

type CutGuideNav   = NativeStackNavigationProp<BarberStackParams, 'CutGuide'>;
type CutGuideRoute = RouteProp<BarberStackParams, 'CutGuide'>;

interface RequestedStyle {
  name:                string;
  description?:        string | null;
  generatedImageUrl?:  string | null;
  tryOnImageUrl?:      string | null;
  referenceImageUrl?:  string | null;
  selfieUrl?:          string | null;
}

type ExtendedParams = CutGuideRoute['params'] & {
  requestedStyle?: RequestedStyle | null;
};

const SYSTEM_PROMPT =
  'You are an expert barber trainer with 20 years of experience. ' +
  'Explain haircuts clearly and professionally for barbers of all skill levels.';

export default function CutGuideScreen() {
  const navigation = useNavigation<CutGuideNav>();
  const route      = useRoute<CutGuideRoute>();

  const {
    bookingId: _bookingId,
    serviceName,
    clientName,
    scheduledAt,
    requestedStyle,
  } = route.params as ExtendedParams;

  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [guide,   setGuide]   = useState<string>('');

  const afterUrl  = requestedStyle?.generatedImageUrl ?? requestedStyle?.tryOnImageUrl ?? null;
  const beforeUrl = requestedStyle?.selfieUrl ?? requestedStyle?.referenceImageUrl ?? null;

  const fetchGuide = useCallback(async () => {
    setLoading(true);
    setError(null);
    setGuide('');

    const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
    if (!apiKey) {
      setError('API key not configured. Set EXPO_PUBLIC_ANTHROPIC_API_KEY in .env and restart Expo.');
      setLoading(false);
      return;
    }

    const styleContext = requestedStyle?.name
      ? `The client specifically requested: "${requestedStyle.name}".` +
        (requestedStyle.description
          ? ` Style description: ${requestedStyle.description}.`
          : '') +
        ' Tailor your cutting guide to deliver this exact style.'
      : '';

    const userMessage =
      `Give me a complete step-by-step cut guide for: ${serviceName} for client ${clientName}.\n` +
      `${styleContext}\n` +
      `Include: 1) Tools needed 2) Preparation 3) Step-by-step cutting instructions 4) Finishing touches 5) Pro tips.\n` +
      `Be specific and practical.`;

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
          max_tokens: 1000,
          system:     SYSTEM_PROMPT,
          messages:   [{ role: 'user', content: userMessage }],
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.content?.[0]?.text) {
        setError('Could not generate cut guide. Please try again.');
        return;
      }

      setGuide(data.content[0].text as string);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [serviceName, clientName, requestedStyle]);

  useEffect(() => {
    fetchGuide();
  }, [fetchGuide]);

  const formattedDate = (() => {
    if (!scheduledAt) return '';
    const d = new Date(scheduledAt);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString([], {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  })();

  // ── Image section — strictly mutually exclusive ───────────────────────────
  // Case A: both before + after → side by side
  // Case B: only after          → full width, single image
  // Case C: neither             → render nothing
  const renderStyleImages = () => {
    if (!afterUrl) return null;

    if (beforeUrl) {
      // Case A — side by side
      return (
        <View style={styles.styleImagesRow}>
          <View style={styles.styleImageBlock}>
            <Text style={styles.styleImageLabel}>BEFORE</Text>
            <Image
              source={{ uri: beforeUrl }}
              style={styles.styleImage}
              resizeMode="cover"
            />
          </View>
          <View style={styles.styleImageBlock}>
            <Text style={[styles.styleImageLabel, styles.styleImageLabelGold]}>
              AI TRY-ON
            </Text>
            <Image
              source={{ uri: afterUrl }}
              style={[styles.styleImage, styles.styleImageAfter]}
              resizeMode="cover"
            />
          </View>
        </View>
      );
    }

    // Case B — only after, full width
    return (
      <View style={styles.styleImageFullBlock}>
        <Text style={[styles.styleImageLabel, styles.styleImageLabelGold]}>
          AI TRY-ON
        </Text>
        <Image
          source={{ uri: afterUrl }}
          style={styles.styleImageFull}
          resizeMode="cover"
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.gold} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>CUT GUIDE</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {clientName} · {serviceName}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Booking info card ── */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={16} color={theme.colors.gold} />
            <Text style={styles.infoLabel}>CLIENT</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{clientName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="cut-outline" size={16} color={theme.colors.gold} />
            <Text style={styles.infoLabel}>SERVICE</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{serviceName}</Text>
          </View>
          {formattedDate ? (
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={16} color={theme.colors.gold} />
              <Text style={styles.infoLabel}>WHEN</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{formattedDate}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Requested Style card — only when client attached a style ── */}
        {requestedStyle?.name ? (
          <View style={styles.styleCard}>
            <Text style={styles.styleCardHeading}>REQUESTED STYLE</Text>
            <Text style={styles.styleCardName}>{requestedStyle.name}</Text>
            {requestedStyle.description ? (
              <Text style={styles.styleCardDesc} numberOfLines={3}>
                {requestedStyle.description}
              </Text>
            ) : null}
            {renderStyleImages()}
          </View>
        ) : null}

        {/* ── Loading ── */}
        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={theme.colors.gold} />
            <Text style={styles.loadingText}>Generating cut guide...</Text>
          </View>
        )}

        {/* ── Error ── */}
        {!loading && error ? (
          <View style={styles.errorWrap}>
            <Ionicons name="alert-circle-outline" size={32} color={theme.colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* ── Guide content ── */}
        {!loading && !error && guide ? (
          <View style={styles.guideCard}>
            <Markdown style={{
              body: {
                color:      theme.colors.textPrimary,
                fontFamily: theme.fonts.body,
                fontSize:   theme.fontSizes.md,
              },
              strong: {
                color:      theme.colors.gold,
                fontFamily: theme.fonts.bold,
              },
              heading1: {
                color:         theme.colors.gold,
                fontFamily:    theme.fonts.heading,
                fontSize:      theme.fontSizes.lg,
                letterSpacing: 2,
              },
              bullet_list: { color: theme.colors.textPrimary },
            }}>
              {guide}
            </Markdown>
          </View>
        ) : null}

        {/* ── Regenerate ── */}
        {!loading && (
          <TouchableOpacity
            style={styles.regenBtn}
            onPress={fetchGuide}
            disabled={loading}
          >
            <Ionicons name="refresh" size={16} color={theme.colors.textInverse} />
            <Text style={styles.regenBtnText}>REGENERATE</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
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
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.goldMuted,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xl,
    color: theme.colors.gold,
    letterSpacing: 4,
  },
  headerSubtitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textSecondary,
    letterSpacing: 1,
    marginTop: 2,
  },
  scroll: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.lg,
  },
  infoCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    ...theme.shadows.gold,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  infoLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
    letterSpacing: 2,
    width: 70,
  },
  infoValue: {
    flex: 1,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textPrimary,
  },
  styleCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.gold,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    ...theme.shadows.gold,
  },
  styleCardHeading: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.gold,
    letterSpacing: 4,
  },
  styleCardName: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xl,
    color: theme.colors.textPrimary,
    letterSpacing: 1,
  },
  styleCardDesc: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  // Side-by-side (before + after)
  styleImagesRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  styleImageBlock: {
    flex: 1,
    gap: 4,
  },
  styleImageLabel: {
    fontFamily: theme.fonts.heading,
    fontSize: 10,
    color: theme.colors.textMuted,
    letterSpacing: 2,
  },
  styleImageLabelGold: {
    color: theme.colors.gold,
  },
  styleImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  styleImageAfter: {
    borderColor: theme.colors.gold,
    borderWidth: 1.5,
  },
  // Full-width (after only)
  styleImageFullBlock: {
    gap: 6,
    marginTop: theme.spacing.sm,
  },
  styleImageFull: {
    width: '100%',
    height: 220,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.gold,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  loadingText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
    letterSpacing: 1,
  },
  errorWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.error,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  errorText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.error,
    textAlign: 'center',
  },
  guideCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    ...theme.shadows.md,
  },
  regenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.gold,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    ...theme.shadows.gold,
  },
  regenBtnText: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textInverse,
    letterSpacing: 3,
  },
});