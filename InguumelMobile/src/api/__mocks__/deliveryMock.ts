/**
 * Example mock data for GET /api/v1/orders/{order_id}/delivery.
 * Use for UI testing when backend is unavailable or to drive Storybook/tests.
 */

import type { DeliveryResponse } from '../endpoints';

/** PREPARING active – received done, preparing active, rest todo. */
export const deliveryMockPreparing: DeliveryResponse = {
  current_status: {
    code: 'preparing',
    label: 'Бэлтгэж байна',
    at: '2026-02-02T08:22:15',
  },
  timeline: [
    { code: 'received', label: 'Захиалга авлаа', at: '2026-02-02 08:21:00', is_current: false },
    { code: 'preparing', label: 'Бэлтгэж байна', at: '2026-02-02 08:22:15', is_current: true },
  ],
  last_update_at: '2026-02-02T08:22:15.000Z',
};

/** OUT_FOR_DELIVERY active. */
export const deliveryMockOutForDelivery: DeliveryResponse = {
  current_status: {
    code: 'out_for_delivery',
    label: 'Хүргэлтэд гарсан',
    at: '2026-02-02T10:15:00',
  },
  timeline: [
    { code: 'received', label: 'Захиалга авлаа', at: '2026-02-02 08:21:00' },
    { code: 'preparing', label: 'Бэлтгэж байна', at: '2026-02-02 08:22:15' },
    { code: 'prepared', label: 'Бэлтгэж дууссан', at: '2026-02-02 09:00:00' },
    { code: 'out_for_delivery', label: 'Хүргэлтэд гарсан', at: '2026-02-02 10:15:00', is_current: true },
  ],
  last_update_at: '2026-02-02T10:15:00.000Z',
};

/** DELIVERED – all steps done. */
export const deliveryMockDelivered: DeliveryResponse = {
  current_status: {
    code: 'delivered',
    label: 'Хүргэгдсэн',
    at: '2026-02-02T14:30:00',
  },
  timeline: [
    { code: 'received', label: 'Захиалга авлаа', at: '2026-02-02 08:21:00' },
    { code: 'preparing', label: 'Бэлтгэж байна', at: '2026-02-02 08:22:15' },
    { code: 'prepared', label: 'Бэлтгэж дууссан', at: '2026-02-02 09:00:00' },
    { code: 'out_for_delivery', label: 'Хүргэлтэд гарсан', at: '2026-02-02 10:15:00' },
    { code: 'delivered', label: 'Хүргэгдсэн', at: '2026-02-02 14:30:00', is_current: true },
  ],
  last_update_at: '2026-02-02T14:30:00.000Z',
};

/** CANCELLED – received done, cancelled active. */
export const deliveryMockCancelled: DeliveryResponse = {
  current_status: {
    code: 'cancelled',
    label: 'Цуцлагдсан',
    at: '2026-02-02T09:05:00',
  },
  timeline: [
    { code: 'received', label: 'Захиалга авлаа', at: '2026-02-02 08:21:00' },
    { code: 'cancelled', label: 'Цуцлагдсан', at: '2026-02-02 09:05:00', is_current: true, note: 'User cancelled' },
  ],
  last_update_at: '2026-02-02T09:05:00.000Z',
};
