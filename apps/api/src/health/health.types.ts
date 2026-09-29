export type DependencyStatus = "up" | "down";

export interface LivenessResponse {
  status: "alive";
  timestamp: string;
}

export interface ReadinessResponse {
  status: "ready" | "not_ready";
  checks: {
    database: DependencyStatus;
    redis: DependencyStatus;
  };
  timestamp: string;
}
