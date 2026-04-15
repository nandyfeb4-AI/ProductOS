import { getJson, postJson } from "./client";

export const getConnectors    = ()  => getJson("/api/connectors");
export const disconnectMural  = ()  => postJson("/api/connectors/mural/disconnect", {});
