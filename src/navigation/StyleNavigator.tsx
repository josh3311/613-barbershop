import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleStackParamList } from './types';
import StyleOnboardingScreen from '../screens/client/StyleOnboardingScreen';
import StyleResultsScreen from '../screens/client/StyleResultsScreen';
import StyleChatScreen from '../screens/client/StyleChatScreen';

const Stack = createNativeStackNavigator<StyleStackParamList>();

export default function StyleNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName="StyleOnboarding"
    >
      <Stack.Screen name="StyleOnboarding" component={StyleOnboardingScreen} />
      <Stack.Screen name="StyleResults" component={StyleResultsScreen} />
      <Stack.Screen name="StyleChat" component={StyleChatScreen} />
    </Stack.Navigator>
  );
}
