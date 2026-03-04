import { Group, HistoryEntry, Person, ReceiptItem } from "./types";

export const PEOPLE: Person[] = [
  { id: "p1", name: "Alex", avatar: "A", color: "#7C3AED" },
  { id: "p2", name: "Sam", avatar: "S", color: "#0891B2" },
  { id: "p3", name: "Jordan", avatar: "J", color: "#D97706" },
  { id: "p4", name: "Riley", avatar: "R", color: "#DC2626" },
  { id: "p5", name: "Casey", avatar: "C", color: "#059669" },
];

export const GROUPS: Group[] = [
  {
    id: "g1",
    name: "Friday Crew",
    emoji: "🍕",
    members: [PEOPLE[0], PEOPLE[1], PEOPLE[2], PEOPLE[3]],
    lastUsed: true,
  },
  {
    id: "g2",
    name: "Road Trip",
    emoji: "🚗",
    members: [PEOPLE[0], PEOPLE[4], PEOPLE[2]],
    lastUsed: false,
  },
  {
    id: "g3",
    name: "Roommates",
    emoji: "🏠",
    members: [PEOPLE[1], PEOPLE[3], PEOPLE[4]],
    lastUsed: false,
  },
  {
    id: "g4",
    name: "Work Lunch",
    emoji: "💼",
    members: [PEOPLE[0], PEOPLE[1], PEOPLE[2], PEOPLE[3], PEOPLE[4]],
    lastUsed: false,
  },
];

export const MOCK_RECEIPT_ITEMS: ReceiptItem[] = [
  { id: "i1", name: "Margherita Pizza", qty: 1, price: 14.99, assignedTo: [] },
  { id: "i2", name: "Caesar Salad", qty: 2, price: 8.5, assignedTo: [] },
  { id: "i3", name: "Craft Beer × 3", qty: 1, price: 18.0, uncertain: true, assignedTo: [] },
  { id: "i4", name: "Sparkling Water", qty: 2, price: 4.0, assignedTo: [] },
  { id: "i5", name: "Tiramisu", qty: 1, price: 7.5, uncertain: true, assignedTo: [] },
];

export const MOCK_TAX = 4.28;

export const HISTORY: HistoryEntry[] = [
  {
    id: "h1",
    title: "Dinner at Osteria",
    date: "Feb 28, 2026",
    total: 87.4,
    group: "Friday Crew",
    status: "sent",
    emoji: "🍝",
  },
  {
    id: "h2",
    title: "Gas Station",
    date: "Feb 25, 2026",
    total: 62.0,
    group: "Road Trip",
    status: "sent",
    emoji: "⛽",
  },
  {
    id: "h3",
    title: "Grocery Run",
    date: "Feb 22, 2026",
    total: 134.55,
    group: "Roommates",
    status: "sent",
    emoji: "🛒",
  },
  {
    id: "h4",
    title: "Team Pizza Friday",
    date: "Feb 21, 2026",
    total: 54.0,
    group: "Work Lunch",
    status: "draft",
    emoji: "🍕",
  },
  {
    id: "h5",
    title: "Brunch @ Café Blue",
    date: "Feb 14, 2026",
    total: 110.2,
    group: "Friday Crew",
    status: "sent",
    emoji: "☕",
  },
];
