import { useCallback, useState } from "react";

const normalizeSuggestion = (suggestion) => {
  if (!suggestion?.place_id) {
    return null;
  }
  return {
    place_id: suggestion.place_id,
    description: suggestion.description,
    structured_formatting: suggestion.structured_formatting,
  };
};

const useSearchUiState = ({ onOverlayShown } = {}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [recentSearches, setRecentSearches] = useState([]);

  const showOverlay = useCallback(() => {
    setOverlayVisible(true);
    onOverlayShown?.();
  }, [onOverlayShown]);

  const hideOverlay = useCallback(() => {
    setOverlayVisible(false);
  }, []);

  const persistRecentSearch = useCallback((suggestion) => {
    const normalized = normalizeSuggestion(suggestion);
    if (!normalized) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter(
        (entry) => entry.place_id !== normalized.place_id
      );
      return [normalized, ...filtered].slice(0, 5);
    });
  }, []);

  const handleClearRecent = useCallback(() => {
    setRecentSearches([]);
  }, []);

  const handleCompactClear = useCallback(() => {
    setSearchQuery("");
    showOverlay();
  }, [showOverlay]);

  return {
    searchQuery,
    setSearchQuery,
    overlayVisible,
    showOverlay,
    hideOverlay,
    recentSearches,
    persistRecentSearch,
    handleCompactClear,
    handleClearRecent,
  };
};

export default useSearchUiState;
