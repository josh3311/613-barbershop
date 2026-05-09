import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../config/firebase';
import { COLLECTIONS } from '../../constants/collections';
import { Service } from '../../types';
import { theme } from '../../theme';

interface Props {
  navigation: any;
}

export default function ServiceSelectionScreen({ navigation }: Props) {
  const [services, setServices] = useState<Service[]>([]);
  const [selected, setSelected] = useState<Service | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const fetchServices = async () => {
      const q    = query(
        collection(db, COLLECTIONS.SERVICES),
        where('isActive', '==', true)
      );
      const snap = await getDocs(q);
      setServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Service)));
      setLoading(false);
    };
    fetchServices();
  }, []);

  const handleContinue = () => {
    if (!selected) return;
    // Step 2 — barber selection (coming next)
    navigation.navigate('BarberSelection', { service: selected });
  };

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={theme.colors.textPrimary}
          />
        </TouchableOpacity>
        <View>
          <Text style={styles.stepText}>STEP 1 OF 4</Text>
          <Text style={styles.title}>PICK A SERVICE</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: '25%' }]} />
      </View>

      {loading ? (
        <ActivityIndicator
          color={theme.colors.gold}
          size="large"
          style={styles.loader}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {services.map(service => {
            const isSelected = selected?.id === service.id;
            return (
              <TouchableOpacity
                key={service.id}
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => setSelected(service)}
                activeOpacity={0.8}
              >
                {/* Icon */}
                <View style={[
                  styles.iconBox,
                  isSelected && styles.iconBoxSelected
                ]}>
                  <Ionicons
                    name="cut-outline"
                    size={28}
                    color={isSelected
                      ? theme.colors.textInverse
                      : theme.colors.gold}
                  />
                </View>

                {/* Info */}
                <View style={styles.cardInfo}>
                  <Text style={[
                    styles.serviceName,
                    isSelected && styles.serviceNameSelected
                  ]}>
                    {service.name}
                  </Text>
                  <Text style={styles.serviceDesc}>
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

                {/* Price + Check */}
                <View style={styles.cardRight}>
                  <Text style={[
                    styles.price,
                    isSelected && styles.priceSelected
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
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Continue Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, !selected && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!selected}
        >
          <Text style={styles.buttonText}>
            {selected ? `CONTINUE — $${selected.price}` : 'SELECT A SERVICE'}
          </Text>
          {selected && (
            <Ionicons
              name="arrow-forward"
              size={18}
              color={theme.colors.textInverse}
            />
          )}
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    fontFamily: theme.fonts.medium,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.gold,
    letterSpacing: 2,
  },
  title: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xxl,
    color: theme.colors.textPrimary,
    letterSpacing: 4,
  },
  progressBar: {
    height: 3,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.full,
    marginBottom: theme.spacing.lg,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.gold,
    borderRadius: theme.radius.full,
  },
  loader: {
    flex: 1,
  },
  scroll: {
    padding: theme.spacing.lg,
    paddingTop: 0,
    gap: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    ...theme.shadows.md,
  },
  cardSelected: {
    borderColor: theme.colors.gold,
    backgroundColor: theme.colors.goldMuted,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxSelected: {
    backgroundColor: theme.colors.gold,
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  serviceName: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.textPrimary,
  },
  serviceNameSelected: {
    color: theme.colors.gold,
  },
  serviceDesc: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.sm,
    color: theme.colors.textSecondary,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes.xs,
    color: theme.colors.textMuted,
  },
  cardRight: {
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  price: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.xl,
    color: theme.colors.textPrimary,
  },
  priceSelected: {
    color: theme.colors.gold,
  },
  footer: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  button: {
    backgroundColor: theme.colors.gold,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    ...theme.shadows.gold,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontFamily: theme.fonts.heading,
    fontSize: theme.fontSizes.lg,
    color: theme.colors.textInverse,
    letterSpacing: 2,
  },
});