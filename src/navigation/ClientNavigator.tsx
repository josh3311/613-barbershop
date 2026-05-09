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

const HomeScreen = () => <Placeholder name="Client Home" />;

export default function ClientNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
    </Stack.Navigator>
  );
}
