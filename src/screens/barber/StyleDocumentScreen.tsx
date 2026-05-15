import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, Image,
  ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp }          from '@react-navigation/native-stack';
import { Ionicons }       from '@expo/vector-icons';
import * as ImagePicker   from 'expo-image-picker';
import * as FileSystem    from 'expo-file-system/legacy';
import Markdown           from 'react-native-markdown-display';
import {
  collection, addDoc, updateDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage }    from '../../config/firebase';
import { BarberStackParams } from '../../navigation/types';
import { theme }          from '../../theme';

type Nav   = NativeStackNavigationProp<BarberStackParams, 'StyleDocument'>;
type Route = RouteProp<BarberStackParams, 'StyleDocument'>;

const STYLE_CARDS = 'styleCards';

const ANALYSIS_PROMPT =
  'You are an expert barber trainer. Analyze this finished haircut photo and provide ' +
  'a clear reproduction guide another barber can follow. Include:\n' +
  '1) Style name & overall description\n' +
  '2) Key features (fade level, top length, texture, shape)\n' +
  '3) Step-by-step recreation guide\n' +
  '4) Recommended products\n' +
  '5) Maintenance tips for the client\n\n' +
  'Keep it practical, under 300 words, and written for a professional barber.';

export default function StyleDocumentScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const { bookingId, clientId, clientName, barberId, barberName, serviceName } = route.params;

  const [imageUri,   setImageUri]   = useState<string | null>(null);
  const [aiGuide,    setAiGuide]    = useState('');
  const [notes,      setNotes]      = useState('');
  const [analyzing,  setAnalyzing]  = useState(false);
  const [saving,     setSaving]     = useState(false);

  // ── Pick from gallery ───────────────────────────────────
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to document this style.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8, allowsEditing: true, aspect: [4, 5],
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setAiGuide('');
    }
  };

  // ── Take photo ──────────────────────────────────────────
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to photograph the style.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8, allowsEditing: true, aspect: [4, 5],
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setAiGuide('');
    }
  };

  // ── Analyze with Claude vision ──────────────────────────
  const analyzePhoto = async () => {
    if (!imageUri) return;
    const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
    if (!apiKey) { Alert.alert('Error', 'API key not configured.'); return; }

    setAnalyzing(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: 'base64',
      });

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
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
              { type: 'text',  text: ANALYSIS_PROMPT },
            ],
          }],
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.content?.[0]?.text) {
        Alert.alert('Error', 'Could not analyze photo. Please try again.');
        return;
      }
      setAiGuide(data.content[0].text as string);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('analyzePhoto error:', msg);
      Alert.alert('Analysis Failed', msg || 'Please check your connection and try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Upload photo to Firebase Storage ───────────────────
  const uploadPhoto = async (uri: string): Promise<string> => {
    const response    = await fetch(uri);
    const blob        = await response.blob();
    const storageRef  = ref(storage, `styleCards/${bookingId}_${Date.now()}.jpg`);
    await uploadBytes(storageRef, blob);
    return getDownloadURL(storageRef);
  };

  // ── Save style card ─────────────────────────────────────
  const saveCard = async () => {
    if (!imageUri || !aiGuide) {
      Alert.alert('Not ready', 'Please add a photo and run the AI analysis first.');
      return;
    }
    setSaving(true);
    try {
      const photoURL = await uploadPhoto(imageUri);
      const cardRef  = await addDoc(collection(db, STYLE_CARDS), {
        bookingId, clientId, clientName, barberId, barberName, serviceName,
        photoURL,
        aiGuide,
        barberNotes: notes.trim() || null,
        createdAt:   serverTimestamp(),
      });
      await updateDoc(doc(db, 'bookings', bookingId), { styleCardId: cardRef.id });
      Alert.alert(
        'Style Documented',
        `${clientName} can now view this style card in their booking history.`,
        [{ text: 'Done', onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      console.error('Save style card failed:', e);
      Alert.alert('Error', 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.gold} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>DOCUMENT STYLE</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {clientName} · {serviceName}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Photo section ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FINISHED STYLE PHOTO</Text>

          {imageUri ? (
            <View>
              <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
              <View style={styles.photoActions}>
                <TouchableOpacity style={styles.rePhotoBtn} onPress={pickImage}>
                  <Ionicons name="images-outline" size={16} color={theme.colors.gold} />
                  <Text style={styles.rePhotoBtnText}>CHANGE</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.analyzeBtn, analyzing && styles.analyzeBtnDisabled]}
                  onPress={analyzePhoto}
                  disabled={analyzing}
                >
                  {analyzing
                    ? <ActivityIndicator size="small" color={theme.colors.textInverse} />
                    : <Ionicons name="sparkles-outline" size={16} color={theme.colors.textInverse} />
                  }
                  <Text style={styles.analyzeBtnText}>
                    {analyzing ? 'ANALYZING...' : aiGuide ? 'RE-ANALYZE' : 'ANALYZE WITH AI'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="camera-outline" size={40} color={theme.colors.textMuted} />
              <Text style={styles.photoPlaceholderText}>Add a photo of the finished style</Text>
              <View style={styles.photoPickBtns}>
                <TouchableOpacity style={styles.photoPickBtn} onPress={takePhoto}>
                  <Ionicons name="camera-outline" size={18} color={theme.colors.gold} />
                  <Text style={styles.photoPickBtnText}>TAKE PHOTO</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoPickBtn} onPress={pickImage}>
                  <Ionicons name="images-outline" size={18} color={theme.colors.gold} />
                  <Text style={styles.photoPickBtnText}>GALLERY</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ── AI Guide — rendered with Markdown ── */}
        {aiGuide ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AI GUIDE</Text>
            <View style={styles.guideCard}>
              <Ionicons name="sparkles" size={16} color={theme.colors.gold} style={{ marginBottom: 8 }} />
              <Markdown style={markdownStyles}>
                {aiGuide}
              </Markdown>
            </View>
          </View>
        ) : null}

        {/* ── Barber notes — white text in style (not as prop) ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>YOUR NOTES (OPTIONAL)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Add personal tips, product names, guard sizes used..."
            placeholderTextColor={theme.colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={400}
          />
        </View>

        {/* ── Save button ── */}
        <TouchableOpacity
          style={[styles.saveBtn, (!imageUri || !aiGuide || saving) && styles.saveBtnDisabled]}
          onPress={saveCard}
          disabled={!imageUri || !aiGuide || saving}
        >
          {saving
            ? <ActivityIndicator size="small" color={theme.colors.textInverse} />
            : <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.textInverse} />
          }
          <Text style={styles.saveBtnText}>{saving ? 'SAVING...' : 'SAVE STYLE CARD'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.skipBtnText}>Skip for now</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Markdown styles ───────────────────────────────────────
const markdownStyles = {
  body:     { color: theme.colors.textPrimary, fontFamily: theme.fonts.body, fontSize: theme.fontSizes.sm },
  heading1: { color: theme.colors.gold, fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.lg, letterSpacing: 2, marginBottom: 8 },
  heading2: { color: theme.colors.gold, fontFamily: theme.fonts.bold, fontSize: theme.fontSizes.md, marginBottom: 4, marginTop: 12 },
  strong:   { color: theme.colors.gold, fontFamily: theme.fonts.bold },
  bullet_list: { color: theme.colors.textPrimary },
  paragraph: { marginBottom: 8, lineHeight: 22 } as object,
};

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
    padding: theme.spacing.lg, paddingTop: theme.spacing.xxl,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.goldMuted, borderWidth: 1, borderColor: theme.colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.xl, color: theme.colors.gold, letterSpacing: 4 },
  headerSub:   { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.xs, color: theme.colors.textSecondary, marginTop: 2 },
  scroll:      { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl, gap: theme.spacing.lg },
  section:     { gap: theme.spacing.sm },
  sectionTitle:{ fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.xs, color: theme.colors.gold, letterSpacing: 3 },
  photoPlaceholder: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.border, borderStyle: 'dashed',
    padding: theme.spacing.xl, alignItems: 'center', gap: theme.spacing.md,
  },
  photoPlaceholderText: { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.sm, color: theme.colors.textMuted },
  photoPickBtns: { flexDirection: 'row', gap: theme.spacing.md },
  photoPickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs,
    backgroundColor: theme.colors.goldMuted, borderWidth: 1, borderColor: theme.colors.gold,
    borderRadius: theme.radius.md, paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md,
  },
  photoPickBtnText: { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.xs, color: theme.colors.gold, letterSpacing: 1 },
  preview:     { width: '100%', height: 280, borderRadius: theme.radius.lg },
  photoActions:{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  rePhotoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: theme.spacing.xs, borderWidth: 1, borderColor: theme.colors.gold,
    borderRadius: theme.radius.md, padding: theme.spacing.sm,
  },
  rePhotoBtnText: { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.xs, color: theme.colors.gold, letterSpacing: 1 },
  analyzeBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: theme.spacing.xs, backgroundColor: theme.colors.gold,
    borderRadius: theme.radius.md, padding: theme.spacing.sm, ...theme.shadows.gold,
  },
  analyzeBtnDisabled: { opacity: 0.5 },
  analyzeBtnText:     { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.xs, color: theme.colors.textInverse, letterSpacing: 1 },
  guideCard: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.gold, padding: theme.spacing.lg, ...theme.shadows.gold,
  },
  notesInput: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.md,
    // color in style — NOT as a prop (fixes invisible text on dark bg)
    color: '#FFFFFF',
    fontFamily: theme.fonts.body, fontSize: theme.fontSizes.sm,
    minHeight: 100, textAlignVertical: 'top',
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: theme.spacing.sm, backgroundColor: theme.colors.gold,
    borderRadius: theme.radius.lg, padding: theme.spacing.md, ...theme.shadows.gold,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText:     { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.md, color: theme.colors.textInverse, letterSpacing: 2 },
  skipBtn:         { alignItems: 'center', padding: theme.spacing.md },
  skipBtnText:     { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.sm, color: theme.colors.textMuted },
});