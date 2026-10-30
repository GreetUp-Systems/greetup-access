import { brazilianUfs, isBrazilianUf, lookupCep } from "./cep";

function answer(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ViaCEP's answer for 01310-100.
const paulista = {
  cep: "01310-100",
  logradouro: "Avenida Paulista",
  complemento: "de 612 a 1510 - lado par",
  unidade: "",
  bairro: "Bela Vista",
  localidade: "São Paulo",
  uf: "SP",
  estado: "São Paulo",
  regiao: "Sudeste",
  ibge: "3550308",
  gia: "1004",
  ddd: "11",
  siafi: "7107",
};

/** A fetch that only ends when its request is aborted, as a hung connection. */
function hangingFetch(_url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () =>
      reject(new DOMException("The operation was aborted.", "AbortError")),
    );
  });
}

describe("lookupCep", () => {
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it("fills street, neighborhood, city and state from the CEP", async () => {
    fetchMock.mockResolvedValue(answer(paulista));

    await expect(lookupCep("01310-100")).resolves.toEqual({
      status: "found",
      address: {
        street: "Avenida Paulista",
        neighborhood: "Bela Vista",
        city: "São Paulo",
        uf: "SP",
      },
    });
  });

  it("sends only the CEP: no cookie, no referrer", async () => {
    fetchMock.mockResolvedValue(answer(paulista));

    await lookupCep("01310-100");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://viacep.com.br/ws/01310100/json/");
    expect(init).toMatchObject({ credentials: "omit", referrerPolicy: "no-referrer" });
    expect(init?.method).toBeUndefined();
    expect(init?.body).toBeUndefined();
  });

  it("leaves street and neighborhood empty for a CEP of a whole city", async () => {
    fetchMock.mockResolvedValue(
      answer({
        ...paulista,
        cep: "78175-000",
        logradouro: "",
        bairro: " ",
        localidade: "Poconé",
        uf: "MT",
      }),
    );

    await expect(lookupCep("78175000")).resolves.toEqual({
      status: "found",
      address: { street: null, neighborhood: null, city: "Poconé", uf: "MT" },
    });
  });

  it("reads ViaCEP's erro as a CEP not found, as a boolean or as a string", async () => {
    fetchMock.mockResolvedValueOnce(answer({ erro: true }));
    fetchMock.mockResolvedValueOnce(answer({ erro: "true" }));

    await expect(lookupCep("01319-100")).resolves.toEqual({ status: "not_found" });
    await expect(lookupCep("01319-100")).resolves.toEqual({ status: "not_found" });
  });

  it("does not ask for a CEP without its 8 digits", async () => {
    await expect(lookupCep("01310-10")).resolves.toEqual({ status: "not_found" });
    await expect(lookupCep("")).resolves.toEqual({ status: "not_found" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails when the network fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(lookupCep("01310-100")).resolves.toEqual({ status: "failed" });
  });

  it("fails on an error status", async () => {
    fetchMock.mockResolvedValueOnce(answer({ message: "unavailable" }, 503));
    fetchMock.mockResolvedValueOnce(new Response("<h1>Bad Request</h1>", { status: 400 }));

    await expect(lookupCep("01310-100")).resolves.toEqual({ status: "failed" });
    await expect(lookupCep("01310-100")).resolves.toEqual({ status: "failed" });
  });

  it("fails on an answer that is not JSON or not an address", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>maintenance</html>", { status: 200 }));
    fetchMock.mockResolvedValueOnce(answer([paulista]));
    fetchMock.mockResolvedValueOnce(answer({ ...paulista, localidade: "" }));
    fetchMock.mockResolvedValueOnce(answer({ ...paulista, uf: "XX" }));
    fetchMock.mockResolvedValueOnce(answer(null));

    for (let index = 0; index < 5; index += 1) {
      await expect(lookupCep("01310-100")).resolves.toEqual({ status: "failed" });
    }
  });

  it("fails after the timeout", async () => {
    fetchMock.mockImplementation(hangingFetch);

    await expect(lookupCep("01310-100", { timeoutMs: 20 })).resolves.toEqual({ status: "failed" });
  });

  it("rejects with the abort when the caller cancels, typed again or left", async () => {
    fetchMock.mockImplementation(hangingFetch);
    const controller = new AbortController();

    const lookup = lookupCep("01310-100", { signal: controller.signal });
    controller.abort();

    await expect(lookup).rejects.toMatchObject({ name: "AbortError" });
  });

  it("does not ask when the caller had already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(lookupCep("01310-100", { signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("brazilianUfs", () => {
  it("lists the 27 federative units", () => {
    expect(brazilianUfs).toHaveLength(27);
    expect(new Set(brazilianUfs).size).toBe(27);
    expect(isBrazilianUf("DF")).toBe(true);
    expect(isBrazilianUf("sp")).toBe(false);
    expect(isBrazilianUf(35)).toBe(false);
  });
});
