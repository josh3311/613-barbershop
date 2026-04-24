import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HistoryStackParamList } from './types';
import HistoryScreen from '@/screens/client/HistoryScreen';
import ChatScreen from '@/screens/chat/ChatScreen';
import { colors, fonts } from '@/theme';

const Stack = createNativeStackNavigator<HistoryStackParamList>();

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

export default function HistoryNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="HistoryList"
        component={HistoryScreen}
        options={{ title: 'Your Cuts' }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ title: 'Chat' }}
      />
    </Stack.Navigator>
  );
}
