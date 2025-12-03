import { memo, useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

const PRICE_BADGE_COLORS = {
  background: "#0f766e",
  stroke: "#99f6e4",
  text: "#ecfeff",
};

const DEFAULT_BADGE_WIDTH = 48;
const DEFAULT_BADGE_HEIGHT = 32;

const PropertyPriceBadges = ({ badges = [] }) => {
  const [measurements, setMeasurements] = useState({});

  const handleLayout = useCallback((id, event) => {
    const { width, height } = event.nativeEvent.layout;
    setMeasurements((prev) => {
      const existing = prev[id];
      if (existing && existing.width === width && existing.height === height) {
        return prev;
      }
      return {
        ...prev,
        [id]: { width, height },
      };
    });
  }, []);

  if (!badges.length) {
    return null;
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {badges.map((badge) => {
        if (
          !badge ||
          !Number.isFinite(badge.x) ||
          !Number.isFinite(badge.y) ||
          !badge.label
        ) {
          return null;
        }
        const measurement = measurements[badge.id];
        const translateX = measurement
          ? -measurement.width / 2
          : -DEFAULT_BADGE_WIDTH / 2;
        const translateY = measurement
          ? -measurement.height
          : -DEFAULT_BADGE_HEIGHT;
        return (
          <View
            key={badge.id}
            style={[
              styles.badgeContainer,
              {
                left: badge.x,
                top: badge.y,
                transform: [{ translateX }, { translateY }],
              },
            ]}
            onLayout={(event) => handleLayout(badge.id, event)}
          >
            <View style={styles.badgeBubble}>
              <Text
                style={styles.badgeText}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {badge.label}
              </Text>
            </View>
            <View style={styles.badgePointer} />
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  badgeContainer: {
    position: "absolute",
    alignItems: "center",
  },
  badgeBubble: {
    backgroundColor: PRICE_BADGE_COLORS.background,
    borderColor: PRICE_BADGE_COLORS.stroke,
    borderWidth: 1.4,
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    minWidth: 32,
    maxWidth: 160,
    shadowColor: "#020617",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  badgeText: {
    color: PRICE_BADGE_COLORS.text,
    fontWeight: "700",
    fontSize: 13,
    textAlign: "center",
  },
  badgePointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 9,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: PRICE_BADGE_COLORS.background,
    marginTop: -1,
  },
});

export default memo(PropertyPriceBadges);
