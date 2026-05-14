export interface Item {
  id: string;
  name: string;
  quantity: number;
  addedAt: number; // timestamp
  categoryId: string;
  cabinetId: string;
  imageUrl?: string;
  notes?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface Cabinet {
  id: string;
  name: string;
  type: string;
  color: string;
}

export const INITIAL_CABINETS: Cabinet[] = [
  { id: 'cab1', name: '卧室抽屉', type: 'drawer', color: 'var(--coral)' },
  { id: 'cab2', name: '大衣柜', type: 'wardrobe', color: 'var(--purple)' },
  { id: 'cab3', name: '书桌', type: 'desk', color: 'var(--sky)' },
];

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat1', name: '药品', icon: 'Pill', color: 'var(--mint)' },
  { id: 'cat2', name: '餐具', icon: 'Utensils', color: 'var(--coral)' },
  { id: 'cat3', name: '食物', icon: 'Apple', color: 'var(--lemon)' },
  { id: 'cat4', name: '数据线', icon: 'Usb', color: 'var(--sky)' },
];

const STORAGE_KEY = 'remember_me_data';

export const db = {
  saveData: (data: { items: Item[]; cabinets: Cabinet[]; categories: Category[] }) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
  loadData: () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      items: [],
      cabinets: INITIAL_CABINETS,
      categories: INITIAL_CATEGORIES,
    };
  }
};
