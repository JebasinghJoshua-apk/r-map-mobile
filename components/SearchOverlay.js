import { useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

export default function SearchOverlay({
  isDark,
  searchQuery,
  onChangeQuery,
  onClearQuery,
  onSuggestionPress,
  onSubmitEditing,
  suggestions,
  isFetchingSuggestions,
  suggestionError,
  recentSearches = [],
  onRecentSelect,
  onClearRecent,
}) {
  const hasSuggestions = suggestions.length > 0;
  const showRecents = !hasSuggestions && recentSearches.length > 0;
  const attachResults = hasSuggestions || showRecents;
  const backgroundColor = useMemo(
    () => (isDark ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.95)"),
    [isDark]
  );

  return (
    <>
      <View
        style={[
          styles.brandContainer,
          { backgroundColor: isDark ? "#f1f5f9" : "#f1f5f9" },
        ]}
      >
        <LinearGradient
          colors={["#04c2a8", "#0f766e"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.brandBadge}
        >
          <Text style={styles.brandBadgeText}>R</Text>
        </LinearGradient>
        <View style={styles.brandLabel}>
          <Text
            style={[styles.brandText, { color: "#0f766e" }]}
            numberOfLines={1}
          >
            eal Estate Map
          </Text>
        </View>
      </View>

      <View style={styles.searchSection}>
        <View
          style={[
            styles.searchRow,
            { backgroundColor },
            attachResults && styles.searchRowAttached,
          ]}
        >
          <Ionicons
            name="search"
            size={18}
            color={isDark ? "#cbd5f5" : "#475569"}
          />
          <TextInput
            style={[
              styles.searchInput,
              { color: isDark ? "#f8fafc" : "#0f172a" },
            ]}
            value={searchQuery}
            onChangeText={onChangeQuery}
            placeholder="Search for places..."
            placeholderTextColor={"#94a3b8"}
            returnKeyType="search"
            onSubmitEditing={onSubmitEditing}
          />
          {!!searchQuery && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={onClearQuery}
              accessibilityLabel="Clear search"
            >
              <Ionicons
                name="close"
                size={16}
                color={isDark ? "#475569" : "#475569"}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.filterButton,
              { opacity: suggestions.length ? 1 : 0.65 },
            ]}
            onPress={onSubmitEditing}
            disabled={!suggestions.length}
          >
            {isFetchingSuggestions ? (
              <ActivityIndicator size="small" color="#0f766e" />
            ) : (
              <Ionicons name="options-outline" size={18} color="#0f766e" />
            )}
          </TouchableOpacity>
        </View>

        {suggestionError ? (
          <View style={styles.suggestionErrorContainer}>
            <Text
              style={[
                styles.suggestionErrorText,
                { color: isDark ? "#fecdd3" : "#b91c1c" },
              ]}
            >
              {suggestionError}
            </Text>
          </View>
        ) : null}

        {hasSuggestions && (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={[
              styles.suggestionsList,
              {
                backgroundColor: isDark
                  ? "rgba(15,23,42,0.92)"
                  : "rgba(255,255,255,0.96)",
              },
              styles.suggestionsListAttached,
            ]}
          >
            {suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={suggestion.place_id}
                style={[
                  styles.suggestionRow,
                  {
                    borderBottomWidth:
                      index === suggestions.length - 1
                        ? 0
                        : StyleSheet.hairlineWidth,
                    borderBottomColor: isDark
                      ? "rgba(148, 163, 184, 0.3)"
                      : "rgba(15, 23, 42, 0.08)",
                  },
                ]}
                onPress={() => onSuggestionPress(suggestion)}
              >
                <Ionicons
                  name="location-outline"
                  size={16}
                  color={isDark ? "#cbd5f5" : "#475569"}
                />
                <View style={styles.suggestionTextWrapper}>
                  <Text
                    style={[
                      styles.suggestionPrimary,
                      { color: isDark ? "#f8fafc" : "#0f172a" },
                    ]}
                    numberOfLines={1}
                  >
                    {suggestion.structured_formatting?.main_text ??
                      suggestion.description}
                  </Text>
                  {suggestion.structured_formatting?.secondary_text ? (
                    <Text
                      style={[
                        styles.suggestionSecondary,
                        { color: isDark ? "#94a3b8" : "#64748b" },
                      ]}
                      numberOfLines={1}
                    >
                      {suggestion.structured_formatting.secondary_text}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {showRecents && (
          <View
            style={[
              styles.recentList,
              {
                backgroundColor: isDark
                  ? "rgba(15,23,42,0.92)"
                  : "rgba(255,255,255,0.96)",
              },
              styles.recentListAttached,
            ]}
          >
            <View style={styles.recentHeader}>
              <Text
                style={[
                  styles.recentLabel,
                  { color: isDark ? "#e2e8f0" : "#94a3b8" },
                ]}
              >
                RECENT
              </Text>
              <TouchableOpacity onPress={onClearRecent}>
                <Text
                  style={[
                    styles.clearLabel,
                    { color: isDark ? "#e2e8f0" : "#94a3b8" },
                  ]}
                >
                  CLEAR
                </Text>
              </TouchableOpacity>
            </View>
            {recentSearches.map((recent, index) => (
              <TouchableOpacity
                key={recent.place_id + index}
                style={[
                  styles.suggestionRow,
                  {
                    borderBottomWidth:
                      index === recentSearches.length - 1
                        ? 0
                        : StyleSheet.hairlineWidth,
                    borderBottomColor: isDark
                      ? "rgba(148, 163, 184, 0.3)"
                      : "rgba(15, 23, 42, 0.08)",
                  },
                ]}
                onPress={() => onRecentSelect?.(recent)}
              >
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={isDark ? "#cbd5f5" : "#475569"}
                />
                <View style={styles.suggestionTextWrapper}>
                  <Text
                    style={[
                      styles.suggestionPrimary,
                      { color: isDark ? "#f8fafc" : "#0f172a" },
                    ]}
                    numberOfLines={1}
                  >
                    {recent.structured_formatting?.main_text ??
                      recent.description}
                  </Text>
                  {recent.structured_formatting?.secondary_text ? (
                    <Text
                      style={[
                        styles.suggestionSecondary,
                        { color: isDark ? "#94a3b8" : "#64748b" },
                      ]}
                      numberOfLines={1}
                    >
                      {recent.structured_formatting.secondary_text}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  brandContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 6,
    overflow: "hidden",
    alignSelf: "center",
    marginBottom: 12,
    marginTop: 6,
  },
  brandBadge: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  brandBadgeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 20,
  },
  brandLabel: {
    backgroundColor: "#fff",
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    paddingHorizontal: 12,
    paddingLeft: 4,
    paddingVertical: 6,
  },
  brandText: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    minWidth: 140,
  },
  searchSection: {
    width: "100%",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchRowAttached: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  filterButton: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 6,
  },
  clearButton: {
    marginRight: 0,
    padding: 0,
    borderRadius: 8,
  },
  suggestionsList: {
    marginTop: 0,
    borderRadius: 12,
    maxHeight: 220,
    paddingHorizontal: 8,
  },
  suggestionsListAttached: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  recentList: {
    borderRadius: 12,
    marginTop: 0,
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  recentListAttached: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  recentLabel: {
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: "600",
  },
  clearLabel: {
    fontSize: 10,
    fontWeight: "600",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  suggestionTextWrapper: {
    flex: 1,
  },
  suggestionPrimary: {
    fontSize: 16,
    fontWeight: "600",
  },
  suggestionSecondary: {
    fontSize: 13,
  },
  suggestionErrorContainer: {
    marginTop: 8,
    paddingHorizontal: 8,
  },
  suggestionErrorText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
