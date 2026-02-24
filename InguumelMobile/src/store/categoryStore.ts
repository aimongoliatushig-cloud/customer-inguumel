import { create } from 'zustand';
import { fetchCategories as apiFetchCategories } from '~/api/endpoints';
import { isCancelError } from '~/api/client';
import { authStore } from '~/store/authStore';
import { isDev } from '~/constants/config';
import type { Category } from '~/types';

function sortCategories(list: Category[]): Category[] {
  return [...list].sort((a, b) => {
    const sa = a.sequence ?? 999;
    const sb = b.sequence ?? 999;
    if (sa !== sb) return sa - sb;
    return (a.name ?? '').localeCompare(b.name ?? '');
  });
}

function rootOnly(categories: Category[]): Category[] {
  return categories.filter((c) => c.parent_id == null || c.parent_id === 0);
}

interface CategoryState {
  /** Full list from API (for Categories screen tree). */
  allCategories: Category[];
  /** Root-only list (for Home chips and Categories left panel). */
  categories: Category[];
  /** Children of selectedRootId (for Categories screen subcategory chips). */
  childCategories: Category[];
  loading: boolean;
  error: string | null;
  /** Home screen: null = "Бүгд". */
  selectedCategoryId: number | null;
  /** Categories screen: selected root category id. */
  selectedRootId: number | null;
  /** Categories screen: selected child (subcategory) id; null = "Бүгд" within root. */
  selectedChildId: number | null;
  loadCategories: (warehouseId: number | null | undefined) => Promise<void>;
  selectCategory: (id: number | null) => void;
  resetCategorySelection: () => void;
  selectRoot: (id: number | null) => void;
  selectChild: (id: number | null) => void;
}

export const categoryStore = create<CategoryState>((set, get) => ({
  allCategories: [],
  categories: [],
  childCategories: [],
  loading: false,
  error: null,
  selectedCategoryId: null,
  selectedRootId: null,
  selectedChildId: null,

  loadCategories: async (warehouseId: number | null | undefined) => {
    const { status, token } = authStore.getState();
    if (status !== 'LOGGED_IN' || !token) {
      set({ loading: false, error: null });
      return;
    }
    set({
      loading: true,
      error: null,
      selectedCategoryId: null,
      selectedRootId: null,
      selectedChildId: null,
      childCategories: [],
    });
    try {
      const raw = await apiFetchCategories(warehouseId ?? undefined);
      if (isDev && raw.length > 0) {
        const first5 = raw.slice(0, 5).map((c) => ({
          id: c.id,
          name: c.name,
          icon_url: c.icon_url ?? null,
        }));
        // eslint-disable-next-line no-console
        console.log('[Categories] loaded, first 5:', JSON.stringify(first5));
      }
      const roots = sortCategories(rootOnly(raw));
      const all = sortCategories(raw);
      set({
        allCategories: all,
        categories: roots,
        childCategories: [],
        loading: false,
        error: null,
      });
    } catch (err) {
      if (isCancelError(err)) {
        set({ loading: false, error: null });
        return;
      }
      set({
        allCategories: [],
        categories: [],
        childCategories: [],
        loading: false,
        error: (err as Error).message ?? 'Failed to load categories',
      });
    }
  },

  selectCategory: (id: number | null) => {
    set({ selectedCategoryId: id });
  },

  resetCategorySelection: () => {
    set({ selectedCategoryId: null });
  },

  selectRoot: (id: number | null) => {
    const { allCategories } = get();
    const childCategories =
      id == null
        ? []
        : sortCategories(allCategories.filter((c) => c.parent_id === id));
    set({
      selectedRootId: id,
      selectedChildId: null,
      childCategories,
    });
  },

  selectChild: (id: number | null) => {
    set({ selectedChildId: id });
  },
}));
