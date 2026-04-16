import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Animated,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookStackParamList } from '@/navigation/types';
import { Service, ServiceCategory } from '@/types';

// ─── Theme ────────────────────────────────────────────────────────────────────

const C = {
  bg:              '#0A0A0A',
  surface:         '#161616',
  surfaceHigh:     '#1E1E1E',
  card:            '#141414',
  gold:            '#D4AF37',
  goldDark:        '#A8861A',
  goldLight:       '#EDD060',
  goldGlow:        '#D4AF3720',
  goldBorder:      '#D4AF3780',
  white:           '#FFFFFF',
  textSub:         '#999999',
  textMuted:       '#555555',
  divider:         '#1F1F1F',
  errorSurface:    '#2A1010',
} as const;

const { width: SW } = Dimensions.get('window');
const CARD_PAD = 20;

// ─── Static service catalogue ─────────────────────────────────────────────────

const SERVICES: Service[] = [
  {
    id: 's1',
    name: 'Fade',
    description: 'Skin, low or mid fade blended to perfection with crisp razor edges.',
    price: 40,
    durationMinutes: 30,
    category: 'haircut' as ServiceCategory,
    imageURL: null,
    isActive: true,
    createdAt: null as any,
    updatedAt: null as any,
  },
  {
    id: 's2',
    name: 'Lineup',
    description: 'Sharp edge-up along the hairline, temples and sideburns.',
    price: 15,
    durationMinutes: 15,
    category: 'haircut' as ServiceCategory,
    imageURL: null,
    isActive: true,
    createdAt: null as any,
    updatedAt: null as any,
  },
  {
    id: 's3',
    name: 'Beard Trim',
    description: 'Shape, define and detail your beard with straight-razor finishing.',
    price: 25,
    durationMinutes: 20,
    category: 'beard' as ServiceCategory,
    imageURL: null,
    isActive: true,
    createdAt: null as any,
    updatedAt: null as any,
  },
  {
    id: 's4',
    name: 'Haircut',
    description: 'Classic or modern cut styled to your face shape and preference.',
    price: 35,
    durationMinutes: 45,
    category: 'haircut' as ServiceCategory,
    imageURL: null,
    isActive: true,
    createdAt: null as any,
    updatedAt: null as any,
  },
  {
    id: 's5',
    name: 'Beard + Haircut',
    description: 'Full combo session — haircut, fade and complete beard sculpt.',
    price: 50,
    durationMinutes: 60,
    category: 'combo' as ServiceCategory,
    imageURL: null,
    isActive: true,
    createdAt: null as any,
    updatedAt: null as any,
  },
];

// ─── Category icon map (Ionicons names) ──────────────────────────────────────

const ICON: Record<ServiceCategory, keyof typeof Ionicons.glyphMap> = {
  haircut:   'cut-outline',
  beard:     'cut-outline',
  combo:     'star-outline',
  treatment: 'leaf-outline',
  other:     'ellipse-outline',
};

// ─── Duration formatter ───────────────────────────────────────────────────────

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<BookStackParamList, 'SelectService'>;

// ─── ServiceCard ──────────────────────────────────────────────────────────────

interface CardProps {
  service: Service;
  selected: boolean;
  onPress: (s: Service) => void;
}

function ServiceCard({ service, selected, onPress }: CardProps): React.JSX.Element {
  const scale = useRef(new Animated.Value(1)).current;

  function pressIn(): void {
    Animated.spring(scale, { toValue: 0.972, useNativeDriver: true, speed: 80, bounciness: 2 }).start();
  }
  function pressOut(): void {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 80, bounciness: 2 }).start();
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      {/* Gold halo behind selected card */}
      {selected && <View style={styles.cardHalo} />}

      <TouchableOpacity
        onPress={() => onPress(service)}
        onPressIn={pressIn}
        onPressOut={pressOut}
        activeOpacity={1}
        style={[styles.card, selected && styles.cardSelected]}
        accessibilityRole="button"
        accessibilityLabel={`${service.name}, $${service.price}, ${fmtDuration(service.durationMinutes)}`}
        accessibilityState={{ selected }}
      >
        {/* Gold top accent bar */}
        <View style={[styles.cardAccentBar, selected && styles.cardAccentBarActive]} />

        <View style={styles.cardInner}>
          {/* Icon badge */}
          <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
            <Ionicons
              name={ICON[service.category]}
              size={22}
              color={selected ? '#0A0A0A' : '#D4AF37'}
            />
          </View>

          {/* Info */}
          <View style={styles.cardInfo}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardName} numberOfLines={1}>{service.name}</Text>
              {selected && (
                <View style={styles.checkBadge} accessibilityLabel="Selected">
                  <Ionicons name="checkmark-circle" size={20} color="#D4AF37" />
                </View>
              )}
            </View>
            <Text style={styles.cardDesc} numberOfLines={2}>{service.description}</Text>
            <View style={styles.pillRow}>
              <View style={[styles.pill, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                <Ionicons name="time-outline" size={11} color="#999999" />
                <Text style={styles.pillText}>{fmtDuration(service.durationMinutes)}</Text>
              </View>
              <View style={[styles.pill, styles.pillCategory]}>
                <Text style={[styles.pillText, styles.pillCategoryText]}>
                  {service.category.charAt(0).toUpperCase() + service.category.slice(1)}
                </Text>
              </View>
            </View>
          </View>

          {/* Price */}
          <View style={styles.priceCol}>
            <Text style={[styles.priceDollar, selected && styles.priceDollarActive]}>$</Text>
            <Text style={[styles.priceNum, selected && styles.priceNumActive]}>
              {service.price}
            </Text>
          </View>
        </View>

        {/* Bottom depth strip */}
        <View style={[styles.depthStrip, selected && styles.depthStripActive]} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ServicesScreen({ route, navigation }: Props): React.JSX.Element {
  const { barberId } = route.params;
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Service | null>(null);

  const btnScale = useRef(new Animated.Value(1)).current;

  function toggleSelect(service: Service): void {
    setSelected(prev => prev?.id === service.id ? null : service);
  }

  function handleContinue(): void {
    if (!selected) return;
    navigation.navigate('SelectDateTime', { barberId, serviceId: selected.id });
  }

  function btnPressIn(): void {
    if (!selected) return;
    Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 60, bounciness: 3 }).start();
  }
  function btnPressOut(): void {
    Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 60, bounciness: 3 }).start();
  }

  const canContinue = !!selected;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={styles.header} accessibilityRole="header">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
        >
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Choose Your Service</Text>
          <Text style={styles.headerSub}>613 BARBERSHOP</Text>
        </View>

        {/* Spacer to centre the title */}
        <View style={styles.backBtn} />
      </View>

      {/* Gold separator under header */}
      <View style={styles.headerLine} />

      {/* ── Service list ──────────────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Count label */}
        <View style={styles.countRow}>
          <View style={styles.countLine} />
          <Text style={styles.countText}>{SERVICES.length} SERVICES AVAILABLE</Text>
          <View style={styles.countLine} />
        </View>

        {SERVICES.map((svc, idx) => (
          <View key={svc.id} style={idx > 0 ? styles.cardGap : undefined}>
            <ServiceCard
              service={svc}
              selected={selected?.id === svc.id}
              onPress={toggleSelect}
            />
          </View>
        ))}
      </ScrollView>

      {/* ── Bottom bar ────────────────────────────────────────────────────── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 14 }]}>
        {/* Selection summary row */}
        {selected ? (
          <View
            style={styles.summary}
            accessible
            accessibilityLabel={`Selected: ${selected.name}, $${selected.price}`}
          >
            <Text style={styles.summaryLabel}>SELECTED</Text>
            <View style={styles.summaryRight}>
              <Text style={styles.summaryName} numberOfLines={1}>{selected.name}</Text>
              <Text style={styles.summaryPrice}>${selected.price}</Text>
            </View>
          </View>
        ) : (
          <Text
            style={styles.hintText}
            accessibilityRole="text"
          >
            Tap a service card to select it
          </Text>
        )}

        {/* Continue button */}
        <Animated.View style={[styles.btnWrapper, { transform: [{ scale: btnScale }] }]}>
          {/* Glow layer */}
          {canContinue && <View style={styles.btnGlow} />}

          <TouchableOpacity
            onPress={handleContinue}
            onPressIn={btnPressIn}
            onPressOut={btnPressOut}
            disabled={!canContinue}
            activeOpacity={1}
            style={[styles.btn, !canContinue && styles.btnDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Continue to Book"
            accessibilityHint={canContinue ? `Book ${selected!.name}` : 'Select a service first'}
            accessibilityState={{ disabled: !canContinue }}
          >
            <Text style={[styles.btnText, !canContinue && styles.btnTextDisabled]}>
              Continue to Book
            </Text>
            {/* Depth strip */}
            {canContinue && <View style={styles.btnDepth} />}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_W = SW - CARD_PAD * 2;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 36,
    alignItems: 'center',
  },
  backChevron: {
    fontSize: 38,
    color: C.gold,
    lineHeight: 42,
    marginTop: -6,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: C.white,
    letterSpacing: 0.5,
  },
  headerSub: {
    fontSize: 10,
    color: C.gold,
    letterSpacing: 3,
    fontWeight: '700',
    marginTop: 2,
  },
  headerLine: {
    height: 1,
    marginHorizontal: 20,
    backgroundColor: C.gold,
    opacity: 0.3,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },

  // ── List ─────────────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: CARD_PAD,
    paddingTop: 16,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  countLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.divider,
  },
  countText: {
    fontSize: 10,
    color: C.textMuted,
    letterSpacing: 2,
    fontWeight: '700',
    marginHorizontal: 10,
  },
  cardGap: {
    marginTop: 14,
  },

  // ── Card ─────────────────────────────────────────────────────────────────────
  cardHalo: {
    position: 'absolute',
    top: 5,
    left: 6,
    right: 6,
    bottom: -4,
    backgroundColor: C.gold,
    borderRadius: 18,
    opacity: 0.1,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 0,
  },
  card: {
    width: CARD_W,
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#252525',
    overflow: 'hidden',
    // 3D depth shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 14,
  },
  cardSelected: {
    borderColor: C.gold,
    backgroundColor: '#181510',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 18,
  },
  cardAccentBar: {
    height: 3,
    backgroundColor: '#252525',
  },
  cardAccentBarActive: {
    backgroundColor: C.gold,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 14,
  },

  // Icon badge
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#1C1C1C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    flexShrink: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
  },
  iconWrapSelected: {
    backgroundColor: C.goldGlow,
    borderColor: C.goldBorder,
  },
  iconText: {
    fontSize: 24,
  },

  // Info column
  cardInfo: {
    flex: 1,
    gap: 5,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardName: {
    fontSize: 17,
    fontWeight: '800',
    color: C.white,
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkMark: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A0A0A',
    lineHeight: 15,
  },
  cardDesc: {
    fontSize: 12,
    color: C.textSub,
    lineHeight: 17,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  pill: {
    backgroundColor: '#222222',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2E2E2E',
  },
  pillText: {
    fontSize: 10,
    color: C.textMuted,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  pillCategory: {
    backgroundColor: C.goldGlow,
    borderColor: '#D4AF3730',
  },
  pillCategoryText: {
    color: C.gold,
  },

  // Price column
  priceCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
  priceDollar: {
    fontSize: 14,
    fontWeight: '700',
    color: C.textSub,
    lineHeight: 16,
    alignSelf: 'flex-end',
  },
  priceDollarActive: {
    color: C.goldLight,
  },
  priceNum: {
    fontSize: 30,
    fontWeight: '900',
    color: C.textSub,
    letterSpacing: -1,
    lineHeight: 32,
  },
  priceNumActive: {
    color: C.gold,
  },

  // Bottom depth strip
  depthStrip: {
    height: 4,
    backgroundColor: '#0D0D0D',
    opacity: 0.8,
  },
  depthStripActive: {
    backgroundColor: C.goldDark,
    opacity: 0.45,
  },

  // ── Bottom bar ────────────────────────────────────────────────────────────────
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.surface,
    paddingTop: 14,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#1E1E1E',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.7,
    shadowRadius: 18,
    elevation: 24,
  },

  // Selection summary
  hintText: {
    fontSize: 12,
    color: C.textMuted,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surfaceHigh,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: C.goldBorder,
  },
  summaryLabel: {
    fontSize: 10,
    color: C.gold,
    fontWeight: '800',
    letterSpacing: 2,
  },
  summaryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryName: {
    fontSize: 14,
    fontWeight: '700',
    color: C.white,
    maxWidth: SW * 0.42,
  },
  summaryPrice: {
    fontSize: 17,
    fontWeight: '900',
    color: C.gold,
    letterSpacing: -0.3,
  },

  // Continue button
  btnWrapper: {
    position: 'relative',
  },
  btnGlow: {
    position: 'absolute',
    top: 4,
    left: 12,
    right: 12,
    bottom: -4,
    backgroundColor: C.gold,
    borderRadius: 14,
    opacity: 0.22,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
  },
  btn: {
    height: 54,
    borderRadius: 14,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: C.goldLight + '70',
    shadowColor: C.goldDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden',
  },
  btnDisabled: {
    backgroundColor: '#1C1C1C',
    borderTopColor: 'transparent',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    elevation: 3,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0A0A0A',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  btnTextDisabled: {
    color: C.textMuted,
  },
  btnDepth: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: C.goldDark,
    opacity: 0.5,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
});
