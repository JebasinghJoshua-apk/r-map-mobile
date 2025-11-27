# r-map-mobile

Simple Expo-based React Native starter that currently renders a `Hello World` message.

## Prerequisites

- Node.js 18+ (local machine currently has Node.js 24.11.1 / npm 11.6.2)
- Expo CLI (available via `npx expo`, version 54.0.16)
- Android or iOS device with the latest **Expo Go** app installed
- Reliable Wi-Fi network shared by both the development machine and the physical device

## Getting started

1. Install dependencies (already installed by the scaffold, but safe to re-run):
   ```bash
   npm install
   ```
2. Start the Expo development server:
   ```bash
   npm start
   ```
   This opens **Expo DevTools** in your browser and shows you a QR code in the terminal.
3. On your physical device:
   - Connect to the same Wi-Fi network as your computer.
   - Open the **Expo Go** app.
   - Tap "Scan QR code" and scan the code shown in the terminal or DevTools.
4. The `Hello World` screen should load on the device. Any edits to `App.js` will hot-reload automatically.

## Platform-specific commands

- `npm run android` – launch on a connected Android device or emulator via Android Studio.
- `npm run ios` – launch on an iOS simulator (requires macOS) or use Expo Go on physical iOS hardware.
- `npm run web` – run the app in a browser for quick UI checks.

## Troubleshooting

- If the device cannot connect, ensure firewall rules allow inbound connections on the Expo dev server ports or switch to the "Tunnel" connection type inside Expo DevTools.
- Run `npx expo doctor` to diagnose common environment issues.
