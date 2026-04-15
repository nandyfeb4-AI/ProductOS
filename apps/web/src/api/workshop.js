import { postJson } from "./client";
export const analyzeWorkshop = (body) => postJson("/api/workshop/analyze", body);
