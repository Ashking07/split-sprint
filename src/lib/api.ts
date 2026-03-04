const API_BASE = import.meta.env.VITE_API_URL || "";

function getToken(): string | null {
  return localStorage.getItem("splitsprint-token");
}

function getHeaders(): HeadersInit {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function parseJson(res: Response) {
  const text = await res.text();
  if (!text) {
    const msg =
      res.status === 504
        ? "Server is starting up. Please try again in a few seconds."
        : res.status === 404
          ? "API not found. Run 'vercel dev' for full stack, or check deployment."
          : "Empty response from server";
    throw new Error(msg);
  }
  try {
    return JSON.parse(text);
  } catch {
    if (text.trimStart().startsWith("<")) {
      throw new Error(
        "API not found (got HTML). Run 'vercel dev' for full stack with API."
      );
    }
    throw new Error(`Invalid response: ${text.slice(0, 80)}`);
  }
}

export async function apiLogin(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || "Login failed");
  return data;
}

export async function apiSignup(email: string, password: string, name?: string) {
  const res = await fetch(`${API_BASE}/api/auth/signup`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ email, password, name }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || "Signup failed");
  return data;
}

export async function apiMe() {
  const res = await fetch(`${API_BASE}/api/me`, {
    headers: getHeaders(),
  });
  if (res.status === 401) return null;
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export async function apiGetHistory() {
  const res = await fetch(`${API_BASE}/api/bills`, {
    headers: getHeaders(),
  });
  const data = await parseJson(res);
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export async function apiGetBill(id: string) {
  const res = await fetch(`${API_BASE}/api/bills/${id}`, {
    headers: getHeaders(),
  });
  const data = await parseJson(res);
  if (res.status === 401) throw new Error("Unauthorized");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export async function apiCreateBill(payload: {
  groupId?: string | null;
  merchant?: string;
  currency?: string;
  receiptDate?: string | null;
  rawReceipt?: { imageBase64?: string; pastedText?: string };
  items: { id: string; name: string; qty: number; unitPriceCents: number; confidence?: number; source?: string }[];
  taxCents?: number;
  tipCents?: number;
  splitMode?: "equal" | "itemized";
  participantsByItem?: Record<string, string[]>;
}) {
  const res = await fetch(`${API_BASE}/api/bills`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export async function apiUpdateBill(
  id: string,
  payload: {
    merchant?: string;
    groupId?: string | null;
    receiptDate?: string | null;
    rawReceipt?: { imageBase64?: string; pastedText?: string };
    items?: { id: string; name: string; qty: number; unitPriceCents: number; confidence?: number; source?: string }[];
    taxCents?: number;
    tipCents?: number;
    splitMode?: "equal" | "itemized";
    participantsByItem?: Record<string, string[]>;
    status?: "draft" | "sent";
  }
) {
  const res = await fetch(`${API_BASE}/api/bills/${id}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export async function apiFinalizeBill(id: string) {
  const res = await fetch(`${API_BASE}/api/bills/${id}/finalize`, {
    method: "POST",
    headers: getHeaders(),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export async function apiGetGroups() {
  const res = await fetch(`${API_BASE}/api/groups`, {
    headers: getHeaders(),
  });
  const data = await parseJson(res);
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export async function apiCreateGroup(payload: { name: string; memberIds?: string[] }) {
  const res = await fetch(`${API_BASE}/api/groups`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export async function apiCreateGroupFromSplitwise(payload: {
  name: string;
  splitwiseGroupId: number;
  splitwiseMembers: { id: number; email?: string; first_name?: string; last_name?: string }[];
}) {
  const res = await fetch(`${API_BASE}/api/groups/from-splitwise`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export async function apiAddGroupMember(groupId: string, email: string) {
  const res = await fetch(`${API_BASE}/api/groups/${groupId}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ addMemberEmail: email }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export async function apiParseReceipt(payload: {
  imageBase64?: string;
  pastedText?: string;
  currencyHint?: string;
}) {
  const res = await fetch(`${API_BASE}/api/receipts/parse`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await parseJson(res);
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error(data.error || "Failed to parse receipt");
  return data;
}

export async function apiSplitwiseStatus() {
  const res = await fetch(`${API_BASE}/api/splitwise/status`, {
    headers: getHeaders(),
    cache: 'no-store',
  });
  const data = await parseJson(res);
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export async function apiSplitwiseConnect() {
  return `${API_BASE}/api/splitwise/connect`;
}

export async function apiSplitwiseGroups() {
  const res = await fetch(`${API_BASE}/api/splitwise/groups`, { headers: getHeaders() });
  const data = await parseJson(res);
  if (res.status === 401) throw new Error("Unauthorized");
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export async function apiSplitwiseDisconnect() {
  const res = await fetch(`${API_BASE}/api/splitwise/disconnect`, {
    method: "POST",
    headers: getHeaders(),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export async function apiSplitwiseCreateGroup(
  groupId: string,
  additionalMembers?: { email?: string; first_name?: string; last_name?: string; id?: number }[]
) {
  const res = await fetch(`${API_BASE}/api/splitwise/groups/create`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ groupId, additionalMembers: additionalMembers || [] }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export async function apiSplitwiseCreateExpense(billId: string, groupId?: string) {
  const res = await fetch(`${API_BASE}/api/splitwise/expenses/create`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ billId, ...(groupId && { groupId }) }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export async function apiUpdateGroupSplitwise(groupId: string, splitwiseGroupId: number | null) {
  const res = await fetch(`${API_BASE}/api/groups/${groupId}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ splitwiseGroupId }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export async function apiGetGroup(id: string) {
  const res = await fetch(`${API_BASE}/api/groups/${id}`, {
    headers: getHeaders(),
  });
  const data = await parseJson(res);
  if (res.status === 401) throw new Error("Unauthorized");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

