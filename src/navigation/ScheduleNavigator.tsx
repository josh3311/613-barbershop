import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ScheduleStackParamList } from './types';
import ScheduleScreen from '@/screens/barber/ScheduleScreen';
import ChatScreen from '@/screens/chat/ChatScreen';
import { colors, fonts } from '@/theme';

const Stack = createNativeStackNavigator<ScheduleStackParamList>();

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

export default function ScheduleNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="ScheduleList"
        component={ScheduleScreen}
        options={{ title: 'Schedule' }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ title: 'Chat' }}
      />
    </Stack.Navigator>
  );
}
