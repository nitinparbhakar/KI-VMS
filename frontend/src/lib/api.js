import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = axios.create({ baseURL: `${BACKEND_URL}/api` });

export const api = {
  // Departments
  getDepartments: () => API.get("/departments"),

  // Hosts
  getHosts: (department) => API.get("/hosts", { params: department ? { department } : {} }),
  createHost: (data) => API.post("/hosts", data),
  updateHost: (id, data) => API.put(`/hosts/${id}`, data),
  deleteHost: (id) => API.delete(`/hosts/${id}`),

  // Visitors
  lookupPhone: (phone) => API.get("/visitors/lookup", { params: { phone } }),
  checkin: (data) => API.post("/visitors/checkin", data),
  checkout: (visitorId) => API.post("/visitors/checkout", { visitor_id: visitorId }),
  getActiveVisitors: () => API.get("/visitors/active"),
  searchVisitors: (params) => API.get("/visitors/search", { params }),
  getVisitor: (visitorId) => API.get(`/visitors/${visitorId}`),
  getVisitorPhoto: (visitorId) => API.get(`/visitors/${visitorId}/photo`),
  getVisitorSlipUrl: (visitorId) => `${BACKEND_URL}/api/visitors/${visitorId}/slip`,

  // Blacklist
  getBlacklist: () => API.get("/blacklist"),
  addToBlacklist: (data) => API.post("/blacklist", data),
  updateBlacklist: (id, data) => API.put(`/blacklist/${id}`, data),
  removeFromBlacklist: (id) => API.delete(`/blacklist/${id}`),

  // Stats
  getStats: () => API.get("/stats"),

  // Audit & Email
  getAuditLog: (page) => API.get("/audit-log", { params: { page } }),
  getEmailLog: () => API.get("/email-log"),

  // Seed
  seed: () => API.post("/seed"),
};
