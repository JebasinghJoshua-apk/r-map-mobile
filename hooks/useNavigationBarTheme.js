import { useEffect } from "react";
import * as NavigationBar from "expo-navigation-bar";

export default function useNavigationBarTheme({ isDark, colorScheme }) {
  useEffect(() => {
    const applyNavigationBarTheme = async () => {
      const available = await NavigationBar.isAvailableAsync();
      if (!available) {
        return;
      }

      const behavior = await NavigationBar.getBehaviorAsync().catch(() => null);
      if (behavior === "inset-swipe" || behavior === "overlay-swipe") {
        return;
      }

      const backgroundColor = isDark ? "#1b1b1b" : "#f1f1f1";
      const buttonStyle = isDark ? "light" : "dark";

      await NavigationBar.setBackgroundColorAsync(backgroundColor).catch(
        () => {}
      );
      await NavigationBar.setButtonStyleAsync(buttonStyle).catch(() => {});
    };

    applyNavigationBarTheme();
  }, [colorScheme, isDark]);
}
