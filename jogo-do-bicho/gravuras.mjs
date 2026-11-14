import { numeroComZeros } from "./regras.mjs";

/** Resolve a gravura WebP pelo grupo tradicional e pelo nome do animal. */
export function urlDaGravura({ grupo, nome }) {
  const arquivo = nome.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  return new URL(`./assets/bichos/${numeroComZeros(grupo)}-${arquivo}.webp`, import.meta.url);
}
