import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BookStackParamList } from './types';
import ServicesScreen from '@/screens/client/ServicesScreen';
import BookingScreen from '@/screens/client/BookingScreen';
import SelectBarberScreen from '@/screens/client/SelectBarberScreen';
import BookingConfirmationScreen from '@/screens/client/BookingConfirmationScreen';
import { colors, fonts } from '@/theme';

// ─── Booking flow:
//   SelectService → SelectBarber → SelectDateTime → BookingConfirm

const Stack = createNativeStackNavigator<BookStackParamList>();

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

export default function BookNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={screenOptions} initialRouteName="SelectService">
      <Stack.Screen
        name="SelectService"
        component={ServicesScreen}
        options={{ title: 'Book a Cut' }}
      />
      <Stack.Screen
        name="SelectBarber"
        component={SelectBarberScreen}
        options={{ title: 'Choose Your Barber' }}
      />
      <Stack.Screen
        name="SelectDateTime"
        component={BookingScreen}
        options={{ title: 'Select Date & Time' }}
      />
      <Stack.Screen
        name="BookingConfirm"
        component={BookingConfirmationScreen}
        options={{ title: 'Confirm Booking' }}
      />
    </Stack.Navigator>
  );
}
