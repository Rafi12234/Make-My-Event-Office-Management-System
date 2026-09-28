import * as Location from "expo-location";

const LOCATION_TIMEOUT_MS = 15000;

export class LocationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "LocationError";
    this.code = code;
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new LocationError("Location request timed out. Please try again.", "TIMEOUT"));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Resolves the employee's current foreground location for a Sign In / Sign
 * Out action (guide sections 20-25: permission + GPS gate, foreground only,
 * no background tracking). Requests permission if needed, verifies location
 * services are enabled, then reads a fresh GPS fix — never a cached one.
 * Throws a LocationError with a user-facing message on any failure; callers
 * must not proceed to call the Sign In/Out API if this rejects.
 */
export async function getCurrentAttendanceLocation() {
  const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
  let status = existingStatus;

  if (status !== "granted") {
    const requested = await Location.requestForegroundPermissionsAsync();
    status = requested.status;
  }

  if (status !== "granted") {
    throw new LocationError(
      "Location permission is required to continue. Please allow location access and try again.",
      "PERMISSION_DENIED",
    );
  }

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    throw new LocationError("Please enable location services and try again.", "SERVICES_DISABLED");
  }

  let position;
  try {
    position = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      LOCATION_TIMEOUT_MS,
    );
  } catch (error) {
    if (error instanceof LocationError) throw error;
    throw new LocationError("Unable to get your current location. Please try again.", "UNAVAILABLE");
  }

  if (!position?.coords) {
    throw new LocationError("Unable to get your current location. Please try again.", "UNAVAILABLE");
  }

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy ?? null,
  };
}
