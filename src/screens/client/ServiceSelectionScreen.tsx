/**
 * ServiceSelectionScreen — "Haircut Select" RPG visual layer
 *
 * Red Dead-style selection screen: a cinematic dark backdrop with a
 * gold-framed RPG panel floating over the left/centre of the screen,
 * leaving the right side showing the background. The service list is
 * rendered as animated gold selection rows.
 *
 * BUSINESS LOGIC IS UNCHANGED: same Firestore query, same selection
 * state, same `handleContinue` navigation, same loading/error/empty
 * handling. Only the presentation is redesigned.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../constants/collections';
import { Service } from '../../types';
import { theme } from '../../theme';
import {
  GoldShimmer,
  PremiumButton,
  OrnamentalCorners,
  RPGPanel,
  RPGSelectionRow,
  ScissorDivider,
  // CinematicBackground — enable once a shop photo asset exists, e.g.:
  // <CinematicBackground source={require('../../../assets/shop-bg.jpg')} />
} from '../../components/ui';

interface Props { navigation: any; }

export default function ServiceSelectionScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const [services, setServices] = useState<Service[]>([]);
  const [selected, setSelected] = useState<Service | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const q = query(
          collection(db, COLLECTIONS.SERVICES),
          where('isActive', '==', true),
        );
        const snap = await getDocs(q);
        setServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
      } catch (e) {
        console.error('Failed to load services:', e);
        setError('Could not load services. Pull to retry.');
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, []);

  const handleContinue = () => {
    if (!selected) return;
    navigation.navigate('BarberSelection', { service: selected });
  };

  // ── Panel body: loading → error → empty → list ──────────────────
  const renderBody = () => {
    if (loading) {
      return (
        <View style={styles.shimmerStack}>
          {Array.from({ length: 4 }).map((_, i) => (
            <GoldShimmer
              key={i}
              width="100%"
              height={52}
              radius={theme.radius.sm}
              style={styles.shimmerRow}
            />
          ))}
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={40} color={theme.colors.error} />
          <Text style={styles.emptyTitle}>{error}</Text>
        </View>
      );
    }
    if (services.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="cut-outline" size={40} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>No services available</Text>
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
        {services.map((service, i) => (
          <RPGSelectionRow
            key={service.id}
            label={service.name}
            icon="cut-outline"
            selected={selected?.id === service.id}
            onPress={() => setSelected(service)}
            entranceIndex={i}
          />
        ))}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {/* 1 — Cinematic backdrop (dark gradient placeholder; swap for a
          <CinematicBackground source={...} /> photo when one is added). */}
      <LinearGradient
        colors={['#1A140B', '#0A0A0A', '#050302']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* 2 — Ornamental crosshairs framing the whole screen */}
      <OrnamentalCorners size={24} opacity={0.5} />

      {/* 3 — Full-width progress line (step 1 of 4 = 25%) at the very top */}
      <View style={[styles.progressTrack, { top: insets.top }]}>
        <View style={styles.progressFill} />
      </View>

      {/* 4 — Minimal cinematic back affordance (preserves goBack) */}
      <Pressable
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={[styles.backButton, { top: insets.top + theme.spacing.md }]}
        hitSlop={8}
      >
        <Ionicons name="chevron-back" size={22} color={theme.colors.gold} />
      </Pressable>

      {/* 5 — Floating RPG panel, left/centre, ~62% width */}
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
          <Text style={styles.screenTitle}>HAIRCUT SELECT</Text>
          <ScissorDivider />
          {renderBody()}
        </RPGPanel>
      </View>

      {/* 6 — Continue button: full width, outside the panel, at bottom */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
        <PremiumButton
          label={selected ? `CONTINUE — $${selected.price}` : 'SELECT A SERVICE'}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },

  // Thin gold progress line spanning the full screen width.
  progressTrack: {
    position:        'absolute',
    left:            0,
    right:           0,
    height:          2,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  progressFill: {
    width:           '25%',
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

  // Floating panel column — left/centre, leaves the right ~38% open.
  panelContainer: {
    position:       'absolute',
    left:           0,
    top:            0,
    bottom:         0,
    width:          '62%',
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

  // Service rows scroll inside the panel when the list is long.
  rowList: { flexGrow: 0 },
  rowListContent: { gap: theme.spacing.sm, paddingBottom: 2 },

  shimmerStack: { gap: theme.spacing.sm },
  shimmerRow:   { marginBottom: 0 },

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
