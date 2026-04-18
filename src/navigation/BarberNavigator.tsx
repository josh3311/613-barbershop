import React from 'react';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BarberTabParamList } from './types';

import DashboardScreen    from '@/screens/barber/DashboardScreen';
import ScheduleNavigator  from '@/navigation/ScheduleNavigator';
import ClientsScreen      from '@/screens/barber/ClientsScreen';
import BarberProfileScreen from '@/screens/barber/BarberProfileScreen';

const C = {
  surface:  '#111111',
  border:   '#1E1E1E',
  gold:     '#D4AF37',
  inactive: '#3A3A3A',
  white:    '#FFFFFF',
} as const;

const Tab = createBottomTabNavigator<BarberTabParamList>();

export default function BarberNavigator(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle:             st.tabBar,
        tabBarActiveTintColor:   C.gold,
        tabBarInactiveTintColor: C.inactive,
        tabBarLabelStyle:        st.tabLabel,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Schedule"
        component={ScheduleNavigator}
        options={{
          tabBarLabel: 'Schedule',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Clients"
        component={ClientsScreen}
        options={{
          tabBarLabel: 'Clients',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="BarberProfile"
        component={BarberProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const st = StyleSheet.create({
  tabBar: {
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.border,
    height: 62,
    paddingBottom: 8,
    paddingTop: 6,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
