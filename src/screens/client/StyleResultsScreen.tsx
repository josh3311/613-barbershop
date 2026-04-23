import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { NavigationProp } from '@react-navigation/native';
import { ClientTabParamList, StyleStackParamList } from '@/navigation/types';
import { db } from '@/config/firebase';
import { COLLECTIONS } from '@/constants/collections';
import { useAuth } from '@/hooks/useAuth';
import { BookingService } from '@/services/booking.service';
import type { ProfileRecord, StyleRecommendation } from '@/services/ai.service';
import { readImageAsBase64, inferImageMediaType } from '@/utils/imageBase64.utils';
import {
  UnsplashService,
  STYLE_PHOTO_PLACEHOLDER_URL,
  isStylePhotoPlaceholderUrl,
  stylePhotoHintsFromProfileRecord,
} from '@/services/unsplash.service';
import {
  friendlyBestFor,
  friendlyHairNote,
  friendlyMaintenance,
} from '@/utils/styleDisplay.utils';

const C = {
  bg: '#0A0A0A',
  card: '#161616',
  elevated: '#1C1C1C',
  gold: '#D4AF37',
  goldBorder: '#D4AF3740',
  white: '#FFFFFF',
  sub: '#888888',
  muted: '#555555',
  border: '#222222',
} as const;

const SW = Dimensions.get('window').width;
const CARD_PAD = 20;
const PHOTO_WIDTH = SW - CARD_PAD * 2;

type Props = NativeStackScreenProps<StyleStackParamList, 'StyleResults'>;

function goToProfileTab(navigation: NavigationProp<StyleStackParamList>): void {
  const tab = navigation.getParent<NavigationProp<ClientTabParamList>>();
  tab?.navigate('Profile', { screen: 'ProfileHome' });
}

function labelize(value: string | undefined): string {
  if (!value) return '—';
  const v = value.replace(/_/g, ' ');
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function getProfileString(
  p: ProfileRecord,
  snake: keyof ProfileRecord,
  camel: string,
): string | undefined {
  const raw = (p as Record<string, unknown>)[snake] ?? (p as Record<string, unknown>)[camel];
  return typeof raw === 'string' ? raw : undefined;
}

export default function StyleResultsScreen({ navigation, route }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { firebaseUser } = useAuth();
  const { analysis, readOnly, selfieUri, selfieDataUrl: routeSelfieDataUrl } = route.params;
  const [saving, setSaving] = React.useState(false);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [photosLoading, setPhotosLoading] = useState(true);
  const [bookBusyStyle, setBookBusyStyle] = useState<string | null>(null);

  const recs: StyleRecommendation[] = useMemo(() => {
    const list = analysis.styles?.recommendations;
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  }, [analysis.styles]);

  const photoHints = useMemo(() => stylePhotoHintsFromProfileRecord(analysis.profile), [analysis.profile]);

  useEffect(() => {
    let cancelled = false;
    async function loadPhotos(): Promise<void> {
      if (recs.length === 0) {
        setPhotosLoading(false);
        return;
      }
      setPhotosLoading(true);
      try {
        const urls = await Promise.all(
          recs.map((r) => UnsplashService.getStylePhoto(r.style_name, photoHints)),
        );
        if (cancelled) return;
        const map: Record<string, string> = {};
        recs.forEach((r, i) => {
          map[r.style_name] = urls[i] ?? STYLE_PHOTO_PLACEHOLDER_URL;
        });
        setPhotos(map);
      } finally {
        if (!cancelled) setPhotosLoading(false);
      }
    }
    void loadPhotos();
    return () => {
      cancelled = true;
    };
  }, [recs, photoHints]);

  const p = analysis.profile;

  async function saveProfile(): Promise<void> {
    if (!firebaseUser?.uid) {
      Alert.alert('Not signed in', 'Sign in again to save your profile.');
      return;
    }
    setSaving(true);
    try {
      let photoURL: string | undefined;
      const fromRoute = routeSelfieDataUrl?.trim();
      if (fromRoute && fromRoute.length > 0) {
        photoURL = fromRoute.startsWith('data:') ? fromRoute : `data:image/jpeg;base64,${fromRoute}`;
      } else if (selfieUri && selfieUri.trim().length > 0) {
        const uri = selfieUri.trim();
        const b64 = await readImageAsBase64(uri);
        const mt = inferImageMediaType(uri);
        photoURL = `data:${mt};base64,${b64}`;
      }

      await setDoc(
        doc(db, COLLECTIONS.USERS, firebaseUser.uid),
        {
          styleProfile: {
            profile: analysis.profile,
            styles: analysis.styles,
            ...(photoURL ? { photoURL } : {}),
            updatedAt: serverTimestamp(),
          },
        },
        { merge: true },
      );
      Alert.alert('Saved', 'Your style profile has been saved.', [
        {
          text: 'OK',
          onPress: () => goToProfileTab(navigation),
        },
      ]);
    } catch {
      Alert.alert('Save failed', 'Could not save to your account. Try again.');
    } finally {
      setSaving(false);
    }
  }

  function openChat(): void {
    navigation.navigate('StyleChat', {
      analysis,
      recommendationPhotos: photos,
    });
  }

  async function bookThisStyle(item: StyleRecommendation): Promise<void> {
    if (!firebaseUser?.uid) {
      Alert.alert('Not signed in', 'Sign in to attach a style to your booking.');
      return;
    }
    setBookBusyStyle(item.style_name);
    try {
      const ph =
        photos[item.style_name] && !isStylePhotoPlaceholderUrl(photos[item.style_name])
          ? photos[item.style_name]
          : STYLE_PHOTO_PLACEHOLDER_URL;
      const res = await BookingService.attachRequestedStyleForClient(firebaseUser.uid, {
        name: item.style_name,
        photoURL: ph,
        description:
          item.why_it_suits_you?.trim() ||
          `The look you picked: ${item.style_name}. Your barber can fine-tune it in the chair.`,
      });
      if (!res.success) {
        Alert.alert('Could not attach', res.error);
        return;
      }
      if (res.data.mode === 'booking') {
        Alert.alert('Style added', 'Style added to your booking! Your barber will see it.');
      } else {
        Alert.alert(
          'Style saved',
          'Style saved! It will be attached to your next booking automatically',
        );
      }
    } finally {
      setBookBusyStyle(null);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Style Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryCard}>
          <SummaryRow label="Face shape" value={labelize(getProfileString(p, 'face_shape', 'faceShape'))} />
          <View style={styles.divider} />
          <SummaryRow label="Hair texture" value={labelize(getProfileString(p, 'hair_texture', 'hairTexture'))} />
          <View style={styles.divider} />
          <SummaryRow label="Skin tone" value={labelize(getProfileString(p, 'skin_tone', 'skinTone'))} />
          <View style={styles.divider} />
          <SummaryRow
            label="Current style"
            value={(() => {
              const cur = getProfileString(p, 'current_style', 'currentStyle');
              return cur ? labelize(cur) : '—';
            })()}
          />
        </View>

        <Text style={styles.sectionLabel}>Recommended For You</Text>

        {photosLoading && recs.length > 0 && (
          <View style={styles.photosLoadingRow}>
            <ActivityIndicator color={C.gold} size="small" />
            <Text style={styles.photosLoadingText}>Finding style photos…</Text>
          </View>
        )}

        {recs.map((item) => {
          const photoUri = photos[item.style_name];
          const usePlaceholder = isStylePhotoPlaceholderUrl(photoUri);
          const bookingThis = bookBusyStyle === item.style_name;
          const rankNum = item.rank ?? 0;
          return (
            <View key={`${item.rank}-${item.style_name}`} style={styles.styleCard}>
              <View style={[styles.photoFrame, usePlaceholder && styles.photoFramePlaceholder]}>
                {photoUri ? (
                  <Image
                    source={{ uri: photoUri }}
                    style={[styles.photo, usePlaceholder && styles.photoMuted]}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.photoSolid} />
                )}
                {usePlaceholder ? (
                  <View style={styles.photoOverlay} pointerEvents="none">
                    <Text style={styles.photoOverlayText} numberOfLines={3}>
                      {item.style_name}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.rankBadge}>
                  <Text style={styles.rankBadgeText}>#{rankNum}</Text>
                </View>
              </View>
              <Text style={styles.styleName}>{item.style_name}</Text>
              <Text style={styles.greatMatchLabel}>Great match for you</Text>
              <Text style={styles.whyText}>{item.why_it_suits_you}</Text>
              <View style={styles.tagRow}>
                <Tag text={friendlyMaintenance(item.maintenance_level)} />
                <Tag text={`About ${item.duration_minutes} min`} />
                {friendlyBestFor(item.best_for) ? (
                  <Tag text={friendlyBestFor(item.best_for)} />
                ) : null}
              </View>
              {friendlyHairNote(item.hair_texture_compatibility) ? (
                <Text style={styles.hairNote}>
                  Hair note: {friendlyHairNote(item.hair_texture_compatibility)}
                </Text>
              ) : null}
              <TouchableOpacity
                style={[styles.bookStyleBtn, (photosLoading || bookingThis) && styles.bookStyleBtnDisabled]}
                onPress={() => void bookThisStyle(item)}
                disabled={photosLoading || bookingThis}
                accessibilityRole="button"
                accessibilityLabel={`Book this style: ${item.style_name}`}
              >
                {bookingThis ? (
                  <ActivityIndicator color={C.bg} size="small" />
                ) : (
                  <Text style={styles.bookStyleBtnText}>Book this style</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.chatOutlineBtn}
                onPress={openChat}
                accessibilityRole="button"
                accessibilityLabel={`Chat about this style: ${item.style_name}`}
              >
                <Text style={styles.chatOutlineBtnText}>Chat about this style</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {readOnly ? (
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={() => goToProfileTab(navigation)}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text style={styles.saveBtnText}>Done</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnBusy]}
            onPress={() => void saveProfile()}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Save my style profile"
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save My Style Profile'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function Tag({ text }: { text: string }): React.JSX.Element {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 44 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: C.white,
    letterSpacing: 0.3,
  },
  scroll: { paddingHorizontal: CARD_PAD, paddingTop: 12 },

  summaryCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 8,
    marginBottom: 24,
  },
  summaryRow: { paddingHorizontal: 16, paddingVertical: 12 },
  summaryLabel: { fontSize: 11, color: C.gold, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  summaryValue: { fontSize: 15, color: C.white, fontWeight: '600' },
  divider: { height: 1, backgroundColor: C.border, marginHorizontal: 16 },

  sectionLabel: { fontSize: 11, color: C.muted, fontWeight: '700', letterSpacing: 2, marginBottom: 12 },
  photosLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  photosLoadingText: { fontSize: 13, color: C.sub },

  styleCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  photoFrame: {
    width: PHOTO_WIDTH,
    aspectRatio: 16 / 9,
    backgroundColor: C.elevated,
    alignSelf: 'center',
    position: 'relative',
  },
  photoFramePlaceholder: {
    borderWidth: 2,
    borderColor: C.gold,
    borderRadius: 4,
  },
  photo: { width: '100%', height: '100%' },
  photoMuted: { opacity: 0.4 },
  photoSolid: { flex: 1, width: '100%', height: '100%', backgroundColor: C.bg },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#00000055',
  },
  photoOverlayText: {
    fontSize: 18,
    fontWeight: '800',
    color: C.gold,
    textAlign: 'center',
    lineHeight: 24,
    textShadowColor: '#000000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  rankBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 2,
    backgroundColor: '#000000AA',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  rankBadgeText: { fontSize: 12, fontWeight: '800', color: C.gold },
  styleName: {
    fontSize: 18,
    fontWeight: '800',
    color: C.white,
    marginTop: 14,
    paddingHorizontal: 16,
  },
  greatMatchLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: C.gold,
    marginTop: 6,
    paddingHorizontal: 16,
  },
  whyText: { fontSize: 14, color: C.sub, lineHeight: 21, marginTop: 10, paddingHorizontal: 16 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingHorizontal: 16 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: C.elevated,
    borderWidth: 1,
    borderColor: C.border,
  },
  tagText: { fontSize: 12, color: C.sub, fontWeight: '600' },
  hairNote: {
    fontSize: 12,
    color: C.muted,
    marginTop: 12,
    paddingHorizontal: 16,
    lineHeight: 17,
  },
  bookStyleBtn: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 10,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  bookStyleBtnDisabled: { opacity: 0.55 },
  bookStyleBtnText: { fontSize: 15, fontWeight: '800', color: C.bg, letterSpacing: 0.2 },
  chatOutlineBtn: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  chatOutlineBtnText: { fontSize: 15, fontWeight: '800', color: C.gold, letterSpacing: 0.2 },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  saveBtn: { backgroundColor: C.gold, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnBusy: { opacity: 0.7 },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: C.bg, letterSpacing: 0.3 },
});
