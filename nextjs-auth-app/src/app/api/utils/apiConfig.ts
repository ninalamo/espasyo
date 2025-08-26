const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5041/api").replace(/\/$/, "");
export default API_BASE_URL;
