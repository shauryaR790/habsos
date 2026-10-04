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
  clientKey: z.string().uuid().optional(),
});

export const statusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
});

export const paymentSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
});

export const menuItemPatchSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(400),
  price: z.number().int().min(0).max(100000),
  isAvailable: z.boolean(),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  isVeg: z.boolean().optional(),
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

export const settingsPatchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  taxBps: z.number().int().min(0).max(2800).optional(),
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
