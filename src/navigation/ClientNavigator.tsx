import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { View, Text } from 'react-native';
import { theme } from '../theme';

// Screens
import HomeScreen             from '../screens/client/HomeScreen';
import ServiceSelectionScreen from '../screens/client/ServiceSelectionScreen';
import BarberSelectionScreen  from '../screens/client/BarberSelectionScreen';

const Placeholder = ({ name }: { name: string }) => (
  <View style={{ flex: 1, backgroundColor: theme.colors.background,
    alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color: theme.colors.gold,
      fontFamily: theme.fonts.heading, fontSize: 24 }}>{name}</Text>
  </View>
);

const BookScreen        = () => <Placeholder name="Book" />;
const HistoryScreen     = () => <Placeholder name="History" />;
const ProfileScreen     = () => <Placeholder name="Profile" />;
const DateTimeScreen    = () => <Placeholder name="Pick Date & Time" />;

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

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
          const icons: Record<string, {
            active:   keyof typeof Ionicons.glyphMap;
            inactive: keyof typeof Ionicons.glyphMap;
          }> = {
            Home:    { active: 'home',     inactive: 'home-outline'     },
            Book:    { active: 'calendar', inactive: 'calendar-outline' },
            History: { active: 'time',     inactive: 'time-outline'     },
            Profile: { active: 'person',   inactive: 'person-outline'   },
          };
          const icon = icons[route.name];
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
      <Tab.Screen name="Home"    component={HomeScreen}    />
      <Tab.Screen name="Book"    component={BookScreen}    />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function ClientNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ClientTabs"       component={ClientTabs}             />
      <Stack.Screen name="BookingFlow"      component={ServiceSelectionScreen} />
      <Stack.Screen name="BarberSelection"  component={BarberSelectionScreen}  />
      <Stack.Screen name="DateTimeSelection" component={DateTimeScreen}        />
    </Stack.Navigator>
  );
}