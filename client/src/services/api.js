import axios from "axios";
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",
  timeout: 20000,
});
let token;
export function setToken(value) {
  token = value;
}
api.interceptors.request.use((config) => {
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (
      error.response?.status === 401 &&
      !error.config.url.includes("/auth/login")
    )
      window.dispatchEvent(new Event("session-expired"));
    return Promise.reject(error);
  },
);
export const errorMessage = (e) =>
  e.response?.data?.error?.message ||
  (e.code === "ERR_NETWORK"
    ? "Cannot reach the API. Check that the server is running."
    : e.message || "Something went wrong.");
export const get = async (url, params) => (await api.get(url, { params })).data;
export const post = async (url, data) => (await api.post(url, data)).data.data;
