import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp }          from '@react-navigation/native-stack';
import { doc, getDoc }  from 'firebase/firestore';
import { Ionicons }     from '@expo/vector-icons';
import { db }           from '../../config/firebase';
import { ClientStackParams } from '../../navigation/types';
import { StyleCard }    from '../../types';
import { theme }        from '../../theme';

type Nav   = NativeStackNavigationProp<ClientStackParams, 'StyleCardView'>;
type Route = RouteProp<ClientStackParams, 'StyleCardView'>;

const STYLE_CARDS = 'styleCards';

export default function StyleCardViewScreen() {
  const navigation = useNavigation<Nav>();
  const { styleCardId } = useRoute<Route>().params;
  const [card,    setCard]    = useState<StyleCard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDoc(doc(db, STYLE_CARDS, styleCardId)).then(snap => {
      if (snap.exists()) {
        setCard({
          id: snap.id, ...snap.data(),
          createdAt: snap.data().createdAt?.toDate(),
        } as StyleCard);
      }
      setLoading(false);
    });
  }, [styleCardId]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.gold} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>STYLE CARD</Text>
          <Text style={styles.headerSub}>Show this to your barber</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.gold} size="large" style={{ flex: 1 }} />
      ) : !card ? (
        <View style={styles.empty}>
          <Ionicons name="alert-circle-outline" size={40} color={theme.colors.textMuted} />
          <Text style={styles.emptyText}>Style card not found.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Info */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="cut-outline"    size={16} color={theme.colors.gold} />
              <Text style={styles.infoLabel}>SERVICE</Text>
              <Text style={styles.infoValue}>{card.serviceName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={16} color={theme.colors.gold} />
              <Text style={styles.infoLabel}>BARBER</Text>
              <Text style={styles.infoValue}>{card.barberName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={16} color={theme.colors.gold} />
              <Text style={styles.infoLabel}>DATE</Text>
              <Text style={styles.infoValue}>
                {card.createdAt?.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
          </View>

          {/* Finished style photo */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>FINISHED STYLE</Text>
            <Image source={{ uri: card.photoURL }} style={styles.photo} resizeMode="cover" />
          </View>

          {/* AI Guide */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="sparkles" size={14} color={theme.colors.gold} />
              <Text style={styles.sectionTitle}>AI REPRODUCTION GUIDE</Text>
            </View>
            <View style={styles.guideCard}>
              <Text style={styles.guideText}>{card.aiGuide}</Text>
            </View>
          </View>

          {/* Barber notes */}
          {card.barberNotes ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="create-outline" size={14} color={theme.colors.textSecondary} />
                <Text style={styles.sectionTitle}>BARBER NOTES</Text>
              </View>
              <View style={styles.notesCard}>
                <Text style={styles.notesText}>{card.barberNotes}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.tipCard}>
            <Ionicons name="information-circle-outline" size={16} color={theme.colors.gold} />
            <Text style={styles.tipText}>
              Show this card to any barber at 613 Barbershop to recreate your style accurately.
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
    padding: theme.spacing.lg, paddingTop: theme.spacing.xxl,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.goldMuted, borderWidth: 1, borderColor: theme.colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.xl, color: theme.colors.gold, letterSpacing: 4 },
  headerSub:   { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.xs, color: theme.colors.textSecondary, marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md },
  emptyText: { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.sm, color: theme.colors.textMuted },
  scroll: { padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  infoCard: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.gold, padding: theme.spacing.lg,
    gap: theme.spacing.sm, ...theme.shadows.gold,
  },
  infoRow:   { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  infoLabel: { fontFamily: theme.fonts.medium, fontSize: theme.fontSizes.xs, color: theme.colors.textMuted, letterSpacing: 2, width: 70 },
  infoValue: { flex: 1, fontFamily: theme.fonts.body, fontSize: theme.fontSizes.sm, color: theme.colors.textPrimary },
  section:      { gap: theme.spacing.sm },
  sectionHeader:{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  sectionTitle: { fontFamily: theme.fonts.heading, fontSize: theme.fontSizes.xs, color: theme.colors.gold, letterSpacing: 3 },
  photo: { width: '100%', height: 300, borderRadius: theme.radius.lg, borderWidth: 1.5, borderColor: theme.colors.gold },
  guideCard: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.gold, padding: theme.spacing.lg, ...theme.shadows.gold,
  },
  guideText:  { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.sm, color: theme.colors.textPrimary, lineHeight: 22 },
  notesCard: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.lg,
  },
  notesText:  { fontFamily: theme.fonts.body, fontSize: theme.fontSizes.sm, color: theme.colors.textSecondary, lineHeight: 20 },
  tipCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm,
    backgroundColor: theme.colors.goldMuted, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.gold, padding: theme.spacing.md,
  },
  tipText: { flex: 1, fontFamily: theme.fonts.body, fontSize: theme.fontSizes.xs, color: theme.colors.textSecondary, lineHeight: 18 },
});