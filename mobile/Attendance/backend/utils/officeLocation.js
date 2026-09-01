// Centralized MakeMyEvent office geofence constants — the office location
// and allowed radius are defined ONCE here and imported everywhere they're
// needed (attendanceController.js), never duplicated/hardcoded elsewhere.
export const MAKE_MY_EVENT_OFFICE_LATITUDE = 23.776915;
export const MAKE_MY_EVENT_OFFICE_LONGITUDE = 90.411707;
export const MAKE_MY_EVENT_OFFICE_RADIUS_METERS = 20;

const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * Straight-line (Haversine) distance in meters between two GPS coordinates.
 * Local calculation only — no external API, no driving distance.
 */
export function getDistanceInMeters(latitudeA, longitudeA, latitudeB, longitudeB) {
  const dLat = toRadians(latitudeB - latitudeA);
  const dLon = toRadians(longitudeB - longitudeA);
  const lat1 = toRadians(latitudeA);
  const lat2 = toRadians(latitudeB);

  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.asin(Math.sqrt(a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Distance from the given coordinates to the MakeMyEvent office, plus
 * whether that falls within the allowed radius. The inside/outside decision
 * is made from the raw (unrounded) distance — callers should only round the
 * returned distanceFromOffice for display/storage, never before comparing.
 */
export function getOfficeDistance(latitude, longitude) {
  const distanceFromOffice = getDistanceInMeters(
    latitude,
    longitude,
    MAKE_MY_EVENT_OFFICE_LATITUDE,
    MAKE_MY_EVENT_OFFICE_LONGITUDE,
  );

  return {
    distanceFromOffice,
    isInsideOffice: distanceFromOffice <= MAKE_MY_EVENT_OFFICE_RADIUS_METERS,
  };
}
