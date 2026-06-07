import Constants from "expo-constants";
import { Platform } from "react-native";

const DEFAULT_PORT = 3001;

function isLocalhostUrl(url: string) {
  return /localhost|127\.0\.0\.1/.test(url);
}

function getDevMachineHost() {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return null;

  const host = hostUri.split(":")[0];
  if (!host || host === "localhost" || host === "127.0.0.1") return null;
  return host;
}

export function getServerUrl() {
  const configured = process.env.EXPO_PUBLIC_SERVER_URL?.replace(/\/$/, "");

  if (configured && !isLocalhostUrl(configured)) {
    return configured;
  }

  // Android emulator: localhost on the device is not your PC
  if (Platform.OS === "android" && !Constants.isDevice) {
    return `http://10.0.2.2:${DEFAULT_PORT}`;
  }

  // Expo Go on a physical device: reuse Metro's host (your PC's LAN IP)
  const devHost = getDevMachineHost();
  if (devHost) {
    return `http://${devHost}:${DEFAULT_PORT}`;
  }

  return configured ?? `http://localhost:${DEFAULT_PORT}`;
}

export function getWsUrl() {
  const configured = process.env.EXPO_PUBLIC_WS_URL?.replace(/\/$/, "");

  if (configured && !isLocalhostUrl(configured)) {
    return configured;
  }

  if (Platform.OS === "android" && !Constants.isDevice) {
    return `ws://10.0.2.2:${DEFAULT_PORT}`;
  }

  const devHost = getDevMachineHost();
  if (devHost) {
    return `ws://${devHost}:${DEFAULT_PORT}`;
  }

  return configured ?? `ws://localhost:${DEFAULT_PORT}`;
}
