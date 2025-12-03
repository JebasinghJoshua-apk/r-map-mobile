import { useCallback, useEffect, useRef, useState } from "react";

import { getPropertyBadgeLabel } from "../constants/mapConfig";

export default function usePropertyBadges(mapRef, viewportProperties) {
  const [propertyBadges, setPropertyBadges] = useState([]);
  const badgeAnimationFrameRef = useRef(null);

  const updatePropertyBadges = useCallback(async () => {
    const mapInstance = mapRef?.current;
    if (!mapInstance || !viewportProperties?.length) {
      setPropertyBadges([]);
      return;
    }

    try {
      const projections = await Promise.all(
        viewportProperties.map(async (property) => {
          if (!property?.coordinate) {
            return null;
          }

          try {
            const point = await mapInstance.pointForCoordinate(
              property.coordinate
            );
            if (!point) {
              return null;
            }

            return {
              id: property.id,
              x: point.x,
              y: point.y,
              label: getPropertyBadgeLabel(property),
            };
          } catch (projectionError) {
            return null;
          }
        })
      );

      setPropertyBadges(projections.filter(Boolean));
    } catch (error) {
      console.warn("Failed to project price badges", error);
    }
  }, [mapRef, viewportProperties]);

  const scheduleBadgeUpdate = useCallback(() => {
    if (badgeAnimationFrameRef.current) {
      return;
    }

    badgeAnimationFrameRef.current = requestAnimationFrame(() => {
      badgeAnimationFrameRef.current = null;
      updatePropertyBadges();
    });
  }, [updatePropertyBadges]);

  useEffect(() => {
    updatePropertyBadges();
  }, [updatePropertyBadges]);

  useEffect(
    () => () => {
      if (badgeAnimationFrameRef.current) {
        cancelAnimationFrame(badgeAnimationFrameRef.current);
        badgeAnimationFrameRef.current = null;
      }
    },
    []
  );

  return {
    propertyBadges,
    scheduleBadgeUpdate,
    updatePropertyBadges,
  };
}
