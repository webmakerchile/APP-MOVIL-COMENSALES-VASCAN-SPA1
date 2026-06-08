import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useAuth, requiresPasswordChange } from "@/lib/auth-context";

export default function SplashRedirect() {
  const { user, isLoading } = useAuth();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        if (requiresPasswordChange(user)) {
          router.replace("/cambiar-clave");
        } else {
          router.replace("/(main)/home");
        }
      } else {
        router.replace("/login");
      }
    }
  }, [isLoading, user]);

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Platform.OS === "web" ? 67 : insets.top,
          paddingBottom: Platform.OS === "web" ? 34 : insets.bottom,
        },
      ]}
    >
      <Image
        source={require("@/assets/images/vascan-logo.webp")}
        style={styles.logo}
        resizeMode="contain"
      />
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
  },
  logo: {
    width: 200,
    height: 100,
  },
});
