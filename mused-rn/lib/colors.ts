export const SOUND_COLORS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
];

export const TAILWIND_BG_HEX_MAP: Record<string, string> = {
  'bg-red-500': '#ef4444',
  'bg-red-600': '#dc2626',
  'bg-orange-500': '#f97316',
  'bg-orange-600': '#ea580c',
  'bg-amber-500': '#f59e0b',
  'bg-amber-600': '#d97706',
  'bg-yellow-500': '#eab308',
  'bg-yellow-600': '#ca8a04',
  'bg-lime-500': '#84cc16',
  'bg-lime-600': '#65a30d',
  'bg-green-500': '#22c55e',
  'bg-green-600': '#16a34a',
  'bg-emerald-500': '#10b981',
  'bg-emerald-600': '#059669',
  'bg-teal-500': '#14b8a6',
  'bg-teal-600': '#0d9488',
  'bg-cyan-500': '#06b6d4',
  'bg-cyan-600': '#0891b2',
  'bg-sky-500': '#0ea5e9',
  'bg-sky-600': '#0284c7',
  'bg-blue-500': '#3b82f6',
  'bg-blue-600': '#2563eb',
  'bg-indigo-500': '#6366f1',
  'bg-indigo-600': '#4f46e5',
  'bg-violet-500': '#8b5cf6',
  'bg-violet-600': '#7c3aed',
  'bg-purple-500': '#a855f7',
  'bg-purple-600': '#9333ea',
  'bg-fuchsia-500': '#d946ef',
  'bg-fuchsia-600': '#c026d3',
  'bg-pink-500': '#ec4899',
  'bg-pink-600': '#db2777',
  'bg-rose-500': '#f43f5e',
  'bg-rose-600': '#e11d48',
  'bg-muted': '#1f2937',
};

export function normalizePadColor(color?: string | null) {
  if (!color) {
    return undefined;
  }

  const trimmed = color.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.startsWith('#') || trimmed.startsWith('rgb') || trimmed.startsWith('hsl')) {
    return trimmed;
  }

  const mapped = TAILWIND_BG_HEX_MAP[trimmed];
  return mapped;
}
