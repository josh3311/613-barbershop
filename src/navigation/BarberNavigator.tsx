import React from 'react';
import { View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

import DashboardScreen from '../screens/barber/DashboardScreen';

// ── Placeholder screens (to be built next) ───────────────────
const ScheduleScreen = () => (
  <View style={{ flex: 1, backgroundColor: theme.colors.background,
    alignItems: 'center', justifyContent: 'center' }}>
    <Ionicons name="calendar-outline" size={48} color={theme.colors.textMuted} />
    <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fonts.heading,
      fontSize: 16, marginTop: 12, letterSpacing: 2 }}>SCHEDULE</Text>
    <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fonts.body,
      fontSize: 13, marginTop: 6 }}>Coming soon</Text>
  </View>
);

const BarberProfileScreen = () => (
  <View style={{ flex: 1, backgroundColor: theme.colors.background,
    alignItems: 'center', justifyContent: 'center' }}>
    <Ionicons name="person-outline" size={48} color={theme.colors.textMuted} />
    <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fonts.heading,
      fontSize: 16, marginTop: 12, letterSpacing: 2 }}>PROFILE</Text>
    <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fonts.body,
      fontSize: 13, marginTop: 6 }}>Coming soon</Text>
  </View>
);

// ── Tab icon map ──────────────────────────────────────────────
const TAB_ICONS: Record<string, {
  active:   keyof typeof Ionicons.glyphMap;
  inactive: keyof typeof Ionicons.glyphMap;
}> = {
  Dashboard: { active: 'grid',     inactive: 'grid-outline'     },
  Schedule:  { active: 'calendar', inactive: 'calendar-outline' },
  Profile:   { active: 'person',   inactive: 'person-outline'   },
};

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ── Bottom tabs ───────────────────────────────────────────────
function BarberTabs() {
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
      <Tab.Screen name="Dashboard" component={DashboardScreen}     />
      <Tab.Screen name="Schedule"  component={ScheduleScreen}      />
      <Tab.Screen name="Profile"   component={BarberProfileScreen} />
    </Tab.Navigator>
  );
}

// ── Root stack (tabs + future full-screen views) ──────────────
export default function BarberNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BarberTabs" component={BarberTabs} />
    </Stack.Navigator>
  );
}