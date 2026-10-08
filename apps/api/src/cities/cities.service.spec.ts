import { CitiesRepository } from "./cities.repository";
import { CitiesService, normalizeCityName } from "./cities.service";

describe("normalizeCityName", () => {
  it("drops accents and case, and tidies spaces and typographic apostrophes", () => {
    expect(normalizeCityName("  São   João  ")).toBe("sao joao");
    expect(normalizeCityName("Guajará-Mirim")).toBe("guajara-mirim");
    expect(normalizeCityName("Olho D’Água")).toBe("olho d'agua");
    expect(normalizeCityName("ITAPIRANGA")).toBe("itapiranga");
  });
});

describe("CitiesService", () => {
  let repository: jest.Mocked<Pick<CitiesRepository, "search">>;
  let service: CitiesService;

  beforeEach(() => {
    repository = {
      search: jest.fn().mockResolvedValue([{ ibgeCode: 3550308, name: "São Paulo", uf: "SP" }]),
    };
    service = new CitiesService(repository as unknown as CitiesRepository);
  });

  it("searches the normalized term, ten at most, and answers code, name and UF", async () => {
    await expect(service.search({ query: "São Pau" })).resolves.toEqual([
      { code: 3550308, name: "São Paulo", uf: "SP" },
    ]);
    expect(repository.search).toHaveBeenCalledWith("sao pau", 10);
  });

  it.each([
    {},
    { query: "s" },
    { query: " á " },
    { query: ["sa", "pa"] },
    { query: "x".repeat(81) },
  ])("refuses a search without two letters (%#)", async (query) => {
    await expect(service.search(query)).rejects.toMatchObject({
      response: { code: "invalid_city_query" },
    });
    expect(repository.search).not.toHaveBeenCalled();
  });

  it("answers nothing for characters no city name has, without querying", async () => {
    await expect(service.search({ query: "sa%" })).resolves.toEqual([]);
    await expect(service.search({ query: "s_o" })).resolves.toEqual([]);
    expect(repository.search).not.toHaveBeenCalled();
  });
});
