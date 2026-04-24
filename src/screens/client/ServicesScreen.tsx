import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import { colors, fonts, spacing, radius, shadows, icons, animations } from '@/theme';

const { width: SW } = Dimensions.get('window');
const CARD_PAD = 20;

// ==========================================
// Static service catalogue
// ==========================================
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

// ==========================================
// Category icon map (Ionicons names)
// ==========================================
const ICON: Record<ServiceCategory, keyof typeof Ionicons.glyphMap> = {
  haircut: icons.cutOutline,
  beard: icons.cutOutline,
  combo: icons.starOutline,
  treatment: icons.colorWandOutline,
  other: icons.ellipseOutline,
};

// ==========================================
// Duration formatter
// ==========================================
function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ==========================================
// Types
// ==========================================
type Props = NativeStackScreenProps<BookStackParamList, 'SelectService'>;

// ==========================================
// Animated Card Component
// ==========================================
interface CardProps {
  service: Service;
  selected: boolean;
  onPress: (s: Service) => void;
  index: number;
}

function ServiceCard({ service, selected, onPress, index }: CardProps): React.JSX.Element {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // Entrance animation on mount
  useEffect(() => {
    const delay = index * 50;
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

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        { transform: [{ scale: scaleAnim }, { translateY: slideAnim }], opacity: fadeAnim },
      ]}
    >
      {/* Gold halo behind selected card */}
      {selected && <View style={styles.cardHalo} />}

      <TouchableOpacity
        onPress={() => onPress(service)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
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
              color={selected ? colors.background : colors.gold}
            />
          </View>

          {/* Info */}
          <View style={styles.cardInfo}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardName} numberOfLines={1}>{service.name}</Text>
              {selected && (
                <View style={styles.checkBadge} accessibilityLabel="Selected">
                  <Ionicons name={icons.check} size={20} color={colors.gold} />
                </View>
              )}
            </View>
            <Text style={styles.cardDesc} numberOfLines={2}>{service.description}</Text>
            <View style={styles.pillRow}>
              <View style={[styles.pill, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                <Ionicons name={icons.time} size={11} color={colors.grey} />
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

// ==========================================
// Main Screen Component
// ==========================================
export default function ServicesScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Service | null>(null);
  const btnScaleAnim = useRef(new Animated.Value(1)).current;

  function toggleSelect(service: Service): void {
    setSelected(prev => prev?.id === service.id ? null : service);
  }

  function handleContinue(): void {
    if (!selected) return;
    navigation.navigate('SelectBarber', { serviceId: selected.id });
  }

  function btnPressIn(): void {
    if (!selected) return;
    Animated.spring(btnScaleAnim, { toValue: animations.pressScale, useNativeDriver: true, friction: 5 }).start();
  }

  function btnPressOut(): void {
    Animated.spring(btnScaleAnim, { toValue: animations.activeScale, useNativeDriver: true, friction: 5 }).start();
  }

  const canContinue = !!selected;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header} accessibilityRole="header">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
        >
          <Ionicons name={icons.back} size={22} color={colors.white} />
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

      {/* Service list */}
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
              index={idx}
            />
          </View>
        ))}
      </ScrollView>

      {/* Bottom bar */}
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
        <Animated.View style={[styles.btnWrapper, { transform: [{ scale: btnScaleAnim }] }]}>
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

// ==========================================
// Styles
// ==========================================
const CARD_W = SW - CARD_PAD * 2;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  backBtn: {
    width: 36,
    alignItems: 'center',
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
    fontSize: fonts.size.xs,
    color: colors.gold,
    letterSpacing: fonts.letterSpacing.widest,
    fontFamily: fonts.bodySemiBold,
    marginTop: spacing.xs,
  },
  headerLine: {
    height: 1,
    marginHorizontal: spacing.xl,
    backgroundColor: colors.gold,
    opacity: 0.3,
  },

  // List
  listContent: {
    paddingHorizontal: CARD_PAD,
    paddingTop: spacing.lg,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  countLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderSubtle,
  },
  countText: {
    fontSize: fonts.size.xs,
    color: colors.greyDark,
    letterSpacing: fonts.letterSpacing.wider,
    fontFamily: fonts.bodySemiBold,
    marginHorizontal: spacing.md,
  },
  cardGap: {
    marginTop: spacing.md,
  },
  cardContainer: {
    position: 'relative',
  },

  // Card
  cardHalo: {
    position: 'absolute',
    top: 5,
    left: 6,
    right: 6,
    bottom: -4,
    backgroundColor: colors.gold,
    borderRadius: radius.lg,
    opacity: 0.1,
    ...shadows.lg,
  },
  card: {
    width: CARD_W,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.md,
  },
  cardSelected: {
    borderColor: colors.gold,
    backgroundColor: colors.surfaceRaised,
    ...shadows.gold,
  },
  cardAccentBar: {
    height: 3,
    backgroundColor: colors.border,
  },
  cardAccentBarActive: {
    backgroundColor: colors.gold,
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },

  // Icon badge
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    flexShrink: 0,
    ...shadows.sm,
  },
  iconWrapSelected: {
    backgroundColor: colors.goldGlow,
    borderColor: colors.gold,
  },

  // Info column
  cardInfo: {
    flex: 1,
    gap: 5,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardName: {
    fontSize: fonts.size.lg,
    fontFamily: fonts.bodyBold,
    color: colors.white,
    letterSpacing: fonts.letterSpacing.normal,
    flexShrink: 1,
  },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardDesc: {
    fontSize: fonts.size.sm,
    color: colors.grey,
    lineHeight: fonts.lineHeight.relaxed * fonts.size.sm,
    fontFamily: fonts.body,
  },
  pillRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 2,
  },
  pill: {
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillText: {
    fontSize: fonts.size.xs,
    color: colors.greyDark,
    fontFamily: fonts.bodySemiBold,
    letterSpacing: fonts.letterSpacing.normal,
  },
  pillCategory: {
    backgroundColor: colors.goldGlow,
    borderColor: colors.gold,
  },
  pillCategoryText: {
    color: colors.gold,
  },

  // Price column
  priceCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
  priceDollar: {
    fontSize: fonts.size.md,
    fontFamily: fonts.bodyBold,
    color: colors.grey,
    lineHeight: fonts.size.md,
    alignSelf: 'flex-end',
  },
  priceDollarActive: {
    color: colors.goldDim,
  },
  priceNum: {
    fontSize: fonts.size['4xl'],
    fontFamily: fonts.bodyBold,
    color: colors.grey,
    letterSpacing: fonts.letterSpacing.tight,
    lineHeight: fonts.size['4xl'],
  },
  priceNumActive: {
    color: colors.gold,
  },

  // Bottom depth strip
  depthStrip: {
    height: 4,
    backgroundColor: colors.background,
    opacity: 0.8,
  },
  depthStripActive: {
    backgroundColor: colors.goldDim,
    opacity: 0.45,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    gap: spacing.md,
    ...shadows.md,
  },

  // Selection summary
  hintText: {
    fontSize: fonts.size.sm,
    color: colors.greyDark,
    textAlign: 'center',
    letterSpacing: fonts.letterSpacing.normal,
    fontFamily: fonts.body,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  summaryLabel: {
    fontSize: fonts.size.xs,
    color: colors.gold,
    fontFamily: fonts.bodyBold,
    letterSpacing: fonts.letterSpacing.wider,
  },
  summaryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  summaryName: {
    fontSize: fonts.size.md,
    fontFamily: fonts.bodyBold,
    color: colors.white,
    maxWidth: SW * 0.42,
  },
  summaryPrice: {
    fontSize: fonts.size.xl,
    fontFamily: fonts.bodyBold,
    color: colors.gold,
    letterSpacing: fonts.letterSpacing.tight,
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
    backgroundColor: colors.gold,
    borderRadius: radius['2xl'],
    opacity: 0.22,
    ...shadows.gold,
  },
  btn: {
    height: 54,
    borderRadius: radius['2xl'],
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
    overflow: 'hidden',
  },
  btnDisabled: {
    backgroundColor: colors.surfaceRaised,
    shadowColor: colors.background,
    shadowOpacity: 0.3,
    elevation: 3,
  },
  btnText: {
    fontSize: fonts.size.md,
    fontFamily: fonts.bodyBold,
    color: colors.background,
    letterSpacing: fonts.letterSpacing.wider,
    textTransform: 'uppercase',
  },
  btnTextDisabled: {
    color: colors.greyDark,
  },
  btnDepth: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: colors.goldDim,
    opacity: 0.5,
    borderBottomLeftRadius: radius['2xl'],
    borderBottomRightRadius: radius['2xl'],
  },
});
