import { Controller, Get, Query } from "@nestjs/common";

import { CitiesService } from "./cities.service";
import { type CityView } from "./cities.types";

@Controller("cities")
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  @Get()
  search(@Query() query: unknown): Promise<CityView[]> {
    return this.citiesService.search(query);
  }
}
