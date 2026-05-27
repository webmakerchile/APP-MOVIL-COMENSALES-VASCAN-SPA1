import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/query-client";

interface Minuta {
  id: string;
  casinoId: string;
  fecha: string;
  familia: string;
  opcion1: string;
}

export default function ValeVisitaScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [nombreVisita, setNombreVisita] = useState("");
  const [selectedMinuta, setSelectedMinuta] = useState<string | null>(null);

  const { data: minutas, isLoading } = useQuery<Minuta[]>({
    queryKey: ["/api/minutas", user?.casinoId ?? "none"],
    enabled: !!user?.casinoId,
  });

  const createVale = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pedidos/visita", {
        userId: user!.id,
        minutaId: selectedMinuta,
        nombreVisita: nombreVisita.trim(),
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pedidos"] });
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert("Vale Emitido", `Vale de visita creado para "${nombreVisita}". Indícale a la persona que retire el vale impreso en el tótem.`, [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
    onError: () => {
      Alert.alert("Error", "No se pudo crear el vale de visita.");
    },
  });

  const sortedMinutas = (minutas ?? []).sort(
    (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
  );

  const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

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
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Vale de Visita</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoCard}>
          <MaterialCommunityIcons name="account-plus" size={28} color={Colors.primary} />
          <Text style={styles.infoText}>
            Emite un vale para personas que no están registradas en el sistema (visitas, entrevistas, ingresos nuevos).
          </Text>
        </View>

        <Text style={styles.label}>Nombre de la visita</Text>
        <TextInput
          style={styles.input}
          placeholder="Nombre completo de la visita"
          placeholderTextColor={Colors.textMuted}
          value={nombreVisita}
          onChangeText={setNombreVisita}
        />

        <Text style={styles.label}>Selecciona el día</Text>
        {isLoading ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          sortedMinutas.map((m) => {
            const d = new Date(m.fecha + "T12:00:00");
            const isSelected = selectedMinuta === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => setSelectedMinuta(m.id)}
                style={[styles.dayOption, isSelected && styles.dayOptionSelected]}
              >
                <View style={styles.dayOptionLeft}>
                  <Text style={[styles.dayOptionDay, isSelected && { color: Colors.primary }]}>
                    {DAYS[d.getDay()]} {d.getDate()}
                  </Text>
                  <Text style={styles.dayOptionFam}>{m.familia}</Text>
                </View>
                {isSelected && <Feather name="check-circle" size={20} color="#22C55E" />}
              </Pressable>
            );
          })
        )}

        <Pressable
          onPress={() => createVale.mutate()}
          disabled={!nombreVisita.trim() || !selectedMinuta || createVale.isPending}
          style={[
            styles.submitBtn,
            (!nombreVisita.trim() || !selectedMinuta) && { opacity: 0.5 },
          ]}
        >
          {createVale.isPending ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitBtnText}>Emitir Vale de Visita</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    color: Colors.text,
  },
  content: {
    padding: 20,
    gap: 12,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(212, 168, 67, 0.08)",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(212, 168, 67, 0.2)",
    marginBottom: 8,
  },
  infoText: {
    flex: 1,
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  label: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: "Poppins_400Regular",
    fontSize: 15,
    color: Colors.text,
  },
  dayOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  dayOptionSelected: {
    borderColor: "#22C55E",
    backgroundColor: "rgba(34, 197, 94, 0.06)",
  },
  dayOptionLeft: {
    gap: 2,
  },
  dayOptionDay: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: Colors.text,
  },
  dayOptionFam: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: Colors.primaryLight,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 12,
  },
  submitBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
  },
});
