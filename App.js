import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  Platform,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import * as NavigationBar from "expo-navigation-bar";
import { BlurView } from "expo-blur";
import MapView, {
  Marker,
  Polygon,
  Polyline,
  PROVIDER_GOOGLE,
} from "react-native-maps";
import Constants from "expo-constants";
import SearchOverlay from "./components/SearchOverlay";
import CompactSearchBar from "./components/CompactSearchBar";
import ProfileMenu from "./components/ProfileMenu";
import AuthModal from "./components/AuthModal";
import { usePlacesAutocomplete } from "./hooks/usePlacesAutocomplete";
import { useAuthState } from "./hooks/useAuthState";
import { useViewportProperties } from "./hooks/useViewportProperties";
import { computeApproximateZoom } from "./utils/mapRegion";

const INITIAL_REGION = {
  latitude: 13.0827,
  longitude: 80.2707,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};
const HYBRID_ZOOM_THRESHOLD = 15.5;
const LIGHT_MAP_STYLE = [
  {
    elementType: "geometry",
    stylers: [{ color: "#f5f5f5" }],
  },
  {
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#f5f5f5" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#eeeeee" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#c9e5ff" }],
  },
];

export default function App() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [searchQuery, setSearchQuery] = useState("");
  const [mapType, setMapType] = useState("standard");
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [recentSearches, setRecentSearches] = useState([]);
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(null);
  const mobileBffUrl =
    process.env.EXPO_PUBLIC_MOBILE_BFF_URL ||
    Constants.expoConfig?.extra?.mobileBffUrl ||
    Constants.manifest?.extra?.mobileBffUrl ||
    "http://localhost:5150";
  const {
    userProfile,
    authToken,
    loginPhone,
    loginPassword,
    loginLoading,
    loginError,
    setLoginPhone,
    setLoginPassword,
    login,
    logout,
    clearAuthError,
  } = useAuthState({ baseUrl: mobileBffUrl });
  const mapRef = useRef(null);
  const {
    properties: viewportProperties,
    plots: viewportPlots,
    roads: viewportRoads,
    loading: viewportLoading,
    error: viewportError,
    requestViewport,
  } = useViewportProperties({ baseUrl: mobileBffUrl, authToken });
  const mapsApiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    Constants.expoConfig?.extra?.googleMapsApiKey ||
    Constants.manifest?.extra?.googleMapsApiKey ||
    "";
  const {
    suggestions,
    isFetching: isFetchingSuggestions,
    error: suggestionError,
    clearSuggestions,
  } = usePlacesAutocomplete(searchQuery, mapsApiKey);
  // Expo's BlurView uses hardware bitmaps that crash software-rendered Android surfaces, so keep it iOS-only.
  const blurSupported = Platform.OS === "ios";
  const topOffset =
    Platform.OS === "android" ? (RNStatusBar.currentHeight ?? 0) + 72 : 96;
  const compactTopOffset =
    Platform.OS === "android" ? (RNStatusBar.currentHeight ?? 0) + 18 : 36;

  const persistRecentSearch = (suggestion) => {
    if (!suggestion?.place_id) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter(
        (item) => item.place_id !== suggestion.place_id
      );
      return [
        {
          place_id: suggestion.place_id,
          description: suggestion.description,
          structured_formatting: suggestion.structured_formatting,
        },
        ...filtered,
      ].slice(0, 5);
    });
  };

  const handleSuggestionPress = async (suggestion) => {
    if (!mapsApiKey) return;

    setSearchQuery(suggestion.description);
    clearSuggestions();

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
      persistRecentSearch(suggestion);
      setOverlayVisible(false);
    } catch (error) {
      console.warn("Place details error", error);
    }
  };

  const handleRecentSelect = (recentEntry) => {
    handleSuggestionPress(recentEntry);
  };

  const handleClearRecent = () => setRecentSearches([]);

  const handleSubmitEditing = () => {
    if (suggestions.length > 0) {
      handleSuggestionPress(suggestions[0]);
    }
  };

  const showSearchOverlay = () => {
    setOverlayVisible(true);
    setProfileMenuVisible(false);
  };

  const handleCompactClear = () => {
    setSearchQuery("");
    showSearchOverlay();
  };

  const handleProfilePress = () => {
    if (userProfile) {
      setProfileMenuVisible((prev) => !prev);
    } else {
      clearAuthError();
      setAuthModalVisible(true);
    }
  };

  const handleAuthSubmit = async () => {
    const success = await login();
    if (success) {
      setAuthModalVisible(false);
      setProfileMenuVisible(true);
    }
  };

  const handleLogout = () => {
    logout();
    setProfileMenuVisible(false);
  };

  const closeAuthModal = () => {
    setAuthModalVisible(false);
    setLoginPassword("");
    clearAuthError();
  };

  const handleMenuSelection = (action) => {
    setProfileMenuVisible(false);
    console.log(`Selected action: ${action}`);
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

  useEffect(() => {
    if (overlayVisible) {
      setProfileMenuVisible(false);
    }
  }, [overlayVisible]);

  const updateMapTypeForRegion = useCallback((region) => {
    if (!region) return;
    const zoomLevel = computeApproximateZoom(region);
    setCurrentZoom(zoomLevel);
    setMapType((prev) => {
      const next = zoomLevel >= HYBRID_ZOOM_THRESHOLD ? "hybrid" : "standard";
      return prev === next ? prev : next;
    });
  }, []);

  const handleRegionChangeComplete = useCallback(
    (region) => {
      updateMapTypeForRegion(region);
      requestViewport(region);
    },
    [requestViewport, updateMapTypeForRegion]
  );

  useEffect(() => {
    updateMapTypeForRegion(INITIAL_REGION);
    requestViewport(INITIAL_REGION, { immediate: true });
  }, [requestViewport, updateMapTypeForRegion]);

  const propertyMarkers = useMemo(
    () =>
      viewportProperties.map((property) => (
        <Marker
          key={`${property.id}-marker`}
          coordinate={property.coordinate}
          tracksViewChanges={false}
          title={property.name}
          description={property.propertyType}
        >
          <View
            style={[
              styles.propertyMarker,
              property.isOwned && styles.propertyMarkerOwned,
            ]}
          >
            <Text style={styles.propertyMarkerLabel}>
              {property.propertyType?.[0]?.toUpperCase() || "P"}
            </Text>
          </View>
        </Marker>
      )),
    [viewportProperties]
  );

  const propertyPolygons = useMemo(() => {
    const items = [];
    viewportProperties.forEach((property) => {
      if (!property.polygonPaths?.length) {
        return;
      }
      property.polygonPaths.forEach((path, index) => {
        items.push(
          <Polygon
            key={`${property.id}-polygon-${index}`}
            coordinates={path}
            strokeColor={property.isOwned ? "#2563eb" : "#0f766e"}
            fillColor={property.isOwned ? "rgba(37,99,235,0.25)" : "rgba(15,118,110,0.25)"}
            strokeWidth={2}
          />
        );
      });
    });
    return items;
  }, [viewportProperties]);

  const plotPolygons = useMemo(() => {
    const items = [];
    viewportPlots.forEach((plot) => {
      plot.polygonPaths?.forEach((path, index) => {
        items.push(
          <Polygon
            key={`${plot.id}-plot-${index}`}
            coordinates={path}
            strokeColor="#f97316"
            fillColor="rgba(249,115,22,0.25)"
            strokeWidth={2}
          />
        );
      });
    });
    return items;
  }, [viewportPlots]);

  const roadPolylines = useMemo(() => {
    const items = [];
    viewportRoads.forEach((road) => {
      road.paths?.forEach((path, index) => {
        items.push(
          <Polyline
            key={`${road.id}-road-${index}`}
            coordinates={path}
            strokeColor="#facc15"
            strokeWidth={4}
          />
        );
      });
    });
    return items;
  }, [viewportRoads]);

  const renderMapStatus = () => {
    if (viewportLoading) {
      return (
        <View style={[styles.mapStatusPill, styles.mapStatusLoading]}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.mapStatusText}>Updating map…</Text>
        </View>
      );
    }
    if (viewportError) {
      return (
        <View style={[styles.mapStatusPill, styles.mapStatusError]}>
          <Text style={styles.mapStatusText} numberOfLines={2}>
            {viewportError}
          </Text>
        </View>
      );
    }
    if (viewportProperties.length > 0) {
      return (
        <View style={[styles.mapStatusPill, styles.mapStatusInfo]}>
          <Text style={styles.mapStatusText}>
            {viewportProperties.length} properties in view
          </Text>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        ref={mapRef}
        initialRegion={INITIAL_REGION}
        onRegionChangeComplete={handleRegionChangeComplete}
        mapType={mapType}
        customMapStyle={mapType === "standard" ? LIGHT_MAP_STYLE : undefined}
      >
        {plotPolygons}
        {propertyPolygons}
        {roadPolylines}
        {propertyMarkers}
      </MapView>
      {overlayVisible && (
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
      )}
      {overlayVisible && (
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
              <SearchOverlay
                isDark={isDark}
                searchQuery={searchQuery}
                onChangeQuery={setSearchQuery}
                onClearQuery={() => setSearchQuery("")}
                suggestions={suggestions}
                onSuggestionPress={handleSuggestionPress}
                onSubmitEditing={handleSubmitEditing}
                isFetchingSuggestions={isFetchingSuggestions}
                suggestionError={suggestionError}
                recentSearches={recentSearches}
                onRecentSelect={handleRecentSelect}
                onClearRecent={handleClearRecent}
              />
            </BlurView>
          ) : (
            <View
              style={[
                styles.overlayCard,
                styles.overlayFallback,
                isDark && styles.overlayFallbackDark,
              ]}
            >
              <SearchOverlay
                isDark={isDark}
                searchQuery={searchQuery}
                onChangeQuery={setSearchQuery}
                onClearQuery={() => setSearchQuery("")}
                suggestions={suggestions}
                onSuggestionPress={handleSuggestionPress}
                onSubmitEditing={handleSubmitEditing}
                isFetchingSuggestions={isFetchingSuggestions}
                suggestionError={suggestionError}
                recentSearches={recentSearches}
                onRecentSelect={handleRecentSelect}
                onClearRecent={handleClearRecent}
              />
            </View>
          )}
        </View>
      )}
      {!overlayVisible && (
        <CompactSearchBar
          isDark={isDark}
          searchQuery={searchQuery}
          topOffset={compactTopOffset}
          onShowOverlay={showSearchOverlay}
          onClearSearch={handleCompactClear}
          userProfile={userProfile}
          onProfilePress={handleProfilePress}
        />
      )}
      <ProfileMenu
        isDark={isDark}
        visible={profileMenuVisible && !!userProfile}
        topOffset={compactTopOffset + 60}
        userProfile={userProfile}
        onDismiss={() => setProfileMenuVisible(false)}
        onLogout={handleLogout}
        onNavigateProperties={() => handleMenuSelection("properties")}
      />
      <AuthModal
        isDark={isDark}
        visible={authModalVisible}
        phone={loginPhone}
        password={loginPassword}
        onChangePhone={setLoginPhone}
        onChangePassword={setLoginPassword}
        onClose={closeAuthModal}
        onSubmit={handleAuthSubmit}
        loading={loginLoading}
        errorMessage={loginError}
        endpoint={`${mobileBffUrl.replace(/\/$/, "")}/mobile/auth/login`}
      />
      <View
        pointerEvents="none"
        style={[styles.mapStatusContainer, { top: compactTopOffset + 8 }]}
      >
        {renderMapStatus()}
      </View>
      {currentZoom && (
        <View style={styles.zoomBadgeContainer} pointerEvents="none">
          <Text style={styles.zoomBadgeText}>Zoom {currentZoom.toFixed(1)}x</Text>
        </View>
      )}
      <ExpoStatusBar style={isDark ? "light" : "dark"} />
    </View>
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
  propertyMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#0f766e",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  propertyMarkerOwned: {
    backgroundColor: "#2563eb",
  },
  propertyMarkerLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  mapStatusContainer: {
    position: "absolute",
    alignSelf: "center",
  },
  mapStatusPill: {
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
  mapStatusLoading: {
    backgroundColor: "rgba(15, 118, 110, 0.95)",
  },
  mapStatusError: {
    backgroundColor: "rgba(239, 68, 68, 0.95)",
  },
  mapStatusInfo: {
    backgroundColor: "rgba(15, 23, 42, 0.9)",
  },
  mapStatusText: {
    color: "#fff",
    fontWeight: "600",
  },
  zoomBadgeContainer: {
    position: "absolute",
    bottom: 24,
    right: 20,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 8,
    elevation: 4,
  },
  zoomBadgeText: {
    color: "#fff",
    fontWeight: "600",
  },
});
