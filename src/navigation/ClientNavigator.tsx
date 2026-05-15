import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { theme }    from '../theme';

import HomeScreen              from '../screens/client/HomeScreen';
import ServiceSelectionScreen  from '../screens/client/ServiceSelectionScreen';
import BarberSelectionScreen   from '../screens/client/BarberSelectionScreen';
import DateTimeSelectionScreen from '../screens/client/DateTimeSelectionScreen';
import BookingConfirmScreen    from '../screens/client/BookingConfirmScreen';
import BookingSuccessScreen    from '../screens/client/BookingSuccessScreen';
import BookingHistoryScreen    from '../screens/client/BookingHistoryScreen';
import ProfileScreen           from '../screens/client/ProfileScreen';
import StylesScreen            from '../screens/client/StylesScreen';
import StyleChatScreen         from '../screens/client/StyleChatScreen';
import AddToBookingScreen      from '../screens/client/AddToBookingScreen';
import AIStylistChatScreen     from '../screens/client/AIStylistChatScreen';
import ChatScreen              from '../screens/chat/ChatScreen';
// StyleCardView is a lightweight screen — created below inline or as a separate file
import StyleCardViewScreen     from '../screens/client/StyleCardViewScreen';

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_ICONS: Record<string, {
  active:   keyof typeof Ionicons.glyphMap;
  inactive: keyof typeof Ionicons.glyphMap;
}> = {
  Home:      { active: 'home',          inactive: 'home-outline'          },
  Book:      { active: 'calendar',      inactive: 'calendar-outline'      },
  Styles:    { active: 'cut',           inactive: 'cut-outline'           },
  History:   { active: 'time',          inactive: 'time-outline'          },
  AIStyler:  { active: 'chatbubbles',   inactive: 'chatbubbles-outline'   },
  Profile:   { active: 'person',        inactive: 'person-outline'        },
};

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
      <Tab.Screen name="Home"     component={HomeScreen}              />
      <Tab.Screen name="Book"     component={ServiceSelectionScreen}  />
      <Tab.Screen name="Styles"   component={StylesScreen}            />
      <Tab.Screen name="History"  component={BookingHistoryScreen}    />
      <Tab.Screen
        name="AIStyler"
        component={AIStylistChatScreen}
        options={{ tabBarLabel: 'AI Chat' }}
      />
      <Tab.Screen name="Profile"  component={ProfileScreen}           />
    </Tab.Navigator>
  );
}

export default function ClientNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ClientTabs"          component={ClientTabs}             />
      <Stack.Screen name="BookingFlow"         component={ServiceSelectionScreen} />
      <Stack.Screen name="BarberSelection"     component={BarberSelectionScreen}  />
      <Stack.Screen name="DateTimeSelection"   component={DateTimeSelectionScreen}/>
      <Stack.Screen name="BookingConfirm"      component={BookingConfirmScreen}   />
      <Stack.Screen name="BookingSuccess"      component={BookingSuccessScreen}   />
      <Stack.Screen name="Chat"                component={ChatScreen}             />
      <Stack.Screen name="StyleChat"           component={StyleChatScreen}        />
      <Stack.Screen name="AddToBooking"        component={AddToBookingScreen}     />
      <Stack.Screen name="StyleCardView"       component={StyleCardViewScreen}    />
    </Stack.Navigator>
  );
}