/**
 * XP and level logic for gamification.
 * - Start at 0 XP, Level 1
 * - 100 XP per level, cap at Level 10
 * - +25 XP per bill uploaded to Splitwise
 * - +50 XP bonus for connecting Splitwise (one-time)
 */

export const XP_PER_BILL = 25;
export const XP_SPLITWISE_BONUS = 50;
export const XP_PER_LEVEL = 100;
export const MAX_LEVEL = 10;

export function getLevel(xp: number): number {
  return Math.min(MAX_LEVEL, Math.floor(xp / XP_PER_LEVEL) + 1);
}

export function getXpInCurrentLevel(xp: number): number {
  const level = getLevel(xp);
  if (level >= MAX_LEVEL) return Math.min(XP_PER_LEVEL, xp - (MAX_LEVEL - 1) * XP_PER_LEVEL);
  return xp % XP_PER_LEVEL;
}

export function getMaxXpForLevel(level: number): number {
  return XP_PER_LEVEL;
}

export function getProgress(xp: number): { level: number; xpInLevel: number; maxXpForLevel: number } {
  const level = getLevel(xp);
  const xpInLevel = getXpInCurrentLevel(xp);
  const maxXpForLevel = getMaxXpForLevel(level);
  return { level, xpInLevel, maxXpForLevel };
}
