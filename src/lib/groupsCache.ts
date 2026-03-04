/**
 * Cache for groups and Splitwise data to speed up the Choose Group step.
 * Prefetch early (import, camera, paste, review) so data is ready when user navigates.
 */

import type { Group } from "../app/types";
import { apiGetGroups, apiSplitwiseStatus, apiSplitwiseGroups } from "./api";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cached: { groups: Group[]; timestamp: number } | null = null;

export type SplitwiseCache = {
  connected: boolean;
  groups: { id: number; name: string; members?: { id: number; email?: string; first_name?: string; last_name?: string }[] }[];
  timestamp: number;
};

let splitwiseCached: SplitwiseCache | null = null;

export function getCachedGroups(): Group[] | null {
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) return null;
  return cached.groups;
}

export function setCachedGroups(groups: Group[]): void {
  cached = { groups, timestamp: Date.now() };
}

export function getCachedSplitwise(): SplitwiseCache | null {
  if (!splitwiseCached) return null;
  if (Date.now() - splitwiseCached.timestamp > CACHE_TTL_MS) return null;
  return splitwiseCached;
}

function setCachedSplitwise(connected: boolean, groups: { id: number; name: string; members?: { id: number; email?: string; first_name?: string; last_name?: string }[] }[]): void {
  splitwiseCached = { connected, groups, timestamp: Date.now() };
}

export async function prefetchGroups(): Promise<Group[]> {
  // Run both in parallel; set groups as soon as we have them (don't wait for Splitwise)
  const groupsPromise = apiGetGroups();
  prefetchSplitwise(); // Fire and forget - populates Splitwise cache
  const groups = await groupsPromise;
  setCachedGroups(groups);
  return groups;
}

export async function prefetchSplitwise(): Promise<void> {
  try {
    const status = await apiSplitwiseStatus();
    if (status.connected) {
      const g = await apiSplitwiseGroups();
      const arr = Array.isArray(g) ? g : (g?.groups ? g.groups : []);
      setCachedSplitwise(true, arr.map((x: { id: number; name: string; members?: unknown[] }) => ({
        id: x.id,
        name: x.name,
        members: x.members || [],
      })));
    } else {
      setCachedSplitwise(false, []);
    }
  } catch {
    setCachedSplitwise(false, []);
  }
}
