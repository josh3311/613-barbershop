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

export default function StyleDocumentScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const { bookingId, clientId, clientName, barberId, barberName, serviceName } = route.params;

  const [imageUri,    setImageUri]    = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [saving,      setSaving]      = useState(false);

  // ── Pick from gallery ──────────────────────────────────
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to document this style.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 5],
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  // ── Take photo ─────────────────────────────────────────
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to photograph the style.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 5],
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  // ── Upload photo to Firebase Storage ──────────────────
  const uploadPhoto = async (uri: string): Promise<string> => {
    const response   = await fetch(uri);
    const blob       = await response.blob();
    const storageRef = ref(storage, `styleCards/${bookingId}_${Date.now()}.jpg`);
    await uploadBytes(storageRef, blob);
    return getDownloadURL(storageRef);
  };

  // ── Save style card ────────────────────────────────────
  const saveCard = async () => {
    if (!imageUri) {
      Alert.alert('Photo required', 'Please add a photo of the finished style.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Description required', 'Please describe the style you did.');
      return;
    }

    setSaving(true);
    try {
      const photoURL = await uploadPhoto(imageUri);

      // Create style card document
      const cardRef = await addDoc(collection(db, STYLE_CARDS), {
        bookingId,
        clientId,
        clientName,
        barberId,
        barberName,
        serviceName,
        photoURL,
        barberNotes: description.trim(),
        aiGuide:     null,
        createdAt:   serverTimestamp(),
      });

      // Link style card back to the booking
      await updateDoc(doc(db, 'bookings', bookingId), {
        styleCardId: cardRef.id,
      });

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

  const canSave = !!imageUri && description.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {/* ── Header ── */}
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
                <TouchableOpacity style={styles.changeBtn} onPress={takePhoto}>
                  <Ionicons name="camera-outline" size={16} color={theme.colors.gold} />
                  <Text style={styles.changeBtnText}>RETAKE</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.changeBtn} onPress={pickImage}>
                  <Ionicons name="images-outline" size={16} color={theme.colors.gold} />
                  <Text style={styles.changeBtnText}>CHANGE</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="camera-outline" size={44} color={theme.colors.textMuted} />
              <Text style={styles.photoPlaceholderText}>
                Take or upload a photo of the completed style
              </Text>
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

        {/* ── Style description ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DESCRIBE THIS STYLE</Text>
          <Text style={styles.sectionHint}>
            Describe what you did so any barber can recreate it exactly.
          </Text>
          <TextInput
            style={styles.descriptionInput}
            placeholder="e.g. Low skin fade, 1.5 guard on top, sharp lineup, textured finish with pomade..."
            placeholderTextColor={theme.colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{description.length}/500</Text>
        </View>

        {/* ── Save button ── */}
        <TouchableOpacity
          style={[styles.saveBtn, (!canSave || saving) && styles.saveBtnDisabled]}
          onPress={saveCard}
          disabled={!canSave || saving}
        >
          {saving
            ? <ActivityIndicator size="small" color={theme.colors.textInverse} />
            : <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.textInverse} />
          }
          <Text style={styles.saveBtnText}>
            {saving ? 'SAVING...' : 'SAVE STYLE CARD'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.skipBtnText}>Skip for now</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },

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
  headerTitle: {
    fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.xl,
    color: theme.colors.gold, letterSpacing: 4,
  },
  headerSub: {
    fontFamily: theme.fonts.body, fontSize: theme.fontSizes.xs,
    color: theme.colors.textSecondary, marginTop: 2,
  },

  scroll: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl, gap: theme.spacing.xl },

  section:      { gap: theme.spacing.sm },
  sectionTitle: {
    fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.xs,
    color: theme.colors.gold, letterSpacing: 3,
  },
  sectionHint: {
    fontFamily: theme.fonts.body, fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted, marginTop: -2,
  },

  // ── Photo ──────────────────────────────────────────────
  photoPlaceholder: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.border, borderStyle: 'dashed',
    padding: theme.spacing.xxl, alignItems: 'center', gap: theme.spacing.md,
  },
  photoPlaceholderText: {
    fontFamily: theme.fonts.body, fontSize: theme.fontSizes.sm,
    color: theme.colors.textMuted, textAlign: 'center',
  },
  photoPickBtns: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.sm },
  photoPickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs,
    backgroundColor: theme.colors.goldMuted, borderWidth: 1, borderColor: theme.colors.gold,
    borderRadius: theme.radius.md, paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md,
  },
  photoPickBtnText: {
    fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.xs,
    color: theme.colors.gold, letterSpacing: 1,
  },
  preview: {
    width: '100%', height: 300, borderRadius: theme.radius.lg,
    borderWidth: 1.5, borderColor: theme.colors.gold,
  },
  photoActions: {
    flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm,
  },
  changeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: theme.spacing.xs, borderWidth: 1, borderColor: theme.colors.gold,
    borderRadius: theme.radius.md, padding: theme.spacing.sm,
  },
  changeBtnText: {
    fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.xs,
    color: theme.colors.gold, letterSpacing: 1,
  },

  // ── Description ────────────────────────────────────────
  descriptionInput: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.md,
    color: '#FFFFFF', fontFamily: theme.fonts.body, fontSize: theme.fontSizes.sm,
    minHeight: 140, textAlignVertical: 'top',
  },
  charCount: {
    fontFamily: theme.fonts.body, fontSize: 11,
    color: theme.colors.textMuted, textAlign: 'right',
  },

  // ── Buttons ────────────────────────────────────────────
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: theme.spacing.sm, backgroundColor: theme.colors.gold,
    borderRadius: theme.radius.lg, padding: theme.spacing.md, ...theme.shadows.gold,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: {
    fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.md,
    color: theme.colors.textInverse, letterSpacing: 2,
  },
  skipBtn:    { alignItems: 'center', padding: theme.spacing.md },
  skipBtnText:{ fontFamily: theme.fonts.body, fontSize: theme.fontSizes.sm, color: theme.colors.textMuted },
});