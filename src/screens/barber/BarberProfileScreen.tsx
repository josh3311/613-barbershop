/**
 * BarberProfileScreen.tsx
 *
 * Redesigned profile screen with:
 * - Modern card-based layout
 * - React Native Animated API animations
 * - Improved UX for working hours
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Text, Snackbar, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import {
  colors,
  fonts,
  spacing,
  radius,
  shadows,
  icons,
} from '@/theme';
import { db } from '@/config/firebase';
import { COLLECTIONS } from '@/constants/collections';
import { AuthService } from '@/services/auth.service';
import { BarberService } from '@/services/barber.service';
import { StorageService } from '@/services/storage.service';
import { UserService } from '@/services/user.service';
import { useAuth } from '@/hooks/useAuth';
import { Barber } from '@/types/barber.types';
import { DayOfWeek, WorkingHours, DaySchedule } from '@/types/common.types';

// ─── Theme Constants ──────────────────────────────────────────────────────────

const C = {
  bg: colors.background,
  surface: colors.surface,
  surfaceRaised: colors.surfaceRaised,
  border: colors.border,
  gold: colors.gold,
  red: colors.red,
  green: colors.green,
  white: colors.white,
  grey: colors.grey,
  greyDark: colors.greyDark,
  goldGlow: colors.goldGlow,
  danger: '#CF6679',
};

// ─── Day Order Configuration ──────────────────────────────────────────────────

const DAY_ORDER: { key: DayOfWeek; short: string; full: string }[] = [
  { key: 'monday', short: 'Mon', full: 'Monday' },
  { key: 'tuesday', short: 'Tue', full: 'Tuesday' },
  { key: 'wednesday', short: 'Wed', full: 'Wednesday' },
  { key: 'thursday', short: 'Thu', full: 'Thursday' },
  { key: 'friday', short: 'Fri', full: 'Friday' },
  { key: 'saturday', short: 'Sat', full: 'Saturday' },
  { key: 'sunday', short: 'Sun', full: 'Sunday' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function cloneWorkingHours(wh: WorkingHours): WorkingHours {
  return JSON.parse(JSON.stringify(wh)) as WorkingHours;
}

function parseSpecialties(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeTime(t: string): string {
  const s = t.trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return s;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BarberProfileScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { firebaseUser, appUser, refreshUser } = useAuth();
  const uid = firebaseUser?.uid ?? '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [barber, setBarber] = useState<Barber | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [pendingMimeType, setPendingMimeType] = useState<string | null>(null);
  const [specialtiesStr, setSpecialtiesStr] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [hours, setHours] = useState<WorkingHours | null>(null);

  const [loggingOut, setLoggingOut] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; err: boolean } | null>(null);

  // Animation values
  const headerFadeAnim = useRef(new Animated.Value(0)).current;
  const avatarFadeAnim = useRef(new Animated.Value(0)).current;
  const avatarSlideAnim = useRef(new Animated.Value(20)).current;
  const section1FadeAnim = useRef(new Animated.Value(0)).current;
  const section1SlideAnim = useRef(new Animated.Value(20)).current;
  const section2FadeAnim = useRef(new Animated.Value(0)).current;
  const section2SlideAnim = useRef(new Animated.Value(20)).current;
  const saveFadeAnim = useRef(new Animated.Value(0)).current;
  const saveSlideAnim = useRef(new Animated.Value(20)).current;
  const accountFadeAnim = useRef(new Animated.Value(0)).current;
  const accountSlideAnim = useRef(new Animated.Value(20)).current;
  const logoutFadeAnim = useRef(new Animated.Value(0)).current;
  const logoutSlideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Staggered entrance animations
    Animated.timing(headerFadeAnim, { toValue: 1, duration: 300, delay: 100, useNativeDriver: true }).start();
    
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(avatarFadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(avatarSlideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }, 200);

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(section1FadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(section1SlideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }, 300);

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(section2FadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(section2SlideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }, 400);

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(saveFadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(saveSlideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }, 500);

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(accountFadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(accountSlideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }, 600);

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(logoutFadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(logoutSlideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }, 700);
  }, []);

  const load = useCallback(
    async (opts?: { showFullScreenLoader?: boolean }): Promise<void> => {
      const showLoader = opts?.showFullScreenLoader !== false;
      if (!uid) {
        setLoading(false);
        return;
      }
      setLoadError(null);
      if (showLoader) setLoading(true);
      try {
        const res = await BarberService.getById(uid);
        if (!res.success || !res.data) {
          setLoadError(res.success ? 'Profile not found.' : res.error);
          setBarber(null);
          return;
        }
        const b = res.data;
        setBarber(b);
        setDisplayName(b.displayName);
        setBio(b.bio);
        setPhotoURL(b.photoURL ?? '');
        setPendingPhotoUri(null);
        setPendingMimeType(null);
        setSpecialtiesStr(b.specialties.join(', '));
        setIsAvailable(b.isAvailable);
        setHours(cloneWorkingHours(b.workingHours));
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [uid]
  );

  useEffect(() => {
    void load({ showFullScreenLoader: true });
  }, [load]);

  function updateDay(key: DayOfWeek, patch: Partial<DaySchedule>): void {
    setHours((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [key]: { ...prev[key], ...patch },
      };
    });
  }

  async function pickFromLibrary(): Promise<void> {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setSnack({ msg: 'Allow photo library access to choose a profile picture.', err: true });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPendingPhotoUri(asset.uri);
    setPendingMimeType(asset.mimeType ?? null);
  }

  async function takePhoto(): Promise<void> {
    if (Platform.OS === 'web') return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setSnack({ msg: 'Allow camera access to take a profile picture.', err: true });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPendingPhotoUri(asset.uri);
    setPendingMimeType(asset.mimeType ?? null);
  }

  function clearProfilePhoto(): void {
    setPendingPhotoUri(null);
    setPendingMimeType(null);
    setPhotoURL('');
  }

  async function handleSave(): Promise<void> {
    if (!uid || !hours) return;
    setSaving(true);
    setSnack(null);

    try {
      let photoForSave: string | null = photoURL.trim() || null;
      if (pendingPhotoUri) {
        const uploadRes = await StorageService.uploadBarberProfilePhoto(uid, pendingPhotoUri, pendingMimeType);
        if (!uploadRes.success) {
          setSnack({ msg: uploadRes.error, err: true });
          return;
        }
        photoForSave = uploadRes.data;
        setPhotoURL(uploadRes.data);
        setPendingPhotoUri(null);
        setPendingMimeType(null);
      }

      const workingHours: WorkingHours = { ...hours };
      DAY_ORDER.forEach(({ key }) => {
        const d = workingHours[key];
        workingHours[key] = {
          ...d,
          startTime: normalizeTime(d.startTime),
          endTime: normalizeTime(d.endTime),
        };
      });

      const specialties = parseSpecialties(specialtiesStr);
      const trimmedName = displayName.trim();
      const trimmedBio = bio.trim();

      const barberPayload = {
        displayName: trimmedName || barber?.displayName || 'Barber',
        bio: trimmedBio,
        photoURL: photoForSave,
        specialties: specialties.length ? specialties : ['General'],
        isAvailable,
        workingHours,
      };

      try {
        await setDoc(
          doc(db, COLLECTIONS.BARBERS, uid),
          {
            userId: uid,
            displayName: barberPayload.displayName,
            bio: barberPayload.bio,
            isAvailable: barberPayload.isAvailable,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e) {
        console.warn('[BarberProfileScreen] setDoc merge to barbers failed:', e);
      }

      const barberRes = await BarberService.saveProfile(uid, barberPayload);
      if (!barberRes.success) {
        setSnack({ msg: barberRes.error, err: true });
        return;
      }

      const userRes = await UserService.update(uid, {
        displayName: barberPayload.displayName,
        photoURL: barberPayload.photoURL,
      });
      if (!userRes.success) {
        setSnack({ msg: `Barber saved; user profile: ${userRes.error}`, err: true });
        return;
      }

      setSnack({ msg: 'Profile saved.', err: false });

      void AuthService.updateAuthProfile({
        displayName: barberPayload.displayName,
        photoURL: barberPayload.photoURL,
      }).catch(() => {});

      await load({ showFullScreenLoader: false }).catch(() => {});
      void refreshUser();
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout(): Promise<void> {
    if (loggingOut) return;
    setLoggingOut(true);
    await AuthService.logout();
    setLoggingOut(false);
  }

  const email = appUser?.email ?? firebaseUser?.email ?? '—';
  const role = appUser?.role ?? '—';
  const isOwner = role === 'admin';
  const initials = getInitials(displayName || appUser?.displayName);
  const memberSince = firebaseUser?.metadata?.creationTime
    ? new Date(firebaseUser.metadata.creationTime).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—';

  const avatarPreviewUri = pendingPhotoUri || (photoURL.trim().length > 0 ? photoURL.trim() : null);
  const hasPhotoChoice = Boolean(pendingPhotoUri || photoURL.trim());

  // Loading state
  if (loading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={C.gold} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (loadError) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <View style={styles.errorContainer}>
          <Ionicons name={icons.alertCircle} size={56} color={C.danger} />
          <Text style={styles.errorTitle}>Could not load profile</Text>
          <Text style={styles.errorSubtitle}>{loadError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void load()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.inner, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />

        {/* Header */}
        <Animated.View style={[styles.header, { opacity: headerFadeAnim }]}>
          <Text style={styles.headerTitle}>My Profile</Text>
          <Text style={styles.headerSubtitle}>613 BARBERSHOP</Text>
        </Animated.View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar Card */}
          <Animated.View style={[styles.avatarCard, { opacity: avatarFadeAnim, transform: [{ translateY: avatarSlideAnim }] }]}>
            <View style={styles.avatarAccent} />
            <View style={styles.avatarContainer}>
              <View style={styles.avatarOuter}>
                <View style={styles.avatarInner}>
                  {avatarPreviewUri ? (
                    <Image source={{ uri: avatarPreviewUri }} style={styles.avatarPhoto} resizeMode="cover" />
                  ) : (
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Role Badge */}
            <View style={[styles.roleBadge, isOwner && styles.roleBadgeOwner]}>
              <Ionicons name={isOwner ? icons.shield : icons.cut} size={14} color={isOwner ? C.gold : C.grey} />
              <Text style={[styles.roleBadgeText, isOwner && { color: C.gold }]}>
                {isOwner ? 'SHOP OWNER' : 'BARBER'}
              </Text>
            </View>

            <Text style={styles.memberSince}>Member since {memberSince}</Text>
          </Animated.View>

          {/* Shop Profile Section */}
          <Animated.View style={[styles.section, { opacity: section1FadeAnim, transform: [{ translateY: section1SlideAnim }] }]}>
            <Text style={styles.sectionLabel}>SHOP PROFILE</Text>
            <View style={styles.card}>
              {/* Rating */}
              {barber != null &&
              typeof barber.reviewCount === 'number' &&
              barber.reviewCount > 0 &&
              typeof barber.rating === 'number' &&
              barber.rating > 0 ? (
                <View style={styles.ratingRow}>
                  <Text style={styles.ratingText}>Your rating: {barber.rating.toFixed(1)}</Text>
                  <Ionicons name={icons.star} size={16} color={C.gold} />
                  <Text style={styles.ratingText}>
                    ({barber.reviewCount} {barber.reviewCount === 1 ? 'review' : 'reviews'})
                  </Text>
                </View>
              ) : (
                <Text style={styles.ratingEmpty}>No ratings yet</Text>
              )}
              <View style={styles.divider} />

              {/* Display Name */}
              <Text style={styles.fieldLabel}>Display name</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name as clients see it"
                placeholderTextColor={C.greyDark}
                autoCapitalize="words"
              />
              <View style={styles.divider} />

              {/* Bio */}
              <Text style={styles.fieldLabel}>Bio</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell clients about your experience and style..."
                placeholderTextColor={C.greyDark}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <View style={styles.divider} />

              {/* Photo */}
              <Text style={styles.fieldLabel}>Profile photo</Text>
              <Text style={styles.fieldHint}>
                Choose from your library{Platform.OS !== 'web' ? ' or take a new photo' : ''}. It uploads when you save.
              </Text>
              <View style={styles.photoActions}>
                <TouchableOpacity style={styles.photoBtn} onPress={() => void pickFromLibrary()}>
                  <Ionicons name={icons.image} size={20} color={C.gold} />
                  <Text style={styles.photoBtnText}>Library</Text>
                </TouchableOpacity>
                {Platform.OS !== 'web' ? (
                  <TouchableOpacity style={styles.photoBtn} onPress={() => void takePhoto()}>
                    <Ionicons name={icons.camera} size={20} color={C.gold} />
                    <Text style={styles.photoBtnText}>Camera</Text>
                  </TouchableOpacity>
                ) : null}
                {hasPhotoChoice ? (
                  <TouchableOpacity style={[styles.photoBtn, styles.photoBtnDanger]} onPress={clearProfilePhoto}>
                    <Ionicons name={icons.trash} size={20} color={C.danger} />
                    <Text style={[styles.photoBtnText, { color: C.danger }]}>Remove</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {pendingPhotoUri ? (
                <Text style={styles.photoPending}>New photo selected — tap Save changes to upload.</Text>
              ) : null}
              <View style={styles.divider} />

              {/* Specialties */}
              <Text style={styles.fieldLabel}>Specialties (comma-separated)</Text>
              <TextInput
                style={styles.input}
                value={specialtiesStr}
                onChangeText={setSpecialtiesStr}
                placeholder="Fades, Beard trims, ..."
                placeholderTextColor={C.greyDark}
              />
              <View style={styles.divider} />

              {/* Availability */}
              <View style={styles.availabilityRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Available for booking</Text>
                  <Text style={styles.fieldHint}>Turn off if you are not taking new appointments</Text>
                </View>
                <Switch
                  value={isAvailable}
                  onValueChange={setIsAvailable}
                  trackColor={{ false: C.greyDark, true: C.gold }}
                  thumbColor={isAvailable ? C.bg : C.grey}
                />
              </View>
            </View>
          </Animated.View>

          {/* Working Hours Section */}
          {hours && (
            <Animated.View style={[styles.section, { opacity: section2FadeAnim, transform: [{ translateY: section2SlideAnim }] }]}>
              <Text style={styles.sectionLabel}>WORKING HOURS</Text>
              <Text style={styles.sectionHint}>Start / end in 24h format (HH:mm)</Text>
              <View style={styles.card}>
                {DAY_ORDER.map(({ key, short, full }, idx) => {
                  const d = hours[key];
                  return (
                    <View key={key}>
                      {idx > 0 ? <View style={styles.divider} /> : null}
                      <View style={styles.dayRow}>
                        <View style={styles.dayHeader}>
                          <View>
                            <Text style={styles.dayShort}>{short}</Text>
                            <Text style={styles.dayFull}>{full}</Text>
                          </View>
                          <Switch
                            value={d.isWorking}
                            onValueChange={(v) => updateDay(key, { isWorking: v })}
                            trackColor={{ false: C.greyDark, true: C.gold }}
                            thumbColor={d.isWorking ? C.bg : C.grey}
                          />
                        </View>
                        {d.isWorking ? (
                          <View style={styles.timeRow}>
                            <TextInput
                              style={styles.timeInput}
                              value={d.startTime}
                              onChangeText={(t) => updateDay(key, { startTime: t })}
                              placeholder="09:00"
                              placeholderTextColor={C.greyDark}
                              keyboardType="numbers-and-punctuation"
                            />
                            <Text style={styles.timeSeparator}>–</Text>
                            <TextInput
                              style={styles.timeInput}
                              value={d.endTime}
                              onChangeText={(t) => updateDay(key, { endTime: t })}
                              placeholder="19:00"
                              placeholderTextColor={C.greyDark}
                              keyboardType="numbers-and-punctuation"
                            />
                          </View>
                        ) : (
                          <Text style={styles.dayOff}>Closed</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </Animated.View>
          )}

          {/* Save Button */}
          <Animated.View style={{ opacity: saveFadeAnim, transform: [{ translateY: saveSlideAnim }] }}>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={() => void handleSave()}
              disabled={saving || !hours}
            >
              {saving ? (
                <ActivityIndicator color={C.bg} />
              ) : (
                <>
                  <Ionicons name={icons.check} size={20} color={C.bg} style={{ marginRight: spacing.sm }} />
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Account Section */}
          <Animated.View style={[styles.section, { opacity: accountFadeAnim, transform: [{ translateY: accountSlideAnim }] }]}>
            <Text style={styles.sectionLabel}>ACCOUNT</Text>
            <View style={styles.card}>
              <View style={styles.infoRow}>
                <Ionicons name={icons.mail} size={18} color={C.grey} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue} numberOfLines={1}>
                    {email}
                  </Text>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Ionicons name={icons.shield} size={18} color={C.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Role</Text>
                  <Text style={[styles.infoValue, { color: C.gold }]}>{role}</Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Logout */}
          <Animated.View style={{ opacity: logoutFadeAnim, transform: [{ translateY: logoutSlideAnim }] }}>
            <TouchableOpacity
              style={[styles.logoutBtn, loggingOut && styles.logoutBtnDisabled]}
              onPress={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? (
                <ActivityIndicator size={18} color={C.danger} />
              ) : (
                <Ionicons name={icons.logOut} size={20} color={C.danger} />
              )}
              <Text style={styles.logoutText}>{loggingOut ? 'Signing out...' : 'Log Out'}</Text>
            </TouchableOpacity>
            <Text style={styles.logoutHint}>You will return to the role selection screen</Text>
          </Animated.View>

          {/* Version */}
          <Text style={styles.version}>613 Barbershop · Barber Portal · v1.0.0</Text>
        </ScrollView>

        {/* Snackbar */}
        <Snackbar
          visible={snack !== null}
          onDismiss={() => setSnack(null)}
          duration={4000}
          style={snack?.err ? styles.snackErr : styles.snackOk}
        >
          <Text style={styles.snackText}>{snack?.msg ?? ''}</Text>
        </Snackbar>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  inner: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: C.grey,
  },

  // Error
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['3xl'],
    gap: spacing.md,
  },
  errorTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.lg,
    color: C.white,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: C.grey,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.md,
    backgroundColor: C.gold,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  retryButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.md,
    color: C.bg,
  },

  // Header
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: fonts.size['2xl'],
    color: C.white,
    letterSpacing: fonts.letterSpacing.tight,
  },
  headerSubtitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.xs,
    color: C.gold,
    letterSpacing: fonts.letterSpacing.widest,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
  },

  // Avatar Card
  avatarCard: {
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    paddingBottom: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  avatarAccent: {
    height: 4,
    width: '100%',
    backgroundColor: C.gold,
    marginBottom: spacing.xl,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarOuter: {
    width: 100,
    height: 100,
    borderRadius: radius.full,
    backgroundColor: C.surfaceRaised,
    borderWidth: 3,
    borderColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: C.goldGlow,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPhoto: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
  },
  avatarInitials: {
    fontFamily: fonts.heading,
    fontSize: fonts.size['3xl'],
    color: C.gold,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: C.surfaceRaised,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  roleBadgeOwner: {
    borderColor: C.gold,
    backgroundColor: C.goldGlow,
  },
  roleBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.xs,
    color: C.grey,
    letterSpacing: fonts.letterSpacing.wider,
    textTransform: 'uppercase',
  },
  memberSince: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: C.grey,
  },

  // Section
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.xs,
    color: C.greyDark,
    letterSpacing: fonts.letterSpacing.wider,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  sectionHint: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: C.grey,
    marginBottom: spacing.sm,
  },

  // Card
  card: {
    backgroundColor: C.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: C.border,
    padding: spacing.lg,
    ...shadows.sm,
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: spacing.md,
  },

  // Rating
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  ratingText: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.md,
    color: C.gold,
  },
  ratingEmpty: {
    fontFamily: fonts.body,
    fontSize: fonts.size.md,
    color: C.grey,
  },

  // Fields
  fieldLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.xs,
    color: C.grey,
    letterSpacing: fonts.letterSpacing.wide,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  fieldHint: {
    fontFamily: fonts.body,
    fontSize: fonts.size.xs,
    color: C.greyDark,
    marginBottom: spacing.sm,
    lineHeight: 16,
  },
  input: {
    fontFamily: fonts.body,
    fontSize: fonts.size.md,
    color: C.white,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: C.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  inputMultiline: {
    minHeight: 100,
    paddingTop: spacing.md,
    textAlignVertical: 'top',
  },

  // Photo Actions
  photoActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: C.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  photoBtnDanger: {
    borderColor: C.danger,
  },
  photoBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.sm,
    color: C.white,
  },
  photoPending: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fonts.size.xs,
    color: C.gold,
    marginTop: spacing.sm,
  },

  // Availability
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  // Working Hours
  dayRow: {
    paddingVertical: spacing.xs,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  dayShort: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.md,
    color: C.white,
  },
  dayFull: {
    fontFamily: fonts.body,
    fontSize: fonts.size.xs,
    color: C.grey,
    marginTop: spacing.xs,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fonts.size.md,
    color: C.white,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: C.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  timeSeparator: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.md,
    color: C.grey,
  },
  dayOff: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: C.greyDark,
  },

  // Save Button
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.gold,
    borderRadius: radius['2xl'],
    paddingVertical: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.gold,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.lg,
    color: C.bg,
  },

  // Info Rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  infoLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.xs,
    color: C.greyDark,
    letterSpacing: fonts.letterSpacing.wide,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  infoValue: {
    fontFamily: fonts.body,
    fontSize: fonts.size.md,
    color: C.white,
  },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: `${C.danger}15`,
    borderWidth: 1.5,
    borderColor: C.danger,
    borderRadius: radius['2xl'],
    paddingVertical: spacing.lg,
  },
  logoutBtnDisabled: {
    opacity: 0.65,
  },
  logoutText: {
    fontFamily: fonts.bodyBold,
    fontSize: fonts.size.lg,
    color: C.danger,
  },
  logoutHint: {
    fontFamily: fonts.body,
    fontSize: fonts.size.xs,
    color: C.greyDark,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // Version
  version: {
    fontFamily: fonts.body,
    fontSize: fonts.size.xs,
    color: C.greyDark,
    textAlign: 'center',
    marginTop: spacing.xl,
  },

  // Snackbar
  snackOk: {
    backgroundColor: C.surface,
    marginBottom: spacing.xl,
  },
  snackErr: {
    backgroundColor: `${C.danger}15`,
    marginBottom: spacing.xl,
  },
  snackText: {
    fontFamily: fonts.body,
    fontSize: fonts.size.sm,
    color: C.white,
  },
});
