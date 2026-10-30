const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:5041/api").replace(/\/$/, "");
export default API_BASE_URL;
