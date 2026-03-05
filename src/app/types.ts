export type Screen =
  | "home"
  | "login"
  | "signup"
  | "import"
  | "camera"
  | "paste"
  | "review"
  | "group"
  | "split"
  | "confirm"
  | "success"
  | "history"
  | "integrations";

export interface ReceiptItem {
  id: string;
  name: string;
  qty: number;
  price: number;
  /** 0-1 confidence; when < 0.75, treat as needs review */
  confidence?: number;
  uncertain?: boolean;
  source?: "vision" | "text" | "manual";
  assignedTo: string[];
}

export interface Receipt {
  id: string;
  merchant?: string;
  date?: string;
  currency: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
}

export interface SplitState {
  mode: "equal" | "itemized";
  participantsByItem: Record<string, string[]>;
}

export interface Settlement {
  memberId: string;
  amount: number;
  /** For MVP: amount is net (positive = owes, negative = owed) */
}

export interface Person {
  id: string;
  name: string;
  avatar: string;
  color: string;
}

export interface Group {
  id: string;
  name: string;
  emoji: string;
  members: Person[];
  splitwiseGroupId?: number;
  lastUsed: boolean;
}

export interface HistoryEntry {
  id: string;
  title: string;
  date: string;
  total: number;
  group: string;
  status: "sent" | "draft";
  emoji: string;
}

export interface AppState {
  screen: Screen;
  merchant?: string;
  receiptDate?: string;
  items: ReceiptItem[];
  tax: number;
  tip: number;
  tipPreset: number; // 0, 10, 15, 20, -1 for custom
  customTip: string;
  selectedGroup: Group | null;
  selectedPeople: Person[];
  splitMode: "equal" | "itemized";
  xp: number;
  streak: number;
  /** Set when navigating to success after Splitwise upload; shown as +N XP */
  xpGained?: number;
}
