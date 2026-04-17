import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ClientTabParamList } from './types';
import { AuthService } from '@/services/auth.service';

import HomeScreen    from '@/screens/client/HomeScreen';
import BookNavigator from '@/navigation/BookNavigator';
import HistoryNavigator from '@/navigation/HistoryNavigator';
import ProfileScreen from '@/screens/client/ProfileScreen';

const Tab = createBottomTabNavigator<ClientTabParamList>();

const C = {
  bg:       '#0A0A0A',
  surface:  '#111111',
  gold:     '#D4AF37',
  inactive: '#3A3A3A',
  border:   '#1E1E1E',
  white:    '#FFFFFF',
  danger:   '#CF6679',
  dangerBg: '#2A1010',
  dangerBdr:'#CF667944',
} as const;

// ─── Persistent logout button ─────────────────────────────────────────────────

function LogoutButton(): React.JSX.Element {
  const [busy, setBusy] = useState(false);

  async function handleLogout(): Promise<void> {
    if (busy) return;
    setBusy(true);
    await AuthService.logout();
    setBusy(false);
  }

  return (
    <TouchableOpacity
      onPress={handleLogout}
      disabled={busy}
      style={st.logoutBtn}
      accessibilityRole="button"
      accessibilityLabel="Log out"
      accessibilityHint="Signs you out of your account"
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={st.logoutIconWrap}>
        {busy
          ? <ActivityIndicator size={14} color={C.danger} />
          : <Ionicons name="log-out-outline" size={18} color={C.danger} />
        }
      </View>
    </TouchableOpacity>
  );
}

// ─── Navigator ────────────────────────────────────────────────────────────────

export default function ClientNavigator(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle:      st.header,
        headerTitleStyle: st.headerTitle,
        headerTintColor:  C.white,
        headerShadowVisible: false,
        headerRight: () => <LogoutButton />,
        tabBarStyle:              st.tabBar,
        tabBarActiveTintColor:    C.gold,
        tabBarInactiveTintColor:  C.inactive,
        tabBarLabelStyle:         st.tabLabel,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Book"
        component={BookNavigator}
        options={{
          title: 'Book',
          headerShown: false,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryNavigator}
        options={{
          title: 'History',
          headerShown: false,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'time' : 'time-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={26} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  header: {
    backgroundColor: '#141414',
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
    elevation: 0,
  },
  headerTitle: {
    color: C.white,
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: 0.5,
  },
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

  // Logout button
  logoutBtn:      { marginRight: 14, padding: 4 },
  logoutIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: C.dangerBg, borderWidth: 1, borderColor: C.dangerBdr,
    alignItems: 'center', justifyContent: 'center',
  },
});
