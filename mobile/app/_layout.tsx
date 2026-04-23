import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { palette } from "@/lib/theme";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.background },
        }}
      />
    </>
  );
}
