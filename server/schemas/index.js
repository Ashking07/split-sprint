import { z } from "zod";

const billItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  qty: z.number().int().min(1),
  unitPriceCents: z.number().int().min(0),
  confidence: z.number().min(0).max(1).optional(),
  source: z.enum(["vision", "text", "manual"]).optional(),
});

const splitwiseMemberSchema = z.object({
  id: z.number(),
  email: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
});

export const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  memberIds: z.array(z.string()).optional().default([]),
});

export const createGroupFromSplitwiseSchema = z.object({
  name: z.string().min(1).max(100),
  splitwiseGroupId: z.number(),
  splitwiseMembers: z.array(splitwiseMemberSchema).min(1),
});

export const createBillSchema = z.object({
  groupId: z.string().min(1).optional().nullable(),
  merchant: z.string().optional().default(""),
  currency: z.string().optional().default("USD"),
  receiptDate: z.string().optional().nullable(),
  rawReceipt: z.object({
    imageBase64: z.string().optional(),
    pastedText: z.string().optional(),
  }).optional(),
  items: z.array(billItemSchema).min(1),
  taxCents: z.number().int().min(0).optional().default(0),
  tipCents: z.number().int().min(0).optional().default(0),
  splitMode: z.enum(["equal", "itemized"]).optional().default("equal"),
  participantsByItem: z.record(z.string(), z.array(z.string())).optional().default({}),
});

export const updateBillSchema = z.object({
  merchant: z.string().optional().nullable(),
  groupId: z.string().min(1).optional().nullable(),
  currency: z.string().optional(),
  receiptDate: z.string().optional().nullable(),
  rawReceipt: z.object({
    imageBase64: z.string().optional(),
    pastedText: z.string().optional(),
  }).optional(),
  items: z.array(billItemSchema).optional(),
  taxCents: z.number().int().min(0).optional(),
  tipCents: z.number().int().min(0).optional(),
  splitMode: z.enum(["equal", "itemized"]).optional(),
  participantsByItem: z.record(z.string(), z.array(z.string())).optional(),
  status: z.enum(["draft", "sent"]).optional(),
});
