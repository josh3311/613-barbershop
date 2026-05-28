import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen              from '../screens/client/HomeScreen';
import ServiceSelectionScreen  from '../screens/client/ServiceSelectionScreen';
import BarberSelectionScreen   from '../screens/client/BarberSelectionScreen';
import DateTimeSelectionScreen from '../screens/client/DateTimeSelectionScreen';
import BookingConfirmScreen    from '../screens/client/BookingConfirmScreen';
import BookingSuccessScreen    from '../screens/client/BookingSuccessScreen';
import BookingHistoryScreen    from '../screens/client/BookingHistoryScreen';
import ProfileScreen           from '../screens/client/ProfileScreen';
import StylesScreen            from '../screens/client/StylesScreen';
import AddToBookingScreen      from '../screens/client/AddToBookingScreen';
import ChatScreen              from '../screens/chat/ChatScreen';
import StyleCardViewScreen     from '../screens/client/StyleCardViewScreen';

import { BlurTabBar } from '../components/ui';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function ClientTabs() {
  return (
    <Tab.Navigator
      // BlurTabBar handles the icon, label, indicator, blur background,
      // and active-tab spring. No screenOptions needed for styling.
      tabBar={(props) => <BlurTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home"    component={HomeScreen}             />
      <Tab.Screen name="Book"    component={ServiceSelectionScreen} />
      <Tab.Screen
        name="StyleAI"
        component={StylesScreen}
        options={{ tabBarLabel: 'Style AI' }}
      />
      <Tab.Screen name="History" component={BookingHistoryScreen}   />
      <Tab.Screen name="Profile" component={ProfileScreen}          />
    </Tab.Navigator>
  );
}

export default function ClientNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ClientTabs"        component={ClientTabs}              />
      <Stack.Screen name="BookingFlow"       component={ServiceSelectionScreen}  />
      <Stack.Screen name="BarberSelection"   component={BarberSelectionScreen}   />
      <Stack.Screen name="DateTimeSelection" component={DateTimeSelectionScreen} />
      <Stack.Screen name="BookingConfirm"    component={BookingConfirmScreen}    />
      <Stack.Screen name="BookingSuccess"    component={BookingSuccessScreen}    />
      <Stack.Screen name="Chat"              component={ChatScreen}              />
      <Stack.Screen name="AddToBooking"      component={AddToBookingScreen}      />
      <Stack.Screen name="StyleCardView"     component={StyleCardViewScreen}     />
    </Stack.Navigator>
  );
}