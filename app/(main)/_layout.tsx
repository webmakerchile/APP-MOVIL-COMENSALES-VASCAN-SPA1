import { Stack, Redirect } from "expo-router";
import React from "react";
import Colors from "@/constants/colors";
import { useAuth, requiresPasswordChange } from "@/lib/auth-context";

export default function MainLayout() {
  const { user, isLoading } = useAuth();

  if (!isLoading && requiresPasswordChange(user)) {
    return <Redirect href="/cambiar-clave" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="home" />
      <Stack.Screen name="minuta-detail" />
    </Stack>
  );
}
