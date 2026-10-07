import { z } from 'zod';
import { ORDER_STATUSES, PAYMENT_METHODS } from './domain';

export const cartLineSchema = z.object({
  menuItemId: z.string().trim().min(1).max(80),
  quantity: z.number().int().min(1).max(20),
  addonIds: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  notes: z.string().max(180).optional().default(''),
});

export const checkoutStartSchema = z.object({
  tableCode: z.string().trim().min(2).max(12),
  customerName: z.string().trim().min(1).max(80),
  customerMobile: z.string().trim().min(8).max(20),
  items: z.array(cartLineSchema).min(1).max(30),
  clientKey: z.string().uuid().optional(),
  paymentPreference: z.enum(['DESK', 'UPI', 'CARD']).optional().default('DESK'),
  address: z.string().trim().max(200).optional(),
  locality: z.string().trim().max(120).optional(),
  extraInfo: z.string().trim().max(200).optional(),
});

const guestMenuFieldsSchema = {
  menuLead: z.string().trim().max(24).optional().default(''),
  menuSubtitle: z.string().trim().max(80).optional().default(''),
  kcalLabel: z.string().trim().max(40).optional().default(''),
  ingredients: z.array(z.string().trim().min(1).max(24)).max(8).optional().default([]),
};

export const menuItemCreateSchema = z.object({
  categoryId: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(400).optional().default(''),
  price: z.number().int().min(0).max(100000),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  isVeg: z.boolean().optional().default(true),
  isFavorite: z.boolean().optional().default(false),
  shortcutNum: z.string().trim().max(8).nullable().optional(),
  shortcutAlpha: z.string().trim().max(8).nullable().optional(),
  addonGroupIds: z.array(z.string().trim().min(1).max(80)).max(12).optional().default([]),
  ...guestMenuFieldsSchema,
});

export const tableStageSchema = z.object({
  stage: z.enum(['blank', 'running', 'kot', 'printed', 'paid']),
});

export const mediaUploadSchema = z.object({
  filename: z.string().trim().min(1).max(80),
  contentBase64: z.string().min(32).max(2_500_000),
  mime: z.enum(['image/png', 'image/jpeg', 'image/webp']),
});

export const checkoutVerifySchema = z.object({
  orderId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/),
});

export const resendSchema = z.object({
  orderId: z.string().uuid(),
});

export const staffOrderSchema = z.object({
  id: z.string().uuid().optional(),
  tableId: z.string().trim().min(1).max(80).nullable().optional(),
  tableCode: z.string().trim().min(2).max(12).optional(),
  customerName: z.string().trim().min(1).max(80),
  customerMobile: z.string().trim().max(20).optional().default(''),
  items: z.array(cartLineSchema).min(1).max(30),
  notes: z.string().max(400).optional().default(''),
  discount: z.number().int().min(0).max(100000).optional().default(0),
  clientKey: z.string().uuid().optional(),
  allowOpenTable: z.boolean().optional(),
});

export const staffOrderPatchSchema = z.object({
  customerName: z.string().trim().min(1).max(80).optional(),
  customerMobile: z.string().trim().max(20).optional(),
  items: z.array(cartLineSchema).min(1).max(30),
  notes: z.string().max(400).optional(),
  discount: z.number().int().min(0).max(100000).optional(),
});

export const statusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
});

export const paymentSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  amount: z.number().int().min(1).max(100000).optional(),
});

export const razorpayCreateSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.number().int().min(100).max(10000000).optional(),
});

export const razorpayVerifySchema = z.object({
  orderId: z.string().uuid(),
  razorpayOrderId: z.string().trim().min(4).max(40),
  razorpayPaymentId: z.string().trim().min(4).max(40),
  razorpaySignature: z.string().trim().min(8).max(128),
});

export const splitSchema = z.object({
  parts: z.number().int().min(2).max(8),
});

export const menuItemPatchSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(400),
  price: z.number().int().min(0).max(100000),
  isAvailable: z.boolean(),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  isVeg: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  shortcutNum: z.string().trim().max(8).nullable().optional(),
  shortcutAlpha: z.string().trim().max(8).nullable().optional(),
  ...guestMenuFieldsSchema,
});

export const addonPatchSchema = z.object({
  name: z.string().trim().min(1).max(80),
  price: z.number().int().min(0).max(100000),
  isAvailable: z.boolean(),
});

export const itemGroupsSchema = z.object({
  addonGroupIds: z.array(z.string().trim().min(1).max(80)).max(12),
});

export const categoryPatchSchema = z.object({
  name: z.string().trim().min(1).max(40),
});

export const moveSchema = z.object({
  direction: z.enum(['up', 'down']),
});

export const tablePatchSchema = z.object({
  status: z.enum(['AVAILABLE', 'OCCUPIED']),
});

export const tableCreateSchema = z.object({
  name: z.string().trim().min(1).max(40),
  area: z.string().trim().min(1).max(40).optional(),
});

export const orderTableSchema = z.object({
  tableId: z.string().trim().min(1).max(80),
});

export const settingsPatchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  taxBps: z.number().int().min(0).max(2800).optional(),
});

export const customerCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  mobile: z.string().trim().min(8).max(20),
});

export const reservationCreateSchema = z.object({
  tableId: z.string().trim().min(1).max(80),
  customerName: z.string().trim().min(1).max(80),
  customerMobile: z.string().trim().max(20).optional().default(''),
  covers: z.number().int().min(1).max(20),
  startsAt: z.string().trim().max(40).optional(),
});

export const syncOpSchema = z.object({
  id: z.string().min(1).max(80),
  operation: z.enum([
    'CREATE_ORDER',
    'UPDATE_ORDER',
    'MARK_PREPARING',
    'MARK_READY',
    'MARK_PAID',
    'UPDATE_MENU',
    'UPDATE_ADDON',
    'UPDATE_TABLE',
  ]),
  entity: z.string().min(1).max(40),
  entityId: z.string().min(1).max(80),
  payload: z.unknown(),
  createdAt: z.string().min(4).max(40),
});

export const syncBatchSchema = z.object({
  operations: z.array(syncOpSchema).max(50),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(120),
  password: z.string().min(4).max(120),
});

export const inventoryItemCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sku: z.string().trim().max(32).optional().default(''),
  category: z.string().trim().max(40).optional().default('Raw material'),
  unit: z.enum(['kg', 'g', 'l', 'ml', 'pcs']),
  qty: z.number().min(0).max(1_000_000).optional().default(0),
  reorderLevel: z.number().min(0).max(1_000_000).optional().default(0),
  costPerUnit: z.number().int().min(0).max(10_000_000).optional().default(0),
  supplier: z.string().trim().max(80).optional().default(''),
});

export const inventoryItemPatchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  sku: z.string().trim().max(32).optional(),
  category: z.string().trim().max(40).optional(),
  unit: z.enum(['kg', 'g', 'l', 'ml', 'pcs']).optional(),
  reorderLevel: z.number().min(0).max(1_000_000).optional(),
  costPerUnit: z.number().int().min(0).max(10_000_000).optional(),
  supplier: z.string().trim().max(80).optional(),
});

export const inventoryMovementSchema = z.object({
  itemId: z.string().trim().min(1).max(80),
  kind: z.enum(['PURCHASE', 'WASTAGE', 'ADJUSTMENT', 'RETURN']),
  qty: z.number().refine((n) => n !== 0 && Math.abs(n) <= 1_000_000, 'Enter a non-zero quantity.'),
  unitCost: z.number().int().min(0).max(10_000_000).optional(),
  notes: z.string().trim().max(200).optional().default(''),
  supplier: z.string().trim().max(80).optional().default(''),
});

export const menuRecipesSchema = z.object({
  lines: z.array(z.object({
    inventoryItemId: z.string().trim().min(1).max(80),
    qtyPerPortion: z.number().positive().max(10_000),
  })).max(24),
});
