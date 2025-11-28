import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  computeApproximateZoom,
  computeBoundsFromRegion,
  createCoordinate,
} from "../utils/mapRegion";

const DEFAULT_DEBOUNCE_MS = 450;

export function useViewportProperties({
  baseUrl,
  authToken,
  debounceMs = DEFAULT_DEBOUNCE_MS,
} = {}) {
  const [properties, setProperties] = useState([]);
  const [plots, setPlots] = useState([]);
  const [roads, setRoads] = useState([]);
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

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${normalizedBaseUrl}/mobile/map/viewport?${query.toString()}`,
          {
            headers: {
              ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            },
            signal: controller.signal,
          }
        );

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
        setProperties(normalized.properties);
        setPlots(normalized.plots);
        setRoads(normalized.roads);
        setError(null);
      } catch (err) {
        if (err?.name === "AbortError") {
          return;
        }
        console.warn("Viewport fetch failed", err);
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

  const requestViewport = useCallback(
    (region, { immediate = false } = {}) => {
      if (!region) return;
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
    [debounceMs, fetchViewport]
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
    loading,
    error,
    requestViewport,
    refetch,
  };
}

function mapViewportPayload(payload) {
  return {
    properties: mapPropertyFeatures(payload?.properties || payload?.Properties || []),
    plots: mapPlotFeatures(payload?.plots || payload?.Plots || []),
    roads: mapRoadFeatures(payload?.roads || payload?.Roads || []),
  };
}

function mapPropertyFeatures(list) {
  if (!Array.isArray(list)) {
    return [];
  }

  return list
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
      if (!coordinate) {
        return null;
      }
      return {
        id:
          feature.featureId ||
          feature.propertyId ||
          feature.name ||
          Math.random().toString(36).slice(2),
        name: feature.name || "Untitled",
        propertyType: feature.propertyType || "Property",
        isOwned: Boolean(feature.isOwnedByCurrentUser),
        coordinate,
        polygonPaths,
      };
    })
    .filter(Boolean);
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
      return {
        id: feature.plotId || feature.featureId || feature.layoutId || Math.random().toString(36).slice(2),
        polygonPaths: paths,
      };
    })
    .filter(Boolean);
}

function mapRoadFeatures(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map((feature) => {
      const paths = extractLinePaths(feature?.roadGeoJson || feature?.RoadGeoJson);
      if (!paths.length) {
        return null;
      }
      return {
        id: feature.roadId || feature.featureId || feature.name || Math.random().toString(36).slice(2),
        paths,
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
    console.warn("Failed to parse geojson", err);
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
      .map((pair) => (Array.isArray(pair) ? createCoordinate(pair[1], pair[0]) : null))
      .filter(Boolean);
    return coords.length > 1 ? [coords] : null;
  }
  if (node.type === "MultiLineString" && Array.isArray(node.coordinates)) {
    const lines = node.coordinates
      .map((line) =>
        Array.isArray(line)
          ? line
              .map((pair) => (Array.isArray(pair) ? createCoordinate(pair[1], pair[0]) : null))
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
      .map((pair) => (Array.isArray(pair) ? createCoordinate(pair[1], pair[0]) : null))
      .filter(Boolean);
    return coords.length > 1 ? [coords] : null;
  }
  return null;
}
