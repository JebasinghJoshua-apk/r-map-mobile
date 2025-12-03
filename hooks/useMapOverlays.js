import { useMemo } from "react";
import { StyleSheet, Text } from "react-native";
import { Marker, Polygon, Polyline } from "react-native-maps";
import { DRAWING_STYLES } from "../constants/drawingStyles";
import { getPlotLabelFontSize, getRoadLabelFontSize } from "../utils/labelFont";
import {
  computeAmenityLabelFontSize,
  computePolygonCentroid,
  computeRoadLabelPlacement,
  isClosedPath,
  offsetCoordinate,
} from "../utils/mapGeometry";

const LAYOUT_POLYGON_ZOOM_THRESHOLD = 10.9;
const PLOT_LABEL_EAST_OFFSET_METERS = 2;

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

const overlayStyles = StyleSheet.create({
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
});

const shouldAlwaysShowPolygon = (normalizedType) => {
  if (!normalizedType) {
    return false;
  }
  const type = normalizedType.toLowerCase();
  const collapsed = type.replace(/[^a-z]/g, "");

  const matchesIndependentHouse =
    collapsed.includes("independenthouse") ||
    collapsed.includes("individualhouse");
  const matchesIndividualPlots =
    collapsed.includes("individualplots") ||
    collapsed.includes("individualplot");
  const matchesLand = collapsed.includes("land");
  const matchesApartmentFlat =
    collapsed.includes("apartmentflat") ||
    (type.includes("apartment") && type.includes("flat"));
  const matchesCommercialSpace =
    collapsed.includes("commercialspace") ||
    (type.includes("commercial") && type.includes("space"));

  return (
    matchesIndependentHouse ||
    matchesIndividualPlots ||
    matchesLand ||
    matchesApartmentFlat ||
    matchesCommercialSpace
  );
};

const useMapOverlays = ({
  currentZoom,
  showPolygons,
  showPlotLabels,
  showAmenityPolygons,
  showAmenityLabels,
  showRoadLabels,
  viewportProperties = [],
  viewportPlots = [],
  viewportRoads = [],
  viewportAmenities = [],
  markerViewsFrozen,
  onPropertyPolygonPress,
}) => {
  const propertyPolygons = useMemo(() => {
    const items = [];
    const zoom = currentZoom ?? 0;
    const normalizedZoom = Math.round(zoom * 10) / 10;
    viewportProperties.forEach((property) => {
      if (!property.polygonPaths?.length) {
        return;
      }
      const propertyType = property.propertyType?.toLowerCase() ?? "";
      const isLayout = propertyType.includes("layout");
      const shouldShowLayout =
        isLayout && normalizedZoom >= LAYOUT_POLYGON_ZOOM_THRESHOLD;
      const shouldForcePolygon =
        !isLayout && shouldAlwaysShowPolygon(propertyType);
      if (!showPolygons && !shouldShowLayout && !shouldForcePolygon) {
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
            onPress={() =>
              onPropertyPolygonPress?.(property.polygonPaths ?? [path])
            }
          />
        );
      });
    });
    return items.length ? items : null;
  }, [currentZoom, onPropertyPolygonPress, showPolygons, viewportProperties]);

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
    const zoom = currentZoom ?? 0;
    const fontSize = getPlotLabelFontSize(zoom);
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
          <Text
            style={[overlayStyles.plotLabelText, { fontSize }]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </Marker>
      );
    });
    return items;
  }, [currentZoom, markerViewsFrozen, showPlotLabels, viewportPlots]);

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
    const zoom = currentZoom ?? 0;
    const fontSize = getRoadLabelFontSize(zoom);
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
          <Text
            style={[overlayStyles.roadLabelText, rotationStyle, { fontSize }]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </Marker>
      );
    });
    return items.length ? items : null;
  }, [currentZoom, showRoadLabels, viewportRoads]);

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
            style={[overlayStyles.amenityLabelText, { fontSize }]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </Marker>
      );
    });
    return items.length ? items : null;
  }, [showAmenityLabels, viewportAmenities]);

  return {
    propertyPolygons,
    plotPolygons,
    plotLabelMarkers,
    roadPolylines,
    roadLabelMarkers,
    amenityPolygons,
    amenityLabelMarkers,
  };
};

export default useMapOverlays;
