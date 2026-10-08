/** A municipality from the IBGE base (SPEC-015 E3); `code` is the IBGE code. */
export interface CityView {
  code: number;
  name: string;
  uf: string;
}

export const citySearchLimit = 10;
