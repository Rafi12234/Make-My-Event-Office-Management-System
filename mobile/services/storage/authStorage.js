import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "mme_mobile_access_token";

export async function saveAccessToken(token) {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function removeAccessToken() {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
}
