import { useEffect, useRef, useState } from "react";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import {
  Platform,
  StatusBar as RNStatusBar,
  StyleSheet,
  View,
  useColorScheme,
} from "react-native";
import * as NavigationBar from "expo-navigation-bar";
import { BlurView } from "expo-blur";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import Constants from "expo-constants";
import SearchOverlay from "./components/SearchOverlay";
import CompactSearchBar from "./components/CompactSearchBar";
import ProfileMenu from "./components/ProfileMenu";
import AuthModal from "./components/AuthModal";
import { usePlacesAutocomplete } from "./hooks/usePlacesAutocomplete";
import { useAuthState } from "./hooks/useAuthState";

export default function App() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const [searchQuery, setSearchQuery] = useState("");
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [recentSearches, setRecentSearches] = useState([]);
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const {
    userProfile,
    loginPhone,
    loginPassword,
    setLoginPhone,
    setLoginPassword,
    login,
    logout,
  } = useAuthState();
  const mapRef = useRef(null);
  const mapsApiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    Constants.expoConfig?.extra?.googleMapsApiKey ||
    Constants.manifest?.extra?.googleMapsApiKey ||
    "";
  const {
    suggestions,
    isFetching: isFetchingSuggestions,
    error: suggestionError,
    clearSuggestions,
  } = usePlacesAutocomplete(searchQuery, mapsApiKey);
  // Expo's BlurView uses hardware bitmaps that crash software-rendered Android surfaces, so keep it iOS-only.
  const blurSupported = Platform.OS === "ios";
  const topOffset =
    Platform.OS === "android" ? (RNStatusBar.currentHeight ?? 0) + 72 : 96;
  const compactTopOffset =
    Platform.OS === "android" ? (RNStatusBar.currentHeight ?? 0) + 18 : 36;

  const persistRecentSearch = (suggestion) => {
    if (!suggestion?.place_id) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter(
        (item) => item.place_id !== suggestion.place_id
      );
      return [
        {
          place_id: suggestion.place_id,
          description: suggestion.description,
          structured_formatting: suggestion.structured_formatting,
        },
        ...filtered,
      ].slice(0, 5);
    });
  };

  const handleSuggestionPress = async (suggestion) => {
    if (!mapsApiKey) return;

    setSearchQuery(suggestion.description);
    clearSuggestions();

    try {
      const params = new URLSearchParams({
        place_id: suggestion.place_id,
        key: mapsApiKey,
        fields: "geometry",
      });
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`
      );
      const data = await response.json();
      const location = data.result?.geometry?.location;

      if (location && mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude: location.lat,
            longitude: location.lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          750
        );
      }
      persistRecentSearch(suggestion);
      setOverlayVisible(false);
    } catch (error) {
      console.warn("Place details error", error);
    }
  };

  const handleRecentSelect = (recentEntry) => {
    handleSuggestionPress(recentEntry);
  };

  const handleClearRecent = () => setRecentSearches([]);

  const handleSubmitEditing = () => {
    if (suggestions.length > 0) {
      handleSuggestionPress(suggestions[0]);
    }
  };

  const showSearchOverlay = () => {
    setOverlayVisible(true);
    setProfileMenuVisible(false);
  };

  const handleCompactClear = () => {
    setSearchQuery("");
    showSearchOverlay();
  };

  const handleProfilePress = () => {
    if (userProfile) {
      setProfileMenuVisible((prev) => !prev);
    } else {
      setAuthModalVisible(true);
    }
  };

  const handleAuthSubmit = () => {
    const success = login();
    if (success) {
      setAuthModalVisible(false);
      setProfileMenuVisible(true);
    }
  };

  const handleLogout = () => {
    logout();
    setProfileMenuVisible(false);
  };

  const closeAuthModal = () => {
    setAuthModalVisible(false);
    setLoginPassword("");
  };

  const handleMenuSelection = (action) => {
    setProfileMenuVisible(false);
    console.log(`Selected action: ${action}`);
  };

  useEffect(() => {
    const applyNavigationBarTheme = async () => {
      const available = await NavigationBar.isAvailableAsync();
      if (!available) return;

      const behavior = await NavigationBar.getBehaviorAsync().catch(() => null);
      if (behavior === "inset-swipe" || behavior === "overlay-swipe") {
        return; // edge-to-edge gesture nav, OS ignores background changes
      }

      await NavigationBar.setBackgroundColorAsync(
        isDark ? "#1b1b1b" : "#f1f1f1"
      ).catch(() => {});
      await NavigationBar.setButtonStyleAsync(isDark ? "light" : "dark").catch(
        () => {}
      );
    };

    applyNavigationBarTheme();
  }, [colorScheme, isDark]);

  useEffect(() => {
    if (overlayVisible) {
      setProfileMenuVisible(false);
    }
  }, [overlayVisible]);

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        ref={mapRef}
        initialRegion={{
          latitude: 13.0827,
          longitude: 80.2707,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      />
      {overlayVisible && (
        <View
          pointerEvents="none"
          style={[
            styles.mapDimmer,
            {
              backgroundColor: isDark
                ? "rgba(2, 6, 23, 0.65)"
                : "rgba(241, 245, 249, 0.60)",
            },
          ]}
        />
      )}
      {overlayVisible && (
        <View
          style={[styles.overlayWrapper, { paddingTop: topOffset }]}
          pointerEvents="box-none"
        >
          {blurSupported ? (
            <BlurView
              intensity={85}
              tint={isDark ? "dark" : "light"}
              style={styles.overlayCard}
            >
              <SearchOverlay
                isDark={isDark}
                searchQuery={searchQuery}
                onChangeQuery={setSearchQuery}
                onClearQuery={() => setSearchQuery("")}
                suggestions={suggestions}
                onSuggestionPress={handleSuggestionPress}
                onSubmitEditing={handleSubmitEditing}
                isFetchingSuggestions={isFetchingSuggestions}
                suggestionError={suggestionError}
                recentSearches={recentSearches}
                onRecentSelect={handleRecentSelect}
                onClearRecent={handleClearRecent}
              />
            </BlurView>
          ) : (
            <View
              style={[
                styles.overlayCard,
                styles.overlayFallback,
                isDark && styles.overlayFallbackDark,
              ]}
            >
              <SearchOverlay
                isDark={isDark}
                searchQuery={searchQuery}
                onChangeQuery={setSearchQuery}
                onClearQuery={() => setSearchQuery("")}
                suggestions={suggestions}
                onSuggestionPress={handleSuggestionPress}
                onSubmitEditing={handleSubmitEditing}
                isFetchingSuggestions={isFetchingSuggestions}
                suggestionError={suggestionError}
                recentSearches={recentSearches}
                onRecentSelect={handleRecentSelect}
                onClearRecent={handleClearRecent}
              />
            </View>
          )}
        </View>
      )}
      {!overlayVisible && (
        <CompactSearchBar
          isDark={isDark}
          searchQuery={searchQuery}
          topOffset={compactTopOffset}
          onShowOverlay={showSearchOverlay}
          onClearSearch={handleCompactClear}
          userProfile={userProfile}
          onProfilePress={handleProfilePress}
        />
      )}
      <ProfileMenu
        isDark={isDark}
        visible={profileMenuVisible && !!userProfile}
        topOffset={compactTopOffset + 60}
        userProfile={userProfile}
        onDismiss={() => setProfileMenuVisible(false)}
        onLogout={handleLogout}
        onNavigateProperties={() => handleMenuSelection("properties")}
      />
      <AuthModal
        isDark={isDark}
        visible={authModalVisible}
        phone={loginPhone}
        password={loginPassword}
        onChangePhone={setLoginPhone}
        onChangePassword={setLoginPassword}
        onClose={closeAuthModal}
        onSubmit={handleAuthSubmit}
      />
      <ExpoStatusBar style={isDark ? "light" : "dark"} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  overlayWrapper: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 16,
  },
  mapDimmer: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayCard: {
    width: "100%",
    maxWidth: 390,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
  },
  overlayFallback: {
    backgroundColor: "rgba(230, 230, 230, 0.9)",
  },
  overlayFallbackDark: {
    backgroundColor: "rgba(15, 23, 42, 0.9)",
  },
});
