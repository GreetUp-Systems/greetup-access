import { type CityRecord } from "./cities.repository";

/** A municipality from the IBGE base (SPEC-015 E3); `code` is the IBGE code. */
export interface CityView {
  code: number;
  name: string;
  uf: string;
}

export const citySearchLimit = 10;

/** An event's city as the API answers it, null for an event without a city (D-30). */
export function toCityView(city: CityRecord | null): CityView | null {
  return city === null ? null : { code: city.ibgeCode, name: city.name, uf: city.uf };
}
