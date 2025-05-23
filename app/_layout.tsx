import React from 'react';
import { Stack } from 'expo-router';

function RootLayoutNav() {
  return (
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{}} />
      </Stack>
  );
}

export default RootLayoutNav;
