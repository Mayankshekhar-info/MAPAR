import axios from "axios";


export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api/v1",
  withCredentials: true,
  timeout: 30000,
  xsrfCookieName: "csrftoken",
  xsrfHeaderName: "X-CSRFToken",
  headers: {
    "Content-Type": "application/json",
  },
});


api.interceptors.request.use((config) => {
  // If request data is FormData, remove Content-Type so browser sets boundary automatically
  if (config.data instanceof FormData && config.headers) {
    if (typeof config.headers.delete === "function") {
      config.headers.delete("Content-Type");
    } else {
      delete (config.headers as any)["Content-Type"];
    }
  }
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    return Promise.reject(error);
  },
);
