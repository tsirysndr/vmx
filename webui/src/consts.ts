export const API_URL = import.meta.env.PROD
  ? window.location.origin + "/api"
  : import.meta.env.VITE_API_URL || "http://localhost:8889";
