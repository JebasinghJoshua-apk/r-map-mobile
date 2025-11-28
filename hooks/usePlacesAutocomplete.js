import { useEffect, useState } from "react";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 350;
const TAMIL_NADU_BOUNDS = {
  southwest: { lat: 8.076, lng: 76.199 },
  northeast: { lat: 13.561, lng: 80.35 },
};
const LOCATION_RECTANGLE = `rectangle:${TAMIL_NADU_BOUNDS.southwest.lat},${TAMIL_NADU_BOUNDS.southwest.lng}|${TAMIL_NADU_BOUNDS.northeast.lat},${TAMIL_NADU_BOUNDS.northeast.lng}`;

export function usePlacesAutocomplete(searchQuery, apiKey) {
  const [suggestions, setSuggestions] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!apiKey) {
      setError(
        "Google Places API key missing. Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY."
      );
      setSuggestions([]);
      setIsFetching(false);
      return;
    }

    const trimmed = searchQuery.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setIsFetching(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    let isActive = true;
    setIsFetching(true);

    const debounceId = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          input: trimmed,
          key: apiKey,
          language: "en",
          components: "country:in",
          locationrestriction: LOCATION_RECTANGLE,
        });

        const response = await fetch(
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
          { signal: controller.signal }
        );
        const data = await response.json();

        if (!isActive) return;

        if (data.status === "OK" && Array.isArray(data.predictions)) {
          setSuggestions(data.predictions);
          setError(null);
        } else {
          setSuggestions([]);
          setError(data.error_message || `Places API error: ${data.status}`);
        }
      } catch (fetchError) {
        if (fetchError?.name !== "AbortError" && isActive) {
          setError("Unable to reach Google Places service.");
        }
      } finally {
        if (isActive) {
          setIsFetching(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      isActive = false;
      clearTimeout(debounceId);
      controller.abort();
    };
  }, [searchQuery, apiKey]);

  const clearSuggestions = () => setSuggestions([]);

  return { suggestions, isFetching, error, clearSuggestions };
}
