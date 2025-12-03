import { Dimensions } from "react-native";

import { clampLatitude, clampLongitude } from "../utils/mapRegion";

export const INITIAL_REGION = {
  latitude: 13.0827,
  longitude: 80.2707,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export const HYBRID_ZOOM_THRESHOLD = 16.5;
export const PLOT_LABEL_ZOOM_THRESHOLD = 17.2;
export const AMENITY_POLYGON_ZOOM_THRESHOLD = 15;
export const AMENITY_LABEL_ZOOM_THRESHOLD = 16.4;
export const ROAD_LABEL_ZOOM_THRESHOLD = 15.4;
export const POLYGON_FOCUS_MIN_ZOOM = 14;
export const POLYGON_FOCUS_MAX_ZOOM = 19;
export const POLYGON_FOCUS_TARGET_ZOOM = 18;

export const PROPERTY_BADGE_FALLBACK_LABEL = "Property";

export const getPropertyBadgeLabel = (property) =>
  property?.priceDisplay ??
  property?.displayPrice ??
  property?.displayLabel ??
  property?.name ??
  PROPERTY_BADGE_FALLBACK_LABEL;

export const LIGHT_MAP_STYLE = [
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

export const computeRegionForZoom = (center, zoomLevel) => {
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
