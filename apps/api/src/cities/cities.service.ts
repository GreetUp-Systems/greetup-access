import { BadRequestException, Injectable } from "@nestjs/common";
import { z } from "zod";

import { CitiesRepository } from "./cities.repository";
import { citySearchLimit, type CityView } from "./cities.types";

const citySearchQuerySchema = z.object({ query: z.string().max(80) }).strict();
const searchableTerm = /^[a-z' -]+$/;

/** The same normalization that filled `cities.search_name`: no accents, lower case. */
export function normalizeCityName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[‘’]/g, "'")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

@Injectable()
export class CitiesService {
  constructor(private readonly cities: CitiesRepository) {}

  async search(query: unknown): Promise<CityView[]> {
    const result = citySearchQuerySchema.safeParse(query);
    const term = result.success ? normalizeCityName(result.data.query) : "";
    if (term.length < 2) {
      throw new BadRequestException({
        code: "invalid_city_query",
        message: "The search needs at least two letters.",
        fields: ["query"],
      });
    }
    // No city name has other characters, so nothing would match.
    if (!searchableTerm.test(term)) {
      return [];
    }
    const cities = await this.cities.search(term, citySearchLimit);
    return cities.map((city) => ({ code: city.ibgeCode, name: city.name, uf: city.uf }));
  }
}
