import { ApiError } from "../api/client";
import {
  coverProblem,
  eventSaveProblem,
  publishProblem,
  ticketTypeSaveProblem,
} from "./event-errors";

const apiError = (status: number, code: string, body: Record<string, unknown> = {}) =>
  new ApiError(status, code, "", { code, ...body });
const network = new ApiError(0, "network_error", "", null);

describe("eventSaveProblem", () => {
  it("turns the API's date and capacity rules into the field's error", () => {
    expect(eventSaveProblem(apiError(422, "event_starts_in_past"))).toEqual({
      kind: "field",
      field: "startDate",
      message: "Já passou. Use uma data futura.",
    });
    expect(eventSaveProblem(apiError(422, "event_ends_before_start"))).toEqual({
      kind: "field",
      field: "endDate",
      message: "O término precisa ser depois do início.",
    });
    expect(eventSaveProblem(apiError(422, "ticket_quantity_exceeds_capacity"), 150)).toEqual({
      kind: "field",
      field: "capacity",
      message: "Os tipos já somam 150 lugares. Use 150 ou mais.",
    });
  });

  it("points 400 invalid_event at the first field it knows", () => {
    expect(eventSaveProblem(apiError(400, "invalid_event", { fields: ["name"] }))).toEqual({
      kind: "field",
      field: "name",
      message: "Escreva o nome do evento.",
    });
    expect(
      eventSaveProblem(apiError(400, "invalid_event", { fields: ["refundPolicy", "capacity"] })),
    ).toMatchObject({ field: "capacity", message: "Informe quantas pessoas o evento comporta." });
    expect(eventSaveProblem(apiError(400, "invalid_event", { fields: ["cityCode"] }))).toEqual({
      kind: "failed",
    });
  });

  it("knows an event that is gone, and leaves the rest to the toast", () => {
    expect(eventSaveProblem(apiError(404, "event_not_found"))).toEqual({ kind: "gone" });
    expect(eventSaveProblem(network)).toEqual({ kind: "failed" });
    expect(eventSaveProblem(apiError(503, "http_503"))).toEqual({ kind: "failed" });
    expect(eventSaveProblem(apiError(409, "event_cancelled"))).toEqual({ kind: "failed" });
  });
});

describe("ticketTypeSaveProblem", () => {
  const rules = { minimumCents: 6000, fits: 180 };

  it("says the minimum the API answered", () => {
    expect(
      ticketTypeSaveProblem(
        apiError(422, "ticket_price_below_minimum", { minimumCents: 7000 }),
        rules,
      ),
    ).toEqual({ kind: "field", field: "price", message: "O mínimo é R$ 70,00." });
    expect(ticketTypeSaveProblem(apiError(422, "ticket_price_below_minimum"), rules)).toMatchObject(
      { message: "O mínimo é R$ 60,00." },
    );
  });

  it("says what fits, and that the quantity cannot go below what was sold", () => {
    expect(ticketTypeSaveProblem(apiError(422, "ticket_quantity_exceeds_capacity"), rules)).toEqual(
      {
        kind: "field",
        field: "quantity",
        message: "Passa da capacidade: use até 180.",
      },
    );
    expect(ticketTypeSaveProblem(apiError(409, "ticket_quantity_below_committed"), rules)).toEqual({
      kind: "field",
      field: "quantity",
      message: "Não pode ficar abaixo do que já foi vendido ou reservado.",
    });
  });

  it("points 400 invalid_ticket_type at its field, and leaves the rest to the toast", () => {
    expect(
      ticketTypeSaveProblem(apiError(400, "invalid_ticket_type", { fields: ["name"] }), rules),
    ).toMatchObject({ field: "name", message: "Escreva o nome do tipo." });
    expect(ticketTypeSaveProblem(network, rules)).toEqual({ kind: "failed" });
  });
});

describe("publishProblem", () => {
  it("reads the producer again when it is not ready", () => {
    expect(publishProblem(apiError(409, "producer_not_ready"))).toBe("producer");
  });

  it("reads the event again when it misses something", () => {
    for (const code of [
      "event_not_publishable",
      "event_without_ticket_types",
      "event_starts_in_past",
      "ticket_quantity_exceeds_capacity",
    ]) {
      expect(publishProblem(apiError(422, code, { missing: ["cover"] }))).toBe("event");
    }
  });

  it("offers to try again on the network and 5xx", () => {
    expect(publishProblem(network)).toBe("failed");
    expect(publishProblem(apiError(500, "http_500"))).toBe("failed");
  });
});

describe("coverProblem", () => {
  it("is Erro no arquivo for an image refused, the toast for the rest", () => {
    expect(coverProblem(apiError(422, "invalid_cover"))).toBe("refused");
    expect(coverProblem(apiError(400, "invalid_cover_request"))).toBe("refused");
    expect(coverProblem(apiError(503, "cover_storage_unavailable"))).toBe("failed");
    expect(coverProblem(network)).toBe("failed");
  });
});
