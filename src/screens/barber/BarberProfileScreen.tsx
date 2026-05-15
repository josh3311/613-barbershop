import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, Image, ActivityIndicator,
} from 'react-native';
import {
  collection, query, where, onSnapshot,
  getDocs, updateDoc, doc,
} from 'firebase/firestore';
import { Ionicons }     from '@expo/vector-icons';
import { signOut }      from 'firebase/auth';
import * as ImagePicker from 'expo-image-picker';
import { auth, db }     from '../../config/firebase';
import { useAuth }      from '../../context/AuthContext';
import { COLLECTIONS }  from '../../constants/collections';
import { theme }        from '../../theme';

interface Stats {
  total: number; pending: number; confirmed: number; completed: number; revenue: number;
}

export default function BarberProfileScreen() {
  const { user } = useAuth();

  const [stats, setStats] = useState<Stats>({
    total: 0, pending: 0, confirmed: 0, completed: 0, revenue: 0,
  });
  const [photoURL,       setPhotoURL]       = useState<string | null>(user?.photoURL ?? null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (user?.photoURL) setPhotoURL(user.photoURL);
  }, [user?.photoURL]);

  useEffect(() => {
    if (!user?.id) return;
    const q = query(collection(db, COLLECTIONS.BOOKINGS), where('barberId', '==', user.id));
    return onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => d.data());
      setStats({
        total:     docs.length,
        pending:   docs.filter(d => d.status === 'pending').length,
        confirmed: docs.filter(d => d.status === 'confirmed').length,
        completed: docs.filter(d => d.status === 'completed').length,
        revenue:   docs.filter(d => d.status !== 'cancelled')
          .reduce((sum, d) => sum + (d.servicePrice ?? 0), 0),
      });
    });
  }, [user?.id]);

  // ── Upload profile photo via ImgBB ───────────────────────
  const handlePhotoUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to set a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (result.canceled || !result.assets[0]) return;
    const { base64 } = result.assets[0];
    if (!base64) return;

    setUploadingPhoto(true);
    try {
      // Upload to ImgBB — same approach as StylesScreen
      const key = process.env.EXPO_PUBLIC_IMGBB_API_KEY;
      if (!key) throw new Error('ImgBB key missing');

      const formData = new FormData();
      formData.append('image', base64);
      const res  = await fetch(`https://api.imgbb.com/1/upload?key=${key}`, {
        method: 'POST', body: formData,
      });
      const data = await res.json();
      const downloadURL: string | undefined = data?.data?.url;
      if (!downloadURL) throw new Error('ImgBB upload failed');

      // Update users collection
      await updateDoc(doc(db, COLLECTIONS.USERS, user!.id), {
        photoURL: downloadURL,
      });

      // Update barbers collection (what BarberSelectionScreen reads from)
      const barbersSnap = await getDocs(
        query(collection(db, 'barbers'), where('userId', '==', user!.id)),
      );
      for (const barberDoc of barbersSnap.docs) {
        await updateDoc(doc(db, 'barbers', barberDoc.id), {
          photoURL: downloadURL,
        });
      }

      setPhotoURL(downloadURL);
      Alert.alert('Photo Updated', 'Your profile photo has been saved.');
    } catch (e) {
      console.error('Photo upload failed:', e);
      Alert.alert('Error', 'Could not upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel',   style: 'cancel'      },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut(auth) },
    ]);
  };

  const initial = user?.displayName?.charAt(0).toUpperCase() ?? '?';

  const STAT_CARDS = [
    { label: 'ALL',  value: stats.total,     color: theme.colors.textPrimary },
    { label: 'PEND', value: stats.pending,   color: theme.colors.warning     },
    { label: 'CONF', value: stats.confirmed, color: theme.colors.success     },
    { label: 'DONE', value: stats.completed, color: theme.colors.gold        },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.pageLabel}>Barber</Text>
        <Text style={styles.pageTitle}>PROFILE</Text>
      </View>

      {/* ── Avatar + Name ── */}
      <View style={styles.avatarSection}>
        <TouchableOpacity
          style={styles.avatarWrapper}
          onPress={handlePhotoUpload}
          disabled={uploadingPhoto}
          activeOpacity={0.8}
        >
          {photoURL ? (
            <Image source={{ uri: photoURL }} style={styles.avatarPhoto} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          )}
          <View style={styles.cameraOverlay}>
            {uploadingPhoto
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="camera" size={14} color="#fff" />
            }
          </View>
        </TouchableOpacity>

        <Text style={styles.displayName}>
          {user?.displayName?.toUpperCase() ?? 'BARBER'}
        </Text>
        <Text style={styles.email}>{user?.email}</Text>
        <Text style={styles.photoHint}>Tap photo to update</Text>

        <View style={styles.roleBadge}>
          <Ionicons name="cut-outline" size={12} color={theme.colors.gold} />
          <Text style={styles.roleText}>BARBER</Text>
        </View>
      </View>

      {/* ── Stats ── */}
      <Text style={styles.sectionTitle}>BOOKINGS</Text>
      <View style={styles.statsGrid}>
        {STAT_CARDS.map(card => (
          <View key={card.label} style={styles.statCard}>
            <Text style={[styles.statValue, { color: card.color }]}>{card.value}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>{card.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Revenue ── */}
      <View style={styles.revenueCard}>
        <View style={styles.revenueIcon}>
          <Ionicons name="cash-outline" size={22} color={theme.colors.gold} />
        </View>
        <View style={styles.revenueMid}>
          <Text style={styles.revenueLabel}>REVENUE</Text>
          <Text style={styles.revenueNote}>All non-cancelled</Text>
        </View>
        <Text style={styles.revenueValue}>${stats.revenue}</Text>
      </View>

      {/* ── Account ── */}
      <Text style={styles.sectionTitle}>ACCOUNT</Text>
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <Ionicons name="person-outline" size={18} color={theme.colors.gold} />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>DISPLAY NAME</Text>
            <Text style={styles.infoValue}>{user?.displayName ?? '—'}</Text>
          </View>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <Ionicons name="mail-outline" size={18} color={theme.colors.gold} />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>EMAIL</Text>
            <Text style={styles.infoValue}>{user?.email ?? '—'}</Text>
          </View>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.gold} />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>ROLE</Text>
            <Text style={styles.infoValue}>Barber</Text>
          </View>
        </View>
      </View>

      {/* ── App ── */}
      <Text style={styles.sectionTitle}>APP</Text>
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.infoIcon}>
            <Ionicons name="information-circle-outline" size={18} color={theme.colors.gold} />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>VERSION</Text>
            <Text style={styles.infoValue}>613 Barbershop v2.0</Text>
          </View>
        </View>
      </View>

      {/* ── Sign Out ── */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color={theme.colors.error} />
        <Text style={styles.signOutText}>SIGN OUT</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: theme.colors.background },
  scroll:     { padding: theme.spacing.lg, paddingTop: theme.spacing.xxl },
  header:     { marginBottom: theme.spacing.xl },
  pageLabel:  { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.sm, color: theme.colors.textSecondary },
  pageTitle:  { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.xxl, color: theme.colors.textPrimary, letterSpacing: 4 },

  avatarSection:  { alignItems: 'center', marginBottom: theme.spacing.xl, gap: theme.spacing.sm },
  avatarWrapper:  { position: 'relative', width: 88, height: 88 },
  avatarPhoto: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 2, borderColor: theme.colors.gold,
  },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: theme.colors.gold,
    alignItems: 'center', justifyContent: 'center',
    ...theme.shadows.gold,
  },
  avatarText:     { fontFamily: theme.fonts.heading, fontSize: 40, color: theme.colors.textInverse },
  cameraOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: theme.colors.gold,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: theme.colors.background,
  },
  photoHint:      { fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.textMuted, marginTop: -4 },
  displayName:    { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.xxl, color: theme.colors.textPrimary, letterSpacing: 4, marginTop: theme.spacing.xs },
  email:          { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.sm, color: theme.colors.textMuted },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.colors.goldMuted, borderWidth: 1, borderColor: theme.colors.gold,
    borderRadius: theme.radius.full, paddingVertical: 4, paddingHorizontal: theme.spacing.md, marginTop: 4,
  },
  roleText:       { fontFamily: theme.fonts.medium, fontSize: theme.fontSizes.xs, color: theme.colors.gold, letterSpacing: 2 },

  sectionTitle:   { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.sm, color: theme.colors.textSecondary, letterSpacing: 4, marginBottom: theme.spacing.md, marginTop: theme.spacing.sm },
  statsGrid:      { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  statCard:       { flex: 1, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.xs, alignItems: 'center', ...theme.shadows.md },
  statValue:      { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.xl },
  statLabel:      { fontFamily: theme.fonts.medium, fontSize: 9, color: theme.colors.textMuted, letterSpacing: 0.5, marginTop: 4, textAlign: 'center' },

  revenueCard:    { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.gold, paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.lg, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, marginBottom: theme.spacing.md, ...theme.shadows.gold },
  revenueIcon:    { width: 40, height: 40, borderRadius: theme.radius.sm, backgroundColor: theme.colors.goldMuted, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  revenueMid:     { flex: 1 },
  revenueLabel:   { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.md, color: theme.colors.textPrimary, letterSpacing: 1 },
  revenueNote:    { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.xs, color: theme.colors.textMuted, marginTop: 2 },
  revenueValue:   { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.xl, color: theme.colors.gold, flexShrink: 0 },

  infoCard:       { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, marginBottom: theme.spacing.md, overflow: 'hidden', ...theme.shadows.md },
  infoRow:        { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.md },
  infoIcon:       { width: 36, height: 36, borderRadius: theme.radius.sm, backgroundColor: theme.colors.goldMuted, alignItems: 'center', justifyContent: 'center' },
  infoContent:    { flex: 1 },
  infoLabel:      { fontFamily: theme.fonts.medium, fontSize: theme.fontSizes.xs, color: theme.colors.textMuted, letterSpacing: 2 },
  infoValue:      { fontFamily: theme.fonts.bold, fontSize: theme.fontSizes.md, color: theme.colors.textPrimary, marginTop: 1 },
  infoDivider:    { height: 1, backgroundColor: theme.colors.border, marginLeft: theme.spacing.lg + 36 },

  signOutBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, backgroundColor: 'rgba(255, 68, 68, 0.08)', borderWidth: 1, borderColor: theme.colors.error, borderRadius: theme.radius.md, padding: theme.spacing.md, marginTop: theme.spacing.md },
  signOutText:    { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.md, color: theme.colors.error, letterSpacing: 3 },
});