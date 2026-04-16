import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from './types';

import RoleSelectionScreen  from '@/screens/RoleSelectionScreen';
import LoginScreen          from '@/screens/auth/LoginScreen';
import RegisterScreen       from '@/screens/auth/RegisterScreen';
import ForgotPasswordScreen from '@/screens/auth/ForgotPasswordScreen';
import BarberLoginScreen    from '@/screens/barber/BarberLoginScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      initialRouteName="RoleSelection"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="RoleSelection"  component={RoleSelectionScreen} />
      <Stack.Screen name="Login"          component={LoginScreen} />
      <Stack.Screen name="Register"       component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="BarberLogin"    component={BarberLoginScreen} />
    </Stack.Navigator>
  );
}
