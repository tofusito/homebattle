import { BedDouble, Cat, CookingPot, Shirt, Sparkles, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  cocina: CookingPot,
  gatos: Cat,
  habitacion: BedDouble,
  ropa: Shirt,
  general: Sparkles,
};

export function ZoneIcon({ zone, className }: { zone: string; className?: string }) {
  const Icon = ICONS[zone] ?? CookingPot;
  return <Icon className={className} strokeWidth={1.6} aria-hidden="true" />;
}
