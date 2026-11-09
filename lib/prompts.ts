import type { Category, ShotId } from "@/lib/shots";

const BASE = [
  "Sei un fotografo di alta gioielleria per il catalogo e-commerce Adamante.",
  "L'immagine 1 è SEMPRE la fotografia del prodotto reale da riprodurre: è l'unica fonte attendibile sull'identità del gioiello.",
  "L'immagine 2, se presente, è SOLTANTO una reference di stile, inquadratura, luce e composizione. Non copiarne il gioiello.",
  "MASSIMA FEDELTÀ AL PRODOTTO: conserva identiche forma, montatura, pietre visibili, tagli, posizione, numero e dimensioni relative delle gemme, tonalità e finitura del metallo, struttura, proporzioni, incisioni e particolari riconoscibili.",
  "Non sostituire la gemma principale con quella della reference. Non aggiungere né eliminare pietre, loghi, ciondoli o elementi decorativi. Non inventare dettagli non osservabili.",
  "Se una parte non è visibile nella foto originale, evita di mostrarla o ricostruiscila con la minima variazione plausibile: non enfatizzare dettagli ipotetici.",
  "Stile fotografico luxury e-commerce, estremamente nitido sul prodotto, riflessi metallici credibili, gemme realistiche e luce studio diffusa ben controllata.",
  "Sfondo bianco puro o bianco ottico senza texture, ombre di contatto soffici e realistiche, non ritagliare parti del gioiello.",
  "Output: UNA SOLA fotografia, formato 1:1 quadrato. Nessun collage, cornice, testo, lettering, watermark, grafica o oggetti non richiesti."
].join("\n");

const SCENES: Record<ShotId, string> = {
  hero: "SCATTO PRINCIPALE: foto still-life del gioiello isolato, inquadratura a tre quarti, angolo che valorizza la costruzione. Il gioiello occupa circa il 55-70% della composizione ed è centrato con spazio negativo equilibrato, come la reference di stile. Fondo bianco e ombra lievissima.",
  front: "SECONDA PROSPETTIVA: foto still-life complementare, prevalentemente frontale e simmetrica dove la geometria lo consente. Mostra profilo, spessore e dettagli strutturali del gioiello; non ripetere l'esatto angolo della prima foto. Usa il riferimento soltanto per luce e composizione, senza replicare le sue pietre.",
  worn: "INDOSSATO: foto macro del gioiello realmente indossato sulla parte del corpo anatomicamente coerente con la categoria. Mani curate senza smalto vistoso per gli anelli, polso per bracciali, collo e clavicole per collane, orecchio per orecchini, supporto appropriato per charm. Pelle naturale dai toni caldi e neutri, texture verosimile, sfondo bianco, gioiello protagonista e a fuoco. Niente altri gioielli.",
  box: "PACKAGING: posiziona il gioiello nella confezione di alta gioielleria Adamante ispirata alla reference: scrigno aperto con esterno in velluto bordeaux intenso e interno imbottito color avorio/crema. Foto frontale pulita su sfondo bianco con ombra morbida; contenitore dimensionato coerentemente per la categoria del gioiello. Non aggiungere loghi inventati o scritte."
};

export function buildPrompt(slot: ShotId, category: Category, notes: string): string {
  const details = notes.trim().slice(0, 1600);
  return [
    BASE,
    "Categoria prodotto: " + category + ".",
    SCENES[slot],
    details ? "Vincoli dichiarati dal cliente (prioritari se verificabili nella foto): " + details : "",
    "La reference definisce esclusivamente lo stile, mentre il prodotto della fotografia 1 deve rimanere riconoscibile e quanto più esatto possibile."
  ].filter(Boolean).join("\n\n");
}
