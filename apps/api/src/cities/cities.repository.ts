import { PrismaService } from "@access/database";
import { Injectable } from "@nestjs/common";

export interface CityRecord {
  ibgeCode: number;
  name: string;
  uf: string;
}

/** Reference data without tenant: no RLS, read-only for the API role. */
@Injectable()
export class CitiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cities whose name, or a word in it, starts with `term`. The term is already normalized to
   * letters, spaces, hyphens and apostrophes, so it carries no LIKE wildcard.
   */
  search(term: string, limit: number): Promise<CityRecord[]> {
    return this.prisma.$queryRaw<CityRecord[]>`
      SELECT "ibge_code" AS "ibgeCode", "name", "uf"
      FROM "cities"
      WHERE "search_name" LIKE ${`${term}%`}
        OR "search_name" LIKE ${`% ${term}%`}
        OR "search_name" LIKE ${`%-${term}%`}
        OR "search_name" LIKE ${`%'${term}%`}
      ORDER BY "search_name", "uf"
      LIMIT ${limit}
    `;
  }

  async exists(ibgeCode: number): Promise<boolean> {
    return (await this.prisma.city.count({ where: { ibgeCode } })) > 0;
  }
}
