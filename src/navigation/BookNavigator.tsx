import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BookStackParamList }          from './types';
import ServicesScreen                  from '@/screens/client/ServicesScreen';
import BookingScreen                   from '@/screens/client/BookingScreen';
import SelectBarberScreen              from '@/screens/client/SelectBarberScreen';
import BookingConfirmationScreen       from '@/screens/client/BookingConfirmationScreen';

// ─── Booking flow:
//   SelectService → SelectDateTime → SelectBarber → BookingConfirm

const Stack = createNativeStackNavigator<BookStackParamList>();

const PLACEHOLDER_BARBER_ID = 'default';

export default function BookNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="SelectService">
      <Stack.Screen
        name="SelectService"
        component={ServicesScreen}
        initialParams={{ barberId: PLACEHOLDER_BARBER_ID }}
      />
      <Stack.Screen name="SelectDateTime" component={BookingScreen} />
      <Stack.Screen name="SelectBarber"   component={SelectBarberScreen} />
      <Stack.Screen name="BookingConfirm" component={BookingConfirmationScreen} />
    </Stack.Navigator>
  );
}
