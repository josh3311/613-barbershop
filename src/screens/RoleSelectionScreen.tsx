import React, { useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Animated,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '@/navigation/types';
import { colors, fonts, spacing, radius, icons } from '@/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SW, height: SH } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<AuthStackParamList, 'RoleSelection'>;

// ─── Role Card ────────────────────────────────────────────────────────────────

function RoleCard({
  iconName,
  title,
  subtitle,
  tag,
  accent,
  onPress,
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  tag: string;
  accent: 'gold' | 'grey';
  onPress: () => void;
}): React.JSX.Element {
  const scale   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const accentColor = accent === 'gold' ? colors.gold : colors.grey;
  const accentGlow = accent === 'gold' ? colors.gold + '15' : colors.grey + '12';
  const accentBorder = accent === 'gold' ? colors.gold + '40' : colors.grey + '35';

  function pressIn(): void {
    Animated.parallel([
      Animated.spring(scale,   { toValue: 0.97, useNativeDriver: true, speed: 60, bounciness: 3 }),
      Animated.timing(opacity, { toValue: 0.88, duration: 80, useNativeDriver: true }),
    ]).start();
  }
  function pressOut(): void {
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1,   useNativeDriver: true, speed: 60, bounciness: 3 }),
      Animated.timing(opacity, { toValue: 1,   duration: 100, useNativeDriver: true }),
    ]).start();
  }

  return (
    <Animated.View style={[rc.wrap, { transform: [{ scale }], opacity }]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        activeOpacity={1}
        style={[rc.card, { borderColor: accentBorder }]}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={subtitle}
      >
        {/* Top accent stripe */}
        <View style={[rc.stripe, { backgroundColor: accentColor }]} />

        <View style={rc.body}>
          {/* Icon circle */}
          <View style={[rc.iconCircle, { backgroundColor: accentGlow, borderColor: accentBorder }]}>
            <Ionicons name={iconName} size={28} color={accentColor} />
          </View>

          {/* Text */}
          <View style={rc.textBlock}>
            <View style={[rc.tag, { backgroundColor: accentGlow, borderColor: accentBorder }]}>
              <Text style={[rc.tagText, { color: accentColor }]}>{tag}</Text>
            </View>
            <Text style={rc.title}>{title}</Text>
            <Text style={rc.subtitle}>{subtitle}</Text>
          </View>

          {/* Arrow */}
          <Ionicons name={icons.forward} size={18} color={accentColor} />
        </View>

        {/* Bottom depth bar */}
        <View style={[rc.depth, { backgroundColor: accentColor }]} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const rc = StyleSheet.create({
  wrap: { position: 'relative' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md, borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  stripe: { height: 3 },
  body: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: 22, gap: 18,
  },
  iconCircle: {
    width: 64, height: 64, borderRadius: radius.full,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  textBlock: { flex: 1, gap: 4 },
  tag: {
    borderRadius: radius['2xl'], borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 3,
    alignSelf: 'flex-start', marginBottom: 4,
  },
  tagText:  { fontSize: 9, fontFamily: fonts.bodyBold, letterSpacing: 1.5 },
  title:    { fontSize: 20, fontFamily: fonts.bodyBold, color: colors.white, letterSpacing: 0.2 },
  subtitle: { fontSize: fonts.size.md, color: colors.grey, lineHeight: 17, marginTop: 2 },
  depth:    { height: 3, opacity: 0.4 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RoleSelectionScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* ── Decorative background rings ── */}
      <View style={[s.ring, s.ring1]} />
      <View style={[s.ring, s.ring2]} />

      {/* ── Logo block ── */}
      <View style={s.logoBlock} accessibilityRole="header">
        <View style={s.logoNumWrap}>
          <Text style={s.logoNum}>613</Text>
          <View style={s.logoNumLine} />
        </View>
        <Text style={s.logoSub}>BARBERSHOP</Text>
        <Text style={s.logoTagline}>Premium cuts. Every time.</Text>
      </View>

      {/* ── Divider ── */}
      <View style={s.dividerRow}>
        <View style={s.dividerLine} />
        <Text style={s.dividerText}>WHO ARE YOU?</Text>
        <View style={s.dividerLine} />
      </View>

      {/* ── Role cards ── */}
      <View style={s.cards}>
        <RoleCard
          iconName={icons.cutOutline}
          title="I want a Haircut"
          subtitle="Book appointments, track your history, manage your profile"
          tag="CLIENT"
          accent="gold"
          onPress={() => navigation.navigate('Login')}
        />

        <RoleCard
          iconName="storefront-outline"
          title="I work here"
          subtitle="Manage your schedule, view your clients, track earnings"
          tag="BARBER"
          accent="grey"
          onPress={() => navigation.navigate('BarberLogin')}
        />
      </View>

      {/* ── Footer ── */}
      <Text style={s.footer}>613 Barbershop</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: colors.background,
    paddingHorizontal: spacing['2xl'],
    justifyContent: 'space-between',
  },

  // Background rings
  ring: {
    position: 'absolute', borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.gold, opacity: 0.04,
  },
  ring1: {
    width: SW * 1.4, height: SW * 1.4,
    top: -SW * 0.5, left: -SW * 0.2,
  },
  ring2: {
    width: SW * 0.8, height: SW * 0.8,
    bottom: -SW * 0.3, right: -SW * 0.2,
    borderColor: colors.grey,
  },

  // Logo
  logoBlock: { alignItems: 'center', marginTop: spacing.lg },
  logoNumWrap: { alignItems: 'center', marginBottom: spacing.sm },
  logoNum: {
    fontSize: Math.min(SW * 0.25, 96),
    fontFamily: fonts.heading,
    color: colors.gold,
    letterSpacing: -4,
    lineHeight: Math.min(SW * 0.27, 104),
    textShadowColor: colors.gold + '80',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  logoNumLine: {
    width: 60, height: 3,
    backgroundColor: colors.gold,
    borderRadius: 2,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },
  logoSub: {
    fontSize: fonts.size.md, fontFamily: fonts.bodyBold,
    color: colors.white, letterSpacing: 8,
    marginTop: 10, marginBottom: 6,
  },
  logoTagline: {
    fontSize: fonts.size.md, color: colors.grey,
    letterSpacing: 1.5, fontFamily: fonts.body,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, marginVertical: 8,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 10, color: colors.greyDark, fontFamily: fonts.bodyBold, letterSpacing: 2 },

  // Cards
  cards: { gap: 14 },

  // Footer
  footer: {
    fontSize: fonts.size.md, color: colors.greyDark,
    textAlign: 'center', letterSpacing: 0.5,
    marginBottom: 8,
  },
});
