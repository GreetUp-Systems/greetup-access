import {
  confirmCover,
  CoverUploadError,
  createEvent,
  createTicketType,
  getEvent,
  publishEvent,
  requestCoverUpload,
  searchCities,
  updateEvent,
  updateTicketType,
  uploadCover,
} from "./producer-events";

function respond(status: number, body: unknown): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const eventId = "6f1c2c8e-8a43-4c47-9d0a-1d2f3e4a5b6c";

describe("producer events API", () => {
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => Promise.resolve(respond(200, { id: eventId })));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  function request(index = 0): { url: string; method: string | undefined; body: unknown } {
    const [url, init] = fetchMock.mock.calls[index]!;
    return {
      url: String(url),
      method: init?.method,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body,
    };
  }

  it("creates the draft with its three passos", async () => {
    const input = {
      name: "Festival de Inverno",
      category: "festivals" as const,
      startsAt: "2026-12-12T21:00:00-03:00",
      capacity: 300,
    };
    await createEvent("tok", input);
    expect(request()).toEqual({ url: "http://api.test/api/events", method: "POST", body: input });
  });

  it("reads, changes and publishes an event by its id", async () => {
    await getEvent("tok", eventId);
    await updateEvent("tok", eventId, { endsAt: null, cityCode: 3509502 });
    await publishEvent("tok", eventId);

    expect(request(0)).toMatchObject({
      url: `http://api.test/api/events/${eventId}`,
      method: "GET",
    });
    expect(request(1)).toEqual({
      url: `http://api.test/api/events/${eventId}`,
      method: "PATCH",
      body: { endsAt: null, cityCode: 3509502 },
    });
    expect(request(2)).toMatchObject({
      url: `http://api.test/api/events/${eventId}/publish`,
      method: "POST",
    });
  });

  it("creates and changes ticket types", async () => {
    await createTicketType("tok", eventId, { name: "Pista", priceCents: 12000, quantity: 120 });
    await updateTicketType("tok", eventId, "type-1", { quantity: 100 });

    expect(request(0)).toEqual({
      url: `http://api.test/api/events/${eventId}/ticket-types`,
      method: "POST",
      body: { name: "Pista", priceCents: 12000, quantity: 120 },
    });
    expect(request(1)).toEqual({
      url: `http://api.test/api/events/${eventId}/ticket-types/type-1`,
      method: "PATCH",
      body: { quantity: 100 },
    });
  });

  it("asks for the cover's URL and confirms its key with PUT", async () => {
    await requestCoverUpload("tok", eventId, "image/png");
    await confirmCover("tok", eventId, `events/${eventId}/cover.png`);

    expect(request(0)).toEqual({
      url: `http://api.test/api/events/${eventId}/cover/upload-url`,
      method: "POST",
      body: { contentType: "image/png" },
    });
    expect(request(1)).toEqual({
      url: `http://api.test/api/events/${eventId}/cover`,
      method: "PUT",
      body: { key: `events/${eventId}/cover.png` },
    });
  });

  it("searches the cities with the query encoded", async () => {
    fetchMock.mockResolvedValue(respond(200, [{ code: 3509502, name: "Campinas", uf: "SP" }]));
    await expect(searchCities("tok", "são jo")).resolves.toEqual([
      { code: 3509502, name: "Campinas", uf: "SP" },
    ]);
    expect(request().url).toBe("http://api.test/api/cities?query=s%C3%A3o%20jo");
  });
});

// A stand-in for the browser's XMLHttpRequest: the test plays the upload's events.
class FakeRequest {
  static last: FakeRequest | null = null;
  method = "";
  url = "";
  headers: Record<string, string> = {};
  body: unknown = null;
  status = 0;
  aborted = false;
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor() {
    FakeRequest.last = this;
  }
  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string): void {
    this.headers[name] = value;
  }
  send(body: unknown): void {
    this.body = body;
  }
  abort(): void {
    this.aborted = true;
    this.onabort?.();
  }
  progress(loaded: number, total: number): void {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total } as ProgressEvent);
  }
  finish(status: number): void {
    this.status = status;
    this.onload?.();
  }
}

describe("uploadCover", () => {
  const original = globalThis.XMLHttpRequest;
  beforeEach(() => {
    FakeRequest.last = null;
    globalThis.XMLHttpRequest = FakeRequest as unknown as typeof XMLHttpRequest;
  });
  afterAll(() => {
    globalThis.XMLHttpRequest = original;
  });

  const file = new Blob(["png"], { type: "image/png" });

  it("PUTs the file with the signed type and reports the progress", async () => {
    const progress: number[] = [];
    const done = uploadCover("https://r2.test/put", file, "image/png", (p) => progress.push(p));
    const request = FakeRequest.last!;
    expect(request).toMatchObject({
      method: "PUT",
      url: "https://r2.test/put",
      headers: { "Content-Type": "image/png" },
      body: file,
    });
    request.progress(1, 5);
    request.progress(5, 5);
    request.finish(200);
    await expect(done).resolves.toBeUndefined();
    expect(progress).toEqual([20, 100, 100]);
  });

  it("rejects an answer R2 refused, and a request that never got one", async () => {
    const refused = uploadCover("https://r2.test/put", file, "image/png", () => undefined);
    FakeRequest.last!.finish(403);
    await expect(refused).rejects.toEqual(new CoverUploadError(403));

    const offline = uploadCover("https://r2.test/put", file, "image/png", () => undefined);
    FakeRequest.last!.onerror?.();
    await expect(offline).rejects.toMatchObject({ status: 0 });
  });

  it("stops when its signal aborts", async () => {
    const controller = new AbortController();
    const upload = uploadCover(
      "https://r2.test/put",
      file,
      "image/png",
      () => undefined,
      controller.signal,
    );
    controller.abort();
    await expect(upload).rejects.toMatchObject({ name: "AbortError" });
    expect(FakeRequest.last!.aborted).toBe(true);
  });
});
