/**
 * BarberSelectionScreen — V3 visual layer
 * Logic preserved exactly. Visual upgrades:
 * - AnimatedHeader
 * - GoldCard for each barber (with active selected state)
 * - expo-image for profile photo (fade-in)
 * - GoldShimmer for loading
 * - PremiumButton for continue
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
} from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';

import { db } from '../../config/firebase';
import { theme } from '../../theme';
import {
  AnimatedHeader, GoldCard, GoldShimmer, PremiumButton,
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

  return (
    <View style={styles.container}>
      <AnimatedHeader
        title="PICK A BARBER"
        eyebrow="STEP 2 OF 4"
        onBack={() => navigation.goBack()}
      />

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: '50%' }]} />
      </View>

      <View style={styles.servicePill}>
        <Ionicons name="cut-outline" size={14} color={theme.colors.gold} />
        <Text style={styles.servicePillText}>
          {service.name} — ${service.price}
        </Text>
      </View>

      {loading ? (
        <View style={styles.shimmerStack}>
          {Array.from({ length: 3 }).map((_, i) => (
            <GoldShimmer
              key={i}
              width="100%"
              height={100}
              radius={theme.radius.lg}
            />
          ))}
        </View>
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
          {barbers.map((barber, i) => {
            const isSelected = selected?.id === barber.id;
            return (
              <GoldCard
                key={barber.id}
                entranceIndex={i}
                active={isSelected}
                onPress={() => setSelected(barber)}
                contentStyle={styles.cardContent}
              >
                <View style={[styles.avatar, isSelected && styles.avatarSelected]}>
                  {barber.photoURL ? (
                    <ExpoImage
                      source={{ uri: barber.photoURL }}
                      style={styles.avatarImage}
                      transition={300}
                      contentFit="cover"
                    />
                  ) : (
                    <Ionicons
                      name="person"
                      size={32}
                      color={isSelected ? theme.colors.textInverse : theme.colors.gold}
                    />
                  )}
                </View>

                <View style={styles.info}>
                  <Text style={[
                    styles.name,
                    isSelected && styles.nameSelected,
                  ]}>
                    {barber.displayName.toUpperCase()}
                  </Text>

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

                  <View style={styles.specialties}>
                    {barber.specialties?.slice(0, 3).map((s, j) => (
                      <View key={j} style={styles.specialtyTag}>
                        <Text style={styles.specialtyText}>{s}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {isSelected && (
                  <Ionicons name="checkmark-circle" size={24} color={theme.colors.gold} />
                )}
              </GoldCard>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.footer}>
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

  progressBar: {
    height:           3,
    backgroundColor:  theme.colors.border,
    marginHorizontal: theme.spacing.lg,
    borderRadius:     theme.radius.full,
    marginBottom:     theme.spacing.md,
  },
  progressFill: {
    height:          '100%',
    backgroundColor: theme.colors.gold,
    borderRadius:    theme.radius.full,
  },

  servicePill: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              theme.spacing.xs,
    backgroundColor:  theme.colors.goldMuted,
    borderWidth:      1,
    borderColor:      theme.colors.gold,
    borderRadius:     theme.radius.full,
    paddingVertical:  theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    alignSelf:        'flex-start',
    marginHorizontal: theme.spacing.lg,
    marginBottom:     theme.spacing.lg,
  },
  servicePillText: {
    fontFamily:    theme.fonts.medium,
    fontSize:      theme.fontSizes.xs,
    color:         theme.colors.gold,
    letterSpacing: 1,
  },

  shimmerStack: {
    paddingHorizontal: theme.spacing.lg,
    gap:               theme.spacing.md,
  },
  emptyState: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            theme.spacing.md,
  },
  emptyTitle: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.xl,
    color:         theme.colors.textSecondary,
    letterSpacing: 2,
  },
  emptySubtitle: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.sm,
    color:      theme.colors.textMuted,
  },

  scroll: {
    padding: theme.spacing.lg,
    paddingTop: 0,
    gap: theme.spacing.md,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           theme.spacing.md,
    padding:       theme.spacing.lg,
  },
  avatar: {
    width:           64,
    height:          64,
    borderRadius:    32,
    backgroundColor: theme.colors.goldMuted,
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
  },
  avatarSelected: { backgroundColor: theme.colors.gold },
  avatarImage:    { width: 64, height: 64, borderRadius: 32 },

  info: { flex: 1, gap: theme.spacing.xs },
  name: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.lg,
    color:         theme.colors.textPrimary,
    letterSpacing: 2,
  },
  nameSelected: { color: theme.colors.gold },
  ratingRow:    { flexDirection: 'row', alignItems: 'center', gap: 2 },
  reviewCount: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.xs,
    color:      theme.colors.textMuted,
    marginLeft: 4,
  },
  specialties: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           theme.spacing.xs,
    marginTop:     2,
  },
  specialtyTag: {
    backgroundColor: theme.colors.surface,
    borderWidth:     1,
    borderColor:     theme.colors.border,
    borderRadius:    theme.radius.full,
    paddingVertical: 2,
    paddingHorizontal: theme.spacing.sm,
  },
  specialtyText: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.xs,
    color:      theme.colors.textMuted,
  },

  footer: {
    padding:          theme.spacing.lg,
    paddingBottom:    theme.spacing.xl,
    borderTopWidth:   1,
    borderTopColor:   theme.colors.border,
  },
});
