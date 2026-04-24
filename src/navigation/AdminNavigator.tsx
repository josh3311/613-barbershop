import React from 'react';
import { StyleSheet, View, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AdminTabParamList } from './types';
import { colors, fonts, spacing, tabBar, icons } from '@/theme';

import AdminDashboardScreen from '@/screens/admin/AdminDashboardScreen';
import AdminProfileScreen from '@/screens/admin/AdminProfileScreen';

const Tab = createBottomTabNavigator<AdminTabParamList>();

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

export default function AdminNavigator(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.grey,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color }) => {
          let iconName: keyof typeof Ionicons.glyphMap = icons.grid;
          let iconNameOutline: keyof typeof Ionicons.glyphMap = icons.gridOutline;

          switch (route.name) {
            case 'Dashboard':
              iconName = icons.grid;
              iconNameOutline = icons.gridOutline;
              break;
            case 'AdminProfile':
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
        name="Dashboard"
        component={AdminDashboardScreen}
        options={{ tabBarLabel: 'Dashboard' }}
      />
      <Tab.Screen
        name="AdminProfile"
        component={AdminProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
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
});
