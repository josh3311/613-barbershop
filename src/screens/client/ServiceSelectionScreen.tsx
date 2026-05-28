/**
 * ServiceSelectionScreen — V3 visual layer
 * Logic unchanged: same Firestore query, same selection state,
 * same navigation. Only the UI is upgraded.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
} from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../constants/collections';
import { Service } from '../../types';
import { theme } from '../../theme';
import {
  AnimatedHeader, GoldCard, GoldShimmer, PremiumButton,
} from '../../components/ui';

interface Props { navigation: any; }

export default function ServiceSelectionScreen({ navigation }: Props) {
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

  return (
    <View style={styles.container}>
      <AnimatedHeader
        title="PICK A SERVICE"
        eyebrow="STEP 1 OF 4"
        onBack={() => navigation.goBack()}
      />

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: '25%' }]} />
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.shimmerStack}>
          {Array.from({ length: 4 }).map((_, i) => (
            <GoldShimmer
              key={i}
              width="100%"
              height={92}
              radius={theme.radius.lg}
              style={styles.shimmerRow}
            />
          ))}
        </View>
      ) : error ? (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.error} />
          <Text style={styles.emptyTitle}>{error}</Text>
        </View>
      ) : services.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cut-outline" size={48} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>No services available</Text>
          <Text style={styles.emptySubtitle}>Check back soon</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {services.map((service, i) => {
            const isSelected = selected?.id === service.id;
            return (
              <GoldCard
                key={service.id}
                entranceIndex={i}
                active={isSelected}
                onPress={() => setSelected(service)}
                style={styles.cardWrap}
                contentStyle={styles.cardContent}
              >
                <View style={[
                  styles.iconBox,
                  isSelected && styles.iconBoxSelected,
                ]}>
                  <Ionicons
                    name="cut-outline"
                    size={28}
                    color={isSelected
                      ? theme.colors.textInverse
                      : theme.colors.gold}
                  />
                </View>

                <View style={styles.info}>
                  <Text style={[
                    styles.name,
                    isSelected && styles.nameSelected,
                  ]}>
                    {service.name}
                  </Text>
                  <Text style={styles.desc}>
                    {service.description}
                  </Text>
                  <View style={styles.meta}>
                    <Ionicons
                      name="time-outline"
                      size={12}
                      color={theme.colors.textMuted}
                    />
                    <Text style={styles.metaText}>
                      {service.durationMin} min
                    </Text>
                  </View>
                </View>

                <View style={styles.right}>
                  <Text style={[
                    styles.price,
                    isSelected && styles.priceSelected,
                  ]}>
                    ${service.price}
                  </Text>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={theme.colors.gold}
                    />
                  )}
                </View>
              </GoldCard>
            );
          })}
        </ScrollView>
      )}

      {/* Continue */}
      <View style={styles.footer}>
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

  progressBar: {
    height:           3,
    backgroundColor:  theme.colors.border,
    marginHorizontal: theme.spacing.lg,
    borderRadius:     theme.radius.full,
    marginBottom:     theme.spacing.lg,
  },
  progressFill: {
    height:          '100%',
    backgroundColor: theme.colors.gold,
    borderRadius:    theme.radius.full,
  },

  shimmerStack: {
    paddingHorizontal: theme.spacing.lg,
    gap:               theme.spacing.md,
  },
  shimmerRow: { marginBottom: 0 },

  scroll: {
    padding:    theme.spacing.lg,
    paddingTop: 0,
    gap:        theme.spacing.md,
  },
  cardWrap:    {},
  cardContent: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           theme.spacing.md,
    padding:       theme.spacing.lg,
  },
  iconBox: {
    width:           56,
    height:          56,
    borderRadius:    theme.radius.md,
    backgroundColor: theme.colors.goldMuted,
    alignItems:      'center',
    justifyContent:  'center',
  },
  iconBoxSelected: { backgroundColor: theme.colors.gold },
  info:            { flex: 1, gap: 4 },
  name: {
    fontFamily: theme.fonts.bold,
    fontSize:   theme.fontSizes.lg,
    color:      theme.colors.textPrimary,
  },
  nameSelected: { color: theme.colors.gold },
  desc: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.sm,
    color:      theme.colors.textSecondary,
  },
  meta: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginTop:     2,
  },
  metaText: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.xs,
    color:      theme.colors.textMuted,
  },
  right: { alignItems: 'center', gap: theme.spacing.xs },
  price: {
    fontFamily: theme.fonts.heading,
    fontSize:   theme.fontSizes.xl,
    color:      theme.colors.textPrimary,
  },
  priceSelected: { color: theme.colors.gold },

  emptyState: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
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

  footer: {
    padding:          theme.spacing.lg,
    paddingBottom:    theme.spacing.xl,
    borderTopWidth:   1,
    borderTopColor:   theme.colors.border,
  },
});
