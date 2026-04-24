import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from './types';

import RoleSelectionScreen from '@/screens/RoleSelectionScreen';
import LoginScreen from '@/screens/auth/LoginScreen';
import RegisterScreen from '@/screens/auth/RegisterScreen';
import ForgotPasswordScreen from '@/screens/auth/ForgotPasswordScreen';
import BarberLoginScreen from '@/screens/barber/BarberLoginScreen';
import { colors, fonts } from '@/theme';

const Stack = createNativeStackNavigator<AuthStackParamList>();

const screenOptions = {
  headerShown: true,
  headerStyle: {
    backgroundColor: colors.background,
  },
  headerTintColor: colors.white,
  headerTitleStyle: {
    fontFamily: fonts.heading,
    fontSize: fonts.size['2xl'],
  },
  headerShadowVisible: false,
  contentStyle: {
    backgroundColor: colors.background,
  },
};

export default function AuthNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      initialRouteName="RoleSelection"
      screenOptions={screenOptions}
    >
      <Stack.Screen
        name="RoleSelection"
        component={RoleSelectionScreen}
        options={{ title: '613 Barbershop' }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ title: 'Sign In' }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ title: 'Create Account' }}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{ title: 'Reset Password' }}
      />
      <Stack.Screen
        name="BarberLogin"
        component={BarberLoginScreen}
        options={{ title: 'Barber Sign In' }}
      />
    </Stack.Navigator>
  );
}
