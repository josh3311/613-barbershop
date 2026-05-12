import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

import HomeScreen              from '../screens/client/HomeScreen';
import ServiceSelectionScreen  from '../screens/client/ServiceSelectionScreen';
import BarberSelectionScreen   from '../screens/client/BarberSelectionScreen';
import DateTimeSelectionScreen from '../screens/client/DateTimeSelectionScreen';
import BookingConfirmScreen    from '../screens/client/BookingConfirmScreen';
import BookingSuccessScreen    from '../screens/client/BookingSuccessScreen';
import BookingHistoryScreen    from '../screens/client/BookingHistoryScreen';
import ProfileScreen           from '../screens/client/ProfileScreen';
import ChatScreen              from '../screens/chat/ChatScreen';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ── Tab icon map ──────────────────────────────────────────────
const TAB_ICONS: Record<string, {
  active:   keyof typeof Ionicons.glyphMap;
  inactive: keyof typeof Ionicons.glyphMap;
}> = {
  Home:    { active: 'home',     inactive: 'home-outline'     },
  Book:    { active: 'calendar', inactive: 'calendar-outline' },
  History: { active: 'time',     inactive: 'time-outline'     },
  Profile: { active: 'person',   inactive: 'person-outline'   },
};

// ── Bottom tabs ───────────────────────────────────────────────
function ClientTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor:  theme.colors.border,
          borderTopWidth:  1,
          paddingBottom:   8,
          paddingTop:      8,
          height:          70,
        },
        tabBarActiveTintColor:   theme.colors.gold,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: {
          fontFamily: theme.fonts.medium,
          fontSize:   10,
          marginTop:  2,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icon = TAB_ICONS[route.name];
          return (
            <Ionicons
              name={focused ? icon.active : icon.inactive}
              size={size}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Home"    component={HomeScreen}           />
      {/*
        Book tab now shows ServiceSelectionScreen directly.
        The back button inside ServiceSelectionScreen is hidden
        when there is nothing to go back to (tab root).
      */}
      <Tab.Screen name="Book"    component={ServiceSelectionScreen} />
      <Tab.Screen name="History" component={BookingHistoryScreen}   />
      <Tab.Screen name="Profile" component={ProfileScreen}          />
    </Tab.Navigator>
  );
}

// ── Root stack (tabs + full-screen booking flow) ──────────────
export default function ClientNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* Tab shell */}
      <Stack.Screen name="ClientTabs" component={ClientTabs} />

      {/* Full-screen booking flow pushed on top of tabs */}
      <Stack.Screen name="BookingFlow"       component={ServiceSelectionScreen}  />
      <Stack.Screen name="BarberSelection"   component={BarberSelectionScreen}   />
      <Stack.Screen name="DateTimeSelection" component={DateTimeSelectionScreen} />
      <Stack.Screen name="BookingConfirm"    component={BookingConfirmScreen}    />
      <Stack.Screen name="BookingSuccess"    component={BookingSuccessScreen}    />
      <Stack.Screen name="Chat"              component={ChatScreen}              />
    </Stack.Navigator>
  );
}