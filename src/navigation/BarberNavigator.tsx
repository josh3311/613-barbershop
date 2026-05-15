import React from 'react';
import { createBottomTabNavigator }   from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { theme }    from '../theme';

import DashboardScreen      from '../screens/barber/DashboardScreen';
import ScheduleScreen       from '../screens/barber/BarberScheduleScreen';
import ProfileScreen        from '../screens/barber/BarberProfileScreen';
import ChatsScreen          from '../screens/barber/BarberChatsScreen';
import ChatScreen           from '../screens/chat/ChatScreen';
import CutGuideScreen       from '../screens/barber/CutGuideScreen';
import StyleDocumentScreen  from '../screens/barber/StyleDocumentScreen';

const TAB_ICONS: Record<string, {
  active:   keyof typeof Ionicons.glyphMap;
  inactive: keyof typeof Ionicons.glyphMap;
}> = {
  Dashboard: { active: 'grid',        inactive: 'grid-outline'        },
  Schedule:  { active: 'calendar',    inactive: 'calendar-outline'    },
  Messages:  { active: 'chatbubbles', inactive: 'chatbubbles-outline' },
  Profile:   { active: 'person',      inactive: 'person-outline'      },
};

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

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
          if (!icon) return null;
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
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Schedule"  component={ScheduleScreen}  />
      <Tab.Screen name="Messages"  component={ChatsScreen}     />
      <Tab.Screen name="Profile"   component={ProfileScreen}   />
    </Tab.Navigator>
  );
}

export default function BarberNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BarberTabs"     component={BarberTabs}         />
      <Stack.Screen name="BarberChat"     component={ChatScreen}         />
      <Stack.Screen name="CutGuide"       component={CutGuideScreen}     />
      <Stack.Screen name="StyleDocument"  component={StyleDocumentScreen}/>
    </Stack.Navigator>
  );
}