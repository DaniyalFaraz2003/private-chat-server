import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "chat_token";
const USERNAME_KEY = "chat_username";

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getUsername() {
  return SecureStore.getItemAsync(USERNAME_KEY);
}

export async function saveSession(token: string, username: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USERNAME_KEY, username);
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USERNAME_KEY);
}
