import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Easing,
  Platform,
  Pressable,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { StyleStackParamList } from '@/navigation/types';
import { AIService } from '@/services/ai.service';
import { readImageAsBase64, inferImageMediaType } from '@/utils/imageBase64.utils';

const C = {
  bg:         '#0A0A0A',
  card:       '#161616',
  gold:       '#D4AF37',
  goldBorder: '#D4AF3740',
  white:      '#FFFFFF',
  sub:        '#888888',
  muted:      '#555555',
  border:     '#222222',
  danger:     '#CF6679',
} as const;

type Props = NativeStackScreenProps<StyleStackParamList, 'StyleOnboarding'>;

export default function StyleOnboardingScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const spin = useRef(new Animated.Value(0)).current;

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
        setAnalyzing(false);
        navigation.replace('StyleResults', { analysis: result, readOnly: false });
      } catch (e) {
        setAnalyzing(false);
        setError(e instanceof Error ? e.message : 'Something went wrong');
      }
    },
    [navigation],
  );

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

      <Text style={styles.subtitle}>Let AI find styles that actually suit you</Text>

      <View style={styles.cardRow}>
        <TouchableOpacity
          style={[styles.pickCard, styles.pickCardGold]}
          onPress={openCameraFlow}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Take photo"
        >
          <View style={styles.pickIconWrap}>
            <Ionicons name="camera-outline" size={36} color={C.gold} />
          </View>
          <Text style={styles.pickTitle}>Take Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pickCard, styles.pickCardDark]}
          onPress={openLibrary}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Upload from library"
        >
          <View style={[styles.pickIconWrap, styles.pickIconDark]}>
            <Ionicons name="images-outline" size={36} color={C.sub} />
          </View>
          <Text style={styles.pickTitle}>Upload from Library</Text>
        </TouchableOpacity>
      </View>

      <Pressable onPress={() => navigation.goBack()} style={styles.skipWrap}>
        <Text style={styles.skipText}>Skip for now</Text>
      </Pressable>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <View style={styles.errorActions}>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => setError(null)}
              accessibilityRole="button"
              accessibilityLabel="Try again"
            >
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={() => setError(null)}
              accessibilityRole="button"
              accessibilityLabel="Dismiss error"
            >
              <Text style={styles.dismissBtnText}>Dismiss</Text>
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
            <TouchableOpacity onPress={() => setShowCamera(false)} style={styles.backBtn}>
              <Ionicons name="close" size={26} color={C.white} />
            </TouchableOpacity>
            <Text style={styles.cameraTitle}>Take Photo</Text>
            <View style={styles.headerSpacer} />
          </View>
          <CameraView
            ref={cameraRef}
            style={styles.cameraPreview}
            facing="back"
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
  root:         { flex: 1, backgroundColor: C.bg, paddingHorizontal: 20 },
  headerRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backBtn:      { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 44 },
  headerTitle:  { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: C.white, letterSpacing: 0.3 },
  subtitle:     { fontSize: 14, color: C.sub, textAlign: 'center', marginBottom: 28, lineHeight: 20 },

  cardRow:      { flexDirection: 'row', gap: 12 },
  pickCard:     { flex: 1, borderRadius: 16, paddingVertical: 28, paddingHorizontal: 12, alignItems: 'center', minHeight: 160 },
  pickCardGold: { backgroundColor: C.card, borderWidth: 2, borderColor: C.gold },
  pickCardDark: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  pickIconWrap: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#1A1A1A',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  pickIconDark: { backgroundColor: '#141414' },
  pickTitle:    { fontSize: 15, fontWeight: '700', color: C.white, textAlign: 'center' },

  skipWrap:     { marginTop: 28, alignItems: 'center' },
  skipText:     { fontSize: 14, color: C.sub, fontWeight: '600' },

  errorBox:     { marginTop: 24, padding: 14, borderRadius: 12, backgroundColor: '#1A1010', borderWidth: 1, borderColor: '#CF667944' },
  errorText:    { color: C.danger, fontSize: 13, marginBottom: 10 },
  errorActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  retryBtn:     { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: C.gold },
  retryBtnText: { color: C.gold, fontWeight: '700', fontSize: 13 },
  dismissBtn:   { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: C.danger },
  dismissBtnText: { color: C.danger, fontWeight: '700', fontSize: 13 },

  overlay: {
    flex: 1, backgroundColor: '#000000DD', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  spinnerWrap:  { width: 56, height: 56, justifyContent: 'center', alignItems: 'center' },
  spinnerRing: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 3, borderColor: 'transparent', borderTopColor: C.gold,
  },
  overlayTitle: { marginTop: 20, fontSize: 17, fontWeight: '800', color: C.white, textAlign: 'center' },
  overlayHint:  { marginTop: 8, fontSize: 12, color: C.muted, textAlign: 'center' },

  cameraRoot:   { flex: 1, backgroundColor: C.bg },
  cameraHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  cameraTitle:  { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: C.white },
  cameraPreview:{ flex: 1 },
  cameraFooter: { alignItems: 'center', paddingTop: 16, backgroundColor: C.bg },
  shutter:      { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: C.gold, backgroundColor: '#2A2A2A' },
  shutterDisabled: { opacity: 0.4 },
});
