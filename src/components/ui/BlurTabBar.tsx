/**
 * BlurTabBar
 *
 * Custom bottom tab bar used by ClientNavigator.
 * - expo-blur frosted glass background (iOS only, Android uses solid surface)
 * - Active tab icon springs up to 1.2× scale
 * - Gold underline slides between active tabs via withSpring
 *
 * NOTE: Skia Canvas indicator disabled during Android audit.
 * Replaced with a plain View. Restore once Skia is re-enabled.
 */

import React, { useEffect, useMemo } from 'react';
import {
  StyleSheet, View, Pressable, Text, Dimensions, Platform,
} from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { theme } from '../../theme';

const TAB_BAR_HEIGHT   = 78;
const INDICATOR_WIDTH  = 28;
const INDICATOR_HEIGHT = 3;
const INDICATOR_RADIUS = 2;

const TAB_ICONS: Record<string, {
  active:   keyof typeof Ionicons.glyphMap;
  inactive: keyof typeof Ionicons.glyphMap;
  label?:   string;
}> = {
  Home:    { active: 'home',     inactive: 'home-outline'                      },
  Book:    { active: 'calendar', inactive: 'calendar-outline'                  },
  StyleAI: { active: 'cut',      inactive: 'cut-outline',    label: 'Style AI' },
  History: { active: 'time',     inactive: 'time-outline'                      },
  Profile: { active: 'person',   inactive: 'person-outline'                    },
};

// ── Gold indicator — plain View (Skia disabled during audit) ──────
const IndicatorImpl = () => (
  <View
    style={{
      width:           INDICATOR_WIDTH,
      height:          INDICATOR_HEIGHT,
      borderRadius:    INDICATOR_RADIUS,
      backgroundColor: theme.colors.gold,
    }}
  />
);
const Indicator = React.memo(IndicatorImpl);

// ── Single tab button ─────────────────────────────────────────────
interface TabButtonProps {
  routeName:   string;
  focused:     boolean;
  onPress:     () => void;
  onLongPress: () => void;
}

const TabButtonImpl = ({
  routeName, focused, onPress, onLongPress,
}: TabButtonProps) => {
  const scale = useSharedValue(focused ? 1.2 : 1);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.2 : 1, {
      damping:   12,
      stiffness: 220,
    });
  }, [focused, scale]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const cfg = TAB_ICONS[routeName];
  if (!cfg) return null;

  const label = cfg.label ?? routeName;

  const handlePress = () => {
    Haptics.selectionAsync().catch(() => undefined);
    onPress();
  };

  return (
    <Pressable
      style={styles.tabBtn}
      onPress={handlePress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
    >
      <Animated.View style={iconStyle}>
        <Ionicons
          name={focused ? cfg.active : cfg.inactive}
          size={focused ? 24 : 22}
          color={focused ? theme.colors.gold : theme.colors.textMuted}
        />
      </Animated.View>
      <Text
        style={[styles.tabLabel, focused && styles.tabLabelActive]}
        numberOfLines={1}
      >
        {label.toUpperCase()}
      </Text>
    </Pressable>
  );
};
const TabButton = React.memo(TabButtonImpl);

// ── Tab bar ───────────────────────────────────────────────────────
export default function BlurTabBar(props: BottomTabBarProps) {
  const { state, descriptors, navigation } = props;

  const screenWidth = Dimensions.get('window').width;
  const tabCount    = state.routes.length;
  const tabWidth    = screenWidth / tabCount;

  const indicatorX = useSharedValue(
    state.index * tabWidth + (tabWidth - INDICATOR_WIDTH) / 2,
  );

  useEffect(() => {
    indicatorX.value = withSpring(
      state.index * tabWidth + (tabWidth - INDICATOR_WIDTH) / 2,
      { damping: 18, stiffness: 240 },
    );
  }, [state.index, tabWidth, indicatorX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  const tabs = useMemo(() => state.routes.map((route, idx) => {
    const { options } = descriptors[route.key];
    const focused = state.index === idx;

    const onPress = () => {
      const event = navigation.emit({
        type:              'tabPress',
        target:            route.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    };

    const onLongPress = () => {
      navigation.emit({ type: 'tabLongPress', target: route.key });
    };

    if ((options.tabBarStyle as { display?: string } | undefined)?.display === 'none') {
      return null;
    }

    return (
      <TabButton
        key={route.key}
        routeName={route.name}
        focused={focused}
        onPress={onPress}
        onLongPress={onLongPress}
      />
    );
  }), [state, descriptors, navigation]);

  const useBlur = Platform.OS === 'ios';

  return (
    <View style={styles.outer} pointerEvents="box-none">
      {useBlur ? (
        <>
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.tint} />
        </>
      ) : (
        <View style={styles.androidBg} />
      )}

      <View style={styles.topBorder} />

      {/* Sliding gold indicator */}
      <Animated.View style={[styles.indicatorWrap, indicatorStyle]}>
        <Indicator />
      </Animated.View>

      <View style={styles.row}>
        {tabs}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    height:          TAB_BAR_HEIGHT,
    backgroundColor: 'transparent',
    overflow:        'hidden',
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 10, 0.55)',
  },
  androidBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.surface,
  },
  topBorder: {
    position:        'absolute',
    top:             0,
    left:            0,
    right:           0,
    height:          1,
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
  },
  row: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-around',
    paddingTop:     6,
    paddingBottom:  Platform.OS === 'ios' ? 18 : 8,
  },
  tabBtn: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            3,
  },
  tabLabel: {
    fontFamily:    theme.fonts.medium,
    fontSize:      9,
    color:         theme.colors.textMuted,
    letterSpacing: 1,
  },
  tabLabelActive: {
    color: theme.colors.gold,
  },
  indicatorWrap: {
    position: 'absolute',
    top:      4,
    left:     0,
    width:    INDICATOR_WIDTH,
    height:   INDICATOR_HEIGHT,
  },
});