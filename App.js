import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  clampLatitude,
  clampLongitude,
  computeApproximateZoom,
} from "./utils/mapRegion";
import { DRAWING_STYLES } from "./constants/drawingStyles";

const INITIAL_REGION = {
  latitude: 13.0827,
  longitude: 80.2707,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};
const HYBRID_ZOOM_THRESHOLD = 15.5;
const PLOT_LABEL_ZOOM_THRESHOLD = 17;
const LAYOUT_POLYGON_ZOOM_THRESHOLD = 10.9;
const POLYGON_FOCUS_MIN_ZOOM = 11;
const POLYGON_FOCUS_MAX_ZOOM = 15;
const POLYGON_FOCUS_TARGET_ZOOM = 16.5;
const AMENITY_POLYGON_ZOOM_THRESHOLD = 16;
const AMENITY_LABEL_ZOOM_THRESHOLD = 16;
const ROAD_LABEL_ZOOM_THRESHOLD = 16;
const AMENITY_LABEL_MIN_PX = 12;
const AMENITY_LABEL_MAX_PX = 30;
const AMENITY_LABEL_MAX_AREA_SQM = 15000;
const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_M = 6378137;
const PLOT_LABEL_EAST_OFFSET_METERS = 2; // nudges label markers ~1m to the right
const ROAD_PATH_CLOSED_EPSILON = 0.00002;
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

const hexToRgba = (hex, alpha = 1) => {
  if (typeof hex !== "string") return hex;
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return hex;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some((value) => Number.isNaN(value))) {
    return hex;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const buildPolygonStyleProps = (style) => ({
  strokeColor: hexToRgba(style.strokeColor, style.strokeOpacity ?? 1),
  fillColor: hexToRgba(style.fillColor, style.fillOpacity ?? 1),
  strokeWidth: style.strokeWeight,
});

const BOUNDARY_STYLE = buildPolygonStyleProps(DRAWING_STYLES.boundary);
const PLOT_STYLE = buildPolygonStyleProps(DRAWING_STYLES.plot);
const ROAD_STYLE = buildPolygonStyleProps(DRAWING_STYLES.road);
const AMENITY_STYLE = buildPolygonStyleProps(DRAWING_STYLES.amenity);

const computePolygonCentroid = (paths) => {
  if (!Array.isArray(paths) || paths.length === 0) {
    return null;
  }

  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLng = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let hasPoints = false;

  paths.forEach((path) => {
    if (!Array.isArray(path)) {
      return;
    }
    path.forEach((point) => {
      const lat = Number(point?.latitude);
      const lng = Number(point?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }
      hasPoints = true;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    });
  });

  if (!hasPoints) {
    return null;
  }

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
  };
};

const computePolygonApproxAreaSqM = (paths) => {
  if (!Array.isArray(paths) || !paths.length) {
    return null;
  }
  let area = 0;
  let hasRing = false;
  paths.forEach((ring) => {
    if (!Array.isArray(ring) || ring.length < 3) {
      return;
    }
    const refLatRad = Number(ring[0]?.latitude ?? 0) * DEG_TO_RAD;
    for (let i = 0; i < ring.length; i += 1) {
      const current = ring[i];
      const next = ring[(i + 1) % ring.length];
      const lat1 = Number(current?.latitude);
      const lng1 = Number(current?.longitude);
      const lat2 = Number(next?.latitude);
      const lng2 = Number(next?.longitude);
      if (
        !Number.isFinite(lat1) ||
        !Number.isFinite(lng1) ||
        !Number.isFinite(lat2) ||
        !Number.isFinite(lng2)
      ) {
        continue;
      }
      hasRing = true;
      const x1 = lng1 * DEG_TO_RAD * Math.cos(refLatRad) * EARTH_RADIUS_M;
      const y1 = lat1 * DEG_TO_RAD * EARTH_RADIUS_M;
      const x2 = lng2 * DEG_TO_RAD * Math.cos(refLatRad) * EARTH_RADIUS_M;
      const y2 = lat2 * DEG_TO_RAD * EARTH_RADIUS_M;
      area += x1 * y2 - x2 * y1;
    }
  });
  return hasRing ? Math.abs(area) * 0.5 : null;
};

const computeAmenityLabelFontSize = (paths) => {
  const area = computePolygonApproxAreaSqM(paths);
  if (!Number.isFinite(area) || area <= 0) {
    return AMENITY_LABEL_MIN_PX;
  }
  const normalized = Math.min(area / AMENITY_LABEL_MAX_AREA_SQM, 1);
  const eased = Math.sqrt(normalized);
  const size =
    AMENITY_LABEL_MIN_PX +
    (AMENITY_LABEL_MAX_PX - AMENITY_LABEL_MIN_PX) * eased;
  return Math.round(size);
};

const computePolylineCentroid = (paths) => {
  if (!Array.isArray(paths) || !paths.length) {
    return null;
  }
  let latSum = 0;
  let lngSum = 0;
  let count = 0;
  paths.forEach((path) => {
    if (!Array.isArray(path)) {
      return;
    }
    path.forEach((point) => {
      const lat = Number(point?.latitude);
      const lng = Number(point?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }
      latSum += lat;
      lngSum += lng;
      count += 1;
    });
  });
  if (!count) {
    return null;
  }
  return {
    latitude: latSum / count,
    longitude: lngSum / count,
  };
};

const computeRoadLabelPlacement = (paths) => {
  if (!Array.isArray(paths) || !paths.length) {
    return null;
  }
  let bestSegment = null;
  paths.forEach((path) => {
    if (!Array.isArray(path)) {
      return;
    }
    for (let i = 0; i < path.length - 1; i += 1) {
      const start = path[i];
      const end = path[i + 1];
      const startLat = Number(start?.latitude);
      const startLng = Number(start?.longitude);
      const endLat = Number(end?.latitude);
      const endLng = Number(end?.longitude);
      if (
        !Number.isFinite(startLat) ||
        !Number.isFinite(startLng) ||
        !Number.isFinite(endLat) ||
        !Number.isFinite(endLng)
      ) {
        continue;
      }
      const avgLatRad = ((startLat + endLat) / 2) * DEG_TO_RAD;
      const dx = (endLng - startLng) * Math.cos(avgLatRad);
      const dy = endLat - startLat;
      const score = Math.hypot(dx, dy);
      if (!bestSegment || score > bestSegment.score) {
        bestSegment = {
          startLat,
          startLng,
          endLat,
          endLng,
          score,
        };
      }
    }
  });

  if (!bestSegment) {
    const fallback = computePolylineCentroid(paths);
    if (!fallback) {
      return null;
    }
    return { coordinate: fallback, angleDeg: 0 };
  }

  const centroid = computePolylineCentroid(paths) || {
    latitude: (bestSegment.startLat + bestSegment.endLat) / 2,
    longitude: (bestSegment.startLng + bestSegment.endLng) / 2,
  };
  const avgLatRad =
    ((bestSegment.startLat + bestSegment.endLat) / 2) * DEG_TO_RAD;
  let angleDeg =
    (Math.atan2(
      bestSegment.endLat - bestSegment.startLat,
      (bestSegment.endLng - bestSegment.startLng) * Math.cos(avgLatRad)
    ) *
      180) /
    Math.PI;
  if (angleDeg > 90) {
    angleDeg -= 180;
  }
  if (angleDeg < -90) {
    angleDeg += 180;
  }

  return {
    coordinate: centroid,
    angleDeg,
  };
};

const isClosedPath = (path) => {
  if (!Array.isArray(path) || path.length < 3) {
    return false;
  }
  const first = path[0];
  const last = path[path.length - 1];
  const firstLat = Number(first?.latitude);
  const firstLng = Number(first?.longitude);
  const lastLat = Number(last?.latitude);
  const lastLng = Number(last?.longitude);
  if (
    !Number.isFinite(firstLat) ||
    !Number.isFinite(firstLng) ||
    !Number.isFinite(lastLat) ||
    !Number.isFinite(lastLng)
  ) {
    return false;
  }
  return (
    Math.abs(firstLat - lastLat) <= ROAD_PATH_CLOSED_EPSILON &&
    Math.abs(firstLng - lastLng) <= ROAD_PATH_CLOSED_EPSILON
  );
};

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

const offsetCoordinate = (coordinate, metersEast = 0, metersNorth = 0) => {
  if (!coordinate) return null;
  const latRad = coordinate.latitude * DEG_TO_RAD;
  const deltaLat = metersNorth / EARTH_RADIUS_M;
  const deltaLng = metersEast / (EARTH_RADIUS_M * Math.cos(latRad || 0.00001));
  return {
    latitude: coordinate.latitude + (deltaLat * 180) / Math.PI,
    longitude: coordinate.longitude + (deltaLng * 180) / Math.PI,
  };
};

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
  const [showPolygons, setShowPolygons] = useState(false);
  const [markerViewsFrozen, setMarkerViewsFrozen] = useState(false);
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
    login,
    logout,
    clearAuthError,
  } = useAuthState({ baseUrl: mobileBffUrl });
  const mapRef = useRef(null);
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
  };

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
      setProfileMenuVisible(false);
    }
  }, [overlayVisible]);

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

  const propertyPolygons = useMemo(() => {
    const items = [];
    const zoom = currentZoom ?? 0;
    const normalizedZoom = Math.round(zoom * 10) / 10;
    viewportProperties.forEach((property) => {
      if (!property.polygonPaths?.length) {
        return;
      }
      const isLayout = property.propertyType?.toLowerCase().includes("layout");
      const shouldShowLayout =
        isLayout && normalizedZoom >= LAYOUT_POLYGON_ZOOM_THRESHOLD;
      if (!showPolygons && !shouldShowLayout) {
        return;
      }
      property.polygonPaths.forEach((path, index) => {
        const styleProps = isLayout ? BOUNDARY_STYLE : PLOT_STYLE;
        items.push(
          <Polygon
            key={`${property.id}-polygon-${index}`}
            coordinates={path}
            strokeColor={styleProps.strokeColor}
            fillColor={styleProps.fillColor}
            strokeWidth={styleProps.strokeWidth}
            onPress={() => handlePropertyPolygonPress(property.polygonPaths)}
          />
        );
      });
    });
    return items.length ? items : null;
  }, [
    currentZoom,
    handlePropertyPolygonPress,
    showPolygons,
    viewportProperties,
  ]);

  const propertyMarkers = useMemo(() => {
    if (showPolygons) {
      return null;
    }
    return viewportProperties.map((property) => {
      return (
        <Marker
          key={`${property.id}-marker`}
          coordinate={property.coordinate}
          title={property.name}
          description={property.propertyType}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={!markerViewsFrozen}
        >
          <View style={styles.locationMarkerOuter}>
            <View style={styles.locationMarkerInner} />
          </View>
        </Marker>
      );
    });
  }, [markerViewsFrozen, showPolygons, viewportProperties]);

  const plotPolygons = useMemo(() => {
    const items = [];
    viewportPlots.forEach((plot) => {
      plot.polygonPaths?.forEach((path, index) => {
        items.push(
          <Polygon
            key={`${plot.id}-plot-${index}`}
            coordinates={path}
            strokeColor={PLOT_STYLE.strokeColor}
            fillColor={PLOT_STYLE.fillColor}
            strokeWidth={PLOT_STYLE.strokeWidth}
          />
        );
      });
    });
    return items;
  }, [viewportPlots]);

  const plotLabelMarkers = useMemo(() => {
    if (!showPlotLabels) {
      return null;
    }
    const items = [];
    viewportPlots.forEach((plot) => {
      const label = plot.plotNumber;
      const labelCoordinate = offsetCoordinate(
        plot.center,
        PLOT_LABEL_EAST_OFFSET_METERS,
        0
      );
      if (!label || !labelCoordinate) {
        return;
      }
      items.push(
        <Marker
          key={`${plot.id}-label`}
          coordinate={labelCoordinate}
          anchor={{ x: 0.5, y: 0.5 }}
          centerOffset={{ x: 4, y: 0 }}
          flat
          tracksViewChanges={!markerViewsFrozen}
          tappable={false}
        >
          <Text style={styles.plotLabelText} numberOfLines={1}>
            {label}
          </Text>
        </Marker>
      );
    });
    return items;
  }, [markerViewsFrozen, showPlotLabels, viewportPlots]);

  const roadPolylines = useMemo(() => {
    const items = [];
    viewportRoads.forEach((road) => {
      road.paths?.forEach((path, index) => {
        const key = `${road.id}-road-${index}`;
        if (isClosedPath(path)) {
          items.push(
            <Polygon
              key={key}
              coordinates={path}
              strokeColor={ROAD_STYLE.strokeColor}
              fillColor={ROAD_STYLE.fillColor}
              strokeWidth={ROAD_STYLE.strokeWidth}
            />
          );
        } else {
          items.push(
            <Polyline
              key={key}
              coordinates={path}
              strokeColor={ROAD_STYLE.strokeColor}
              strokeWidth={ROAD_STYLE.strokeWidth}
            />
          );
        }
      });
    });
    return items.length ? items : null;
  }, [viewportRoads]);

  const roadLabelMarkers = useMemo(() => {
    if (!showRoadLabels) {
      return null;
    }
    const items = [];
    viewportRoads.forEach((road) => {
      const label = road.name?.trim();
      if (!label || !road.paths?.length) {
        return;
      }
      const placement = computeRoadLabelPlacement(road.paths);
      if (!placement?.coordinate) {
        return;
      }
      const rotationDeg = Number.isFinite(placement.angleDeg)
        ? placement.angleDeg
        : 0;
      const rotationStyle = {
        transform: [{ rotate: `${rotationDeg}deg` }],
      };
      items.push(
        <Marker
          key={`${road.id}-road-label`}
          coordinate={placement.coordinate}
          anchor={{ x: 0.5, y: 0.5 }}
          tappable={false}
        >
          <Text style={[styles.roadLabelText, rotationStyle]} numberOfLines={1}>
            {label}
          </Text>
        </Marker>
      );
    });
    return items.length ? items : null;
  }, [showRoadLabels, viewportRoads]);

  const amenityPolygons = useMemo(() => {
    if (!showAmenityPolygons) {
      return null;
    }
    const items = [];
    viewportAmenities.forEach((amenity) => {
      amenity.polygonPaths?.forEach((path, index) => {
        items.push(
          <Polygon
            key={`${amenity.id}-amenity-${index}`}
            coordinates={path}
            strokeColor={AMENITY_STYLE.strokeColor}
            fillColor={AMENITY_STYLE.fillColor}
            strokeWidth={AMENITY_STYLE.strokeWidth}
          />
        );
      });
    });
    return items.length ? items : null;
  }, [showAmenityPolygons, viewportAmenities]);

  const amenityLabelMarkers = useMemo(() => {
    if (!showAmenityLabels) {
      return null;
    }
    const items = [];
    viewportAmenities.forEach((amenity) => {
      const label = amenity.name?.trim();
      if (!label) {
        return;
      }
      const labelCoordinate = computePolygonCentroid(amenity.polygonPaths);
      if (!labelCoordinate) {
        return;
      }
      const fontSize = computeAmenityLabelFontSize(amenity.polygonPaths);
      items.push(
        <Marker
          key={`${amenity.id}-amenity-label`}
          coordinate={labelCoordinate}
          anchor={{ x: 0.5, y: 0.5 }}
          tappable={false}
        >
          <Text
            style={[styles.amenityLabelText, { fontSize }]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </Marker>
      );
    });
    return items.length ? items : null;
  }, [showAmenityLabels, viewportAmenities]);

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
        {amenityPolygons}
        {plotLabelMarkers}
        {amenityLabelMarkers}
        {propertyPolygons}
        {roadPolylines}
        {roadLabelMarkers}
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
  plotLabelText: {
    color: "#f8fafc",
    fontWeight: "700",
    fontSize: 12,
    textAlign: "center",
    textAlignVertical: "center",
    includeFontPadding: false,
    textShadowColor: "rgba(2, 6, 23, 0.65)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  amenityLabelText: {
    color: "#6d28d9",
    fontWeight: "700",
    fontSize: 12,
    textShadowColor: "rgba(241, 245, 249, 0.85)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
  roadLabelText: {
    color: "#cdd2d9",
    fontWeight: "600",
    fontSize: 11,
    maxWidth: 160,
    textShadowColor: "rgba(15, 23, 42, 0.65)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  locationMarkerOuter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(94, 234, 212,0.25)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(15, 118, 110,0.25)",
  },
  locationMarkerInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#0d9488",
    borderWidth: 2,
    borderColor: "#e6fffa",
  },
});
