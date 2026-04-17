import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ScheduleStackParamList } from './types';
import ScheduleScreen from '@/screens/barber/ScheduleScreen';
import ChatScreen from '@/screens/chat/ChatScreen';

const Stack = createNativeStackNavigator<ScheduleStackParamList>();

export default function ScheduleNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ScheduleList" component={ScheduleScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
    </Stack.Navigator>
  );
}
