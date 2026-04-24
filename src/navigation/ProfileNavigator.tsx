import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileStackParamList } from './types';
import ProfileScreen from '@/screens/client/ProfileScreen';
import { colors, fonts } from '@/theme';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

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

export default function ProfileNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      screenOptions={screenOptions}
      initialRouteName="ProfileHome"
    >
      <Stack.Screen
        name="ProfileHome"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Stack.Navigator>
  );
}
