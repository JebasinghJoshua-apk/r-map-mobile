import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function ProfileMenu({
  isDark,
  visible,
  topOffset = 0,
  userProfile,
  onDismiss,
  onLogout,
  onNavigateProperties,
}) {
  if (!visible || !userProfile) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onDismiss}
      />
      <View
        pointerEvents="box-none"
        style={[styles.wrapper, { top: topOffset }]}
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? "#0f172a" : "#ffffff",
              borderColor: isDark
                ? "rgba(148,163,184,0.3)"
                : "rgba(15,23,42,0.08)",
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerTextBlock}>
              <Text
                style={[
                  styles.greeting,
                  { color: isDark ? "#f8fafc" : "#0f172a" },
                ]}
              >
                Hi, {userProfile.name}
              </Text>
              <Text
                style={[
                  styles.subtext,
                  { color: isDark ? "#cbd5f5" : "#475569" },
                ]}
              >
                {userProfile.phone}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.row} onPress={onNavigateProperties}>
            <Ionicons
              name="home-outline"
              size={18}
              color={isDark ? "#f8fafc" : "#0f172a"}
            />
            <Text
              style={[
                styles.rowLabel,
                { color: isDark ? "#f8fafc" : "#0f172a" },
              ]}
            >
              My Properties
            </Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={onLogout}>
            <Ionicons name="log-out-outline" size={18} color="#dc2626" />
            <Text style={[styles.rowLabel, { color: "#dc2626" }]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  wrapper: {
    position: "absolute",
    right: 16,
    alignItems: "flex-end",
  },
  card: {
    width: 220,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 14,
    elevation: 10,
  },
  header: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 2,
    marginBottom: 12,
  },
  headerTextBlock: {
    flex: 1,
  },
  greeting: {
    fontSize: 15,
    fontWeight: "500",
  },
  subtext: {
    fontSize: 12,
    fontWeight: "500",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(148,163,184,0.4)",
    marginVertical: 6,
  },
});
