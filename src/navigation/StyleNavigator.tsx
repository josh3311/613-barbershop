import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleStackParamList } from './types';
import StyleOnboardingScreen from '../screens/client/StyleOnboardingScreen';
import StyleResultsScreen from '../screens/client/StyleResultsScreen';
import StyleChatScreen from '../screens/client/StyleChatScreen';
import { colors, fonts } from '@/theme';

const Stack = createNativeStackNavigator<StyleStackParamList>();

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

export default function StyleNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      screenOptions={screenOptions}
      initialRouteName="StyleOnboarding"
    >
      <Stack.Screen
        name="StyleOnboarding"
        component={StyleOnboardingScreen}
        options={{ title: 'Find Your Style' }}
      />
      <Stack.Screen
        name="StyleResults"
        component={StyleResultsScreen}
        options={{ title: 'Style Results' }}
      />
      <Stack.Screen
        name="StyleChat"
        component={StyleChatScreen}
        options={{ title: 'Style Assistant' }}
      />
    </Stack.Navigator>
  );
}
