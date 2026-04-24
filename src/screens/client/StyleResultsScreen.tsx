import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Dimensions,
  ActivityIndicator,
  Animated,
  Modal,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, setDoc, serverTimestamp, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import type { NavigationProp } from '@react-navigation/native';
import { ClientTabParamList, StyleStackParamList } from '@/navigation/types';
import { db } from '@/config/firebase';
import { COLLECTIONS } from '@/constants/collections';
import { useAuth } from '@/hooks/useAuth';
import { BookingService } from '@/services/booking.service';
import type { ProfileRecord, StyleRecommendation } from '@/services/ai.service';
import { TryOnService } from '@/services/tryon.service';
import { readImageAsBase64, inferImageMediaType } from '@/utils/imageBase64.utils';
import {
  getStylePhoto,
  STYLE_PHOTO_PLACEHOLDER_URL,
  isStylePhotoPlaceholderUrl,
} from '@/services/unsplash.service';
import {
  friendlyBestFor,
  friendlyMaintenance,
} from '@/utils/styleDisplay.utils';
import BookingNoteModal from '@/components/BookingNoteModal';
import type { SavedLook } from '@/types/user.types';
import { colors, fonts, spacing, radius, shadows, icons, animations } from '@/theme';

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

// Before/After Comparison Modal Component (FIX 1: full-screen, 50/50 split)
interface BeforeAfterModalProps {
  visible: boolean;
  onClose: () => void;
  originalPhoto: string;
  resultPhoto: string;
  onBook: () => void;
  onSave: () => void;
  saving: boolean;
  styleName?: string;
}

function BeforeAfterModal({
  visible,
  onClose,
  originalPhoto,
  resultPhoto,
  onBook,
  onSave,
  saving,
  styleName,
}: BeforeAfterModalProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const halfWidth = SW / 2;
  const [showAfterFullscreen, setShowAfterFullscreen] = useState(false);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header with style name */}
          <View style={[styles.modalHeader, { paddingTop: insets.top + spacing.sm }]}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.modalCloseBtn}
              accessibilityRole="button"
              accessibilityLabel="Close preview"
            >
              <Ionicons name={icons.close} size={28} color={colors.white} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{styleName || 'Your Style Preview'}</Text>
            <View style={styles.modalCloseBtn} />
          </View>

          {/* Side-by-side images, exactly 50/50 of the full screen width — FIX 1: taller container, contain mode */}
          <View style={[styles.comparisonContainer, { height: Dimensions.get('window').height * 0.65 }]}>
            {/* Before — left half */}
            <View style={[styles.halfImageContainer, { width: halfWidth, left: 0 }]}>
              <Image
                source={{ uri: originalPhoto }}
                style={{ flex: 1, height: '100%' }}
                resizeMode="contain"
              />
              <View style={[styles.imageLabelOverlay, styles.imageLabelLeft]}>
                <Text style={styles.imageLabel}>Before</Text>
              </View>
            </View>

            {/* After — right half */}
            <View style={[styles.halfImageContainer, { width: halfWidth, left: halfWidth }]}>
              <Image
                source={{ uri: resultPhoto }}
                style={{ flex: 1, height: '100%' }}
                resizeMode="contain"
              />
              <View style={[styles.imageLabelOverlay, { position: 'absolute', bottom: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 }]}>
                <Text style={styles.imageLabel}>After</Text>
              </View>
            </View>

            {/* Centered 2px gold divider with swap icon */}
            <View style={[styles.dividerLine, { left: halfWidth - 1 }]} pointerEvents="box-none">
              <TouchableOpacity
                style={styles.dividerHandle}
                onPress={() => setShowAfterFullscreen(true)}
                accessibilityRole="button"
                accessibilityLabel="View after fullscreen"
              >
                <Ionicons name="swap-horizontal" size={20} color={colors.gold} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Stacked action buttons */}
          <View style={[styles.modalButtons, { paddingBottom: insets.bottom + spacing.lg }]}>
            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              onPress={onBook}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Book this style"
            >
              <Text style={styles.modalPrimaryBtnText}>Book this style</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOutlineBtn}
              onPress={onSave}
              disabled={saving}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Save this look"
            >
              {saving ? (
                <ActivityIndicator color={colors.gold} size="small" />
              ) : (
                <Text style={styles.modalOutlineBtnText}>Save this look</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCloseTextBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={styles.modalCloseTextBtnText}>Close</Text>
            </TouchableOpacity>
          </View>

          {/* Tap-to-zoom fullscreen After image */}
          <Modal visible={showAfterFullscreen} transparent animationType="fade">
            <TouchableOpacity
              activeOpacity={1}
              style={styles.fullscreenOverlay}
              onPress={() => setShowAfterFullscreen(false)}
            >
              <Image
                source={{ uri: resultPhoto }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
              <View style={[styles.fullscreenClose, { top: insets.top + spacing.md }]}>
                <Ionicons name={icons.close} size={28} color={colors.white} />
              </View>
            </TouchableOpacity>
          </Modal>
        </View>
      </View>
    </Modal>
  );
}

// Loading Modal Component
interface LoadingModalProps {
  visible: boolean;
}

function LoadingModal({ visible }: LoadingModalProps): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.loadingOverlay}>
        <View style={[styles.loadingContent, { paddingBottom: insets.bottom + spacing.lg }]}>
          <ActivityIndicator size={60} color="#D4AF37" />
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginTop: 20 }}>
            Applying style to your photo...
          </Text>
          <Text style={{ color: '#888', fontSize: 13, marginTop: 6 }}>
            This takes about 20 seconds
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// Error Banner Component
function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }): React.JSX.Element {
  return (
    <View style={styles.errorBanner}>
      <Ionicons name={icons.warning} size={20} color={colors.red} />
      <Text style={styles.errorBannerText}>{message}</Text>
      <TouchableOpacity onPress={onDismiss} style={styles.errorBannerClose}>
        <Ionicons name={icons.close} size={18} color={colors.grey} />
      </TouchableOpacity>
    </View>
  );
}

export default function StyleResultsScreen({ navigation, route }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { firebaseUser } = useAuth();
  const { analysis, readOnly, selfieUri, selfieDataUrl: routeSelfieDataUrl } = route.params;
  const [saving, setSaving] = React.useState(false);
  const [bookBusyStyle, setBookBusyStyle] = useState<string | null>(null);

  // Try-on state
  const [tryOnLoading, setTryOnLoading] = useState(false);
  const [showBeforeAfter, setShowBeforeAfter] = useState(false);
  const [originalPhoto, setOriginalPhoto] = useState<string | null>(null);
  const [resultPhoto, setResultPhoto] = useState<string | null>(null);
  const [savingLook, setSavingLook] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentTryOnStyle, setCurrentTryOnStyle] = useState<StyleRecommendation | null>(null);

  // Animation refs for cards
  const cardAnims = useRef<Animated.Value[]>([]).current;

  const recs: StyleRecommendation[] = useMemo(() => {
    const list = analysis.styles?.recommendations;
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  }, [analysis.styles]);

  // Initialize animation values for each recommendation
  useEffect(() => {
    cardAnims.length = 0;
    recs.forEach(() => {
      cardAnims.push(new Animated.Value(0));
    });
  }, [recs.length]);

  // Trigger entrance animations
  useEffect(() => {
    // Stagger animate recommendation cards
    const animations_list = cardAnims.map((anim, index) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: animations.normal,
        delay: index * 100,
        useNativeDriver: true,
      })
    );

    Animated.stagger(80, animations_list).start();
  }, [cardAnims]);

  const getCardStyle = (animValue: Animated.Value) => ({
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

  // Async photo lookup — calls backend Unsplash proxy with ethnicity-aware query
  const [photos, setPhotos] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    if (recs.length === 0) {
      setPhotos({});
      return;
    }
    (async () => {
      const eth = analysis.profile?.ethnicity ?? '';
      const urls = await Promise.all(recs.map((r) => getStylePhoto(r.style_name, eth)));
      if (cancelled) return;
      const map: Record<string, string> = {};
      recs.forEach((r, i) => {
        map[r.style_name] = urls[i] ?? STYLE_PHOTO_PLACEHOLDER_URL;
      });
      setPhotos(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [recs, analysis.profile?.ethnicity]);

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

  async function bookThisStyle(
    item: StyleRecommendation,
    opts?: { clientNote?: string; beforePhotoURL?: string; afterPhotoURL?: string },
  ): Promise<void> {
    if (!firebaseUser?.uid) {
      Alert.alert('Not signed in', 'Sign in to attach a style to your booking.');
      return;
    }
    setBookBusyStyle(item.style_name);
    try {
      const ph =
        opts?.afterPhotoURL ||
        (photos[item.style_name] && !isStylePhotoPlaceholderUrl(photos[item.style_name])
          ? photos[item.style_name]
          : STYLE_PHOTO_PLACEHOLDER_URL);
      const res = await BookingService.attachRequestedStyleForClient(firebaseUser.uid, {
        name: item.style_name,
        photoURL: ph,
        description:
          item.why_it_suits_you?.trim() ||
          `The look you picked: ${item.style_name}. Your barber can fine-tune it in the chair.`,
        ...(opts?.beforePhotoURL ? { beforePhotoURL: opts.beforePhotoURL } : {}),
        ...(opts?.clientNote ? { clientNote: opts.clientNote } : {}),
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

  // Get user profile photo URL from Firestore
  const getUserProfilePhoto = useCallback(async (): Promise<string | null> => {
    if (!firebaseUser?.uid) return null;
    try {
      const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid));
      const data = userDoc.data();
      const photoURL = data?.styleProfile?.photoURL;
      return typeof photoURL === 'string' ? photoURL : null;
    } catch (error) {
      console.error('Error fetching user profile photo:', error);
      return null;
    }
  }, [firebaseUser?.uid]);

  // Fix 7: Build style prompt correctly for FLUX Kontext
  const buildStylePrompt = useCallback(
    (styleName: string): string => {
      // FLUX Kontext prompt strategy: clear instruction to only change hair
      return `Change only the hair to a ${styleName} haircut. Keep the exact same face, skin tone, eyes, expression, background, and clothing completely unchanged. Only the hair and hairline should change. Photorealistic.`;
    },
    []
  );

  // Handle "Try this on me" button press
  const handleTryThisOnMe = async (item: StyleRecommendation): Promise<void> => {
    if (!firebaseUser?.uid) {
      Alert.alert('Not signed in', 'Please sign in to try on styles.');
      return;
    }

    setCurrentTryOnStyle(item);
    setErrorMessage(null);

    // Check if user has a profile photo
    const userPhoto = await getUserProfilePhoto();

    // Fix 6: Log selfie URL from Firestore
    console.log('[tryon] selfieUrl from Firestore:', userPhoto);

    if (!userPhoto) {
      Alert.alert('Photo needed', 'Please upload a photo first in the Style tab', [
        {
          text: 'Go to Style',
          onPress: () => navigation.navigate('StyleOnboarding'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }

    setOriginalPhoto(userPhoto);
    setTryOnLoading(true);

    try {
      // Fix 6: Extract base64 from data URL (format: data:image/jpeg;base64,{data})
      let selfieBase64: string | null = null;
      if (userPhoto.startsWith('data:')) {
        const parts = userPhoto.split(',');
        if (parts.length > 1) {
          selfieBase64 = parts[1];
        }
      } else {
        // If it's already just base64, use as-is (shouldn't happen)
        selfieBase64 = userPhoto;
      }

      // Fix 6: Log and validate base64 length
      // FIX 1: Log base64 length after extraction (web: strip data URL prefix, native: direct read)
      console.log('[tryon] base64 length after fix:', selfieBase64?.length);
      if (!selfieBase64 || selfieBase64.length === 0) {
        Alert.alert('Photo needed', 'Please upload a photo first in the Style tab');
        setTryOnLoading(false);
        return;
      }
      // Warn if base64 seems too small (less than ~100KB = ~75KB after base64 = ~100k chars)
      if (selfieBase64.length < 100000) {
        console.warn('[tryon] WARNING: base64 seems small (< 100k chars), image may be low quality');
      }

      const stylePrompt = buildStylePrompt(item.style_name);

      // Fix 5: Use TryOnService with correct backend URL
      const result = await TryOnService.tryOnKontext({
        selfieBase64,
        stylePrompt,
      });

      setResultPhoto(result.resultUrl);
      setShowBeforeAfter(true);
    } catch (error) {
      console.error('Try-on error:', error);
      setErrorMessage("Couldn't apply style. Try again.");
    } finally {
      setTryOnLoading(false);
    }
  };

  // Build the same plain-English description used elsewhere so the saved
  // record always carries something a barber can read.
  const buildDescriptionFor = useCallback((rec: StyleRecommendation): string => {
    const why = rec.why_it_suits_you?.trim();
    if (why) return why;
    return `The look you picked: ${rec.style_name}. Your barber can fine-tune it in the chair.`;
  }, []);

  // Build concise barber-facing notes (texture, maintenance, best-for tags).
  const buildBarberNotesFor = useCallback((rec: StyleRecommendation): string => {
    const parts: string[] = [];
    const maint = friendlyMaintenance(rec.maintenance_level);
    if (maint) parts.push(maint);
    const best = friendlyBestFor(rec.best_for);
    if (best) parts.push(best);
    if (typeof rec.duration_minutes === 'number') {
      parts.push(`About ${rec.duration_minutes} min in the chair`);
    }
    return parts.join(' · ');
  }, []);

  // Handle save this look — FIX 2: save the rich SavedLook shape
  const handleSaveLook = async (): Promise<void> => {
    if (!firebaseUser?.uid || !resultPhoto || !currentTryOnStyle || !originalPhoto) return;

    setSavingLook(true);
    try {
      const look: SavedLook = {
        id: Date.now().toString(),
        styleName: currentTryOnStyle.style_name,
        beforeUrl: originalPhoto,
        afterUrl: resultPhoto,
        styleDescription: buildDescriptionFor(currentTryOnStyle),
        barberNotes: buildBarberNotesFor(currentTryOnStyle),
        savedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid), {
        savedLooks: arrayUnion(look),
      });

      Alert.alert('Saved!', 'This look has been added to your saved styles.');
    } catch (error) {
      console.error('Save look error:', error);
      Alert.alert('Save failed', 'Could not save this look. Try again.');
    } finally {
      setSavingLook(false);
    }
  };

  // FIX 5 — pre-confirmation note modal state
  const [pendingBook, setPendingBook] = useState<{
    rec: StyleRecommendation;
    beforePhotoURL?: string;
    afterPhotoURL?: string;
  } | null>(null);

  function startBookFlow(
    rec: StyleRecommendation,
    opts?: { beforePhotoURL?: string; afterPhotoURL?: string },
  ): void {
    setPendingBook({ rec, ...opts });
  }

  async function confirmBookWithNote(note: string): Promise<void> {
    const pending = pendingBook;
    setPendingBook(null);
    if (!pending) return;
    await bookThisStyle(pending.rec, {
      clientNote: note,
      beforePhotoURL: pending.beforePhotoURL,
      afterPhotoURL: pending.afterPhotoURL,
    });
  }

  // Button press animation handler
  const [pressedButton, setPressedButton] = useState<string | null>(null);

  const renderPressableButton = (
    onPress: () => void,
    label: string | React.ReactNode,
    variant: 'primary' | 'outline' | 'dark-outline' = 'primary',
    disabled?: boolean,
    buttonId?: string,
  ) => {
    const getButtonStyle = () => {
      switch (variant) {
        case 'primary':
          return styles.primaryBtn;
        case 'outline':
          return styles.outlineBtn;
        case 'dark-outline':
          return styles.darkOutlineBtn;
        default:
          return styles.primaryBtn;
      }
    };

    const getButtonTextStyle = () => {
      switch (variant) {
        case 'primary':
          return styles.primaryBtnText;
        case 'outline':
          return styles.outlineBtnText;
        case 'dark-outline':
          return styles.darkOutlineBtnText;
        default:
          return styles.primaryBtnText;
      }
    };

    const getDisabledStyle = () => {
      switch (variant) {
        case 'primary':
          return styles.primaryBtnDisabled;
        case 'outline':
          return styles.outlineBtnDisabled;
        case 'dark-outline':
          return styles.darkOutlineBtnDisabled;
        default:
          return styles.primaryBtnDisabled;
      }
    };

    return (
      <TouchableOpacity
        style={[
          getButtonStyle(),
          disabled && getDisabledStyle(),
          pressedButton === buttonId && { transform: [{ scale: animations.pressScale }] },
        ]}
        onPress={onPress}
        onPressIn={() => setPressedButton(buttonId || null)}
        onPressOut={() => setPressedButton(null)}
        disabled={disabled}
        activeOpacity={1}
        accessibilityRole="button"
      >
        {typeof label === 'string' ? (
          <Text style={getButtonTextStyle()}>{label}</Text>
        ) : (
          label
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Loading Modal */}
      <LoadingModal visible={tryOnLoading} />

      {/* Before/After Modal */}
      {originalPhoto && resultPhoto && (
        <BeforeAfterModal
          visible={showBeforeAfter}
          onClose={() => setShowBeforeAfter(false)}
          originalPhoto={originalPhoto}
          resultPhoto={resultPhoto}
          onBook={() => {
            setShowBeforeAfter(false);
            if (currentTryOnStyle) {
              startBookFlow(currentTryOnStyle, {
                beforePhotoURL: originalPhoto,
                afterPhotoURL: resultPhoto,
              });
            }
          }}
          onSave={() => void handleSaveLook()}
          saving={savingLook}
          styleName={currentTryOnStyle?.style_name}
        />
      )}

      {/* FIX 5 — pre-confirmation note modal */}
      <BookingNoteModal
        visible={pendingBook !== null}
        styleName={pendingBook?.rec.style_name ?? ''}
        onConfirm={(note) => void confirmBookWithNote(note)}
        onCancel={() => setPendingBook(null)}
      />

      {/* Error Banner */}
      {errorMessage && (
        <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage(null)} />
      )}

      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => navigation.navigate('StyleOnboarding')}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name={icons.back} size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Style Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile pills — one horizontal scroll row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
          {[
            analysis.profile?.face_shape && `${analysis.profile.face_shape} face`,
            analysis.profile?.hair_texture,
            analysis.profile?.skin_tone && `${analysis.profile.skin_tone} skin`,
            analysis.profile?.ethnicity,
          ].filter(Boolean).map((label, i) => (
            <View key={i} style={{ backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 }}>
              <Text style={{ color: '#D4AF37', fontSize: 12 }}>{label}</Text>
            </View>
          ))}
        </ScrollView>

        <Text style={styles.sectionLabel}>Recommended For You</Text>

        {recs.map((item, index) => {
          const photoUri = photos[item.style_name];
          const usePlaceholder = isStylePhotoPlaceholderUrl(photoUri);
          const bookingThis = bookBusyStyle === item.style_name;
          const rankNum = item.rank ?? 0;
          const animValue = cardAnims[index] || new Animated.Value(1);

          // Handle button actions
          const handleTryOn = (rec: typeof item) => {
            void handleTryThisOnMe(rec);
          };
          const handleBook = (rec: typeof item) => {
            startBookFlow(rec);
          };
          const handleChat = () => {
            openChat();
          };

          return (
            <Animated.View key={`${item.rank}-${item.style_name}`} style={[styles.styleCard, getCardStyle(animValue)]}>
              {/* Card container */}
              <View style={{
                backgroundColor: '#111111',
                borderRadius: 16,
                marginBottom: 20,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: '#2A2A2A',
              }}>
                {/* Photo — fixed height showing face + hair (top anchored) */}
                <View style={{ width: '100%', height: 320, backgroundColor: '#1A1A1A' }}>
                  {photoUri ? (
                    <Image
                      source={{ uri: photoUri }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' } as any}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.photoSolid} />
                  )}
                  {/* Rank badge — absolute top left */}
                  <View style={{
                    position: 'absolute', top: 12, left: 12,
                    backgroundColor: '#D4AF37', borderRadius: 8,
                    paddingHorizontal: 10, paddingVertical: 4,
                  }}>
                    <Text style={{ color: '#0A0A0A', fontWeight: '700', fontSize: 12 }}>#{rankNum}</Text>
                  </View>
                  {/* Match score — absolute top right */}
                  <View style={{
                    position: 'absolute', top: 12, right: 12,
                    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 12,
                    paddingHorizontal: 10, paddingVertical: 4,
                  }}>
                    <Text style={{ color: '#D4AF37', fontSize: 12, fontWeight: '600' }}>{item.suitability_score ?? 90}% match</Text>
                  </View>
                </View>

                {/* Card content */}
                <View style={{ padding: 16 }}>
                  {/* Style name */}
                  <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>{item.style_name}</Text>

                  {/* Why it fits */}
                  <Text style={{ color: '#888888', fontSize: 14, marginTop: 6, lineHeight: 20 }} numberOfLines={2}>
                    {item.why_it_suits_you}
                  </Text>

                  {/* Info pills row */}
                  <View style={{ flexDirection: 'row', marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
                    <InfoPill icon="time-outline" text={item.duration_minutes ? `${item.duration_minutes} min` : '30 min'} />
                    <InfoPill icon="construct-outline" text={friendlyMaintenance(item.maintenance_level)} />
                    <InfoPill icon="calendar-outline" text={friendlyBestFor(item.best_for)} />
                  </View>

                  {/* Occasion tags */}
                  <View style={{ flexDirection: 'row', marginTop: 8, gap: 6, flexWrap: 'wrap' }}>
                    {(item.best_for?.split(',') ?? []).slice(0, 3).map((tag: string) => (
                      <View key={tag} style={{ backgroundColor: '#1A1A1A', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: '#666', fontSize: 11 }}>{tag.trim()}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Try this on me — gold filled full width */}
                  <TouchableOpacity
                    style={{ backgroundColor: '#D4AF37', borderRadius: 24, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14 }}
                    onPress={() => handleTryOn(item)}
                  >
                    <Ionicons name="sparkles-outline" size={16} color="#0A0A0A" />
                    <Text style={{ color: '#0A0A0A', fontWeight: '700', fontSize: 15, marginLeft: 6 }}>Try this on me</Text>
                  </TouchableOpacity>

                  {/* Book + Chat row */}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity
                      style={{ flex: 1, borderWidth: 1, borderColor: '#D4AF37', borderRadius: 24, height: 44, alignItems: 'center', justifyContent: 'center' }}
                      onPress={() => handleBook(item)}
                      disabled={bookingThis}
                    >
                      {bookingThis ? (
                        <ActivityIndicator color={colors.gold} size="small" />
                      ) : (
                        <Text style={{ color: '#D4AF37', fontWeight: '600' }}>Book</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flex: 1, backgroundColor: '#1A1A1A', borderRadius: 24, height: 44, alignItems: 'center', justifyContent: 'center' }}
                      onPress={handleChat}
                    >
                      <Text style={{ color: '#888888' }}>Chat about this</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {readOnly ? (
          renderPressableButton(
            () => goToProfileTab(navigation),
            'Done',
            'primary',
            false,
            'done',
          )
        ) : (
          renderPressableButton(
            () => void saveProfile(),
            saving ? 'Saving...' : 'Save My Style Profile',
            'primary',
            saving,
            'save',
          )
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

const InfoPill = ({ icon, text }: { icon: string; text: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}>
    <Ionicons name={icon as any} size={12} color="#D4AF37" />
    <Text style={{ color: '#888', fontSize: 11, marginLeft: 4 }}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 44 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: fonts.size.xl,
    fontFamily: fonts.bodyBold,
    color: colors.white,
    letterSpacing: fonts.letterSpacing.normal,
  },
  scroll: { paddingHorizontal: CARD_PAD, paddingTop: spacing.sm },

  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xl,
    ...shadows.sm,
  },
  summaryRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  summaryLabel: {
    fontSize: fonts.size.xs,
    color: colors.gold,
    fontFamily: fonts.bodyBold,
    letterSpacing: fonts.letterSpacing.wide,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  summaryValue: { fontSize: fonts.size.lg, color: colors.white, fontFamily: fonts.bodySemiBold },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },

  sectionLabel: {
    fontSize: fonts.size.xs,
    color: colors.grey,
    fontFamily: fonts.bodyBold,
    letterSpacing: fonts.letterSpacing.wider,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
  },
  photosLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  photosLoadingText: { fontSize: fonts.size.md, color: colors.grey },

  styleCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  photoFrame: {
    width: PHOTO_WIDTH,
    aspectRatio: 16 / 9,
    backgroundColor: colors.surfaceRaised,
    alignSelf: 'center',
    position: 'relative',
  },
  photoFramePlaceholder: {
    borderWidth: 2,
    borderColor: colors.gold,
    borderRadius: radius.sm,
  },
  photo: { width: '100%', height: '100%' },
  photoMuted: { opacity: 0.4 },
  photoSolid: { flex: 1, width: '100%', height: '100%', backgroundColor: colors.background },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.33)',
  },
  photoOverlayText: {
    fontSize: fonts.size.xl,
    fontFamily: fonts.bodyBold,
    color: colors.gold,
    textAlign: 'center',
    lineHeight: fonts.lineHeight.normal * fonts.size.xl,
    textShadowColor: '#000000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Gold Rank Badge - Top Left
  rankBadgeGold: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    zIndex: 2,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    ...shadows.md,
  },
  rankBadgeTextGold: {
    fontSize: fonts.size.sm,
    fontFamily: fonts.bodyBold,
    color: colors.background,
  },

  styleName: {
    fontSize: fonts.size['2xl'],
    fontFamily: fonts.bodyBold,
    color: colors.white,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },

  // Great Match Gold Pill
  greatMatchPill: {
    alignSelf: 'flex-start',
    marginLeft: spacing.lg,
    marginTop: spacing.sm,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  greatMatchPillText: {
    fontSize: fonts.size.sm,
    fontFamily: fonts.bodySemiBold,
    color: colors.gold,
  },

  whyText: {
    fontSize: fonts.size.md,
    color: colors.grey,
    lineHeight: fonts.lineHeight.relaxed * fonts.size.md,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md, paddingHorizontal: spacing.lg },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagText: { fontSize: fonts.size.sm, color: colors.grey, fontFamily: fonts.bodySemiBold },

  // Primary Button - Gold Filled
  primaryBtn: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius['2xl'],
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryBtnDisabled: { opacity: 0.55 },
  primaryBtnText: { fontSize: fonts.size.md, fontFamily: fonts.bodyBold, color: colors.background, letterSpacing: fonts.letterSpacing.normal },

  // Outline Button - Gold Outline
  outlineBtn: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  outlineBtnDisabled: { opacity: 0.55 },
  outlineBtnText: { fontSize: fonts.size.md, fontFamily: fonts.bodyBold, color: colors.gold, letterSpacing: fonts.letterSpacing.normal },

  // Dark Outline Button
  darkOutlineBtn: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  darkOutlineBtnDisabled: { opacity: 0.55 },
  darkOutlineBtnText: { fontSize: fonts.size.md, fontFamily: fonts.bodyBold, color: colors.grey, letterSpacing: fonts.letterSpacing.normal },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  // Loading Modal Styles
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 10, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  spinnerContainer: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.gold,
    marginBottom: spacing.lg,
  },
  loadingText: {
    fontSize: fonts.size.lg,
    fontFamily: fonts.bodyBold,
    color: colors.white,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  loadingSubtext: {
    fontSize: fonts.size.md,
    fontFamily: fonts.body,
    color: colors.grey,
    textAlign: 'center',
  },

  // Before/After Modal Styles — FIX 1: full screen, 50/50 split
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.background,
    margin: 0,
  },
  modalContent: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: fonts.size.xl,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  modalCloseBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comparisonContainer: {
    flex: 1,
    minHeight: 400,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  halfImageContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  comparisonImage: {
    width: '100%',
    height: '100%',
  },
  imageLabelOverlay: {
    position: 'absolute',
    bottom: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  imageLabelLeft: {
    left: spacing.md,
  },
  imageLabelRight: {
    right: spacing.md,
  },
  imageLabel: {
    fontSize: fonts.size.sm,
    fontFamily: fonts.bodySemiBold,
    color: colors.white,
  },
  dividerLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerHandle: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  modalButtons: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  modalPrimaryBtn: {
    width: '100%',
    paddingVertical: spacing.md,
    borderRadius: radius['2xl'],
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  modalPrimaryBtnText: {
    fontSize: fonts.size.md,
    fontFamily: fonts.bodyBold,
    color: colors.background,
  },
  modalOutlineBtn: {
    width: '100%',
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    minHeight: 48,
  },
  modalOutlineBtnText: {
    fontSize: fonts.size.md,
    fontFamily: fonts.bodyBold,
    color: colors.gold,
  },
  modalCloseTextBtn: {
    width: '100%',
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseTextBtnText: {
    fontSize: fonts.size.md,
    fontFamily: fonts.bodySemiBold,
    color: colors.grey,
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: '#000000EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
  fullscreenClose: {
    position: 'absolute',
    right: spacing.lg,
  },

  // Error Banner
  errorBanner: {
    position: 'absolute',
    top: 100,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: 'rgba(229, 57, 53, 0.15)',
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 100,
  },
  errorBannerText: {
    flex: 1,
    fontSize: fonts.size.sm,
    fontFamily: fonts.bodySemiBold,
    color: colors.red,
    marginLeft: spacing.sm,
  },
  errorBannerClose: {
    padding: spacing.xs,
  },
});
