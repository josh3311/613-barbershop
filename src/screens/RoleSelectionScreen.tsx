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

// ─── Theme ────────────────────────────────────────────────────────────────────

const C = {
  bg:           '#0A0A0A',
  surface:      '#121212',
  card:         '#161616',
  gold:         '#D4AF37',
  goldDark:     '#A8861A',
  goldLight:    '#EDD060',
  goldGlow:     '#D4AF3715',
  goldBorder:   '#D4AF3740',
  steel:        '#9E9E9E',
  steelDark:    '#616161',
  steelGlow:    '#9E9E9E12',
  steelBorder:  '#9E9E9E35',
  white:        '#FFFFFF',
  sub:          '#666666',
  muted:        '#333333',
  divider:      '#1C1C1C',
} as const;

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
  accentGlow,
  accentBorder,
  onPress,
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  tag: string;
  accent: string;
  accentGlow: string;
  accentBorder: string;
  onPress: () => void;
}): React.JSX.Element {
  const scale   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

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
      {/* Glow shadow layer */}
      <View style={[rc.glow, { shadowColor: accent }]} />

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
        <View style={[rc.stripe, { backgroundColor: accent }]} />

        <View style={rc.body}>
          {/* Icon circle */}
          <View style={[rc.iconCircle, { backgroundColor: accentGlow, borderColor: accentBorder }]}>
            <Ionicons name={iconName} size={28} color={accent} />
          </View>

          {/* Text */}
          <View style={rc.textBlock}>
            <View style={[rc.tag, { backgroundColor: accentGlow, borderColor: accentBorder }]}>
              <Text style={[rc.tagText, { color: accent }]}>{tag}</Text>
            </View>
            <Text style={rc.title}>{title}</Text>
            <Text style={rc.subtitle}>{subtitle}</Text>
          </View>

          {/* Arrow */}
          <Ionicons name="chevron-forward" size={18} color={accent} />
        </View>

        {/* Bottom depth bar */}
        <View style={[rc.depth, { backgroundColor: accent }]} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const rc = StyleSheet.create({
  wrap: { position: 'relative' },
  glow: {
    position: 'absolute', top: 8, left: 12, right: 12, bottom: -4,
    borderRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 18, borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  stripe: { height: 4 },
  body: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 22, gap: 18,
  },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  textBlock: { flex: 1, gap: 4 },
  tag: {
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 3,
    alignSelf: 'flex-start', marginBottom: 4,
  },
  tagText:  { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  title:    { fontSize: 20, fontWeight: '900', color: C.white, letterSpacing: 0.2 },
  subtitle: { fontSize: 13, color: C.sub, lineHeight: 17, marginTop: 2 },
  depth:    { height: 3, opacity: 0.4 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RoleSelectionScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

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
          iconName="cut-outline"
          title="I want a Haircut"
          subtitle="Book appointments, track your history, manage your profile"
          tag="CLIENT"
          accent={C.gold}
          accentGlow={C.goldGlow}
          accentBorder={C.goldBorder}
          onPress={() => navigation.navigate('Login')}
        />

        <RoleCard
          iconName="storefront-outline"
          title="I work here"
          subtitle="Manage your schedule, view your clients, track earnings"
          tag="BARBER"
          accent={C.steel}
          accentGlow={C.steelGlow}
          accentBorder={C.steelBorder}
          onPress={() => navigation.navigate('BarberLogin')}
        />
      </View>

      {/* ── Footer ── */}
      <Text style={s.footer}>613 Barbershop · v1.0.0</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: C.bg,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },

  // Background rings
  ring: {
    position: 'absolute', borderRadius: 9999,
    borderWidth: 1, borderColor: C.gold, opacity: 0.04,
  },
  ring1: {
    width: SW * 1.4, height: SW * 1.4,
    top: -SW * 0.5, left: -SW * 0.2,
  },
  ring2: {
    width: SW * 0.8, height: SW * 0.8,
    bottom: -SW * 0.3, right: -SW * 0.2,
    borderColor: C.steel,
  },

  // Logo
  logoBlock: { alignItems: 'center', marginTop: 20 },
  logoNumWrap: { alignItems: 'center', marginBottom: 6 },
  logoNum: {
    fontSize: Math.min(SW * 0.25, 96),
    fontWeight: '900',
    color: C.gold,
    letterSpacing: -4,
    lineHeight: Math.min(SW * 0.27, 104),
    textShadowColor: C.goldDark,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  logoNumLine: {
    width: 60, height: 3,
    backgroundColor: C.gold,
    borderRadius: 2,
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },
  logoSub: {
    fontSize: 14, fontWeight: '800',
    color: C.white, letterSpacing: 8,
    marginTop: 10, marginBottom: 6,
  },
  logoTagline: {
    fontSize: 12, color: C.sub,
    letterSpacing: 1.5, fontStyle: 'italic',
  },

  // Divider
  dividerRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, marginVertical: 8,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.divider },
  dividerText: { fontSize: 10, color: C.muted, fontWeight: '700', letterSpacing: 2 },

  // Cards
  cards: { gap: 14 },

  // Footer
  footer: {
    fontSize: 11, color: C.muted,
    textAlign: 'center', letterSpacing: 0.5,
    marginBottom: 8,
  },
});
