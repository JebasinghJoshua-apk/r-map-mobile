import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

export default function CompactSearchBar({
  isDark,
  searchQuery,
  topOffset = 0,
  onShowOverlay,
  onClearSearch,
  userProfile,
  onProfilePress,
}) {
  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { top: topOffset }]}>
      <View
        style={[
          styles.container,
          {
            backgroundColor: isDark ? "#0f172a" : "#ffffff",
            borderColor: isDark
              ? "rgba(148,163,184,0.2)"
              : "rgba(15,23,42,0.08)",
          },
        ]}
      >
        <LinearGradient
          colors={["#14B8A6", "#0f766e"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.brandBadge}
        >
          <Text style={styles.brandText}>R</Text>
        </LinearGradient>
        <TouchableOpacity
          style={styles.tapArea}
          onPress={onShowOverlay}
          activeOpacity={0.8}
        >
          <Text
            numberOfLines={1}
            style={[
              styles.queryText,
              { color: isDark ? "#e2e8f0" : "#4B5563" },
            ]}
          >
            {searchQuery || "Search for places"}
          </Text>
        </TouchableOpacity>
        {!!searchQuery && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onClearSearch}
            accessibilityLabel="Clear search"
          >
            <Ionicons
              name="close"
              size={18}
              color={isDark ? "#cbd5f5" : "#475569"}
            />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onShowOverlay}
          accessibilityLabel="Adjust search"
        >
          <Ionicons name="options-outline" size={18} color="#0f766e" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onProfilePress}
          accessibilityLabel="User menu"
        >
          <Ionicons
            name={userProfile ? "person" : "person-outline"}
            size={18}
            color={isDark ? "#e2e8f0" : "#475569"}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 6,
    maxWidth: 380,
    width: "100%",
  },
  brandBadge: {
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  brandText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  tapArea: {
    flex: 1,
    paddingHorizontal: 4,
  },
  queryText: {
    fontSize: 16,
    fontWeight: "600",
  },
  iconButton: {
    padding: 6,
    borderRadius: 16,
  },
});
