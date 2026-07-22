// The tracked macro goals and their display colours, shared by every view that
// draws them (Today's macro rings, the week strip's day rings, …) so a colour
// tweak lands everywhere at once.
export const MACROS = [
  { key: "protein_g", label: "Protein", color: "text-sky-400" },
  { key: "carbs_g", label: "Carbs", color: "text-rose-400" },
  { key: "fat_g", label: "Fat", color: "text-orange-400" },
  { key: "fiber_g", label: "Fiber", color: "text-emerald-400" },
] as const;
