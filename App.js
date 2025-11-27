import { useEffect, useState } from "react";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import {
  Platform,
  StatusBar as RNStatusBar,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
import * as NavigationBar from "expo-navigation-bar";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";

export default function App() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [searchQuery, setSearchQuery] = useState("");
  // Expo's BlurView uses hardware bitmaps that crash software-rendered Android surfaces, so keep it iOS-only.
  const blurSupported = Platform.OS === "ios";
  const topOffset =
    Platform.OS === "android" ? (RNStatusBar.currentHeight ?? 0) + 72 : 96;

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
            {renderOverlayContent({ isDark, searchQuery, setSearchQuery })}
          </BlurView>
        ) : (
          <View
            style={[
              styles.overlayCard,
              styles.overlayFallback,
              isDark && styles.overlayFallbackDark,
            ]}
          >
            {renderOverlayContent({ isDark, searchQuery, setSearchQuery })}
          </View>
        )}
      </View>
      <ExpoStatusBar style={isDark ? "light" : "dark"} />
    </View>
  );
}

function renderOverlayContent({ isDark, searchQuery, setSearchQuery }) {
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
      <View
        style={[
          styles.searchRow,
          {
            backgroundColor: isDark
              ? "rgba(15,23,42,0.85)"
              : "rgba(255,255,255,0.95)",
          },
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
        />
        <TouchableOpacity
          style={[
            styles.filterButton,
            { backgroundColor: isDark ? "#f8fafc" : "#f8fafc" },
          ]}
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={isDark ? "#0f766e" : "#0f766e"}
          />
        </TouchableOpacity>
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
  },
  mapDimmer: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayCard: {
    width: "90%",
    maxWidth: 390,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 8,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
  },
  overlayFallback: {
    backgroundColor: "rgba(248, 250, 252, 0.92)",
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
  },
  brandBadge: {
    paddingVertical: 8,
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
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
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
});
