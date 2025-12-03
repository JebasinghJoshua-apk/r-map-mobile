import { useCallback, useEffect, useRef, useState } from "react";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import * as NavigationBar from "expo-navigation-bar";
import Constants from "expo-constants";
import { BlurView } from "expo-blur";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";

import AuthModal from "./components/AuthModal";
import CompactSearchBar from "./components/CompactSearchBar";
import ProfileMenu from "./components/ProfileMenu";
import SearchOverlay from "./components/SearchOverlay";
import PropertyPriceBadges from "./components/PropertyPriceBadges";
import useAuthUiState from "./hooks/useAuthUiState";
import useSearchUiState from "./hooks/useSearchUiState";
import useMapOverlays from "./hooks/useMapOverlays";
import { useViewportProperties } from "./hooks/useViewportProperties";
import { usePlacesAutocomplete } from "./hooks/usePlacesAutocomplete";
import { computePolygonCentroid } from "./utils/mapGeometry";
import {
  clampLatitude,
  clampLongitude,
  computeApproximateZoom,
} from "./utils/mapRegion";

const INITIAL_REGION = {
  latitude: 13.0827,
  longitude: 80.2707,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const HYBRID_ZOOM_THRESHOLD = 16.5;
const PLOT_LABEL_ZOOM_THRESHOLD = 17.2;
const AMENITY_POLYGON_ZOOM_THRESHOLD = 15;
const AMENITY_LABEL_ZOOM_THRESHOLD = 16.4;
const ROAD_LABEL_ZOOM_THRESHOLD = 15.4;
const POLYGON_FOCUS_MIN_ZOOM = 14;
const POLYGON_FOCUS_MAX_ZOOM = 19;
const POLYGON_FOCUS_TARGET_ZOOM = 18;
const PROPERTY_BADGE_FALLBACK_LABEL = "Property";

const getPropertyBadgeLabel = (property) =>
  property?.priceDisplay ??
  property?.displayPrice ??
  property?.displayLabel ??
  property?.name ??
  PROPERTY_BADGE_FALLBACK_LABEL;

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
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road.arterial",
    elementType: "labels.text.fill",
    stylers: [{ color: "#757575" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#dadada" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }],
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#c9e6ff" }],
  },
];

const computeRegionForZoom = (center, zoomLevel) => {
  if (!center || typeof zoomLevel !== "number") {
    return null;
  }
  const latDelta = Math.max(360 / 2 ** zoomLevel, 0.0005);
  const { width, height } = Dimensions.get("window");
  const aspectRatio = height > 0 ? width / height : 1;
  const lngDelta = Math.max(latDelta * aspectRatio, 0.0005);
  return {
    latitude: clampLatitude(center.latitude),
    longitude: clampLongitude(center.longitude),
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
};

export default function App() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [mapType, setMapType] = useState("standard");
  const [currentZoom, setCurrentZoom] = useState(null);
  const [showPolygons, setShowPolygons] = useState(false);
  const [markerViewsFrozen, setMarkerViewsFrozen] = useState(false);
  const [propertyBadges, setPropertyBadges] = useState([]);
  const showPlotLabels =
    typeof currentZoom === "number" && currentZoom >= PLOT_LABEL_ZOOM_THRESHOLD;
  const showAmenityPolygons =
    typeof currentZoom === "number" &&
    currentZoom >= AMENITY_POLYGON_ZOOM_THRESHOLD;
  const showAmenityLabels =
    typeof currentZoom === "number" &&
    currentZoom >= AMENITY_LABEL_ZOOM_THRESHOLD;
  const showRoadLabels =
    typeof currentZoom === "number" && currentZoom >= ROAD_LABEL_ZOOM_THRESHOLD;
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
    handleProfilePress,
    handleAuthSubmit,
    handleLogout,
    closeAuthModal,
    profileMenuVisible,
    setProfileMenuVisible,
    authModalVisible,
  } = useAuthUiState({ baseUrl: mobileBffUrl });
  const dismissProfileMenu = useCallback(() => {
    setProfileMenuVisible(false);
  }, [setProfileMenuVisible]);
  const {
    searchQuery,
    setSearchQuery,
    overlayVisible,
    showOverlay: showSearchOverlay,
    hideOverlay: hideSearchOverlay,
    recentSearches,
    persistRecentSearch,
    handleCompactClear,
    handleClearRecent,
  } = useSearchUiState({
    onOverlayShown: dismissProfileMenu,
  });
  const mapRef = useRef(null);
  const badgeAnimationFrameRef = useRef(null);
  const markerFreezeTimeoutRef = useRef(null);
  const thawMarkersTemporarily = useCallback(() => {
    if (markerFreezeTimeoutRef.current) {
      clearTimeout(markerFreezeTimeoutRef.current);
    }
    setMarkerViewsFrozen(false);
    markerFreezeTimeoutRef.current = setTimeout(() => {
      setMarkerViewsFrozen(true);
      markerFreezeTimeoutRef.current = null;
    }, 400);
  }, []);

  const freezeMarkersImmediately = useCallback(() => {
    if (markerFreezeTimeoutRef.current) {
      clearTimeout(markerFreezeTimeoutRef.current);
      markerFreezeTimeoutRef.current = null;
    }
    setMarkerViewsFrozen(true);
  }, []);

  useEffect(
    () => () => {
      if (markerFreezeTimeoutRef.current) {
        clearTimeout(markerFreezeTimeoutRef.current);
      }
    },
    []
  );
  const {
    properties: viewportProperties,
    plots: viewportPlots,
    roads: viewportRoads,
    amenities: viewportAmenities,
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
      hideSearchOverlay();
    } catch (error) {
      console.warn("Place details error", error);
    }
  };

  const handleRecentSelect = (recentEntry) => {
    handleSuggestionPress(recentEntry);
  };

  const handleSubmitEditing = () => {
    if (suggestions.length > 0) {
      handleSuggestionPress(suggestions[0]);
    }
  };

  const handleMenuSelection = () => {
    dismissProfileMenu();
  };

  const updatePropertyBadges = useCallback(async () => {
    if (!mapRef.current) {
      setPropertyBadges([]);
      return;
    }
    if (!viewportProperties.length) {
      setPropertyBadges([]);
      return;
    }
    try {
      const projections = await Promise.all(
        viewportProperties.map(async (property) => {
          if (!property?.coordinate) {
            return null;
          }
          try {
            const point = await mapRef.current.pointForCoordinate(
              property.coordinate
            );
            if (!point) {
              return null;
            }
            return {
              id: property.id,
              x: point.x,
              y: point.y,
              label: getPropertyBadgeLabel(property),
            };
          } catch (projectionError) {
            return null;
          }
        })
      );
      setPropertyBadges(projections.filter(Boolean));
    } catch (error) {
      console.warn("Failed to project price badges", error);
    }
  }, [viewportProperties]);

  const scheduleBadgeUpdate = useCallback(() => {
    if (badgeAnimationFrameRef.current) {
      return;
    }
    badgeAnimationFrameRef.current = requestAnimationFrame(() => {
      badgeAnimationFrameRef.current = null;
      updatePropertyBadges();
    });
  }, [updatePropertyBadges]);

  const handlePropertyPolygonPress = useCallback(
    (polygonPaths) => {
      const zoom = currentZoom ?? 0;
      const normalizedZoom = Math.round(zoom * 10) / 10;
      if (
        normalizedZoom < POLYGON_FOCUS_MIN_ZOOM ||
        normalizedZoom > POLYGON_FOCUS_MAX_ZOOM ||
        !mapRef.current
      ) {
        return;
      }
      const center = computePolygonCentroid(polygonPaths);
      const region = center
        ? computeRegionForZoom(center, POLYGON_FOCUS_TARGET_ZOOM)
        : null;
      if (!region) {
        return;
      }
      mapRef.current.animateToRegion(region, 600);
    },
    [currentZoom]
  );

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
      dismissProfileMenu();
    }
  }, [dismissProfileMenu, overlayVisible]);

  useEffect(() => {
    updatePropertyBadges();
  }, [updatePropertyBadges]);

  useEffect(
    () => () => {
      if (badgeAnimationFrameRef.current) {
        cancelAnimationFrame(badgeAnimationFrameRef.current);
        badgeAnimationFrameRef.current = null;
      }
    },
    []
  );

  const updateMapTypeForRegion = useCallback(
    (region) => {
      if (!region) return;
      const zoomLevel = computeApproximateZoom(region);
      setCurrentZoom(zoomLevel);
      const nextShowPolygons = zoomLevel > 16;
      setShowPolygons(nextShowPolygons);
      if (nextShowPolygons) {
        freezeMarkersImmediately();
      } else {
        thawMarkersTemporarily();
      }
      setMapType((prev) => {
        const next = zoomLevel >= HYBRID_ZOOM_THRESHOLD ? "hybrid" : "standard";
        return prev === next ? prev : next;
      });
    },
    [freezeMarkersImmediately, thawMarkersTemporarily]
  );

  const handleRegionChange = useCallback(() => {
    scheduleBadgeUpdate();
  }, [scheduleBadgeUpdate]);

  const handleRegionChangeComplete = useCallback(
    (region) => {
      updateMapTypeForRegion(region);
      requestViewport(region);
      updatePropertyBadges();
    },
    [requestViewport, updateMapTypeForRegion, updatePropertyBadges]
  );

  useEffect(() => {
    updateMapTypeForRegion(INITIAL_REGION);
    requestViewport(INITIAL_REGION, { immediate: true });
  }, [requestViewport, updateMapTypeForRegion]);

  useEffect(() => {
    if (showPolygons) {
      return;
    }
    thawMarkersTemporarily();
  }, [showPolygons, viewportProperties, thawMarkersTemporarily]);

  useEffect(() => {
    if (!showPlotLabels) {
      return;
    }
    thawMarkersTemporarily();
  }, [showPlotLabels, viewportPlots, thawMarkersTemporarily]);

  const {
    propertyPolygons,
    plotPolygons,
    plotLabelMarkers,
    roadPolylines,
    roadLabelMarkers,
    amenityPolygons,
    amenityLabelMarkers,
  } = useMapOverlays({
    currentZoom,
    showPolygons,
    showPlotLabels,
    showAmenityPolygons,
    showAmenityLabels,
    showRoadLabels,
    viewportProperties,
    viewportPlots,
    viewportRoads,
    viewportAmenities,
    markerViewsFrozen,
    onPropertyPolygonPress: handlePropertyPolygonPress,
  });

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
        onRegionChange={handleRegionChange}
        onMapReady={updatePropertyBadges}
        mapType={mapType}
        customMapStyle={mapType === "standard" ? LIGHT_MAP_STYLE : undefined}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        {plotPolygons}
        {amenityPolygons}
        {plotLabelMarkers}
        {amenityLabelMarkers}
        {propertyPolygons}
        {roadPolylines}
        {roadLabelMarkers}
      </MapView>
      <PropertyPriceBadges badges={propertyBadges} />
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
        onDismiss={dismissProfileMenu}
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
          <Text style={styles.zoomBadgeText}>
            Zoom {currentZoom.toFixed(1)}x
          </Text>
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
