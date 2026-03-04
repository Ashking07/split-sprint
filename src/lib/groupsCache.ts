/**
 * Cache for groups to speed up the Choose Group step.
 * Prefetch when user is on Receipt Review so data is ready when they navigate.
 */

import type { Group } from "../app/types";
import { apiGetGroups } from "./api";

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

let cached: { groups: Group[]; timestamp: number } | null = null;

export function getCachedGroups(): Group[] | null {
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) return null;
  return cached.groups;
}

export function setCachedGroups(groups: Group[]): void {
  cached = { groups, timestamp: Date.now() };
}

export async function prefetchGroups(): Promise<Group[]> {
  const groups = await apiGetGroups();
  setCachedGroups(groups);
  return groups;
}
