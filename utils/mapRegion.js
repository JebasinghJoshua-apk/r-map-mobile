const MIN_LAT_DELTA = 0.0005;
const MIN_LNG_DELTA = 0.0005;
const MIN_ZOOM = 1;
const MAX_ZOOM = 20;

export function clampLatitude(value) {
  return Math.max(-90, Math.min(90, value));
}

export function clampLongitude(value) {
  if (value < -180) return -180;
  if (value > 180) return 180;
  return value;
}

export function computeBoundsFromRegion(region) {
  const latDelta = Math.max(
    Math.abs(region.latitudeDelta ?? 0.01),
    MIN_LAT_DELTA
  );
  const lngDelta = Math.max(
    Math.abs(region.longitudeDelta ?? 0.01),
    MIN_LNG_DELTA
  );
  const halfLat = latDelta / 2;
  const halfLng = lngDelta / 2;
  return {
    minLat: clampLatitude(region.latitude - halfLat),
    maxLat: clampLatitude(region.latitude + halfLat),
    minLng: clampLongitude(region.longitude - halfLng),
    maxLng: clampLongitude(region.longitude + halfLng),
  };
}

export function computeApproximateZoom(region) {
  const latDelta = Math.max(
    Math.abs(region.latitudeDelta ?? 0.01),
    MIN_LAT_DELTA
  );
  const zoom = Math.log2(360 / latDelta);
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function createCoordinate(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") {
    return null;
  }
  return {
    latitude: clampLatitude(lat),
    longitude: clampLongitude(lng),
  };
}
