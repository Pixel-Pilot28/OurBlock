import type { ItemOutput, ItemStatus } from '../types';

export type RawItemStatus = ItemStatus | { type: ItemStatus };

export function normalizeItemStatus(status: unknown): ItemStatus {
  if (typeof status === 'string') {
    return status as ItemStatus;
  }

  if (status && typeof status === 'object' && 'type' in status) {
    const typedStatus = (status as RawItemStatus).type;
    return typedStatus;
  }

  return 'Unavailable';
}

export function normalizeItemOutput(item: ItemOutput): ItemOutput {
  return {
    ...item,
    item: {
      ...item.item,
      status: normalizeItemStatus(item.item.status),
    },
  };
}

export function normalizeItems(items: ItemOutput[]): ItemOutput[] {
  return items.map(normalizeItemOutput);
}
