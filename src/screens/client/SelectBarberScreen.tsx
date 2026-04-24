import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Image,
  Animated,
} from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BookStackParamList } from '@/navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { COLLECTIONS } from '@/constants/collections';
import { BarberService } from '@/services/barber.service';
import { colors, fonts, spacing, radius, shadows, icons, animations } from '@/theme';

// ==========================================
// Types
// ==========================================
type Props = NativeStackScreenProps<BookStackParamList, 'SelectBarber'>;

interface BarberOption {
  id: string;
  name: string;
  title: string;
  experience: string;
  specialty: string;
  rating: number;
  reviews: number;
  initials: string;
  photoURL: string | null;
}

// ==========================================
// Fallback barbers
// ==========================================
const FALLBACK_BARBERS: BarberOption[] = [
  { id: 'barber-james', name: 'James', title: 'Senior Barber', experience: '5 yrs exp', specialty: 'Fades & Tapers', rating: 4.9, reviews: 142, initials: 'JA', photoURL: null },
  { id: 'barber-akim', name: 'Akim', title: 'Style Specialist', experience: '3 yrs exp', specialty: 'Beard Sculpting', rating: 4.8, reviews: 98, initials: 'AK', photoURL: null },
  { id: 'barber-amir', name: 'Amir Joseph', title: 'Master Barber', experience: '10 yrs exp', specialty: 'All Styles', rating: 5.0, reviews: 311, initials: 'AJ', photoURL: null },
];

// ==========================================
// Animated Barber Card Component
// ==========================================
interface BarberCardProps {
  barber: BarberOption;
  isSelected: boolean;
  onPress: () => void;
  index: number;
}

function BarberCard({ barber, isSelected, onPress, index }: BarberCardProps): React.JSX.Element {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // Entrance animation
  useEffect(() => {
    const delay = index * 60;
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: animations.normal, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: animations.normal, useNativeDriver: true }),
      ]).start();
    }, delay);
  }, []);

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: animations.pressScale, useNativeDriver: true, friction: 5 }).start();
  }, []);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: animations.activeScale, useNativeDriver: true, friction: 5 }).start();
  }, []);

  const hasReviews = barber.reviews > 0 && barber.rating > 0;
  const reviewText = barber.reviews === 1 ? '1 review' : `${barber.reviews} reviews`;

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        { transform: [{ scale: scaleAnim }, { translateY: slideAnim }], opacity: fadeAnim },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={`Select ${barber.name}`}
        accessibilityState={{ selected: isSelected }}
      >
        <View style={[styles.card, isSelected && styles.cardSelected]}>
          <View style={styles.cardInner}>
            {/* Avatar */}
            <View style={[styles.avatar, { borderColor: isSelected ? colors.gold : colors.border }]}>
              {barber.photoURL ? (
                <Image
                  source={{ uri: barber.photoURL }}
                  style={styles.avatarImg}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <Text style={[styles.avatarText, { color: isSelected ? colors.gold : colors.grey }]}>
                  {barber.initials}
                </Text>
              )}
              {isSelected && (
                <View style={styles.avatarCheck}>
                  <Ionicons name={icons.check} size={20} color={colors.gold} />
                </View>
              )}
            </View>

            {/* Info */}
            <View style={styles.cardInfo}>
              <View style={styles.nameLine}>
                <Text style={[styles.barberName, isSelected && { color: colors.gold }]}>
                  {barber.name}
                </Text>
                {barber.rating >= 4.9 && barber.reviews > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>TOP</Text>
                  </View>
                )}
              </View>

              <Text style={styles.barberTitle}>{barber.title}</Text>

              <Text style={styles.ratingLine}>
                {hasReviews
                  ? `${barber.rating.toFixed(1)} ${barber.rating >= 4.8 ? '★' : '☆'} (${reviewText})`
                  : 'New barber'}
              </Text>

              <View style={styles.tagRow}>
                <View style={styles.tag}>
                  <Ionicons name={icons.cutOutline} size={11} color={colors.gold} style={{ marginRight: 3 }} />
                  <Text style={styles.tagText}>{barber.specialty}</Text>
                </View>
                {barber.experience !== '' && (
                  <View style={styles.tag}>
                    <Ionicons name={icons.time} size={11} color={colors.grey} style={{ marginRight: 3 }} />
                    <Text style={[styles.tagText, { color: colors.grey }]}>{barber.experience}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Select indicator */}
            <View style={[styles.selectCircle, isSelected && styles.selectCircleActive]}>
              {isSelected ? (
                <Ionicons name={icons.checkmark} size={16} color={colors.background} />
              ) : (
                <Ionicons name={icons.forward} size={16} color={colors.greyDark} />
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ==========================================
// Main Screen Component
// ==========================================
export default function SelectBarberScreen({ route, navigation }: Props): React.JSX.Element {
  const { serviceId } = route.params;
  const [barbers, setBarbers] = useState<BarberOption[]>([]);
  const [loadingBar, setLoadingBar] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const btnScaleAnim = useRef(new Animated.Value(1)).current;

  // Load barbers from Firestore
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const res = await BarberService.getAll();
        if (!mounted) return;
        if (!res.success || res.data.length === 0) {
          setBarbers(FALLBACK_BARBERS);
          setLoadingBar(false);
          return;
        }

        const available = res.data.filter((b) => b.isAvailable);
        const mapped: BarberOption[] = await Promise.all(
          available.map(async (b) => {
            let rating = 0;
            let reviews = 0;
            try {
              const snap = await getDoc(doc(db, COLLECTIONS.BARBERS, b.id));
              if (snap.exists()) {
                const d = snap.data();
                rating = typeof d.rating === 'number' ? d.rating : 0;
                reviews = typeof d.reviewCount === 'number' ? d.reviewCount : 0;
              }
            } catch {
              rating = typeof b.rating === 'number' ? b.rating : 0;
              reviews = typeof b.reviewCount === 'number' ? b.reviewCount : 0;
            }

            return {
              id: b.id,
              name: b.displayName,
              title: b.specialties.length > 0 ? b.specialties[0] : 'Barber',
              experience: '',
              specialty: b.specialties.join(' · ') || 'All Styles',
              rating,
              reviews,
              initials: b.displayName.substring(0, 2).toUpperCase(),
              photoURL: b.photoURL ?? null,
            };
          }),
        );

        if (!mounted) return;
        setBarbers(mapped.length > 0 ? mapped : FALLBACK_BARBERS);
      } catch {
        if (mounted) setBarbers(FALLBACK_BARBERS);
      } finally {
        if (mounted) setLoadingBar(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  function handleSelect(id: string): void {
    setSelectedId(prev => (prev === id ? null : id));
  }

  function handleContinue(): void {
    if (!selectedId) return;
    const selected = barbers.find(b => b.id === selectedId);
    if (!selected) return;

    navigation.navigate('SelectDateTime', {
      barberId: selected.id,
      serviceId,
      barberName: selected.name,
    });
  }

  function btnPressIn(): void {
    if (!selectedId) return;
    Animated.spring(btnScaleAnim, { toValue: animations.pressScale, useNativeDriver: true, friction: 5 }).start();
  }

  function btnPressOut(): void {
    Animated.spring(btnScaleAnim, { toValue: animations.activeScale, useNativeDriver: true, friction: 5 }).start();
  }

  const selectedBarber = barbers.find(b => b.id === selectedId);
  const btnLabel = selectedBarber
    ? `Continue with ${selectedBarber.name}`
    : 'Select a Barber to Continue';

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name={icons.back} size={24} color={colors.gold} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Choose Your Barber</Text>
          <Text style={styles.headerSub}>Select who will be cutting your hair</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.divider} />

      {/* Body */}
      {loadingBar ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size={32} color={colors.gold} />
          <Text style={styles.loadingText}>Finding available barbers…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {barbers.map((barber, idx) => {
            const isSelected = selectedId === barber.id;
            return (
              <BarberCard
                key={barber.id}
                barber={barber}
                isSelected={isSelected}
                onPress={() => handleSelect(barber.id)}
                index={idx}
              />
            );
          })}

          <View style={{ height: 120 }} />
        </ScrollView>
      )}

      {/* Footer button */}
      <View style={styles.footer}>
        <Animated.View style={[{ transform: [{ scale: btnScaleAnim }] }]}>
          <TouchableOpacity
            style={[styles.continueBtn, !selectedId && styles.continueBtnDisabled]}
            onPress={handleContinue}
            onPressIn={btnPressIn}
            onPressOut={btnPressOut}
            disabled={!selectedId}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={btnLabel}
            accessibilityState={{ disabled: !selectedId }}
          >
            {selectedId && (
              <Ionicons name={icons.checkOutline} size={20} color={colors.background} style={{ marginRight: 8 }} />
            )}
            <Text style={[styles.continueBtnText, !selectedId && { color: colors.greyDark }]}>
              {btnLabel}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

// ==========================================
// Styles
// ==========================================
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fonts.size.xl,
    fontFamily: fonts.heading,
    color: colors.white,
    letterSpacing: fonts.letterSpacing.wide,
  },
  headerSub: {
    fontSize: fonts.size.sm,
    color: colors.grey,
    marginTop: spacing.xs,
    fontFamily: fonts.body,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
  },

  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  loadingText: {
    fontSize: fonts.size.md,
    color: colors.greyDark,
    fontFamily: fonts.body,
  },

  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },

  cardContainer: {
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.sm,
  },
  cardSelected: {
    borderColor: colors.gold,
    ...shadows.gold,
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },

  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
    overflow: 'hidden',
  },
  avatarImg: {
    width: 64,
    height: 64,
    borderRadius: 30,
  },
  avatarText: {
    fontSize: fonts.size['2xl'],
    fontFamily: fonts.bodyBold,
    letterSpacing: fonts.letterSpacing.wide,
  },
  avatarCheck: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
  },

  cardInfo: {
    flex: 1,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  barberName: {
    fontSize: fonts.size.lg,
    fontFamily: fonts.bodyBold,
    color: colors.white,
    marginRight: spacing.sm,
  },
  barberTitle: {
    fontSize: fonts.size.sm,
    color: colors.grey,
    marginBottom: spacing.sm,
    fontFamily: fonts.body,
  },

  badge: {
    backgroundColor: colors.gold,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: fonts.bodyBold,
    color: colors.background,
    letterSpacing: fonts.letterSpacing.normal,
  },

  ratingLine: {
    fontSize: fonts.size.md,
    color: colors.gold,
    fontFamily: fonts.bodyBold,
    marginBottom: spacing.sm,
  },

  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: fonts.size.xs,
    color: colors.gold,
    fontFamily: fonts.bodySemiBold,
  },

  selectCircle: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  selectCircleActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  continueBtn: {
    flexDirection: 'row',
    backgroundColor: colors.gold,
    borderRadius: radius['2xl'],
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.gold,
  },
  continueBtnDisabled: {
    backgroundColor: colors.surfaceRaised,
  },
  continueBtnText: {
    fontSize: fonts.size.md,
    fontFamily: fonts.bodyBold,
    color: colors.background,
    letterSpacing: fonts.letterSpacing.normal,
  },
});
