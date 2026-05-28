import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Image,
} from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../config/firebase';
import { theme } from '../../theme';

interface Barber {
  id:          string;
  userId:      string | null;
  displayName: string;
  bio:         string;
  specialties: string[];
  isAvailable: boolean;
  photoURL:    string | null;
  rating:      number;
  reviewCount: number;
}

interface Props {
  navigation: any;
  route:      any;
}

export default function BarberSelectionScreen({ navigation, route }: Props) {
  const { service }             = route.params;
  const [barbers,  setBarbers]  = useState<Barber[]>([]);
  const [selected, setSelected] = useState<Barber | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const fetchBarbers = async () => {
      try {
        const q    = query(
          collection(db, 'barbers'),
          where('isAvailable', '==', true),
        );
        const snap = await getDocs(q);
        setBarbers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Barber)));
      } catch (e) {
        console.error('Failed to load barbers:', e);
      } finally {
        // Always stop loading — even if query fails
        setLoading(false);
      }
    };
    fetchBarbers();
  }, []);

  const handleContinue = () => {
    if (!selected) return;
    navigation.navigate('DateTimeSelection', { service, barber: selected });
  };

  return (
    <View style={styles.container}>

      {/* Header (3-column: back | title | spacer) */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.stepText}>STEP 2 OF 4</Text>
          <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
            PICK A BARBER
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: '50%' }]} />
      </View>

      {/* Selected service pill */}
      <View style={styles.servicePill}>
        <Ionicons name="cut-outline" size={14} color={theme.colors.gold} />
        <Text style={styles.servicePillText}>
          {service.name} — ${service.price}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator
          color={theme.colors.gold}
          size="large"
          style={styles.loader}
        />
      ) : barbers.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="person-outline" size={48} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>No barbers available</Text>
          <Text style={styles.emptySubtitle}>Check back soon</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {barbers.map(barber => {
            const isSelected = selected?.id === barber.id;
            return (
              <TouchableOpacity
                key={barber.id}
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => setSelected(barber)}
                activeOpacity={0.8}
              >
                {/* Avatar */}
                <View style={[styles.avatar, isSelected && styles.avatarSelected]}>
                  {barber.photoURL ? (
                    <Image
                      source={{ uri: barber.photoURL }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <Ionicons
                      name="person"
                      size={32}
                      color={isSelected ? theme.colors.textInverse : theme.colors.gold}
                    />
                  )}
                </View>

                {/* Info */}
                <View style={styles.cardInfo}>
                  <Text style={[
                    styles.barberName,
                    isSelected && styles.barberNameSelected,
                  ]}>
                    {barber.displayName.toUpperCase()}
                  </Text>

                  {/* Rating */}
                  <View style={styles.ratingRow}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <Ionicons
                        key={star}
                        name={star <= barber.rating ? 'star' : 'star-outline'}
                        size={12}
                        color={theme.colors.gold}
                      />
                    ))}
                    <Text style={styles.reviewCount}>({barber.reviewCount})</Text>
                  </View>

                  {/* Specialties */}
                  <View style={styles.specialties}>
                    {barber.specialties?.slice(0, 3).map((s, i) => (
                      <View key={i} style={styles.specialtyTag}>
                        <Text style={styles.specialtyText}>{s}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Checkmark */}
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={24} color={theme.colors.gold} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Continue Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, !selected && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!selected}
        >
          <Text style={styles.buttonText}>
            {selected
              ? `CONTINUE WITH ${selected.displayName.toUpperCase()}`
              : 'SELECT A BARBER'}
          </Text>
          {selected && (
            <Ionicons name="arrow-forward" size={18} color={theme.colors.textInverse} />
          )}
        </TouchableOpacity>
      </View>

    </View>
  );
}

export const getBarberBookingId = (barber: {
  id: string;
  userId?: string | null;
}): string => barber.userId ?? barber.id;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerSpacer: { width: 40 },
  stepText: { fontFamily: theme.fonts.medium, fontSize: theme.fontSizes.xs, color: theme.colors.gold, letterSpacing: 2, marginBottom: 2 },
  title:    { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.xxl, color: theme.colors.textPrimary, letterSpacing: 4, textAlign: 'center' },
  progressBar: {
    height: 3, backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.lg, borderRadius: theme.radius.full, marginBottom: theme.spacing.md,
  },
  progressFill: { height: '100%', backgroundColor: theme.colors.gold, borderRadius: theme.radius.full },
  servicePill: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs,
    backgroundColor: theme.colors.goldMuted, borderWidth: 1, borderColor: theme.colors.gold,
    borderRadius: theme.radius.full, paddingVertical: theme.spacing.xs, paddingHorizontal: theme.spacing.md,
    alignSelf: 'flex-start', marginHorizontal: theme.spacing.lg, marginBottom: theme.spacing.lg,
  },
  servicePillText: { fontFamily: theme.fonts.medium, fontSize: theme.fontSizes.xs, color: theme.colors.gold, letterSpacing: 1 },
  loader:     { flex: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md },
  emptyTitle: { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.xl, color: theme.colors.textSecondary, letterSpacing: 2 },
  emptySubtitle: { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.sm, color: theme.colors.textMuted },
  scroll: { padding: theme.spacing.lg, paddingTop: 0, gap: theme.spacing.md },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.border,
    padding: theme.spacing.lg, flexDirection: 'row', alignItems: 'center',
    gap: theme.spacing.md, ...theme.shadows.md,
  },
  cardSelected: { borderColor: theme.colors.gold, backgroundColor: theme.colors.goldMuted },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: theme.colors.goldMuted,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarSelected: { backgroundColor: theme.colors.gold },
  avatarImage:    { width: 64, height: 64, borderRadius: 32 },
  cardInfo:       { flex: 1, gap: theme.spacing.xs },
  barberName: {
    fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.lg,
    color: theme.colors.textPrimary, letterSpacing: 2,
  },
  barberNameSelected: { color: theme.colors.gold },
  ratingRow:  { flexDirection: 'row', alignItems: 'center', gap: 2 },
  reviewCount:{ fontFamily: theme.fonts.body, fontSize: theme.fontSizes.xs, color: theme.colors.textMuted, marginLeft: 4 },
  specialties:{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs, marginTop: 2 },
  specialtyTag: {
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.full, paddingVertical: 2, paddingHorizontal: theme.spacing.sm,
  },
  specialtyText: { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.xs, color: theme.colors.textMuted },
  footer: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xl, borderTopWidth: 1, borderTopColor: theme.colors.border },
  button: {
    backgroundColor: theme.colors.gold, borderRadius: theme.radius.md, padding: theme.spacing.md,
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
    gap: theme.spacing.sm, ...theme.shadows.gold,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.md, color: theme.colors.textInverse, letterSpacing: 2 },
});