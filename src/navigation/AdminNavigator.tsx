import React from 'react';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AdminTabParamList, AdminStackParamList } from './types';
import { AdminTodayProvider } from '@/context/AdminTodayContext';
import AdminDashboardScreen from '@/screens/admin/AdminDashboardScreen';
import BarberTodayScheduleScreen from '@/screens/admin/BarberTodayScheduleScreen';
import AdminProfileScreen from '@/screens/admin/AdminProfileScreen';

const C = {
  surface:  '#111111',
  border:   '#1E1E1E',
  gold:     '#D4AF37',
  inactive: '#3A3A3A',
} as const;

const Tab = createBottomTabNavigator<AdminTabParamList>();
const Stack = createNativeStackNavigator<AdminStackParamList>();

function AdminDashboardStack(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminDashboardMain" component={AdminDashboardScreen} />
      <Stack.Screen
        name="BarberTodaySchedule"
        component={BarberTodayScheduleScreen}
      />
    </Stack.Navigator>
  );
}

export default function AdminNavigator(): React.JSX.Element {
  return (
    <AdminTodayProvider>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: st.tabBar,
          tabBarActiveTintColor: C.gold,
          tabBarInactiveTintColor: C.inactive,
          tabBarLabelStyle: st.tabLabel,
        }}
      >
        <Tab.Screen
          name="Dashboard"
          component={AdminDashboardStack}
          options={{
            tabBarLabel: 'Dashboard',
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? 'grid' : 'grid-outline'}
                size={24}
                color={color}
              />
            ),
          }}
        />
        <Tab.Screen
          name="AdminProfile"
          component={AdminProfileScreen}
          options={{
            tabBarLabel: 'Profile',
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? 'person-circle' : 'person-circle-outline'}
                size={26}
                color={color}
              />
            ),
          }}
        />
      </Tab.Navigator>
    </AdminTodayProvider>
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
