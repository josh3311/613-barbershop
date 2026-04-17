import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
  Image,
} from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BookStackParamList } from '@/navigation/types';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { COLLECTIONS } from '@/constants/collections';
import { BarberService } from '@/services/barber.service';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<BookStackParamList, 'SelectBarber'>;

interface BarberOption {
  id:          string;   // Firebase UID (real) or fallback mock ID
  name:        string;
  title:       string;
  experience:  string;
  specialty:   string;
  rating:      number;
  reviews:     number;
  initials:    string;
  photoURL:    string | null;
}

// ─── Fallback barbers (shown while loading or if no Firestore barbers exist) ──

const FALLBACK_BARBERS: BarberOption[] = [
  { id: 'barber-james', name: 'James',       title: 'Senior Barber',   experience: '5 yrs exp',  specialty: 'Fades & Tapers',   rating: 4.9, reviews: 142, initials: 'JA', photoURL: null },
  { id: 'barber-akim',  name: 'Akim',        title: 'Style Specialist', experience: '3 yrs exp', specialty: 'Beard Sculpting',  rating: 4.8, reviews: 98,  initials: 'AK', photoURL: null },
  { id: 'barber-amir',  name: 'Amir Joseph', title: 'Master Barber',   experience: '10 yrs exp', specialty: 'All Styles',       rating: 5.0, reviews: 311, initials: 'AJ', photoURL: null },
];

const GOLD = '#D4AF37';
const BG   = '#0A0A0A';
const CARD = '#161616';

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function SelectBarberScreen({ route, navigation }: Props): React.JSX.Element {
  const { serviceId } = route.params;
  const [barbers,    setBarbers]    = useState<BarberOption[]>([]);
  const [loadingBar, setLoadingBar] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const btnScale = useRef(new Animated.Value(1)).current;

  // ── Load barbers from `barbers` collection; refresh rating/reviewCount per doc via getDoc ──
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

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function handleSelect(id: string): void {
    setSelectedId(prev => (prev === id ? null : id));
  }

  function handleContinue(): void {
    if (!selectedId) return;
    const selected = barbers.find(b => b.id === selectedId);
    if (!selected) return;

    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(btnScale, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start(() => {
      navigation.navigate('SelectDateTime', {
        barberId: selected.id,
        serviceId,
        barberName: selected.name,
      });
    });
  }

  const selectedBarber = barbers.find(b => b.id === selectedId);
  const btnLabel = selectedBarber
    ? `Continue with ${selectedBarber.name}`
    : 'Select a Barber to Continue';

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={st.root}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity
          style={st.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={GOLD} />
        </TouchableOpacity>
        <View style={st.headerCenter}>
          <Text style={st.headerTitle}>Choose Your Barber</Text>
          <Text style={st.headerSub}>Select who will be cutting your hair</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>
      <View style={st.divider} />

      {/* Body */}
      {loadingBar ? (
        <View style={st.loadingWrap}>
          <ActivityIndicator size={32} color={GOLD} />
          <Text style={st.loadingText}>Finding available barbers…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={st.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {barbers.map((barber) => {
            const isSelected = selectedId === barber.id;
            const hasReviews =
              barber.reviews > 0 &&
              typeof barber.rating === 'number' &&
              barber.rating > 0;
            return (
              <TouchableOpacity
                key={barber.id}
                activeOpacity={0.85}
                onPress={() => handleSelect(barber.id)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${barber.name}`}
                accessibilityState={{ selected: isSelected }}
              >
                <View style={[st.card, isSelected && st.cardSelected]}>
                  <View style={st.cardInner}>
                    {/* Avatar */}
                    <View style={[st.avatar, { borderColor: isSelected ? GOLD : '#2A2A2A' }]}>
                      {barber.photoURL ? (
                        <Image
                          source={{ uri: barber.photoURL }}
                          style={st.avatarImg}
                          resizeMode="cover"
                          accessibilityIgnoresInvertColors
                        />
                      ) : (
                        <Text style={[st.avatarText, { color: isSelected ? GOLD : '#888' }]}>
                          {barber.initials}
                        </Text>
                      )}
                      {isSelected && (
                        <View style={st.avatarCheck}>
                          <Ionicons name="checkmark-circle" size={20} color={GOLD} />
                        </View>
                      )}
                    </View>

                    {/* Info */}
                    <View style={st.cardInfo}>
                      <View style={st.nameLine}>
                        <Text style={[st.barberName, isSelected && { color: GOLD }]}>
                          {barber.name}
                        </Text>
                        {barber.rating >= 4.9 && barber.reviews > 0 && (
                          <View style={st.badge}>
                            <Text style={st.badgeText}>TOP</Text>
                          </View>
                        )}
                      </View>

                      <Text style={st.barberTitle}>{barber.title}</Text>

                      <Text style={st.ratingLine}>
                        {hasReviews
                          ? `${barber.rating.toFixed(1)} ★ (${barber.reviews} reviews)`
                          : 'New barber'}
                      </Text>

                      <View style={st.tagRow}>
                        <View style={st.tag}>
                          <Ionicons name="cut-outline" size={11} color={GOLD} style={{ marginRight: 3 }} />
                          <Text style={st.tagText}>{barber.specialty}</Text>
                        </View>
                        {barber.experience !== '' && (
                          <View style={st.tag}>
                            <Ionicons name="time-outline" size={11} color="#888" style={{ marginRight: 3 }} />
                            <Text style={[st.tagText, { color: '#888' }]}>{barber.experience}</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Select indicator */}
                    <View style={[st.selectCircle, isSelected && st.selectCircleActive]}>
                      {isSelected
                        ? <Ionicons name="checkmark" size={16} color={BG} />
                        : <Ionicons name="chevron-forward" size={16} color="#555" />
                      }
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={{ height: 120 }} />
        </ScrollView>
      )}

      {/* Footer button */}
      <View style={st.footer}>
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={[st.continueBtn, !selectedId && st.continueBtnDisabled]}
            onPress={handleContinue}
            disabled={!selectedId}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={btnLabel}
            accessibilityState={{ disabled: !selectedId }}
          >
            {selectedId && (
              <Ionicons name="checkmark-circle-outline" size={20} color={BG} style={{ marginRight: 8 }} />
            )}
            <Text style={[st.continueBtnText, !selectedId && { color: '#555' }]}>
              {btnLabel}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#161616',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  headerSub:   { fontSize: 12, color: '#666', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#1E1E1E' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { fontSize: 13, color: '#555' },

  scroll: { paddingHorizontal: 16, paddingTop: 20 },

  card: {
    backgroundColor: CARD,
    borderRadius: 16, borderWidth: 1.5, borderColor: '#222',
    marginBottom: 14, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  cardSelected: {
    borderColor: GOLD,
    ...Platform.select({
      ios: { shadowColor: GOLD, shadowOpacity: 0.25 },
      android: { elevation: 8 },
    }),
  },
  cardInner: { flexDirection: 'row', alignItems: 'center', padding: 16 },

  avatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#1E1E1E', borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
    overflow: 'hidden',
  },
  avatarImg: { width: 64, height: 64, borderRadius: 30 },
  avatarText: { fontSize: 20, fontWeight: '800', letterSpacing: 1 },
  avatarCheck: { position: 'absolute', bottom: -2, right: -2, backgroundColor: BG, borderRadius: 12 },

  cardInfo: { flex: 1 },
  nameLine:  { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  barberName: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', marginRight: 6 },
  barberTitle: { fontSize: 12, color: '#888', marginBottom: 5 },

  badge: { backgroundColor: GOLD, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  badgeText: { fontSize: 9, fontWeight: '900', color: BG, letterSpacing: 0.5 },

  ratingLine: {
    fontSize: 13,
    color: GOLD,
    fontWeight: '700',
    marginBottom: 8,
  },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  tag: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E1E1E', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  tagText: { fontSize: 11, color: GOLD, fontWeight: '600' },

  selectCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#1E1E1E', borderWidth: 1, borderColor: '#333',
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  selectCircleActive: { backgroundColor: GOLD, borderColor: GOLD },

  anyCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#222', borderStyle: 'dashed',
    padding: 16, marginBottom: 14,
  },
  anyTitle: { fontSize: 15, fontWeight: '700', color: '#AAA', marginBottom: 2 },
  anySub:   { fontSize: 12, color: '#555' },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: BG,
    paddingHorizontal: 20, paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    borderTopWidth: 1, borderTopColor: '#1E1E1E',
  },
  continueBtn: {
    flexDirection: 'row',
    backgroundColor: GOLD, borderRadius: 14, height: 54,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: GOLD, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 10 },
      android: { elevation: 8 },
    }),
  },
  continueBtnDisabled: { backgroundColor: '#1A1A1A' },
  continueBtnText: { fontSize: 16, fontWeight: '800', color: BG, letterSpacing: 0.3 },
});
