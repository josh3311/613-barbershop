/**
 * RegisterScreen — V3 visual layer
 * Matches LoginScreen pattern. Logic unchanged.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, Pressable,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { MotiView } from 'moti';
import { BlurView } from 'expo-blur';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { auth, db } from '../../config/firebase';
import { COLLECTIONS } from '../../constants/collections';
import { theme } from '../../theme';
import { AuthNavProp } from '../../navigation/types';
import { PremiumButton, PremiumInput } from '../../components/ui';

interface Props { navigation: AuthNavProp; }

export default function RegisterScreen({ navigation }: Props) {
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const handleRegister = async () => {
    if (!name || !email || !password || !confirm) {
      setError('Please fill in all fields');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { user } = await createUserWithEmailAndPassword(
        auth, email.trim(), password
      );
      await setDoc(doc(db, COLLECTIONS.USERS, user.uid), {
        id:            user.uid,
        displayName:   name.trim(),
        email:         email.trim(),
        photoURL:      null,
        role:          null,
        phone:         null,
        loyaltyStamps: 0,
        createdAt:     serverTimestamp(),
      });
    } catch (e: any) {
      if (e.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists');
      } else if (e.code === 'auth/invalid-email') {
        setError('Please enter a valid email address');
      } else {
        setError('Something went wrong. Please try again');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* iOS-only blur — Android falls back to the solid dark background */}
      {Platform.OS === 'ios' && (
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <MotiView
            from={{ opacity: 0, translateY: -24 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 14, mass: 0.9, delay: 80 }}
            style={styles.header}
          >
            <Text style={styles.logo}>613</Text>
            <Text style={styles.subtitle}>CREATE ACCOUNT</Text>
          </MotiView>

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
              label="Full Name"
              placeholder="Joshua Fowah"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
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
              placeholder="Min. 6 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <PremiumInput
              label="Confirm Password"
              placeholder="Repeat password"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
            />

            <PremiumButton
              label="CREATE ACCOUNT"
              fullWidth
              loading={loading}
              disabled={loading}
              onPress={handleRegister}
              style={{ marginTop: theme.spacing.sm }}
            />

            <Pressable
              style={styles.loginLink}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.loginText}>
                Already have an account?{' '}
                <Text style={styles.loginTextBold}>Sign in</Text>
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
  scroll:    { flexGrow: 1, justifyContent: 'center', padding: theme.spacing.lg },
  header:    { alignItems: 'center', marginBottom: theme.spacing.xl },
  logo: {
    fontFamily: theme.fonts.heading,
    fontSize:   72,
    color:      theme.colors.gold,
    lineHeight: 72,
  },
  subtitle: {
    fontFamily:    theme.fonts.heading,
    fontSize:      theme.fontSizes.xl,
    color:         theme.colors.textPrimary,
    letterSpacing: 6,
    marginTop:     theme.spacing.xs,
  },
  form: { width: '100%' },
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
  loginLink: { alignItems: 'center', marginTop: theme.spacing.lg },
  loginText: {
    fontFamily: theme.fonts.body,
    fontSize:   theme.fontSizes.sm,
    color:      theme.colors.textSecondary,
  },
  loginTextBold: { fontFamily: theme.fonts.bold, color: theme.colors.gold },
});
