import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet, View, ActivityIndicator, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ClientTabParamList } from './types';
import { AuthService } from '@/services/auth.service';
import { colors, fonts, spacing, radius, shadows, tabBar, icons } from '@/theme';

import HomeScreen from '@/screens/client/HomeScreen';
import BookNavigator from '@/navigation/BookNavigator';
import StyleNavigator from '@/navigation/StyleNavigator';
import HistoryNavigator from '@/navigation/HistoryNavigator';
import ProfileNavigator from '@/navigation/ProfileNavigator';

const Tab = createBottomTabNavigator<ClientTabParamList>();

// ─── Animated Tab Icon with press scale ──────────────────────────────────────

interface TabIconProps {
  focused: boolean;
  iconName: keyof typeof Ionicons.glyphMap;
  iconNameOutline: keyof typeof Ionicons.glyphMap;
  color: string;
}

function AnimatedTabIcon({ focused, iconName, iconNameOutline, color }: TabIconProps): React.JSX.Element {
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.9,
      useNativeDriver: true,
      friction: 5,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons
          name={focused ? iconName : iconNameOutline}
          size={24}
          color={color}
        />
        {focused && (
          <View style={styles.activeIndicator} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Persistent logout button ────────────────────────────────────────────────

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
      style={styles.logoutBtn}
      accessibilityRole="button"
      accessibilityLabel="Log out"
      accessibilityHint="Signs you out of your account"
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={styles.logoutIconWrap}>
        {busy ? (
          <ActivityIndicator size={14} color={colors.red} />
        ) : (
          <Ionicons name={icons.logOut} size={18} color={colors.red} />
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Navigator ─────────────────────────────────────────────────────────────────

export default function ClientNavigator(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: styles.header,
        headerTitleStyle: styles.headerTitle,
        headerTintColor: colors.white,
        headerShadowVisible: false,
        headerRight: () => <LogoutButton />,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.grey,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color }) => {
          let iconName: keyof typeof Ionicons.glyphMap = icons.tabHome;
          let iconNameOutline: keyof typeof Ionicons.glyphMap = icons.tabHomeOutline;

          switch (route.name) {
            case 'Home':
              iconName = icons.tabHome;
              iconNameOutline = icons.tabHomeOutline;
              break;
            case 'Book':
              iconName = icons.tabBook;
              iconNameOutline = icons.tabBookOutline;
              break;
            case 'Style':
              iconName = icons.tabStyle;
              iconNameOutline = icons.tabStyleOutline;
              break;
            case 'History':
              iconName = icons.tabHistory;
              iconNameOutline = icons.tabHistoryOutline;
              break;
            case 'Profile':
              iconName = icons.tabProfile;
              iconNameOutline = icons.tabProfileOutline;
              break;
          }

          return (
            <AnimatedTabIcon
              focused={focused}
              iconName={iconName}
              iconNameOutline={iconNameOutline}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Home' }}
      />
      <Tab.Screen
        name="Book"
        component={BookNavigator}
        options={{ title: 'Book', headerShown: false }}
      />
      <Tab.Screen
        name="Style"
        component={StyleNavigator}
        options={{ title: 'Style', headerShown: false }}
      />
      <Tab.Screen
        name="History"
        component={HistoryNavigator}
        options={{ title: 'History', headerShown: false }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileNavigator}
        options={{ title: 'Profile', headerShown: false }}
      />
    </Tab.Navigator>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    elevation: 0,
  },
  headerTitle: {
    color: colors.white,
    fontFamily: fonts.heading,
    fontSize: fonts.size['2xl'],
    letterSpacing: fonts.letterSpacing.wide,
  },
  tabBar: {
    backgroundColor: tabBar.backgroundColor,
    borderTopWidth: tabBar.borderTopWidth,
    borderTopColor: tabBar.borderTopColor,
    height: tabBar.height,
    paddingBottom: tabBar.paddingBottom,
    paddingTop: spacing.sm,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  tabLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fonts.size.xs,
    letterSpacing: fonts.letterSpacing.wide,
    marginTop: spacing.xs,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    marginLeft: -10,
    width: tabBar.indicatorWidth,
    height: tabBar.indicatorHeight,
    backgroundColor: colors.gold,
    borderRadius: 2,
  },
  // Logout button
  logoutBtn: { marginRight: spacing.md, padding: spacing.xs },
  logoutIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(229, 57, 53, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(229, 57, 53, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
