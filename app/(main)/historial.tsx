import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";

interface PedidoHistorial {
  id: string;
  minutaId: string;
  opcionSeleccionada: number;
  tipo?: string | null;
  codigoQr: string | null;
  fecha: string | null;
  familia: string | null;
  opcionTexto: string | null;
  nombreVisita?: string | null;
}

const DAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS_FULL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function parseDate(s: string): Date {
  // Mediodía local para evitar corrimiento de zona horaria.
  return new Date(s + "T12:00:00");
}

function monthYearLabel(s: string): string {
  const d = parseDate(s);
  return `${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
}

function isNoAsiste(p: PedidoHistorial): boolean {
  return p.opcionSeleccionada === 0 || p.tipo === "no_asiste";
}

function isVisita(p: PedidoHistorial): boolean {
  return p.tipo === "visita";
}

export default function HistorialScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const { data: pedidos, isLoading, error } = useQuery<PedidoHistorial[]>({
    queryKey: ["/api/historial", user?.id ?? "none"],
    enabled: !!user?.id,
  });

  const lista = (pedidos ?? []).filter((p) => !!p.fecha);
  const totalInscritos = lista.filter((p) => !isNoAsiste(p)).length;
  const totalNoAsiste = lista.filter((p) => isNoAsiste(p)).length;

  // Agrupar por mes preservando el orden (el backend ya envía desc por fecha).
  const groups: { key: string; items: PedidoHistorial[] }[] = [];
  const indexByKey: Record<string, number> = {};
  for (const p of lista) {
    const key = p.fecha ? monthYearLabel(p.fecha) : "Sin fecha";
    if (indexByKey[key] === undefined) {
      indexByKey[key] = groups.length;
      groups.push({ key, items: [] });
    }
    groups[indexByKey[key]].items.push(p);
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Volver">
          <Feather name="arrow-left" size={22} color={Colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Historial de Inscripciones</Text>
          <Text style={styles.subtitle}>{user?.nombre} {user?.apellido}</Text>
        </View>
      </View>

      {!isLoading && lista.length > 0 && (
        <View style={styles.statsRow}>
          <StatCard icon="check-circle" color={Colors.success} label="Inscritos" value={totalInscritos} />
          <StatCard icon="x-circle" color={Colors.warning} label="No asistió" value={totalNoAsiste} />
          <StatCard icon="list" color={Colors.primary} label="Total" value={lista.length} />
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.muted}>Cargando historial...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={36} color={Colors.error} />
          <Text style={styles.emptyTitle}>Error al cargar historial</Text>
          <Text style={styles.muted}>Intenta nuevamente más tarde</Text>
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.center}>
          <Feather name="clock" size={40} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Sin historial aún</Text>
          <Text style={styles.muted}>Tus inscripciones aparecerán aquí.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {groups.map((g) => (
            <View key={g.key} style={styles.monthBlock}>
              <Text style={styles.monthLabel}>{g.key.toUpperCase()}</Text>
              {g.items.map((p) => (
                <PedidoRow key={p.id} pedido={p} />
              ))}
            </View>
          ))}
          {Platform.OS === "web" && <View style={{ height: 34 }} />}
        </ScrollView>
      )}
    </View>
  );
}

function StatCard({ icon, color, label, value }: { icon: any; color: string; label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Feather name={icon} size={16} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function PedidoRow({ pedido }: { pedido: PedidoHistorial }) {
  const noAsiste = isNoAsiste(pedido);
  const visita = isVisita(pedido);
  const d = pedido.fecha ? parseDate(pedido.fecha) : null;
  const accent = noAsiste ? Colors.warning : visita ? Colors.primary : Colors.success;

  return (
    <View style={[styles.row, { borderLeftColor: accent }]}>
      {d && (
        <View style={styles.dateCol}>
          <Text style={styles.dateDay}>{DAYS_SHORT[d.getDay()]}</Text>
          <Text style={styles.dateNum}>{d.getDate()}</Text>
          <Text style={styles.dateMonth}>{MONTHS_SHORT[d.getMonth()]}</Text>
        </View>
      )}
      <View style={styles.rowDivider} />
      <View style={{ flex: 1 }}>
        {noAsiste ? (
          <Text style={[styles.rowTitle, { color: Colors.warning }]}>No asistió</Text>
        ) : visita ? (
          <Text style={[styles.rowTitle, { color: Colors.primary }]}>
            Vale de visita{pedido.nombreVisita ? ` — ${pedido.nombreVisita}` : ""}
          </Text>
        ) : (
          <Text style={styles.rowTitle} numberOfLines={2}>
            Opción {pedido.opcionSeleccionada}
            {pedido.opcionTexto ? ` — ${pedido.opcionTexto}` : ""}
          </Text>
        )}
        <Text style={styles.rowFamilia}>{pedido.familia || "Almuerzo"}</Text>
      </View>
      <MaterialCommunityIcons
        name={noAsiste ? "close-circle-outline" : "check-circle-outline"}
        size={22}
        color={noAsiste ? Colors.warning : Colors.success}
      />
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
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.cardBg,
  },
  title: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    color: Colors.text,
  },
  subtitle: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 20,
    color: Colors.text,
  },
  statLabel: {
    fontFamily: "Poppins_400Regular",
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: "uppercase",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
    color: Colors.textSecondary,
  },
  muted: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  monthBlock: {
    marginBottom: 20,
  },
  monthLabel: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
    color: Colors.primaryLight,
    letterSpacing: 1,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: Colors.cardBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    marginBottom: 8,
  },
  dateCol: {
    width: 38,
    alignItems: "center",
  },
  dateDay: {
    fontFamily: "Poppins_400Regular",
    fontSize: 9,
    color: Colors.textMuted,
    textTransform: "uppercase",
  },
  dateNum: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    color: Colors.text,
    lineHeight: 20,
  },
  dateMonth: {
    fontFamily: "Poppins_400Regular",
    fontSize: 9,
    color: Colors.textMuted,
  },
  rowDivider: {
    width: 1,
    height: 38,
    backgroundColor: Colors.border,
  },
  rowTitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    color: Colors.text,
  },
  rowFamilia: {
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    textTransform: "capitalize",
  },
});
