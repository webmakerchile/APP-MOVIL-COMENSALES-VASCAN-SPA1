import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Image,
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
  opcion2: string;
  opcion3: string;
  opcion4: string | null;
  opcion5: string | null;
  activo: boolean;
}

interface Pedido {
  id: string;
  userId: string;
  minutaId: string;
  opcionSeleccionada: number;
  tipo?: string;
  codigoQr: string | null;
}

const DAYS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function getOptions(m: Minuta) {
  const opts: { number: number; text: string }[] = [
    { number: 1, text: m.opcion1 },
    { number: 2, text: m.opcion2 },
    { number: 3, text: m.opcion3 },
  ];
  if (m.opcion4) opts.push({ number: 4, text: m.opcion4 });
  if (m.opcion5) opts.push({ number: 5, text: m.opcion5 });
  return opts;
}

type DaySelection = {
  minutaId: string;
  opcionSeleccionada: number;
  tipo: "seleccion" | "no_asiste";
};

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [selections, setSelections] = useState<Record<string, DaySelection>>({});
  const [expandedMinuta, setExpandedMinuta] = useState<string | null>(null);

  const { data: disponibles, isLoading, isRefetching, refetch } = useQuery<{ minutas: Minuta[]; periodo: any }>({
    queryKey: ["/api/minutas-disponibles", user?.casinoId ?? "none"],
    enabled: !!user?.casinoId,
  });
  const minutas = disponibles?.minutas;

  const { data: periodoData } = useQuery<{ activo: boolean; periodo: any }>({
    queryKey: ["/api/periodo-activo", user?.casinoId ?? "none"],
    enabled: !!user?.casinoId,
  });

  const periodoActivo = periodoData?.activo ?? false;

  const { data: pedidos } = useQuery<Pedido[]>({
    queryKey: ["/api/pedidos", user?.id ?? "none"],
    enabled: !!user?.id,
  });

  const submitWeek = useMutation({
    mutationFn: async (selArray: { minutaId: string; opcionSeleccionada: number; tipo: string }[]) => {
      const res = await apiRequest("POST", "/api/pedidos/semanal", {
        userId: user!.id,
        selecciones: selArray,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pedidos"] });
      setSelections({});
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      const skipped = Array.isArray(data?.skipped) ? data.skipped : [];
      const okCount = Array.isArray(data?.results) ? data.results.length : 0;
      if (skipped.length > 0 && okCount > 0) {
        Alert.alert("Inscripción parcial", `Se registraron ${okCount} días. ${skipped.length} quedaron fuera de la ventana de inscripción.`);
      } else if (skipped.length > 0 && okCount === 0) {
        Alert.alert("Sin registros", "Ningún día pudo registrarse: todos están fuera de la ventana de inscripción.");
      } else {
        Alert.alert("Listo", "Tu inscripción semanal fue registrada correctamente.");
      }
    },
    onError: (err: any) => {
      const msg = err?.message || "Hubo un problema al registrar tu inscripción.";
      Alert.alert("Error", msg);
    },
  });

  const sortedMinutas = useMemo(() =>
    (minutas ?? []).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()),
    [minutas]
  );

  const pedidoByMinuta = useMemo(() => {
    const map: Record<string, Pedido> = {};
    (pedidos ?? []).forEach(p => { map[p.minutaId] = p; });
    return map;
  }, [pedidos]);

  function handleLogout() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    logout();
    router.replace("/login");
  }

  function selectOption(minutaId: string, opcion: number) {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelections(prev => ({
      ...prev,
      [minutaId]: { minutaId, opcionSeleccionada: opcion, tipo: "seleccion" },
    }));
  }

  function selectNoAsiste(minutaId: string) {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelections(prev => ({
      ...prev,
      [minutaId]: { minutaId, opcionSeleccionada: 0, tipo: "no_asiste" },
    }));
  }

  function toggleMinuta(minutaId: string) {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setExpandedMinuta(prev => prev === minutaId ? null : minutaId);
  }

  function handleSubmitWeek() {
    if (!periodoActivo) {
      Alert.alert("Inscripción cerrada", "No hay un periodo de inscripción activo en este momento. Contacta a tu administrador.");
      return;
    }
    const selArray = Object.values(selections);
    if (selArray.length === 0) {
      Alert.alert("Atención", "Selecciona al menos una opción antes de enviar.");
      return;
    }
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    submitWeek.mutate(selArray);
  }

  function getDayStatus(minuta: Minuta): "registered" | "selected" | "no_asiste" | "pending" {
    const pedido = pedidoByMinuta[minuta.id];
    if (pedido) {
      if (pedido.opcionSeleccionada === 0) return "no_asiste";
      return "registered";
    }
    const sel = selections[minuta.id];
    if (sel) {
      if (sel.tipo === "no_asiste") return "no_asiste";
      return "selected";
    }
    return "pending";
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "registered": return "#22C55E";
      case "selected": return "#86EFAC";
      case "no_asiste": return "#F97316";
      case "pending": return Colors.border;
      default: return Colors.border;
    }
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case "registered": return "Inscrito";
      case "selected": return "Seleccionado";
      case "no_asiste": return "No asiste";
      case "pending": return "Pendiente";
      default: return "";
    }
  }

  const pendingSelections = Object.keys(selections).length;
  const isInterlocutor = user?.role === "interlocutor";

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
        <View style={styles.headerLeft}>
          <Image
            source={require("@/assets/images/vascan-logo.webp")}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.greeting}>Hola, {user?.nombre}</Text>
            <Text style={styles.roleTag}>
              {user?.role === "admin" ? "Administrador" : user?.role === "interlocutor" ? "Interlocutor" : "Comensal"}
            </Text>
          </View>
        </View>
        <Pressable onPress={handleLogout} style={styles.logoutButton}>
          <Feather name="log-out" size={22} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons name="silverware-fork-knife" size={22} color={Colors.primary} />
        <Text style={styles.sectionTitle}>Inscripción Semanal</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Cargando minutas...</Text>
        </View>
      ) : !user?.casinoId ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Sin casino asignado</Text>
          <Text style={styles.emptyText}>Contacta a tu administrador para ser asignado a un casino</Text>
        </View>
      ) : !periodoActivo ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="clock-alert-outline" size={48} color="#f59e0b" />
          <Text style={styles.emptyTitle}>Sin periodo activo</Text>
          <Text style={styles.emptyText}>No hay un periodo de inscripción abierto en este momento. Vuelve cuando tu administrador lo habilite.</Text>
        </View>
      ) : sortedMinutas.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="food-off" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Sin minutas disponibles</Text>
          <Text style={styles.emptyText}>No hay menús cargados para la ventana de servicio del periodo activo.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.primary} />}
        >
          {!periodoActivo && (
            <View style={styles.periodoBanner}>
              <MaterialCommunityIcons name="clock-alert-outline" size={20} color="#f59e0b" />
              <Text style={styles.periodoBannerText}>El periodo de inscripción no está activo. Solo puedes ver el menú.</Text>
            </View>
          )}
          {sortedMinutas.map((minuta) => {
            const d = new Date(minuta.fecha + "T12:00:00");
            const dayName = DAYS_ES[d.getDay()];
            const dayShort = DAYS_SHORT[d.getDay()];
            const dayNum = d.getDate();
            const month = MONTHS_ES[d.getMonth()];
            const status = getDayStatus(minuta);
            const statusColor = getStatusColor(status);
            const isExpanded = expandedMinuta === minuta.id;
            const pedido = pedidoByMinuta[minuta.id];
            const sel = selections[minuta.id];
            const options = getOptions(minuta);
            const isToday = new Date().toISOString().split("T")[0] === minuta.fecha;
            const alreadyRegistered = !!pedido;

            return (
              <View key={minuta.id} style={styles.dayCard}>
                <Pressable
                  onPress={() => toggleMinuta(minuta.id)}
                  style={[
                    styles.dayHeader,
                    { borderLeftColor: statusColor, borderLeftWidth: 4 },
                    isToday && styles.dayHeaderToday,
                  ]}
                >
                  <View style={styles.dayHeaderLeft}>
                    <View style={styles.dayDateCol}>
                      <Text style={[styles.dayShortText, isToday && { color: Colors.primary }]}>{dayShort}</Text>
                      <Text style={[styles.dayNumText, isToday && { color: Colors.primary }]}>{dayNum}</Text>
                      <Text style={styles.dayMonthText}>{month}</Text>
                    </View>
                    <View style={styles.dayInfoCol}>
                      <Text style={styles.dayNameText}>{dayName}</Text>
                      <Text style={[styles.famText]}>{minuta.familia || "Almuerzo"}</Text>
                    </View>
                  </View>
                  <View style={styles.dayHeaderRight}>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
                      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                      <Text style={[styles.statusText, { color: statusColor }]}>{getStatusLabel(status)}</Text>
                    </View>
                    <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={Colors.textMuted} />
                  </View>
                </Pressable>

                {isExpanded && (
                  <View style={styles.dayBody}>
                    {alreadyRegistered && (
                      <Text style={[styles.selectLabel, { color: Colors.primaryLight }]}>
                        Ya inscrito {pedido.opcionSeleccionada === 0 ? "(no asistirás)" : `(Opción ${pedido.opcionSeleccionada})`}. Puedes modificar tu selección:
                      </Text>
                    )}
                    {!alreadyRegistered && (
                      <Text style={styles.selectLabel}>Selecciona tu opción:</Text>
                    )}
                    {options.map(opt => {
                      const currentOpt = sel?.tipo === "seleccion" ? sel.opcionSeleccionada : (alreadyRegistered && !sel ? pedido.opcionSeleccionada : undefined);
                      const isSelected = currentOpt === opt.number;
                      return (
                        <Pressable
                          key={opt.number}
                          onPress={() => selectOption(minuta.id, opt.number)}
                          style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                        >
                          <View style={[styles.optionNum, isSelected && styles.optionNumSelected]}>
                            <Text style={[styles.optionNumText, isSelected && { color: "#FFF" }]}>{opt.number}</Text>
                          </View>
                          <Text style={[styles.optionText, isSelected && styles.optionTextSelected]} numberOfLines={2}>
                            {opt.text}
                          </Text>
                          {isSelected && <Feather name="check-circle" size={20} color="#22C55E" />}
                        </Pressable>
                      );
                    })}
                    {(() => {
                      const noAsisteActive = sel?.tipo === "no_asiste" || (alreadyRegistered && !sel && pedido.opcionSeleccionada === 0);
                      return (
                        <Pressable
                          onPress={() => selectNoAsiste(minuta.id)}
                          style={[styles.noAsisteBtn, noAsisteActive && styles.noAsisteBtnActive]}
                        >
                          <Feather name="x-circle" size={18} color={noAsisteActive ? "#FFF" : "#F97316"} />
                          <Text style={[styles.noAsisteBtnText, noAsisteActive && { color: "#FFF" }]}>
                            No asisto este día
                          </Text>
                        </Pressable>
                      );
                    })()}
                    {alreadyRegistered && pedido.opcionSeleccionada !== 0 && (
                      <Pressable
                        onPress={() => router.push({ pathname: "/(main)/minuta-detail", params: { id: minuta.id, fecha: minuta.fecha } })}
                        style={styles.verValeInline}
                      >
                        <Feather name="external-link" size={16} color={Colors.primary} />
                        <Text style={styles.verValeText}>Ver vale actual →</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {!isExpanded && alreadyRegistered && (
                  <View style={styles.registeredInfo}>
                    {pedido.opcionSeleccionada === 0 ? (
                      <Text style={styles.registeredText}>No asistirás este día</Text>
                    ) : (
                      <Pressable
                        onPress={() => router.push({ pathname: "/(main)/minuta-detail", params: { id: minuta.id, fecha: minuta.fecha } })}
                        style={styles.registeredRow}
                      >
                        <Text style={styles.registeredText}>
                          Opción {pedido.opcionSeleccionada} seleccionada
                        </Text>
                        <Text style={styles.verValeText}>Ver vale →</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {isInterlocutor && (
            <Pressable
              onPress={() => router.push("/(main)/vale-visita" as any)}
              style={styles.visitaBtnContainer}
            >
              <MaterialCommunityIcons name="account-plus" size={22} color={Colors.primary} />
              <Text style={styles.visitaBtnText}>Emitir Vale de Visita</Text>
              <Feather name="chevron-right" size={18} color={Colors.textMuted} />
            </Pressable>
          )}

          {pendingSelections > 0 && (
            <Pressable
              onPress={handleSubmitWeek}
              style={[styles.submitBtn, submitWeek.isPending && { opacity: 0.6 }]}
              disabled={submitWeek.isPending}
            >
              {submitWeek.isPending ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Feather name="check" size={20} color="#FFF" />
                  <Text style={styles.submitBtnText}>
                    Confirmar Inscripción ({pendingSelections} {pendingSelections === 1 ? "día" : "días"})
                  </Text>
                </>
              )}
            </Pressable>
          )}
        </ScrollView>
      )}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerLogo: {
    width: 44,
    height: 44,
  },
  greeting: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    color: Colors.text,
  },
  roleTag: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: Colors.primaryLight,
  },
  logoutButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    color: Colors.text,
  },
  periodoBanner: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  periodoBannerText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: "#f59e0b",
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
    gap: 10,
  },
  dayCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 14,
    paddingLeft: 16,
  },
  dayHeaderToday: {
    backgroundColor: "rgba(212, 168, 67, 0.06)",
  },
  dayHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  dayDateCol: {
    alignItems: "center",
    width: 42,
  },
  dayShortText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: "uppercase",
  },
  dayNumText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 22,
    color: Colors.text,
    lineHeight: 26,
  },
  dayMonthText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 10,
    color: Colors.textMuted,
  },
  dayInfoCol: {
    gap: 2,
  },
  dayNameText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: Colors.text,
  },
  famText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: Colors.primaryLight,
  },
  dayHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
  },
  dayBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  selectLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionCardSelected: {
    borderColor: "#22C55E",
    backgroundColor: "rgba(34, 197, 94, 0.08)",
  },
  optionNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(212, 168, 67, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  optionNumSelected: {
    backgroundColor: "#22C55E",
  },
  optionNumText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
    color: Colors.primary,
  },
  optionText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  optionTextSelected: {
    color: Colors.text,
    fontFamily: "Poppins_500Medium",
  },
  noAsisteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F9731640",
    backgroundColor: "rgba(249, 115, 22, 0.05)",
  },
  noAsisteBtnActive: {
    backgroundColor: "#F97316",
    borderColor: "#F97316",
  },
  noAsisteBtnText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: "#F97316",
  },
  registeredInfo: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  registeredRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  registeredText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  verValeText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    color: Colors.primary,
  },
  verValeInline: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(212, 168, 67, 0.08)",
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  visitaBtnContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: Colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  visitaBtnText: {
    flex: 1,
    fontFamily: "Poppins_500Medium",
    fontSize: 15,
    color: Colors.text,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#22C55E",
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 6,
  },
  submitBtnText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 15,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    color: Colors.text,
    textAlign: "center",
  },
  emptyText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});
