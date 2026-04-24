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
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
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

// Before/After Comparison Modal Component
interface BeforeAfterModalProps {
  visible: boolean;
  onClose: () => void;
  originalPhoto: string;
  resultPhoto: string;
  onBook: () => void;
  onSave: () => void;
  saving: boolean;
}

function BeforeAfterModal({
  visible,
  onClose,
  originalPhoto,
  resultPhoto,
  onBook,
  onSave,
  saving,
}: BeforeAfterModalProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [dividerPosition, setDividerPosition] = useState(SW / 2);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        const newPosition = gestureState.moveX;
        if (newPosition >= 20 && newPosition <= SW - 20) {
          setDividerPosition(newPosition);
        }
      },
    }),
  ).current;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingTop: insets.top + spacing.lg }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Your Style Preview</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name={icons.close} size={28} color={colors.white} />
            </TouchableOpacity>
          </View>

          <View style={styles.comparisonContainer}>
            {/* Left side - Original */}
            <View style={[styles.halfImageContainer, { width: dividerPosition }]}>
              <Image source={{ uri: originalPhoto }} style={styles.comparisonImage} resizeMode="cover" />
              <View style={styles.imageLabelOverlay}>
                <Text style={styles.imageLabel}>Before</Text>
              </View>
            </View>

            {/* Right side - Result */}
            <View style={[styles.halfImageContainer, { width: SW - dividerPosition, left: dividerPosition }]}>
              <Image source={{ uri: resultPhoto }} style={styles.comparisonImage} resizeMode="cover" />
              <View style={styles.imageLabelOverlay}>
                <Text style={styles.imageLabel}>After</Text>
              </View>
            </View>

            {/* Draggable Divider */}
            <View
              style={[styles.dividerLine, { left: dividerPosition - 2 }]}
              {...panResponder.panHandlers}
            >
              <View style={styles.dividerHandle}>
                <Ionicons name="swap-horizontal" size={20} color={colors.gold} />
              </View>
            </View>
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={onBook}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>Book this style</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.outlineBtn}
              onPress={onSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color={colors.gold} size="small" />
              ) : (
                <Text style={styles.outlineBtnText}>Save this look</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Loading Modal Component
interface LoadingModalProps {
  visible: boolean;
  spinValue: Animated.Value;
}

function LoadingModal({ visible, spinValue }: LoadingModalProps): React.JSX.Element {
  const insets = useSafeAreaInsets();

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.loadingOverlay}>
        <View style={[styles.loadingContent, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <View style={styles.spinnerContainer}>
              <Ionicons name={icons.refresh} size={48} color={colors.gold} />
            </View>
          </Animated.View>
          <Text style={styles.loadingText}>Applying style to your photo...</Text>
          <Text style={styles.loadingSubtext}>this takes about 20 seconds</Text>
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
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [photosLoading, setPhotosLoading] = useState(true);
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
  const summaryAnim = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef<Animated.Value[]>([]).current;

  // Spinner animation
  const spinValue = useRef(new Animated.Value(0)).current;

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
    // Animate summary card
    Animated.timing(summaryAnim, {
      toValue: 1,
      duration: animations.normal,
      useNativeDriver: true,
    }).start();

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

  // Spinner animation
  useEffect(() => {
    if (tryOnLoading) {
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinValue.setValue(0);
    }
  }, [tryOnLoading, spinValue]);

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
      console.log('[tryon] base64 length:', selfieBase64?.length);
      if (!selfieBase64 || selfieBase64.length === 0) {
        Alert.alert('Photo needed', 'Please upload a photo first in the Style tab');
        setTryOnLoading(false);
        return;
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

  // Handle save this look
  const handleSaveLook = async (): Promise<void> => {
    if (!firebaseUser?.uid || !resultPhoto || !currentTryOnStyle) return;

    setSavingLook(true);
    try {
      const lookData = {
        photoURL: resultPhoto,
        styleName: currentTryOnStyle.style_name,
        createdAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid), {
        savedLooks: arrayUnion(lookData),
      });

      Alert.alert('Saved!', 'This look has been added to your saved styles.');
    } catch (error) {
      console.error('Save look error:', error);
      Alert.alert('Save failed', 'Could not save this look. Try again.');
    } finally {
      setSavingLook(false);
    }
  };

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
      <LoadingModal visible={tryOnLoading} spinValue={spinValue} />

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
              void bookThisStyle(currentTryOnStyle);
            }
          }}
          onSave={() => void handleSaveLook()}
          saving={savingLook}
        />
      )}

      {/* Error Banner */}
      {errorMessage && (
        <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage(null)} />
      )}

      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
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
        <Animated.View style={[styles.summaryCard, getCardStyle(summaryAnim)]}>
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
        </Animated.View>

        <Text style={styles.sectionLabel}>Recommended For You</Text>

        {photosLoading && recs.length > 0 && (
          <View style={styles.photosLoadingRow}>
            <ActivityIndicator color={colors.gold} size="small" />
            <Text style={styles.photosLoadingText}>Finding style photos...</Text>
          </View>
        )}

        {recs.map((item, index) => {
          const photoUri = photos[item.style_name];
          const usePlaceholder = isStylePhotoPlaceholderUrl(photoUri);
          const bookingThis = bookBusyStyle === item.style_name;
          const rankNum = item.rank ?? 0;
          const animValue = cardAnims[index] || new Animated.Value(1);

          return (
            <Animated.View key={`${item.rank}-${item.style_name}`} style={[styles.styleCard, getCardStyle(animValue)]}>
              {/* Full-width 16:9 Photo */}
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

                {/* Gold Rank Badge - Top Left */}
                <View style={styles.rankBadgeGold}>
                  <Text style={styles.rankBadgeTextGold}>#{rankNum}</Text>
                </View>
              </View>

              {/* Style Name - Bold White Inter */}
              <Text style={styles.styleName}>{item.style_name}</Text>

              {/* Great Match Gold Pill */}
              <View style={styles.greatMatchPill}>
                <Text style={styles.greatMatchPillText}>Great match</Text>
              </View>

              {/* Plain English Description */}
              <Text style={styles.whyText}>{item.why_it_suits_you}</Text>

              {/* Tags Row */}
              <View style={styles.tagRow}>
                <Tag text={friendlyMaintenance(item.maintenance_level)} />
                <Tag text={`About ${item.duration_minutes} min`} />
                {friendlyBestFor(item.best_for) ? (
                  <Tag text={friendlyBestFor(item.best_for)} />
                ) : null}
              </View>

              {/* Three Stacked Buttons */}
              {renderPressableButton(
                () => void handleTryThisOnMe(item),
                'Try this on me',
                'primary',
                photosLoading,
                `try-${item.style_name}`,
              )}

              {renderPressableButton(
                () => void bookThisStyle(item),
                bookingThis ? <ActivityIndicator color={colors.gold} size="small" /> : 'Book this style',
                'outline',
                photosLoading || bookingThis,
                `book-${item.style_name}`,
              )}

              {renderPressableButton(
                () => openChat(),
                'Chat about this style',
                'dark-outline',
                false,
                `chat-${item.style_name}`,
              )}
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

  // Before/After Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 10, 0.95)',
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
    paddingBottom: spacing.md,
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
    position: 'relative',
    overflow: 'hidden',
  },
  halfImageContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  comparisonImage: {
    width: SW,
    height: '100%',
  },
  imageLabelOverlay: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
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
    width: 4,
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
    paddingBottom: spacing.lg,
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
