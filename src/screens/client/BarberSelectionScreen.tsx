/**
 * BarberSelectionScreen — "Barber Select" RPG visual layer
 *
 * Red Dead-style selection screen: a cinematic dark backdrop with the
 * selected barber's photo bleeding across the right side, a gold-framed
 * RPG panel floating over the left ~60%, and animated gold selection
 * rows (each showing the barber's circular photo, or a fallback icon).
 *
 * BUSINESS LOGIC IS UNCHANGED: same Firestore query, same selection
 * state, same `handleContinue` navigation, same `service` pass-through,
 * same loading/empty handling. Only the presentation is redesigned.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { db } from '../../config/firebase';
import { theme } from '../../theme';
import {
  GoldShimmer,
  PremiumButton,
  OrnamentalCorners,
  RPGPanel,
  RPGSelectionRow,
  ScissorDivider,
} from '../../components/ui';

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

interface Props { navigation: any; route: any; }

export default function BarberSelectionScreen({ navigation, route }: Props) {
  const { service }             = route.params;
  const [barbers,  setBarbers]  = useState<Barber[]>([]);
  const [selected, setSelected] = useState<Barber | null>(null);
  const [loading,  setLoading]  = useState(true);

  const insets = useSafeAreaInsets();

  useEffect(() => {
    const fetchBarbers = async () => {
      try {
        const q = query(
          collection(db, 'barbers'),
          where('isAvailable', '==', true),
        );
        const snap = await getDocs(q);
        setBarbers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Barber)));
      } catch (e) {
        console.error('Failed to load barbers:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchBarbers();
  }, []);

  const handleContinue = () => {
    if (!selected) return;
    navigation.navigate('DateTimeSelection', { service, barber: selected });
  };

  // ── Panel body: loading → empty → list ──────────────────────────
  const renderBody = () => {
    if (loading) {
      return (
        <View style={styles.shimmerStack}>
          {Array.from({ length: 3 }).map((_, i) => (
            <GoldShimmer
              key={i}
              width="100%"
              height={52}
              radius={theme.radius.sm}
            />
          ))}
        </View>
      );
    }
    if (barbers.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="person-outline" size={40} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>No barbers available</Text>
          <Text style={styles.emptySubtitle}>Check back soon</Text>
        </View>
      );
    }
    return (
      <ScrollView
        style={styles.rowList}
        contentContainerStyle={styles.rowListContent}
        showsVerticalScrollIndicator={false}
      >
        {barbers.map((barber, i) => (
          <RPGSelectionRow
            key={barber.id}
            label={barber.displayName}
            icon="person-outline"
            imageUri={barber.photoURL}
            selected={selected?.id === barber.id}
            onPress={() => setSelected(barber)}
            entranceIndex={i}
          />
        ))}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {/* 1 — Cinematic backdrop (dark gradient placeholder) */}
      <LinearGradient
        colors={['#1A140B', '#0A0A0A', '#050302']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* 2 — Selected barber's photo bleeding across the screen (the
          panel covers the left, leaving it visible on the right).
          expo-image's `transition` crossfades when the source changes. */}
      {selected?.photoURL ? (
        <ExpoImage
          source={{ uri: selected.photoURL }}
          style={[StyleSheet.absoluteFill, styles.heroPhoto]}
          contentFit="cover"
          transition={400}
        />
      ) : null}

      {/* 3 — Ornamental crosshairs framing the whole screen */}
      <OrnamentalCorners size={24} opacity={0.5} />

      {/* 4 — Full-width progress line (step 2 of 4 = 50%) at the top */}
      <View style={[styles.progressTrack, { top: insets.top }]}>
        <View style={styles.progressFill} />
      </View>

      {/* 5 — Minimal cinematic back affordance (preserves goBack) */}
      <Pressable
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={[styles.backButton, { top: insets.top + theme.spacing.md }]}
        hitSlop={8}
      >
        <Ionicons name="chevron-back" size={22} color={theme.colors.gold} />
      </Pressable>

      {/* 6 — Floating RPG panel, left, ~60% width */}
      <View
        style={[
          styles.panelContainer,
          {
            paddingTop:    insets.top + theme.spacing.xl * 2,
            paddingBottom: insets.bottom + 100,
          },
        ]}
      >
        <RPGPanel style={styles.panel}>
          <Text style={styles.screenTitle}>BARBER SELECT</Text>
          <ScissorDivider />
          {renderBody()}
        </RPGPanel>
      </View>

      {/* 7 — Continue button: full width, outside the panel, at bottom */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
        <PremiumButton
          label={selected
            ? `CONTINUE WITH ${selected.displayName.toUpperCase()}`
            : 'SELECT A BARBER'}
          fullWidth
          disabled={!selected}
          onPress={handleContinue}
          rightIcon={selected ? (
            <Ionicons name="arrow-forward" size={18} color={theme.colors.textInverse} />
          ) : undefined}
        />
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

  heroPhoto: { opacity: 0.35 },

  // Thin gold progress line spanning the full screen width.
  progressTrack: {
    position:        'absolute',
    left:            0,
    right:           0,
    height:          2,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  progressFill: {
    width:           '50%',
    height:          '100%',
    backgroundColor: theme.colors.gold,
  },

  backButton: {
    position:        'absolute',
    left:            theme.spacing.lg,
    width:           36,
    height:          36,
    borderRadius:    theme.radius.sm,
    borderWidth:     1,
    borderColor:     'rgba(212, 175, 55, 0.4)',
    backgroundColor: 'rgba(8, 6, 4, 0.6)',
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          10,
  },

  // Floating panel column — left, leaves the right ~40% open.
  panelContainer: {
    position:       'absolute',
    left:           0,
    top:            0,
    bottom:         0,
    width:          '60%',
    justifyContent: 'center',
    paddingLeft:    theme.spacing.lg,
  },
  panel: {
    maxHeight: '100%',
  },

  screenTitle: {
    fontFamily:    theme.fonts.heading, // BebasNeue
    fontSize:      28,
    color:         theme.colors.gold,
    letterSpacing: 4,
    textAlign:     'center',
  },

  // Barber rows scroll inside the panel when the list is long.
  rowList: { flexGrow: 0 },
  rowListContent: { gap: theme.spacing.sm, paddingBottom: 2 },

  shimmerStack: { gap: theme.spacing.sm },

  emptyState: {
    alignItems:      'center',
    justifyContent:  'center',
    gap:             theme.spacing.sm,
    paddingVertical: theme.spacing.xl,
  },
  emptyTitle: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.lg,
    color:         theme.colors.textSecondary,
    letterSpacing: 2,
    textAlign:     'center',
  },
  emptySubtitle: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.sm,
    color:      theme.colors.textMuted,
  },

  // Full-width footer, layered above the panel column.
  footer: {
    position:          'absolute',
    left:              0,
    right:             0,
    bottom:            0,
    paddingHorizontal: theme.spacing.lg,
    paddingTop:        theme.spacing.md,
    zIndex:            10,
  },
});
