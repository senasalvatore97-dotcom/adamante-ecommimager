export const SHOTS = [
  {
    id: "hero",
    number: "01",
    title: "Prodotto principale",
    short: "Tre quarti",
    description: "Gioiello isolato, ripresa a tre quarti, ombra naturale e sfondo bianco puro.",
    referenceNote: "Usa la terza fotografia: anello a tre quarti su fondo bianco."
  },
  {
    id: "front",
    number: "02",
    title: "Seconda prospettiva",
    short: "Vista frontale",
    description: "Inquadratura complementare che mostra incastonatura, volume e struttura.",
    referenceNote: "Usa la quarta fotografia: vista simmetrica e frontale dell'anello."
  },
  {
    id: "worn",
    number: "03",
    title: "Gioiello indossato",
    short: "Lifestyle",
    description: "Primo piano naturale sulla parte del corpo appropriata al gioiello.",
    referenceNote: "Usa la seconda fotografia: anello indossato su una mano in luce morbida."
  },
  {
    id: "box",
    number: "04",
    title: "Confezione Adamante",
    short: "Packaging",
    description: "Gioiello in uno scrigno bordeaux, interno avorio, fondale bianco.",
    referenceNote: "Usa la prima fotografia: scrigno in velluto bordeaux aperto."
  }
] as const;

export type ShotId = (typeof SHOTS)[number]["id"];
export type Category = "anello" | "bracciale" | "collana" | "orecchini" | "ciondolo" | "altro";

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: "anello", label: "Anello" },
  { value: "bracciale", label: "Bracciale" },
  { value: "collana", label: "Collana" },
  { value: "orecchini", label: "Orecchini" },
  { value: "ciondolo", label: "Ciondolo / charm" },
  { value: "altro", label: "Altro gioiello" }
];

export type ImageSet = Record<ShotId, string | null>;
export function blankSet(): ImageSet {
  return { hero: null, front: null, worn: null, box: null };
}

export interface Project {
  id: string;
  title: string;
  category: Category;
  notes: string;
  original: string;
  createdAt: number;
  results: ImageSet;
}
