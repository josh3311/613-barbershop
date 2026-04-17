import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HistoryStackParamList } from './types';
import HistoryScreen from '@/screens/client/HistoryScreen';
import ChatScreen from '@/screens/chat/ChatScreen';

const Stack = createNativeStackNavigator<HistoryStackParamList>();

export default function HistoryNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HistoryList" component={HistoryScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
    </Stack.Navigator>
  );
}
