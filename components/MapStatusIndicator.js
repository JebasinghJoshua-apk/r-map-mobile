import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function MapStatusIndicator({ loading, error, propertyCount }) {
  if (loading) {
    return (
      <View style={[styles.pill, styles.loading]}>
        <ActivityIndicator size="small" color="#fff" />
        <Text style={styles.text}>Updating map…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.pill, styles.error]}>
        <Text style={styles.text} numberOfLines={2}>
          {error}
        </Text>
      </View>
    );
  }

  if (propertyCount > 0) {
    return (
      <View style={[styles.pill, styles.info]}>
        <Text style={styles.text}>{propertyCount} properties in view</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(15,23,42,0.9)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    maxWidth: 320,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 6,
  },
  loading: {
    backgroundColor: "rgba(15, 118, 110, 0.95)",
  },
  error: {
    backgroundColor: "rgba(239, 68, 68, 0.95)",
  },
  info: {
    backgroundColor: "rgba(15, 23, 42, 0.9)",
  },
  text: {
    color: "#fff",
    fontWeight: "600",
  },
});
