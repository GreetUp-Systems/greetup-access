import type { ProducerProfile } from "../api/producer";
import type { EventDetail } from "../api/producer-events";
import {
  pendingSummary,
  publicationTitle,
  publishBlockReason,
  publishRequirements,
  verificationRequirement,
} from "./publication";

const now = new Date("2026-10-01T12:00:00.000Z");

const ready: ProducerProfile = {
  id: "p1",
  displayName: "Casa Fluida",
  onboardingStatus: "ready",
  compliance: { status: "approved", hasOpenRfi: false },
  stellar: { status: "active" },
};

const producer = (fields: Partial<ProducerProfile>): ProducerProfile => ({ ...ready, ...fields });
const pending = (status: ProducerProfile["compliance"]["status"]) => ({
  onboardingStatus: "compliance_pending" as const,
  compliance: { status, hasOpenRfi: status === "compliance_request" },
});

const event: EventDetail = {
  id: "e1",
  slug: "festival-de-inverno",
  name: "Festival de Inverno",
  description: null,
  category: "festivals",
  coverUrl: "https://covers.test/e1.png",
  venueName: "Casa Fluida",
  city: { code: 3550308, name: "São Paulo", uf: "SP" },
  address: null,
  startsAt: "2026-10-13T00:00:00.000Z",
  endsAt: null,
  capacity: 300,
  refundPolicy: null,
  status: "draft",
  publishedAt: null,
  cancelledAt: null,
  createdAt: "2026-09-01T12:00:00.000Z",
  updatedAt: "2026-09-01T12:00:00.000Z",
  ticketTypes: [
    { id: "t1", name: "Pista", description: null, priceCents: 12000, quantity: 120 },
    { id: "t2", name: "Camarote", description: null, priceCents: 24000, quantity: 30 },
  ],
  ticketMinPriceCents: 6000,
};

describe("verificationRequirement (E6), in the order of the table", () => {
  it("is done when the producer is ready", () => {
    expect(verificationRequirement(ready)).toMatchObject({
      state: "done",
      title: "Verificação aprovada",
      detail: null,
      action: null,
    });
  });

  it("leads a receiving account with an error to the Recebimento, before anything else", () => {
    expect(
      verificationRequirement(
        producer({ ...pending("compliance_request"), stellar: { status: "failed" } }),
      ),
    ).toMatchObject({
      state: "missing",
      title: "Conta de recebimento com erro",
      detail: "Prepare a conta de novo no Recebimento.",
      action: { label: "Resolver", target: { kind: "receiving" } },
      reason: "a conta de recebimento ficar pronta",
    });
  });

  it("asks to answer BlindPay's request and to correct a refusal", () => {
    expect(verificationRequirement(producer(pending("compliance_request")))).toMatchObject({
      state: "missing",
      title: "Pedido de informações da BlindPay",
      detail: "Responda para a verificação seguir.",
      action: { label: "Responder" },
    });
    expect(verificationRequirement(producer(pending("rejected")))).toMatchObject({
      state: "missing",
      title: "Verificação recusada",
      detail: "Corrija os dados e envie de novo.",
      action: { label: "Corrigir" },
    });
  });

  it("waits on BlindPay's analysis and on the release, with nothing to do", () => {
    expect(verificationRequirement(producer(pending("verifying")))).toMatchObject({
      state: "waiting",
      title: "Verificação em análise",
      detail: "Publicar fica liberado quando a BlindPay aprovar.",
      action: null,
      reason: "a verificação ser aprovada",
    });
    for (const fields of [
      { onboardingStatus: "wallet_registration_pending" as const },
      { onboardingStatus: "stellar_pending" as const, stellar: { status: "submitted" as const } },
      {
        onboardingStatus: "wallet_registration_pending" as const,
        compliance: { status: "approved_rfi" as const, hasOpenRfi: true },
      },
    ]) {
      expect(verificationRequirement(producer(fields))).toMatchObject({
        state: "waiting",
        title: "Liberando o recebimento",
        detail: "Publicar fica liberado em instantes.",
        reason: "o recebimento ser liberado",
      });
    }
  });

  it("asks to finish the setup when nothing was sent", () => {
    expect(verificationRequirement(producer(pending(null)))).toMatchObject({
      state: "missing",
      title: "Verificação pendente",
      detail: "Termine a configuração do recebimento.",
      action: { label: "Configurar", target: { kind: "receiving" } },
    });
  });
});

describe("publishRequirements", () => {
  it("are all done for a ready producer and a complete event (591:12579)", () => {
    const requirements = publishRequirements(event, ready, now);
    expect(requirements.map((requirement) => [requirement.title, requirement.state])).toEqual([
      ["Verificação aprovada", "done"],
      ["Capa do evento", "done"],
      ["Categoria e cidade", "done"],
      ["Pelo menos um tipo de ingresso", "done"],
      ["Data no futuro", "done"],
      ["Tipos dentro da capacidade", "done"],
    ]);
    expect(requirements[5]!.detail).toBe("150 de 300 lugares");
    expect(publicationTitle(requirements)).toBe("Pronto para publicar");
    expect(pendingSummary(requirements)).toBe("Todos os requisitos estão cumpridos.");
    expect(publishBlockReason(requirements)).toBeNull();
  });

  it("say what is missing and why the button is disabled (595:13914)", () => {
    const requirements = publishRequirements(
      { ...event, coverUrl: null },
      producer(pending("verifying")),
      now,
    );
    expect(requirements[1]).toMatchObject({
      state: "missing",
      detail: "Falta enviar a capa.",
      action: { label: "Enviar capa", target: { kind: "section", section: "capa" } },
    });
    expect(publicationTitle(requirements)).toBe("Faltam 2 itens para publicar");
    expect(pendingSummary(requirements)).toBe("Verificação em análise e capa do evento.");
    expect(publishBlockReason(requirements)).toBe(
      "Falta a verificação ser aprovada e a capa do evento.",
    );
  });

  it("name only the category or the city that is missing, and lead to its section", () => {
    const noCity = publishRequirements({ ...event, city: null }, ready, now);
    expect(noCity[2]).toMatchObject({
      state: "missing",
      action: { target: { kind: "section", section: "local" } },
    });
    expect(publishBlockReason(noCity)).toBe("Falta a cidade.");
    expect(publicationTitle(noCity)).toBe("Falta 1 item para publicar");

    const noCategory = publishRequirements({ ...event, category: null }, ready, now);
    expect(noCategory[2]!.action?.target).toEqual({ kind: "section", section: "nome" });
    expect(publishBlockReason(noCategory)).toBe("Falta a categoria.");

    expect(
      publishBlockReason(publishRequirements({ ...event, category: null, city: null }, ready, now)),
    ).toBe("Falta a categoria e a cidade.");
  });

  it("need a type, a date in the future and the types within the capacity", () => {
    const requirements = publishRequirements(
      { ...event, ticketTypes: [], startsAt: "2026-09-01T00:00:00.000Z" },
      producer({ onboardingStatus: "wallet_registration_pending" }),
      now,
    );
    expect(publishBlockReason(requirements)).toBe(
      "Falta o recebimento ser liberado, um tipo de ingresso e uma data no futuro.",
    );
    expect(pendingSummary(requirements)).toBe(
      "Liberando o recebimento, pelo menos um tipo de ingresso e data no futuro.",
    );

    const crowded = publishRequirements({ ...event, capacity: 100 }, ready, now);
    expect(crowded[5]).toMatchObject({
      state: "missing",
      detail: "150 de 100 lugares",
      action: { target: { kind: "section", section: "ingressos" } },
    });
    expect(publishBlockReason(crowded)).toBe("Falta os tipos caberem na capacidade.");
  });
});
