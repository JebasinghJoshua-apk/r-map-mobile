import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  computeApproximateZoom,
  computeBoundsFromRegion,
  createCoordinate,
} from "../utils/mapRegion";

const DEFAULT_DEBOUNCE_MS = 450;
const COORD_EPSILON = 0.00001;

export function useViewportProperties({
  baseUrl,
  authToken,
  debounceMs = DEFAULT_DEBOUNCE_MS,
} = {}) {
  const [properties, setProperties] = useState([]);
  const [plots, setPlots] = useState([]);
  const [roads, setRoads] = useState([]);
  const [amenities, setAmenities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const normalizedBaseUrl = useMemo(() => {
    if (!baseUrl) return "";
    return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  }, [baseUrl]);
  const abortControllerRef = useRef(null);
  const debounceRef = useRef(null);
  const lastViewportRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(
    () => () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    },
    []
  );

  const fetchViewport = useCallback(
    async (region) => {
      if (!normalizedBaseUrl || !region) {
        setError("Mobile API URL is not configured.");
        return;
      }

      const bounds = computeBoundsFromRegion(region);
      const zoom = computeApproximateZoom(region);
      const query = new URLSearchParams({
        minLat: bounds.minLat.toFixed(6),
        maxLat: bounds.maxLat.toFixed(6),
        minLng: bounds.minLng.toFixed(6),
        maxLng: bounds.maxLng.toFixed(6),
        zoom: zoom.toFixed(2),
      });
      const requestUrl = `${normalizedBaseUrl}/mobile/map/viewport?${query.toString()}`;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(requestUrl, {
          headers: {
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          const message = await response
            .json()
            .catch(() => ({ message: response.statusText }));
          throw new Error(
            typeof message === "string"
              ? message
              : message?.title || message?.message || "Failed to load map data"
          );
        }

        const payload = await response.json();
        if (!mountedRef.current) {
          return;
        }

        const normalized = mapViewportPayload(payload);
        setProperties((prev) =>
          hasPropertyDiff(prev, normalized.properties)
            ? normalized.properties
            : prev
        );
        setPlots((prev) =>
          hasFeatureDiff(prev, normalized.plots) ? normalized.plots : prev
        );
        setRoads((prev) =>
          hasFeatureDiff(prev, normalized.roads) ? normalized.roads : prev
        );
        setAmenities((prev) =>
          hasFeatureDiff(prev, normalized.amenities)
            ? normalized.amenities
            : prev
        );
        setError(null);
      } catch (err) {
        if (err?.name === "AbortError") {
          return;
        }
        console.warn(
          `Viewport fetch failed for ${requestUrl}: ${err?.message ?? "Unknown error"}`
        );
        setError(err?.message || "Unable to load properties for this view.");
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [authToken, normalizedBaseUrl]
  );

  const regionHash = useCallback((region) => {
    if (!region) return "";
    return [
      region.latitude?.toFixed(4),
      region.longitude?.toFixed(4),
      region.latitudeDelta?.toFixed(4),
      region.longitudeDelta?.toFixed(4),
    ].join(":");
  }, []);

  const requestViewport = useCallback(
    (region, { immediate = false } = {}) => {
      if (!region) return;
      const currentHash = regionHash(region);
      const previousHash = regionHash(lastViewportRef.current);
      if (currentHash === previousHash && !immediate) {
        return;
      }
      lastViewportRef.current = region;
      if (immediate) {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        fetchViewport(region);
        return;
      }

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        fetchViewport(region);
      }, debounceMs);
    },
    [debounceMs, fetchViewport, regionHash]
  );

  const refetch = useCallback(() => {
    if (lastViewportRef.current) {
      fetchViewport(lastViewportRef.current);
    }
  }, [fetchViewport]);

  return {
    properties,
    plots,
    roads,
    amenities,
    loading,
    error,
    requestViewport,
    refetch,
  };
}

function mapViewportPayload(payload) {
  const { properties, missingCenterIds } = mapPropertyFeatures(
    payload?.properties || payload?.Properties || []
  );
  return {
    properties,
    missingCenterIds,
    plots: mapPlotFeatures(payload?.plots || payload?.Plots || []),
    roads: mapRoadFeatures(payload?.roads || payload?.Roads || []),
    amenities: mapAmenityFeatures(
      payload?.amenities || payload?.Amenities || []
    ),
  };
}

function hasPropertyDiff(current, next) {
  if (current === next) {
    return false;
  }
  if (!Array.isArray(current) || !Array.isArray(next)) {
    return true;
  }
  if (current.length !== next.length) {
    return true;
  }
  const currentMap = new Map(current.map((item) => [item.id, item]));
  for (const item of next) {
    const existing = currentMap.get(item.id);
    if (!existing) {
      return true;
    }
    if (coordinatesDiffer(existing.coordinate, item.coordinate)) {
      return true;
    }
  }
  return false;
}

function coordinatesDiffer(a, b, epsilon = COORD_EPSILON) {
  if (!a && !b) return false;
  if (!a || !b) return true;
  if (!Number.isFinite(a.latitude) || !Number.isFinite(a.longitude)) {
    return true;
  }
  if (!Number.isFinite(b.latitude) || !Number.isFinite(b.longitude)) {
    return true;
  }
  return (
    Math.abs(a.latitude - b.latitude) > epsilon ||
    Math.abs(a.longitude - b.longitude) > epsilon
  );
}

function hasFeatureDiff(current, next) {
  if (current === next) {
    return false;
  }
  if (!Array.isArray(current) || !Array.isArray(next)) {
    return true;
  }
  if (current.length !== next.length) {
    return true;
  }
  const currentIds = new Set(current.map((item) => item.id));
  for (const item of next) {
    if (!currentIds.has(item.id)) {
      return true;
    }
  }
  return false;
}

function mapPropertyFeatures(list) {
  if (!Array.isArray(list)) {
    return { properties: [], missingCenterIds: [] };
  }
  const missingCenterIds = [];
  const properties = list
    .map((feature) => {
      const coordinate = extractCoordinate(
        feature?.centerGeoJson ||
          feature?.CenterGeoJson ||
          feature?.boundaryGeoJson ||
          feature?.BoundaryGeoJson
      );
      const polygonPaths = extractPolygonPaths(
        feature?.boundaryGeoJson || feature?.BoundaryGeoJson
      );
      const id =
        feature.featureId ||
        feature.propertyId ||
        feature.name ||
        Math.random().toString(36).slice(2);
      if (!coordinate) {
        missingCenterIds.push(id);
        return null;
      }
      return {
        id,
        name: feature.name || "Untitled",
        propertyType: feature.propertyType || "Property",
        isOwned: Boolean(feature.isOwnedByCurrentUser),
        coordinate,
        polygonPaths,
      };
    })
    .filter(Boolean);

  return { properties, missingCenterIds };
}

function mapPlotFeatures(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map((feature) => {
      const paths = extractPolygonPaths(
        feature?.boundaryGeoJson || feature?.BoundaryGeoJson
      );
      if (!paths.length) {
        return null;
      }
      const plotNumber = normalizePlotNumber(
        feature?.plotNumber || feature?.PlotNumber
      );
      const center = extractCoordinate(
        feature?.centerGeoJson || feature?.CenterGeoJson
      );
      return {
        id:
          feature.plotId ||
          feature.featureId ||
          feature.layoutId ||
          Math.random().toString(36).slice(2),
        plotNumber,
        polygonPaths: paths,
        center,
      };
    })
    .filter(Boolean);
}

function normalizePlotNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapRoadFeatures(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map((feature) => {
      const paths = extractLinePaths(
        feature?.roadGeoJson || feature?.RoadGeoJson
      );
      if (!paths.length) {
        return null;
      }
      const metadata = feature?.metadata || feature?.Metadata || null;
      const roadName =
        normalizeName(
          feature?.name,
          feature?.roadName,
          feature?.RoadName,
          metadata?.name,
          metadata?.roadName
        ) || null;
      return {
        id:
          feature.roadId ||
          feature.featureId ||
          feature.name ||
          Math.random().toString(36).slice(2),
        paths,
        name: roadName,
        metadata,
      };
    })
    .filter(Boolean);
}

function mapAmenityFeatures(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map((feature) => {
      const paths = extractPolygonPaths(
        feature?.boundaryGeoJson || feature?.BoundaryGeoJson
      );
      if (!paths.length) {
        return null;
      }
      const metadata = feature?.metadata || feature?.Metadata || null;
      const friendlyName =
        normalizeName(
          feature?.name,
          metadata?.name,
          metadata?.type,
          feature?.amenityType,
          feature?.AmenityType
        ) || "Amenity";
      return {
        id:
          feature.amenityId ||
          feature.featureId ||
          feature.layoutId ||
          Math.random().toString(36).slice(2),
        name: friendlyName,
        polygonPaths: paths,
        metadata,
      };
    })
    .filter(Boolean);
}

function extractCoordinate(geoJsonText) {
  if (!geoJsonText) return null;
  try {
    const geoJson =
      typeof geoJsonText === "string" ? JSON.parse(geoJsonText) : geoJsonText;
    return readCoordinateFromGeoJson(geoJson);
  } catch (err) {
    if (__DEV__) {
      console.warn("Failed to parse center geojson", err, geoJsonText);
    } else {
      console.warn("Failed to parse center geojson", err?.message);
    }
    return null;
  }
}

function readCoordinateFromGeoJson(node) {
  if (!node) return null;
  if (node.type === "Point" && Array.isArray(node.coordinates)) {
    const [lng, lat] = node.coordinates;
    return createCoordinate(lat, lng);
  }
  if (node.type === "Feature" && node.geometry) {
    return readCoordinateFromGeoJson(node.geometry);
  }
  if (node.type === "FeatureCollection" && Array.isArray(node.features)) {
    for (const feature of node.features) {
      const coordinate = readCoordinateFromGeoJson(feature);
      if (coordinate) return coordinate;
    }
    return null;
  }
  if (node.type === "LineString" && Array.isArray(node.coordinates)) {
    const first = node.coordinates[0];
    return Array.isArray(first) ? createCoordinate(first[1], first[0]) : null;
  }
  if (node.type === "Polygon" && Array.isArray(node.coordinates)) {
    const firstRing = node.coordinates[0];
    if (Array.isArray(firstRing) && firstRing.length > 0) {
      const [lng, lat] = firstRing[0];
      return createCoordinate(lat, lng);
    }
  }
  if (node.type === "MultiPolygon" && Array.isArray(node.coordinates)) {
    const firstPolygon = node.coordinates[0];
    if (Array.isArray(firstPolygon)) {
      const firstRing = firstPolygon[0];
      if (Array.isArray(firstRing) && firstRing.length > 0) {
        const [lng, lat] = firstRing[0];
        return createCoordinate(lat, lng);
      }
    }
  }
  return null;
}

function extractPolygonPaths(geoJsonText) {
  if (!geoJsonText) return [];
  try {
    const geoJson =
      typeof geoJsonText === "string" ? JSON.parse(geoJsonText) : geoJsonText;
    const paths = readPolygonPathsFromGeoJson(geoJson);
    return paths ?? [];
  } catch (error) {
    console.warn("Failed to parse polygon geojson", error);
    return [];
  }
}

function extractLinePaths(geoJsonText) {
  if (!geoJsonText) return [];
  try {
    const geoJson =
      typeof geoJsonText === "string" ? JSON.parse(geoJsonText) : geoJsonText;
    const paths = readLinePathsFromGeoJson(geoJson);
    return paths ?? [];
  } catch (error) {
    console.warn("Failed to parse line geojson", error);
    return [];
  }
}

function readPolygonPathsFromGeoJson(node) {
  if (!node) return null;
  if (node.type === "Feature" && node.geometry) {
    return readPolygonPathsFromGeoJson(node.geometry);
  }
  if (node.type === "FeatureCollection" && Array.isArray(node.features)) {
    return node.features
      .map((feature) => readPolygonPathsFromGeoJson(feature))
      .flat()
      .filter(Boolean);
  }
  if (node.type === "Polygon" && Array.isArray(node.coordinates)) {
    const outerRing = node.coordinates[0];
    if (!Array.isArray(outerRing)) {
      return null;
    }
    const coordinates = outerRing
      .map((pair) =>
        Array.isArray(pair) ? createCoordinate(pair[1], pair[0]) : null
      )
      .filter(Boolean);
    return coordinates.length > 2 ? [coordinates] : null;
  }
  if (node.type === "MultiPolygon" && Array.isArray(node.coordinates)) {
    const polygons = [];
    node.coordinates.forEach((polygon) => {
      if (Array.isArray(polygon) && polygon[0]) {
        const ring = polygon[0];
        const coordinates = ring
          .map((pair) =>
            Array.isArray(pair) ? createCoordinate(pair[1], pair[0]) : null
          )
          .filter(Boolean);
        if (coordinates.length > 2) {
          polygons.push(coordinates);
        }
      }
    });
    return polygons.length ? polygons : null;
  }
  return null;
}

function readLinePathsFromGeoJson(node) {
  if (!node) return null;
  if (node.type === "Feature" && node.geometry) {
    return readLinePathsFromGeoJson(node.geometry);
  }
  if (node.type === "FeatureCollection" && Array.isArray(node.features)) {
    return node.features
      .map((feature) => readLinePathsFromGeoJson(feature))
      .flat()
      .filter(Boolean);
  }
  if (node.type === "LineString" && Array.isArray(node.coordinates)) {
    const coords = node.coordinates
      .map((pair) =>
        Array.isArray(pair) ? createCoordinate(pair[1], pair[0]) : null
      )
      .filter(Boolean);
    return coords.length > 1 ? [coords] : null;
  }
  if (node.type === "MultiLineString" && Array.isArray(node.coordinates)) {
    const lines = node.coordinates
      .map((line) =>
        Array.isArray(line)
          ? line
              .map((pair) =>
                Array.isArray(pair) ? createCoordinate(pair[1], pair[0]) : null
              )
              .filter(Boolean)
          : null
      )
      .filter((coords) => coords && coords.length > 1);
    return lines.length ? lines : null;
  }
  if (node.type === "Polygon" && Array.isArray(node.coordinates)) {
    const ring = node.coordinates[0];
    if (!Array.isArray(ring)) {
      return null;
    }
    const coords = ring
      .map((pair) =>
        Array.isArray(pair) ? createCoordinate(pair[1], pair[0]) : null
      )
      .filter(Boolean);
    return coords.length > 1 ? [coords] : null;
  }
  return null;
}

function normalizeName(...candidates) {
  for (const value of candidates) {
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return null;
}
