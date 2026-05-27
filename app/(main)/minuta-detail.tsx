import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
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
  opcion2: string;
  opcion3: string;
  opcion4: string | null;
  opcion5: string | null;
}

const DAYS_ES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
const MONTHS_FULL = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function formatFullDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return `${DAYS_ES[d.getDay()]} ${d.getDate()} de ${MONTHS_FULL[d.getMonth()]}`;
}

export default function MinutaDetailScreen() {
  const { id, fecha } = useLocalSearchParams<{ id: string; fecha: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);

  const { data: minutas, isLoading } = useQuery<Minuta[]>({
    queryKey: ["/api/minutas", user?.casinoId ?? "none"],
    enabled: !!user?.casinoId,
  });

  const minuta = minutas?.find((m) => m.id === id);

  const createPedido = useMutation({
    mutationFn: async (opcion: number) => {
      const res = await apiRequest("POST", "/api/pedidos", {
        userId: user!.id,
        minutaId: id,
        opcionSeleccionada: opcion,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setConfirmed(true);
      setQrCode(data.codigoQr);
      queryClient.invalidateQueries({ queryKey: ["/api/pedidos"] });
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    onError: (error: any) => {
      let msg = "Error al registrar tu selección";
      if (error.message?.includes("409")) {
        msg = "Ya seleccionaste una opción para esta fecha";
      } else if (error.message?.includes("403")) {
        msg = "La inscripción no está disponible en este momento. Fuera del horario de inscripción.";
      }
      Alert.alert("Error", msg);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
  });

  function handleSelectOption(num: number) {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedOption(num);
  }

  function handleConfirm() {
    if (!selectedOption) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    createPedido.mutate(selectedOption);
  }

  function getOptions(): { number: number; text: string }[] {
    if (!minuta) return [];
    const options = [
      { number: 1, text: minuta.opcion1 },
      { number: 2, text: minuta.opcion2 },
      { number: 3, text: minuta.opcion3 },
    ];
    if (minuta.opcion4) {
      options.push({ number: 4, text: minuta.opcion4 });
    }
    if (minuta.opcion5) {
      options.push({ number: 5, text: minuta.opcion5 });
    }
    return options;
  }

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          styles.center,
          {
            paddingTop: Platform.OS === "web" ? 67 : insets.top,
          },
        ]}
      >
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

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
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.topBarTitle}>Seleccionar Menú</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.dateCard}>
          <MaterialCommunityIcons
            name="calendar"
            size={24}
            color={Colors.primary}
          />
          <Text style={styles.dateText}>
            {fecha ? formatFullDate(fecha) : ""}
          </Text>
        </View>

        {confirmed ? (
          <View style={styles.confirmedContainer}>
            <View style={styles.confirmedIcon}>
              <Feather name="check-circle" size={56} color={Colors.success} />
            </View>
            <Text style={styles.confirmedTitle}>Inscripción Confirmada</Text>
            <Text style={styles.confirmedSubtitle}>
              Opción {selectedOption}:{" "}
              {getOptions().find((o) => o.number === selectedOption)?.text}
            </Text>

            <Text style={styles.qrHint}>
              Retira tu vale impreso en el tótem del casino el día del servicio.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.backHomeButton,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => router.back()}
            >
              <Feather name="arrow-left" size={18} color={Colors.primary} />
              <Text style={styles.backHomeText}>Volver al inicio</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.selectLabel}>
              Selecciona tu preferencia de menú
            </Text>

            <View style={styles.optionsGrid}>
              {getOptions().map((option) => (
                <Pressable
                  key={option.number}
                  style={({ pressed }) => [
                    styles.optionCard,
                    selectedOption === option.number &&
                      styles.optionCardSelected,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() => handleSelectOption(option.number)}
                >
                  <View style={styles.optionCardHeader}>
                    <View
                      style={[
                        styles.optionBadge,
                        selectedOption === option.number &&
                          styles.optionBadgeSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionBadgeText,
                          selectedOption === option.number &&
                            styles.optionBadgeTextSelected,
                        ]}
                      >
                        {option.number}
                      </Text>
                    </View>
                    {selectedOption === option.number ? (
                      <Feather
                        name="check-circle"
                        size={22}
                        color={Colors.primary}
                      />
                    ) : (
                      <Feather
                        name="circle"
                        size={22}
                        color={Colors.textMuted}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.optionCardText,
                      selectedOption === option.number &&
                        styles.optionCardTextSelected,
                    ]}
                  >
                    {option.text}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.confirmButton,
                !selectedOption && styles.confirmButtonDisabled,
                pressed && selectedOption ? { opacity: 0.85 } : {},
              ]}
              onPress={handleConfirm}
              disabled={!selectedOption || createPedido.isPending}
            >
              {createPedido.isPending ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="check-bold"
                    size={20}
                    color="#FFF"
                  />
                  <Text style={styles.confirmButtonText}>
                    Confirmar Selección
                  </Text>
                </>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    color: Colors.text,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  dateCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.cardBg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
  },
  dateText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: Colors.text,
  },
  selectLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  optionsGrid: {
    gap: 12,
    marginBottom: 24,
  },
  optionCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 16,
    gap: 10,
  },
  optionCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: "rgba(212, 168, 67, 0.08)",
  },
  optionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  optionBadgeSelected: {
    backgroundColor: Colors.primary,
  },
  optionBadgeText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
    color: Colors.textSecondary,
  },
  optionBadgeTextSelected: {
    color: "#FFFFFF",
  },
  optionCardText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  optionCardTextSelected: {
    color: Colors.text,
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
  },
  confirmButtonDisabled: {
    opacity: 0.4,
  },
  confirmButtonText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  confirmedContainer: {
    alignItems: "center",
    paddingTop: 24,
    gap: 12,
  },
  confirmedIcon: {
    marginBottom: 8,
  },
  confirmedTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 24,
    color: Colors.success,
    textAlign: "center",
  },
  confirmedSubtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  qrContainer: {
    alignItems: "center",
    marginTop: 16,
    gap: 8,
  },
  qrPlaceholder: {
    width: 180,
    height: 180,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  qrCodeText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  qrHint: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  backHomeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  backHomeText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: Colors.primary,
  },
});
