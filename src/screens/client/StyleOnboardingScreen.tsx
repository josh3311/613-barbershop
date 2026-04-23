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
import { CameraView, useCameraPermissions } from 'expo-camera';
import { doc, onSnapshot } from 'firebase/firestore';
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

const C = {
  bg: '#0A0A0A',
  card: '#161616',
  gold: '#D4AF37',
  goldBorder: '#D4AF3740',
  white: '#FFFFFF',
  sub: '#888888',
  muted: '#555555',
  border: '#222222',
  danger: '#CF6679',
} as const;

type Props = NativeStackScreenProps<StyleStackParamList, 'StyleOnboarding'>;

export default function StyleOnboardingScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { firebaseUser } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAnalysis, setSavedAnalysis] = useState<ProfileAnalysisResult | null>(null);
  const [savedPhotos, setSavedPhotos] = useState<Record<string, string>>({});
  const [savedPhotosLoading, setSavedPhotosLoading] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;

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

  const runAnalysis = useCallback(
    async (uri: string, mime?: string | null): Promise<void> => {
      setError(null);
      setAnalyzing(true);
      try {
        const base64 = await readImageAsBase64(uri);
        const mediaType = inferImageMediaType(uri, mime);
        const result = await AIService.analyzeProfileFromBase64(base64, mediaType);
        const selfieDataUrl = `data:${mediaType};base64,${base64}`;
        setAnalyzing(false);
        navigation.replace('StyleResults', {
          analysis: result,
          readOnly: false,
          selfieUri: uri,
          selfieDataUrl,
        });
      } catch (e) {
        setAnalyzing(false);
        setError(e instanceof Error ? e.message : 'Something went wrong');
      }
    },
    [navigation],
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
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo library access is required to upload a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    await runAnalysis(asset.uri, asset.mimeType);
  }

  async function openCameraFlow(): Promise<void> {
    setError(null);
    if (Platform.OS === 'web') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setError('Camera access is required to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.85,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      await runAnalysis(asset.uri, asset.mimeType);
      return;
    }

    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        setError('Camera access is required to take a photo.');
        return;
      }
    }
    setCameraReady(false);
    setShowCamera(true);
  }

  async function captureFromCamera(): Promise<void> {
    if (!cameraRef.current || !cameraReady) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      setShowCamera(false);
      await runAnalysis(photo.uri, 'image/jpeg');
    } catch {
      setError('Could not capture photo. Try again.');
      setShowCamera(false);
    }
  }

  function openSavedStyleResults(): void {
    if (!savedAnalysis) return;
    navigation.navigate('StyleResults', { analysis: savedAnalysis, readOnly: true });
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
      >
        <View style={styles.hero}>
          <Ionicons name="cut-outline" size={64} color={C.gold} style={styles.heroIcon} />
          <Text style={styles.heroTitle}>Your Style Profile</Text>
          <Text style={styles.heroSubtitle}>
            Get AI-powered haircut recommendations personalized to you
          </Text>
        </View>

        <TouchableOpacity
          style={styles.optionCard}
          onPress={openCameraFlow}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Analyze my hair with the camera"
        >
          <View style={styles.optionIconWrap}>
            <Ionicons name="camera-outline" size={32} color={C.gold} />
          </View>
          <View style={styles.optionTextCol}>
            <Text style={styles.optionTitle}>Analyze My Hair</Text>
            <Text style={styles.optionHint}>Take a selfie-style photo for AI analysis</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={C.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.optionCard}
          onPress={openLibrary}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Upload photo from gallery for analysis"
        >
          <View style={styles.optionIconWrap}>
            <Ionicons name="images-outline" size={32} color={C.gold} />
          </View>
          <View style={styles.optionTextCol}>
            <Text style={styles.optionTitle}>Upload Photo</Text>
            <Text style={styles.optionHint}>Choose an existing photo from your library</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={C.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.optionCard}
          onPress={openChat}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Chat with AI stylist"
        >
          <View style={styles.optionIconWrap}>
            <Ionicons name="chatbubbles-outline" size={30} color={C.gold} />
          </View>
          <View style={styles.optionTextCol}>
            <Text style={styles.optionTitle}>Chat with AI Stylist</Text>
            <Text style={styles.optionHint}>
              {savedAnalysis
                ? 'Continue with your saved profile or explore new ideas'
                : 'Ask questions and get personalized advice'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={C.muted} />
        </TouchableOpacity>

        {savedRecs.length > 0 ? (
          <View style={styles.savedSection}>
            <Text style={styles.savedSectionLabel}>Your Recommendations</Text>
            {savedPhotosLoading ? (
              <Text style={styles.savedLoading}>Loading photos…</Text>
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
          </View>
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

      <Modal visible={analyzing} transparent animationType="fade">
        <View style={styles.overlay}>
          <Animated.View style={[styles.spinnerWrap, { transform: [{ rotate: spinInterpolate }] }]}>
            <View style={styles.spinnerRing} />
          </Animated.View>
          <Text style={styles.overlayTitle}>Analyzing your features...</Text>
          <Text style={styles.overlayHint}>This takes about 10 seconds</Text>
        </View>
      </Modal>

      <Modal visible={showCamera} animationType="slide" onRequestClose={() => setShowCamera(false)}>
        <View style={[styles.cameraRoot, { paddingTop: insets.top }]}>
          <View style={styles.cameraHeader}>
            <TouchableOpacity onPress={() => setShowCamera(false)} style={styles.iconBtn}>
              <Ionicons name="close" size={26} color={C.white} />
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>Take a Photo</Text>
            <View style={styles.headerSpacer} />
          </View>
          <CameraView
            ref={cameraRef}
            style={styles.cameraPreview}
            facing="front"
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 20 },
  scrollContent: { paddingTop: 8 },
  hero: { alignItems: 'center', marginBottom: 28, paddingHorizontal: 8 },
  heroIcon: { marginBottom: 16 },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: C.white,
    textAlign: 'center',
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  heroSubtitle: {
    fontSize: 14,
    color: C.sub,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 320,
  },

  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.goldBorder,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  optionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: C.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionTextCol: { flex: 1, minWidth: 0 },
  optionTitle: { fontSize: 16, fontWeight: '800', color: C.white, marginBottom: 4 },
  optionHint: { fontSize: 12, color: C.sub, lineHeight: 17 },

  savedSection: { marginTop: 28 },
  savedSectionLabel: {
    fontSize: 11,
    color: C.gold,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 12,
  },
  savedLoading: { fontSize: 12, color: C.sub, marginBottom: 8 },
  savedRow: { gap: 12, paddingRight: 8 },
  savedCard: {
    width: 112,
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    paddingBottom: 8,
  },
  savedThumb: { width: '100%', aspectRatio: 3 / 4, backgroundColor: C.bg },
  savedThumbMuted: { opacity: 0.45 },
  savedThumbPlaceholder: { width: '100%', aspectRatio: 3 / 4, backgroundColor: '#141414' },
  savedCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: C.white,
    paddingHorizontal: 8,
    marginTop: 8,
    lineHeight: 14,
  },

  errorBox: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#1A1010',
    borderWidth: 1,
    borderColor: '#CF667944',
  },
  errorText: { color: C.danger, fontSize: 13, marginBottom: 10 },
  errorActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  retryBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: C.gold },
  retryBtnText: { color: C.gold, fontWeight: '700', fontSize: 13 },

  overlay: {
    flex: 1,
    backgroundColor: '#000000DD',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  spinnerWrap: { width: 56, height: 56, justifyContent: 'center', alignItems: 'center' },
  spinnerRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: C.gold,
  },
  overlayTitle: { marginTop: 20, fontSize: 17, fontWeight: '800', color: C.white, textAlign: 'center' },
  overlayHint: { marginTop: 8, fontSize: 12, color: C.muted, textAlign: 'center' },

  cameraRoot: { flex: 1, backgroundColor: C.bg },
  cameraHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 44 },
  cameraTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: C.white },
  cameraPreview: { flex: 1 },
  cameraFooter: { alignItems: 'center', paddingTop: 16, backgroundColor: C.bg },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: C.gold,
    backgroundColor: '#2A2A2A',
  },
  shutterDisabled: { opacity: 0.4 },
});
