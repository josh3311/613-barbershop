import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Text, Snackbar } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { COLLECTIONS } from '@/constants/collections';
import { AuthService } from '@/services/auth.service';
import { BarberService } from '@/services/barber.service';
import { StorageService } from '@/services/storage.service';
import { UserService } from '@/services/user.service';
import { useAuth } from '@/hooks/useAuth';
import { Barber } from '@/types/barber.types';
import { DayOfWeek, WorkingHours, DaySchedule } from '@/types/common.types';

// ─── Theme (PROJECT_STATUS UI) ────────────────────────────────────────────────

const C = {
  bg:          '#0A0A0A',
  surface:     '#141414',
  card:        '#141414',
  elevated:    '#1E1E1E',
  gold:        '#D4AF37',
  goldGlow:    '#D4AF3715',
  goldBorder:  '#D4AF3730',
  cardBorder:  '#252525',
  steel:       '#9E9E9E',
  steelGlow:   '#9E9E9E12',
  steelBorder: '#9E9E9E35',
  danger:      '#CF6679',
  dangerBg:    '#1A0A0A',
  dangerBdr:   '#CF667944',
  white:       '#FFFFFF',
  sub:         '#666666',
  muted:       '#444444',
  divider:     '#1C1C1C',
  icon:        '#666666',
  placeholder: '#555555',
} as const;

const DAY_ORDER: { key: DayOfWeek; short: string }[] = [
  { key: 'monday',    short: 'Mon' },
  { key: 'tuesday',   short: 'Tue' },
  { key: 'wednesday', short: 'Wed' },
  { key: 'thursday',  short: 'Thu' },
  { key: 'friday',    short: 'Fri' },
  { key: 'saturday',  short: 'Sat' },
  { key: 'sunday',    short: 'Sun' },
];

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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BarberProfileScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { firebaseUser, appUser, refreshUser } = useAuth();
  const uid = firebaseUser?.uid ?? '';

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [barber, setBarber]     = useState<Barber | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [displayName, setDisplayName]   = useState('');
  const [bio, setBio]                   = useState('');
  const [photoURL, setPhotoURL]         = useState('');
  /** Local URI from ImagePicker; uploaded to Storage on Save. */
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [pendingMimeType, setPendingMimeType] = useState<string | null>(null);
  const [specialtiesStr, setSpecialtiesStr] = useState('');
  const [isAvailable, setIsAvailable]   = useState(true);
  const [hours, setHours]               = useState<WorkingHours | null>(null);

  const [loggingOut, setLoggingOut] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; err: boolean } | null>(null);

  const load = useCallback(async (opts?: { showFullScreenLoader?: boolean }): Promise<void> => {
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
  }, [uid]);

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
        const uploadRes = await StorageService.uploadBarberProfilePhoto(
          uid,
          pendingPhotoUri,
          pendingMimeType,
        );
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
          endTime:   normalizeTime(d.endTime),
        };
      });

      const specialties = parseSpecialties(specialtiesStr);
      const trimmedName = displayName.trim();
      const trimmedBio  = bio.trim();

      const barberPayload = {
        displayName: trimmedName || barber?.displayName || 'Barber',
        bio:         trimmedBio,
        photoURL:    photoForSave,
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
          { merge: true },
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
        photoURL:    barberPayload.photoURL,
      });
      if (!userRes.success) {
        setSnack({ msg: `Barber saved; user profile: ${userRes.error}`, err: true });
        return;
      }

      setSnack({ msg: 'Profile saved.', err: false });

      void AuthService.updateAuthProfile({
        displayName: barberPayload.displayName,
        photoURL:    barberPayload.photoURL,
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

  const email    = appUser?.email ?? firebaseUser?.email ?? '—';
  const role     = appUser?.role ?? '—';
  const isOwner  = role === 'admin';
  const initials = getInitials(displayName || appUser?.displayName);
  const memberSince = firebaseUser?.metadata?.creationTime
    ? new Date(firebaseUser.metadata.creationTime).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—';

  const avatarPreviewUri =
    pendingPhotoUri || (photoURL.trim().length > 0 ? photoURL.trim() : null);
  const hasPhotoChoice = Boolean(pendingPhotoUri || photoURL.trim());

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[s.inner, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />

        <View style={s.headerBar} accessibilityRole="header">
          <Text style={s.headerTitle}>My Profile</Text>
          <Text style={s.headerSub}>613 BARBERSHOP</Text>
        </View>
        <View style={s.headerLine} />

        {loading ? (
          <View style={s.centerLoad}>
            <ActivityIndicator size="large" color={C.gold} />
            <Text style={s.loadText}>Loading profile…</Text>
          </View>
        ) : loadError ? (
          <View style={s.centerLoad}>
            <Ionicons name="alert-circle-outline" size={44} color={C.danger} />
            <Text style={s.errTitle}>Could not load barber profile</Text>
            <Text style={s.errSub}>{loadError}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={() => void load()} accessibilityRole="button">
              <Text style={s.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Avatar + identity */}
            <View style={s.avatarCard}>
              <View style={s.avatarCardAccent} />
              <View style={s.avatarOuter}>
                <View style={s.avatarInner}>
                  {avatarPreviewUri ? (
                    <Image
                      source={{ uri: avatarPreviewUri }}
                      style={s.avatarPhoto}
                      resizeMode="cover"
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <Text style={s.avatarInitials}>{initials}</Text>
                  )}
                </View>
              </View>
              <View style={s.rolePill}>
                <Ionicons
                  name={isOwner ? 'shield-checkmark-outline' : 'cut-outline'}
                  size={12}
                  color={isOwner ? C.gold : C.steel}
                />
                <Text style={[s.rolePillText, isOwner && { color: C.gold }]}>
                  {isOwner ? 'SHOP OWNER' : 'BARBER'}
                </Text>
              </View>
              <Text style={s.memberSince}>Member since {memberSince}</Text>
            </View>

            {/* Public / shop profile */}
            <View style={s.section}>
              <Text style={s.sectionLabel}>SHOP PROFILE</Text>
              <View style={s.card}>
                {barber != null &&
                typeof barber.reviewCount === 'number' &&
                barber.reviewCount > 0 &&
                typeof barber.rating === 'number' &&
                barber.rating > 0 ? (
                  <View style={s.ratingRow} accessibilityRole="text">
                    <Text style={s.ratingReadonly}>
                      Your rating: {barber.rating.toFixed(1)}
                    </Text>
                    <Ionicons name="star" size={14} color={C.gold} />
                    <Text style={s.ratingReadonly}>
                      ({barber.reviewCount}{' '}
                      {barber.reviewCount === 1 ? 'review' : 'reviews'})
                    </Text>
                  </View>
                ) : (
                  <Text style={s.ratingEmpty} accessibilityRole="text">
                    No ratings yet
                  </Text>
                )}
                <View style={s.divider} />
                <Text style={s.fieldLabel}>Display name</Text>
                <TextInput
                  style={s.input}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Your name as clients see it"
                  placeholderTextColor={C.placeholder}
                  autoCapitalize="words"
                  accessibilityLabel="Display name"
                />
                <View style={s.divider} />
                <Text style={s.fieldLabel}>Bio</Text>
                <TextInput
                  style={[s.input, s.inputMultiline]}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Tell clients about your experience and style…"
                  placeholderTextColor={C.placeholder}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  accessibilityLabel="Bio"
                />
                <View style={s.divider} />
                <Text style={s.fieldLabel}>Profile photo</Text>
                <Text style={s.photoHint}>
                  Choose from your library{Platform.OS !== 'web' ? ' or take a new photo' : ''}. It uploads when you save.
                </Text>
                <View style={s.photoActions}>
                  <TouchableOpacity
                    style={s.photoBtn}
                    onPress={() => void pickFromLibrary()}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Choose photo from library"
                  >
                    <Ionicons name="images-outline" size={20} color={C.gold} />
                    <Text style={s.photoBtnText}>Library</Text>
                  </TouchableOpacity>
                  {Platform.OS !== 'web' ? (
                    <TouchableOpacity
                      style={s.photoBtn}
                      onPress={() => void takePhoto()}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel="Take a new photo"
                    >
                      <Ionicons name="camera-outline" size={20} color={C.gold} />
                      <Text style={s.photoBtnText}>Camera</Text>
                    </TouchableOpacity>
                  ) : null}
                  {hasPhotoChoice ? (
                    <TouchableOpacity
                      style={[s.photoBtn, s.photoBtnDanger]}
                      onPress={clearProfilePhoto}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel="Remove profile photo"
                    >
                      <Ionicons name="trash-outline" size={20} color={C.danger} />
                      <Text style={[s.photoBtnText, { color: C.danger }]}>Remove</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                {pendingPhotoUri ? (
                  <Text style={s.photoPending}>New photo selected — tap Save changes to upload.</Text>
                ) : null}
                <View style={s.divider} />
                <Text style={s.fieldLabel}>Specialties (comma-separated)</Text>
                <TextInput
                  style={s.input}
                  value={specialtiesStr}
                  onChangeText={setSpecialtiesStr}
                  placeholder="Fades, Beard trims, …"
                  placeholderTextColor={C.placeholder}
                  accessibilityLabel="Specialties"
                />
                <View style={s.availRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>Available for booking</Text>
                    <Text style={s.availHint}>Turn off if you are not taking new appointments</Text>
                  </View>
                  <Switch
                    value={isAvailable}
                    onValueChange={setIsAvailable}
                    trackColor={{ false: '#333', true: C.gold + '88' }}
                    thumbColor={isAvailable ? C.gold : '#888'}
                    accessibilityLabel="Available for booking"
                  />
                </View>
              </View>
            </View>

            {/* Working hours */}
            {hours ? (
              <View style={s.section}>
                <Text style={s.sectionLabel}>WORKING HOURS</Text>
                <Text style={s.sectionHint}>Start / end in 24h format (HH:mm)</Text>
                <View style={s.card}>
                  {DAY_ORDER.map(({ key, short }, idx) => {
                    const d = hours[key];
                    return (
                      <View key={key}>
                        {idx > 0 ? <View style={s.divider} /> : null}
                        <View style={s.dayRow}>
                          <View style={s.dayHead}>
                            <Text style={s.dayShort}>{short}</Text>
                            <Switch
                              value={d.isWorking}
                              onValueChange={(v) => updateDay(key, { isWorking: v })}
                              trackColor={{ false: '#333', true: C.gold + '88' }}
                              thumbColor={d.isWorking ? C.gold : '#888'}
                              accessibilityLabel={`${short} working`}
                            />
                          </View>
                          {d.isWorking ? (
                            <View style={s.timeRow}>
                              <TextInput
                                style={s.timeInput}
                                value={d.startTime}
                                onChangeText={(t) => updateDay(key, { startTime: t })}
                                placeholder="09:00"
                                placeholderTextColor={C.placeholder}
                                keyboardType="numbers-and-punctuation"
                                accessibilityLabel={`${short} start`}
                              />
                              <Text style={s.timeSep}>–</Text>
                              <TextInput
                                style={s.timeInput}
                                value={d.endTime}
                                onChangeText={(t) => updateDay(key, { endTime: t })}
                                placeholder="19:00"
                                placeholderTextColor={C.placeholder}
                                keyboardType="numbers-and-punctuation"
                                accessibilityLabel={`${short} end`}
                              />
                            </View>
                          ) : (
                            <Text style={s.dayOff}>Closed</Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <TouchableOpacity
              style={[s.saveBtn, saving && s.saveBtnBusy]}
              onPress={() => void handleSave()}
              disabled={saving || !hours}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="Save profile"
              accessibilityState={{ busy: saving, disabled: saving || !hours }}
            >
              {saving ? (
                <ActivityIndicator color={C.bg} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color={C.bg} style={{ marginRight: 8 }} />
                  <Text style={s.saveBtnText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Account read-only */}
            <View style={s.section}>
              <Text style={s.sectionLabel}>ACCOUNT</Text>
              <View style={s.card}>
                <View style={s.infoRow}>
                  <Ionicons name="mail-outline" size={18} color={C.icon} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.infoLabel}>Email</Text>
                    <Text style={s.infoValue} numberOfLines={1}>{email}</Text>
                  </View>
                </View>
                <View style={s.divider} />
                <View style={s.infoRow}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={C.gold} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.infoLabel}>Role</Text>
                    <Text style={[s.infoValue, { color: C.gold }]}>{role}</Text>
                  </View>
                </View>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleLogout}
              disabled={loggingOut}
              style={[s.logoutBtn, loggingOut && s.logoutBtnBusy]}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Log out"
            >
              {loggingOut ? (
                <ActivityIndicator size={18} color={C.danger} />
              ) : (
                <Ionicons name="log-out-outline" size={20} color={C.danger} />
              )}
              <Text style={s.logoutText}>{loggingOut ? 'Signing out…' : 'Log Out'}</Text>
            </TouchableOpacity>
            <Text style={s.logoutHint}>You will return to the role selection screen</Text>

            <Text style={s.version}>613 Barbershop · Barber Portal · v1.0.0</Text>
          </ScrollView>
        )}

        <Snackbar
          visible={snack !== null}
          onDismiss={() => setSnack(null)}
          duration={4000}
          style={snack?.err ? s.snackErr : s.snackOk}
        >
          {snack?.msg ?? ''}
        </Snackbar>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  inner:  { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  headerBar: { paddingHorizontal: 20, paddingVertical: 14, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: C.white },
  headerSub:   { fontSize: 10, color: C.gold, letterSpacing: 3, fontWeight: '700', marginTop: 2 },
  headerLine:  { height: 1, marginHorizontal: 20, backgroundColor: C.gold, opacity: 0.2, marginBottom: 8 },

  centerLoad: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  loadText:   { fontSize: 14, color: C.sub },
  errTitle:   { fontSize: 16, fontWeight: '800', color: C.white, textAlign: 'center' },
  errSub:     { fontSize: 13, color: C.sub, textAlign: 'center' },
  retryBtn:   { marginTop: 8, backgroundColor: C.gold, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryText:  { fontSize: 14, fontWeight: '800', color: C.bg },

  avatarCard: {
    alignItems: 'center', backgroundColor: C.card,
    borderRadius: 18, borderWidth: 1, borderColor: C.cardBorder,
    overflow: 'hidden', paddingBottom: 20, marginBottom: 8,
  },
  avatarCardAccent: { height: 4, width: '100%', backgroundColor: C.steel, marginBottom: 20 },
  avatarOuter: {
    width: 86, height: 86, borderRadius: 43,
    backgroundColor: C.elevated, borderWidth: 2, borderColor: '#D4AF37',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarInner: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: C.steelGlow, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.steelBorder,
    overflow: 'hidden',
  },
  avatarPhoto: { width: 68, height: 68, borderRadius: 34 },
  avatarInitials: { fontSize: 26, fontWeight: '900', color: C.steel },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.steelGlow, borderRadius: 20,
    borderWidth: 1, borderColor: C.steelBorder,
    paddingHorizontal: 12, paddingVertical: 5, marginBottom: 8,
  },
  rolePillText:  { fontSize: 10, fontWeight: '800', color: C.steel, letterSpacing: 2 },
  memberSince:   { fontSize: 12, color: C.sub },

  section:      { marginTop: 18 },
  sectionLabel: { fontSize: 10, color: C.muted, fontWeight: '700', letterSpacing: 2, marginBottom: 8 },
  sectionHint:  { fontSize: 11, color: C.sub, marginBottom: 8 },

  card: {
    backgroundColor: C.card, borderRadius: 14,
    borderWidth: 1, borderColor: C.cardBorder,
    overflow: 'hidden', paddingHorizontal: 14, paddingVertical: 12,
  },
  divider: { height: 1, backgroundColor: C.divider, marginVertical: 12 },

  ratingReadonly: {
    fontSize: 15,
    fontWeight: '700',
    color: C.gold,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  ratingEmpty: {
    fontSize: 15,
    fontWeight: '600',
    color: C.sub,
    marginBottom: 6,
  },
  fieldLabel: { fontSize: 10, color: C.sub, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  input: {
    fontSize: 15,
    color: C.white,
    fontWeight: '600',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: C.elevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.divider,
  },
  inputMultiline: { minHeight: 100, paddingTop: 12 },

  photoHint:    { fontSize: 11, color: C.sub, marginBottom: 10, lineHeight: 16 },
  photoActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: C.elevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  photoBtnDanger: { borderColor: C.dangerBdr },
  photoBtnText:   { fontSize: 14, fontWeight: '700', color: C.white },
  photoPending:   { fontSize: 11, color: C.gold, marginTop: 10, fontWeight: '600' },

  availRow:  { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 12 },
  availHint: { fontSize: 11, color: C.sub, marginTop: 4 },

  dayRow:   { paddingVertical: 4 },
  dayHead:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  dayShort: { fontSize: 13, fontWeight: '800', color: C.white, width: 40 },
  timeRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 40 },
  timeInput: {
    flex: 1,
    fontSize: 14,
    color: C.white,
    fontWeight: '600',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: C.elevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.divider,
  },
  timeSep: { color: C.sub, fontWeight: '700' },
  dayOff:  { fontSize: 12, color: C.muted, paddingLeft: 40 },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.gold,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  saveBtnBusy: { opacity: 0.75 },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: C.bg },

  infoRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  infoLabel: { fontSize: 10, color: C.muted, fontWeight: '700', marginBottom: 2 },
  infoValue: { fontSize: 14, color: C.white, fontWeight: '600' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.dangerBg, borderWidth: 1.5, borderColor: C.dangerBdr,
    borderRadius: 14, paddingVertical: 16, marginTop: 16,
  },
  logoutBtnBusy: { opacity: 0.65 },
  logoutText:    { fontSize: 16, fontWeight: '800', color: C.danger },
  logoutHint:    { fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 8 },

  version: { fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 28 },

  snackOk:  { backgroundColor: '#0D200D', marginBottom: 24 },
  snackErr: { backgroundColor: '#2A0A0A', marginBottom: 24 },
});
