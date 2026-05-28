/**
 * LoginScreen — V3 visual layer
 *
 * - Moti logo entrance (fade + slide down)
 * - BlurView subtle background texture
 * - PremiumInput with gold focus glow
 * - PremiumButton for primary CTA
 * - Auth logic unchanged from v2
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Pressable,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { MotiView } from 'moti';
import { BlurView } from 'expo-blur';
import { signInWithEmailAndPassword } from 'firebase/auth';

import { auth } from '../../config/firebase';
import { theme } from '../../theme';
import { AuthNavProp } from '../../navigation/types';
import { PremiumButton, PremiumInput } from '../../components/ui';

interface Props { navigation: AuthNavProp; }

export default function LoginScreen({ navigation }: Props) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Subtle BlurView texture — sits behind everything */}
      <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo block — Moti fade + slide */}
          <MotiView
            from={{ opacity: 0, translateY: -24 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 14, mass: 0.9, delay: 80 }}
            style={styles.header}
          >
            <Text style={styles.logo}>613</Text>
            <Text style={styles.subtitle}>BARBERSHOP</Text>
            <Text style={styles.tagline}>Premium cuts. Real style.</Text>
          </MotiView>

          {/* Form */}
          <Animated.View
            entering={FadeInUp.delay(220).springify().damping(16)}
            style={styles.form}
          >
            {error && (
              <Animated.View entering={FadeIn.duration(180)} style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            )}

            <PremiumInput
              label="Email"
              placeholder="your@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <PremiumInput
              label="Password"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <PremiumButton
              label="SIGN IN"
              fullWidth
              loading={loading}
              disabled={loading}
              onPress={handleLogin}
              style={{ marginTop: theme.spacing.sm }}
            />

            <Pressable
              style={styles.registerLink}
              onPress={() => navigation.navigate('Register')}
            >
              <Text style={styles.registerText}>
                No account?{' '}
                <Text style={styles.registerTextBold}>Create one</Text>
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  flex:      { flex: 1 },
  scroll: {
    flexGrow:       1,
    justifyContent: 'center',
    padding:        theme.spacing.lg,
  },
  header:    { alignItems: 'center', marginBottom: theme.spacing.xxl },
  logo: {
    fontFamily:  theme.fonts.heading,
    fontSize:    96,
    color:       theme.colors.gold,
    lineHeight:  96,
  },
  subtitle: {
    fontFamily:    theme.fonts.heading,
    fontSize:      28,
    color:         theme.colors.textPrimary,
    letterSpacing: 8,
  },
  tagline: {
    fontFamily:    theme.fonts.body,
    fontSize:      theme.fontSizes.sm,
    color:         theme.colors.textSecondary,
    marginTop:     theme.spacing.sm,
    letterSpacing: 2,
  },
  form:      { width: '100%' },
  errorBox: {
    backgroundColor: 'rgba(255,68,68,0.1)',
    borderWidth:     1,
    borderColor:     theme.colors.error,
    borderRadius:    theme.radius.sm,
    padding:         theme.spacing.md,
    marginBottom:    theme.spacing.md,
  },
  errorText: {
    color:      theme.colors.error,
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.sm,
    textAlign:  'center',
  },
  registerLink: { alignItems: 'center', marginTop: theme.spacing.lg },
  registerText: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.sm,
    color:      theme.colors.textSecondary,
  },
  registerTextBold: {
    fontFamily: theme.fonts.bold,
    color:      theme.colors.gold,
  },
});
