import React from 'react';
import { View, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { theme } from '../theme';

const Stack = createNativeStackNavigator();

const Placeholder = ({ name }: { name: string }) => (
  <View style={{
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  }}>
    <Text style={{ color: theme.colors.gold, fontSize: theme.fontSizes.xl }}>
      {name}
    </Text>
  </View>
);

const DashboardScreen = () => <Placeholder name="Barber Dashboard" />;

export default function BarberNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
    </Stack.Navigator>
  );
}
