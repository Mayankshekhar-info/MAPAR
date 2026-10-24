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


api.interceptors.response.use(
  response => response,
  error => {
    return Promise.reject(error);
  },
);
