const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_M = 6378137;
const AMENITY_LABEL_MIN_PX = 12;
const AMENITY_LABEL_MAX_PX = 30;
const AMENITY_LABEL_MAX_AREA_SQM = 15000;

const computePolygonBounds = (paths) => {
  if (!Array.isArray(paths) || paths.length === 0) {
    return null;
  }

  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLng = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let hasPoints = false;

  paths.forEach((path) => {
    if (!Array.isArray(path)) return;
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
    minLat,
    maxLat,
    minLng,
    maxLng,
  };
};

export const computePolygonCentroid = (paths) => {
  const bounds = computePolygonBounds(paths);
  if (!bounds) {
    return null;
  }
  return {
    latitude: (bounds.minLat + bounds.maxLat) / 2,
    longitude: (bounds.minLng + bounds.maxLng) / 2,
  };
};

export const computePolygonApproxAreaSqM = (paths) => {
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

export const computeAmenityLabelFontSize = (paths) => {
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

export const computeRoadLabelPlacement = (paths) => {
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

export const isClosedPath = (path, epsilon = 0.00002) => {
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
    Math.abs(firstLat - lastLat) <= epsilon &&
    Math.abs(firstLng - lastLng) <= epsilon
  );
};

export const offsetCoordinate = (
  coordinate,
  metersEast = 0,
  metersNorth = 0
) => {
  if (!coordinate) return null;
  const latRad = coordinate.latitude * DEG_TO_RAD;
  const deltaLat = metersNorth / EARTH_RADIUS_M;
  const deltaLng = metersEast / (EARTH_RADIUS_M * Math.cos(latRad || 0.00001));
  return {
    latitude: coordinate.latitude + (deltaLat * 180) / Math.PI,
    longitude: coordinate.longitude + (deltaLng * 180) / Math.PI,
  };
};
