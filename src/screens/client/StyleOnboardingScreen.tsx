import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Easing,
  Platform,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { StyleStackParamList } from '@/navigation/types';
import { db } from '@/config/firebase';
import { COLLECTIONS } from '@/constants/collections';
import { useAuth } from '@/hooks/useAuth';
import type { ProfileAnalysisResult, StyleRecommendation } from '@/services/ai.service';
import { AIService } from '@/services/ai.service';
import {
  UnsplashService,
  STYLE_PHOTO_PLACEHOLDER_URL,
  isStylePhotoPlaceholderUrl,
  stylePhotoHintsFromProfileRecord,
} from '@/services/unsplash.service';
import { readImageAsBase64, inferImageMediaType } from '@/utils/imageBase64.utils';
import { colors, fonts, spacing, radius, shadows, icons, animations } from '@/theme';

type Props = NativeStackScreenProps<StyleStackParamList, 'StyleOnboarding'>;

export default function StyleOnboardingScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { firebaseUser } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraType>('front');
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [capturedPhotoMime, setCapturedPhotoMime] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewSource, setPreviewSource] = useState<'camera' | 'gallery'>('camera');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAnalysis, setSavedAnalysis] = useState<ProfileAnalysisResult | null>(null);
  const [savedPhotos, setSavedPhotos] = useState<Record<string, string>>({});
  const [savedPhotosLoading, setSavedPhotosLoading] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;

  // Animation values for card entrance
  const card1Anim = useRef(new Animated.Value(0)).current;
  const card2Anim = useRef(new Animated.Value(0)).current;
  const card3Anim = useRef(new Animated.Value(0)).current;
  const savedSectionAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered entrance animations
    Animated.sequence([
      Animated.timing(card1Anim, {
        toValue: 1,
        duration: animations.normal,
        useNativeDriver: true,
      }),
      Animated.timing(card2Anim, {
        toValue: 1,
        duration: animations.normal,
        useNativeDriver: true,
      }),
      Animated.timing(card3Anim, {
        toValue: 1,
        duration: animations.normal,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (savedAnalysis) {
      Animated.timing(savedSectionAnim, {
        toValue: 1,
        duration: animations.normal,
        useNativeDriver: true,
      }).start();
    }
  }, [savedAnalysis]);

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

  useEffect(() => {
    if (!firebaseUser?.uid) {
      setSavedAnalysis(null);
      return;
    }
    const uref = doc(db, COLLECTIONS.USERS, firebaseUser.uid);
    return onSnapshot(uref, (snap) => {
      const sp = snap.data()?.styleProfile as
        | { profile?: ProfileAnalysisResult['profile']; styles?: ProfileAnalysisResult['styles'] }
        | undefined;
      if (sp?.profile && sp?.styles?.recommendations && Array.isArray(sp.styles.recommendations)) {
        setSavedAnalysis({
          success: true,
          profile: sp.profile,
          styles: sp.styles,
        });
      } else {
        setSavedAnalysis(null);
      }
    });
  }, [firebaseUser?.uid]);

  const savedRecs: StyleRecommendation[] = React.useMemo(() => {
    const list = savedAnalysis?.styles?.recommendations;
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  }, [savedAnalysis]);

  useEffect(() => {
    let cancelled = false;
    async function loadPhotos(): Promise<void> {
      if (savedRecs.length === 0) {
        setSavedPhotos({});
        setSavedPhotosLoading(false);
        return;
      }
      setSavedPhotosLoading(true);
      try {
        const hints = savedAnalysis?.profile
          ? stylePhotoHintsFromProfileRecord(savedAnalysis.profile)
          : undefined;
        const urls = await Promise.all(
          savedRecs.map((r) => UnsplashService.getStylePhoto(r.style_name, hints)),
        );
        if (cancelled) return;
        const map: Record<string, string> = {};
        savedRecs.forEach((r, i) => {
          map[r.style_name] = urls[i] ?? STYLE_PHOTO_PLACEHOLDER_URL;
        });
        setSavedPhotos(map);
      } finally {
        if (!cancelled) setSavedPhotosLoading(false);
      }
    }
    void loadPhotos();
    return () => {
      cancelled = true;
    };
  }, [savedRecs, savedAnalysis]);

  useEffect(() => {
    if (!analyzing) return;
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => {
      loop.stop();
      spin.setValue(0);
    };
  }, [analyzing, spin]);

  const spinInterpolate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const saveStyleProfileToFirestore = useCallback(
    async (uid: string, analysis: ProfileAnalysisResult, selfieDataUrl: string): Promise<void> => {
      try {
        const userRef = doc(db, COLLECTIONS.USERS, uid);
        const styleProfile = {
          profile: analysis.profile,
          styles: analysis.styles,
          photoURL: selfieDataUrl,
          updatedAt: serverTimestamp(),
        };
        await setDoc(userRef, { styleProfile }, { merge: true });
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : 'Failed to save style profile');
      }
    },
    [],
  );

  const runAnalysis = useCallback(
    async (uri: string, mime?: string | null, source: 'camera' | 'gallery' = 'camera'): Promise<void> => {
      setError(null);
      setAnalyzing(true);
      try {
        const base64 = await readImageAsBase64(uri);
        const mediaType = inferImageMediaType(uri, mime);
        const result = await AIService.analyzeProfileFromBase64(base64, mediaType);
        const selfieDataUrl = `data:${mediaType};base64,${base64}`;

        // Save to Firestore if user is authenticated
        if (firebaseUser?.uid) {
          await saveStyleProfileToFirestore(firebaseUser.uid, result, selfieDataUrl);
        }

        setAnalyzing(false);
        navigation.replace('StyleResults', {
          analysis: result,
          readOnly: false,
          selfieUri: uri,
          selfieDataUrl,
        });
      } catch (e) {
        setAnalyzing(false);
        const message = e instanceof Error ? e.message : 'Something went wrong';
        setError(message);
        Alert.alert('Analysis Error', message);
      }
    },
    [navigation, firebaseUser?.uid, saveStyleProfileToFirestore],
  );

  function openChat(): void {
    if (!firebaseUser?.uid) {
      Alert.alert('Not signed in', 'Sign in to chat with the AI stylist.');
      return;
    }
    navigation.navigate('StyleChat', {});
  }

  async function openLibrary(): Promise<void> {
    setError(null);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError('Photo library access is required to upload a photo.');
        Alert.alert('Permission Required', 'Photo library access is required to upload a photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setCapturedPhotoUri(asset.uri);
      setCapturedPhotoMime(asset.mimeType ?? null);
      setPreviewSource('gallery');
      setShowPreview(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to open photo library';
      setError(message);
      Alert.alert('Error', message);
    }
  }

  async function openCameraFlow(): Promise<void> {
    setError(null);

    // Web fallback - use image picker with message
    if (Platform.OS === 'web') {
      try {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          setError('Photo library access is required to upload a photo.');
          Alert.alert('Permission Required', 'Photo library access is required to upload a photo.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
        if (result.canceled) return;
        const asset = result.assets[0];
        Alert.alert(
          'Photo Selected',
          'On mobile you can take a live photo',
          [
            {
              text: 'Continue',
              onPress: () => {
                setCapturedPhotoUri(asset.uri);
                setCapturedPhotoMime(asset.mimeType ?? null);
                setPreviewSource('camera');
                setShowPreview(true);
              },
            },
          ],
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to select photo';
        setError(message);
        Alert.alert('Error', message);
      }
      return;
    }

    // Native - use expo-camera
    try {
      if (!permission?.granted) {
        const res = await requestPermission();
        if (!res.granted) {
          setError('Camera access is required to take a photo.');
          Alert.alert('Permission Required', 'Camera access is required to take a photo.');
          return;
        }
      }
      setCameraReady(false);
      setCameraFacing('front');
      setShowCamera(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to open camera';
      setError(message);
      Alert.alert('Error', message);
    }
  }

  async function captureFromCamera(): Promise<void> {
    if (!cameraRef.current || !cameraReady) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      setCapturedPhotoUri(photo.uri);
      setCapturedPhotoMime('image/jpeg');
      setPreviewSource('camera');
      setShowCamera(false);
      setShowPreview(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not capture photo. Try again.';
      setError(message);
      Alert.alert('Camera Error', message);
    }
  }

  function flipCamera(): void {
    setCameraFacing((current) => (current === 'front' ? 'back' : 'front'));
  }

  function closeCamera(): void {
    setShowCamera(false);
    setCameraReady(false);
  }

  function closePreview(): void {
    setShowPreview(false);
    setCapturedPhotoUri(null);
    setCapturedPhotoMime(null);
  }

  function tryAgain(): void {
    setShowPreview(false);
    setCapturedPhotoUri(null);
    setCapturedPhotoMime(null);
    // Reopen camera if it was from camera flow
    if (previewSource === 'camera' && Platform.OS !== 'web') {
      setCameraReady(false);
      setShowCamera(true);
    }
  }

  async function useThisPhoto(): Promise<void> {
    if (!capturedPhotoUri) return;
    setShowPreview(false);
    await runAnalysis(capturedPhotoUri, capturedPhotoMime, previewSource);
  }

  function openSavedStyleResults(): void {
    if (!savedAnalysis) return;
    navigation.navigate('StyleResults', { analysis: savedAnalysis, readOnly: true });
  }

  // Button press animation
  const [pressedCard, setPressedCard] = useState<number | null>(null);

  const renderOptionCard = (
    animValue: Animated.Value,
    index: number,
    iconName: keyof typeof Ionicons.glyphMap,
    title: string,
    hint: string,
    onPress: () => void,
  ) => (
    <Animated.View style={getCardStyle(animValue)}>
      <TouchableOpacity
        style={[
          styles.optionCard,
          pressedCard === index && { transform: [{ scale: animations.pressScale }] },
        ]}
        onPress={onPress}
        onPressIn={() => setPressedCard(index)}
        onPressOut={() => setPressedCard(null)}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        <View style={styles.optionIconWrap}>
          <Ionicons name={iconName} size={32} color={colors.gold} />
        </View>
        <View style={styles.optionTextCol}>
          <Text style={styles.optionTitle}>{title}</Text>
          <Text style={styles.optionHint}>{hint}</Text>
        </View>
        <Ionicons name={icons.forward} size={22} color={colors.grey} />
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
      >
        <Animated.View style={[styles.hero, getCardStyle(card1Anim)]}>
          <View style={styles.heroIconWrap}>
            <Ionicons name={icons.tabStyleOutline} size={48} color={colors.gold} />
          </View>
          <Text style={styles.heroTitle}>Your Style Profile</Text>
          <Text style={styles.heroSubtitle}>
            Get AI-powered haircut recommendations personalized to you
          </Text>
        </Animated.View>

        {renderOptionCard(
          card1Anim,
          1,
          icons.camera,
          'Analyze My Hair',
          'Take a selfie-style photo for AI analysis',
          openCameraFlow,
        )}

        {renderOptionCard(
          card2Anim,
          2,
          icons.image,
          'Upload Photo',
          'Choose an existing photo from your library',
          openLibrary,
        )}

        {renderOptionCard(
          card3Anim,
          3,
          icons.chatOutline,
          'Chat with AI Stylist',
          savedAnalysis
            ? 'Continue with your saved profile or explore new ideas'
            : 'Ask questions and get personalized advice',
          openChat,
        )}

        {savedRecs.length > 0 ? (
          <Animated.View style={[styles.savedSection, getCardStyle(savedSectionAnim)]}>
            <Text style={styles.savedSectionLabel}>Your Recommendations</Text>
            {savedPhotosLoading ? (
              <Text style={styles.savedLoading}>Loading photos...</Text>
            ) : null}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.savedRow}
            >
              {savedRecs.map((rec) => {
                const uri = savedPhotos[rec.style_name];
                const ph = !uri || isStylePhotoPlaceholderUrl(uri);
                return (
                  <TouchableOpacity
                    key={`${rec.rank}-${rec.style_name}`}
                    style={styles.savedCard}
                    onPress={openSavedStyleResults}
                    activeOpacity={0.9}
                    accessibilityRole="button"
                    accessibilityLabel={`View saved style ${rec.style_name}`}
                  >
                    {uri ? (
                      <Image source={{ uri }} style={[styles.savedThumb, ph && styles.savedThumbMuted]} />
                    ) : (
                      <View style={styles.savedThumbPlaceholder} />
                    )}
                    <Text style={styles.savedCardTitle} numberOfLines={2}>
                      {rec.style_name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>
        ) : null}
      </ScrollView>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <View style={styles.errorActions}>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => setError(null)}
              accessibilityRole="button"
              accessibilityLabel="Dismiss error"
            >
              <Text style={styles.retryBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Loading Overlay */}
      <Modal visible={analyzing} transparent animationType="fade">
        <View style={styles.overlay}>
          <Animated.View style={[styles.spinnerWrap, { transform: [{ rotate: spinInterpolate }] }]}>
            <View style={styles.spinnerRing} />
          </Animated.View>
          <Text style={styles.overlayTitle}>Analyzing your features...</Text>
          <Text style={styles.overlayHint}>This takes about 10 seconds</Text>
        </View>
      </Modal>

      {/* Camera Modal - Native Only */}
      <Modal visible={showCamera} animationType="slide" onRequestClose={closeCamera}>
        <View style={[styles.cameraRoot, { paddingTop: insets.top }]}>
          <View style={styles.cameraHeader}>
            <TouchableOpacity onPress={closeCamera} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Close camera">
              <Ionicons name={icons.close} size={26} color={colors.white} />
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>Take a Photo</Text>
            <TouchableOpacity onPress={flipCamera} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Flip camera">
              <Ionicons name="camera-reverse-outline" size={26} color={colors.white} />
            </TouchableOpacity>
          </View>
          <CameraView
            ref={cameraRef}
            style={styles.cameraPreview}
            facing={cameraFacing}
            onCameraReady={() => setCameraReady(true)}
          />
          <View style={[styles.cameraFooter, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={[styles.shutter, !cameraReady && styles.shutterDisabled]}
              onPress={captureFromCamera}
              disabled={!cameraReady}
              accessibilityRole="button"
              accessibilityLabel="Capture photo"
            />
          </View>
        </View>
      </Modal>

      {/* Preview Modal */}
      <Modal visible={showPreview} animationType="fade" transparent onRequestClose={closePreview}>
        <View style={styles.previewOverlay}>
          <View style={[styles.previewHeader, { paddingTop: insets.top }]}>
            <TouchableOpacity onPress={closePreview} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Close preview">
              <Ionicons name={icons.close} size={26} color={colors.white} />
            </TouchableOpacity>
            <Text style={styles.previewTitle}>Preview</Text>
            <View style={styles.iconBtn} />
          </View>

          {capturedPhotoUri && (
            <Image source={{ uri: capturedPhotoUri }} style={styles.previewImage} resizeMode="cover" />
          )}

          <View style={[styles.previewFooter, { paddingBottom: insets.bottom + 24 }]}>
            <TouchableOpacity
              style={styles.tryAgainBtn}
              onPress={tryAgain}
              accessibilityRole="button"
              accessibilityLabel="Try again"
            >
              <Text style={styles.tryAgainBtnText}>Try again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.usePhotoBtn}
              onPress={useThisPhoto}
              accessibilityRole="button"
              accessibilityLabel="Use this photo"
            >
              <Text style={styles.usePhotoBtnText}>Use this photo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  scrollContent: { paddingTop: spacing.sm },
  hero: { alignItems: 'center', marginBottom: spacing.xl, paddingHorizontal: spacing.sm },
  heroIconWrap: {
    width: 96,
    height: 96,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  heroTitle: {
    fontSize: fonts.size['3xl'],
    fontFamily: fonts.heading,
    color: colors.white,
    textAlign: 'center',
    letterSpacing: fonts.letterSpacing.wide,
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    fontSize: fonts.size.md,
    fontFamily: fonts.body,
    color: colors.grey,
    textAlign: 'center',
    lineHeight: fonts.lineHeight.relaxed * fonts.size.md,
    maxWidth: 320,
  },

  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  optionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  optionTextCol: { flex: 1, minWidth: 0 },
  optionTitle: {
    fontSize: fonts.size.lg,
    fontFamily: fonts.bodyBold,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  optionHint: {
    fontSize: fonts.size.sm,
    fontFamily: fonts.body,
    color: colors.grey,
    lineHeight: fonts.lineHeight.normal * fonts.size.sm,
  },

  savedSection: { marginTop: spacing['2xl'] },
  savedSectionLabel: {
    fontSize: fonts.size.xs,
    color: colors.gold,
    fontFamily: fonts.bodyBold,
    letterSpacing: fonts.letterSpacing.wider,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
  },
  savedLoading: { fontSize: fonts.size.sm, color: colors.grey, marginBottom: spacing.sm },
  savedRow: { gap: spacing.md, paddingRight: spacing.sm },
  savedCard: {
    width: 112,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    paddingBottom: spacing.sm,
    ...shadows.sm,
  },
  savedThumb: { width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.background },
  savedThumbMuted: { opacity: 0.45 },
  savedThumbPlaceholder: { width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.surfaceRaised },
  savedCardTitle: {
    fontSize: fonts.size.xs,
    fontFamily: fonts.bodyBold,
    color: colors.white,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.sm,
    lineHeight: fonts.lineHeight.tight * fonts.size.xs,
  },

  errorBox: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 24,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.red,
    ...shadows.md,
  },
  errorText: { color: colors.red, fontSize: fonts.size.md, marginBottom: spacing.sm },
  errorActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  retryBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  retryBtnText: { color: colors.gold, fontFamily: fonts.bodyBold, fontSize: fonts.size.md },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  spinnerWrap: { width: 56, height: 56, justifyContent: 'center', alignItems: 'center' },
  spinnerRing: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: colors.gold,
  },
  overlayTitle: {
    marginTop: spacing.lg,
    fontSize: fonts.size.xl,
    fontFamily: fonts.bodyBold,
    color: colors.white,
    textAlign: 'center',
  },
  overlayHint: { marginTop: spacing.sm, fontSize: fonts.size.sm, color: colors.grey, textAlign: 'center' },

  cameraRoot: { flex: 1, backgroundColor: colors.background },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  cameraTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: fonts.size.lg,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  cameraPreview: { flex: 1 },
  cameraFooter: { alignItems: 'center', paddingTop: spacing.md, backgroundColor: colors.background },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    borderWidth: 4,
    borderColor: colors.gold,
    backgroundColor: colors.surfaceRaised,
  },
  shutterDisabled: { opacity: 0.4 },

  previewOverlay: {
    flex: 1,
    backgroundColor: colors.background,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  previewTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: fonts.size.lg,
    fontFamily: fonts.bodyBold,
    color: colors.white,
  },
  previewImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  previewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tryAgainBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: 'transparent',
    minWidth: 140,
    alignItems: 'center',
  },
  tryAgainBtnText: {
    color: colors.gold,
    fontFamily: fonts.bodySemiBold,
    fontSize: fonts.size.md,
  },
  usePhotoBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius['2xl'],
    backgroundColor: colors.gold,
    minWidth: 140,
    alignItems: 'center',
  },
  usePhotoBtnText: {
    color: colors.background,
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.md,
  },
});
