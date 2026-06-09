// Mapa de ícones de categoria (substitui emojis). Compartilhado entre
// views e modais — inclui as opções pro seletor de ícone dos formulários.
import {
  IconArrowIn,
  IconBriefcase,
  IconCar,
  IconCard,
  IconFilm,
  IconFood,
  IconGym,
  IconPlane,
  IconShield,
  IconTarget,
  IconTrendUp,
} from "./icons";

export const ICONS: Record<string, () => JSX.Element> = {
  plane: IconPlane,
  shield: IconShield,
  card: IconCard,
  food: IconFood,
  car: IconCar,
  film: IconFilm,
  gym: IconGym,
  briefcase: IconBriefcase,
  trend: IconTrendUp,
  "arrow-in": IconArrowIn,
  target: IconTarget,
};

// ícone por vital financeiro (saúde)
export const VITAL_ICON: Record<string, string> = {
  fluxo: "trend",
  cartao: "card",
  recorrentes: "film",
  reserva: "shield",
  objetivo: "target",
};

export function CatIcon({ name }: { name: string }) {
  const I = ICONS[name] ?? IconCard;
  return <I />;
}

// opções legíveis pro seletor de ícone nos formulários
export const ICON_OPTIONS: { key: string; label: string }[] = [
  { key: "food", label: "Delivery / comida" },
  { key: "car", label: "Transporte" },
  { key: "film", label: "Assinatura" },
  { key: "gym", label: "Saúde" },
  { key: "card", label: "Cartão / outros" },
  { key: "shield", label: "Reserva / seguro" },
  { key: "plane", label: "Viagem" },
  { key: "briefcase", label: "Salário / trabalho" },
  { key: "arrow-in", label: "Entrada / Pix" },
  { key: "trend", label: "Investimento" },
];
