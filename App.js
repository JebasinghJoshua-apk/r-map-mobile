import { useEffect, useRef, useState } from "react";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import {
  Platform,
  StatusBar as RNStatusBar,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  useColorScheme,
} from "react-native";
import * as NavigationBar from "expo-navigation-bar";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import Constants from "expo-constants";

export default function App() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [suggestionError, setSuggestionError] = useState(null);
  const mapRef = useRef(null);
  const mapsApiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    Constants.expoConfig?.extra?.googleMapsApiKey ||
    Constants.manifest?.extra?.googleMapsApiKey ||
    "";
  // Expo's BlurView uses hardware bitmaps that crash software-rendered Android surfaces, so keep it iOS-only.
  const blurSupported = Platform.OS === "ios";
  const topOffset =
    Platform.OS === "android" ? (RNStatusBar.currentHeight ?? 0) + 72 : 96;

  useEffect(() => {
    if (!mapsApiKey) {
      setSuggestionError(
        "Google Places API key missing. Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY."
      );
      setSuggestions([]);
      setIsFetchingSuggestions(false);
      return;
    }

    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsFetchingSuggestions(false);
      setSuggestionError(null);
      return;
    }

    const controller = new AbortController();
    let isActive = true;
    setIsFetchingSuggestions(true);

    const debounceId = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          input: trimmed,
          key: mapsApiKey,
          language: "en",
        });

        const response = await fetch(
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
          { signal: controller.signal }
        );
        const data = await response.json();

        if (!isActive) return;

        if (data.status === "OK" && Array.isArray(data.predictions)) {
          setSuggestions(data.predictions);
          setSuggestionError(null);
        } else {
          setSuggestions([]);
          setSuggestionError(
            data.error_message || `Places API error: ${data.status}`
          );
        }
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.warn("Autocomplete error", error);
        }
        if (isActive) {
          setSuggestionError("Unable to reach Google Places service.");
        }
      } finally {
        if (isActive) {
          setIsFetchingSuggestions(false);
        }
      }
    }, 350);

    return () => {
      isActive = false;
      clearTimeout(debounceId);
      controller.abort();
    };
  }, [mapsApiKey, searchQuery]);

  const handleSuggestionPress = async (suggestion) => {
    if (!mapsApiKey) return;

    setSearchQuery(suggestion.description);
    setSuggestions([]);

    try {
      const params = new URLSearchParams({
        place_id: suggestion.place_id,
        key: mapsApiKey,
        fields: "geometry",
      });
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`
      );
      const data = await response.json();
      const location = data.result?.geometry?.location;

      if (location && mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude: location.lat,
            longitude: location.lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          750
        );
      }
    } catch (error) {
      console.warn("Place details error", error);
    }
  };

  const handleSubmitEditing = () => {
    if (suggestions.length > 0) {
      handleSuggestionPress(suggestions[0]);
    }
  };

  useEffect(() => {
    const applyNavigationBarTheme = async () => {
      const available = await NavigationBar.isAvailableAsync();
      if (!available) return;

      const behavior = await NavigationBar.getBehaviorAsync().catch(() => null);
      if (behavior === "inset-swipe" || behavior === "overlay-swipe") {
        return; // edge-to-edge gesture nav, OS ignores background changes
      }

      await NavigationBar.setBackgroundColorAsync(
        isDark ? "#1b1b1b" : "#f1f1f1"
      ).catch(() => {});
      await NavigationBar.setButtonStyleAsync(isDark ? "light" : "dark").catch(
        () => {}
      );
    };

    applyNavigationBarTheme();
  }, [colorScheme, isDark]);

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        ref={mapRef}
        initialRegion={{
          latitude: 13.0827,
          longitude: 80.2707,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      />
      <View
        pointerEvents="none"
        style={[
          styles.mapDimmer,
          {
            backgroundColor: isDark
              ? "rgba(2, 6, 23, 0.65)"
              : "rgba(241, 245, 249, 0.60)",
          },
        ]}
      />
      <View
        style={[styles.overlayWrapper, { paddingTop: topOffset }]}
        pointerEvents="box-none"
      >
        {blurSupported ? (
          <BlurView
            intensity={85}
            tint={isDark ? "dark" : "light"}
            style={styles.overlayCard}
          >
            {renderOverlayContent({
              isDark,
              searchQuery,
              setSearchQuery,
              suggestions,
              onSuggestionPress: handleSuggestionPress,
              onSubmitEditing: handleSubmitEditing,
              isFetchingSuggestions,
              suggestionError,
            })}
          </BlurView>
        ) : (
          <View
            style={[
              styles.overlayCard,
              styles.overlayFallback,
              isDark && styles.overlayFallbackDark,
            ]}
          >
            {renderOverlayContent({
              isDark,
              searchQuery,
              setSearchQuery,
              suggestions,
              onSuggestionPress: handleSuggestionPress,
              onSubmitEditing: handleSubmitEditing,
              isFetchingSuggestions,
              suggestionError,
            })}
          </View>
        )}
      </View>
      <ExpoStatusBar style={isDark ? "light" : "dark"} />
    </View>
  );
}

function renderOverlayContent({
  isDark,
  searchQuery,
  setSearchQuery,
  suggestions,
  onSuggestionPress,
  onSubmitEditing,
  isFetchingSuggestions,
  suggestionError,
}) {
  const hasSuggestions = suggestions.length > 0;
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
            {
              backgroundColor: isDark
                ? "rgba(15,23,42,0.85)"
                : "rgba(255,255,255,0.95)",
            },
            hasSuggestions && styles.searchRowAttached,
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
            onChangeText={setSearchQuery}
            placeholder="Search for places..."
            placeholderTextColor={isDark ? "#94a3b8" : "#94a3b8"}
            returnKeyType="search"
            onSubmitEditing={onSubmitEditing}
          />
          <TouchableOpacity
            style={[
              styles.filterButton,
              {
                backgroundColor: isDark ? "#f8fafc" : "#f8fafc",
                opacity: suggestions.length ? 1 : 0.65,
              },
            ]}
            onPress={onSubmitEditing}
            disabled={!suggestions.length}
          >
            {isFetchingSuggestions ? (
              <ActivityIndicator size="small" color="#0f766e" />
            ) : (
              <Ionicons
                name="options-outline"
                size={18}
                color={isDark ? "#0f766e" : "#0f766e"}
              />
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
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  overlayWrapper: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 16,
  },
  mapDimmer: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayCard: {
    width: "100%",
    maxWidth: 390,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
  },
  overlayFallback: {
    backgroundColor: "rgba(230, 230, 230, 0.9)",
  },
  overlayFallbackDark: {
    backgroundColor: "rgba(15, 23, 42, 0.9)",
  },
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
  brandLabel: {
    backgroundColor: "#fff",
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    paddingHorizontal: 12,
    paddingLeft: 4,
    paddingVertical: 6,
  },
  brandBadgeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 20,
  },

  brandText: {
    fontSize: 22,
    fontWeight: "700",
    paddingHorizontal: 0,
    paddingVertical: 0,
    textAlign: "center",
    minWidth: 140,
  },
  searchSection: {
    width: "100%",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 0,
  },
  searchRowAttached: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#0f172a",
    paddingVertical: 4,
  },
  filterButton: {
    backgroundColor: "#d9f99d",
    borderRadius: 8,
    padding: 6,
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
