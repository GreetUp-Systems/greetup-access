import {
  detailsHref,
  editHref,
  eventHref,
  eventStages,
  newEventStepHref,
  publicEventPath,
  resolvePasso,
} from "./event-flow";

describe("the event's addresses", () => {
  it("give each passo and each edition its own address", () => {
    expect(newEventStepHref()).toBe("/producer/events/new");
    expect(newEventStepHref(3)).toBe("/producer/events/new?passo=3");
    expect(eventHref("e1")).toBe("/producer/events/e1");
    expect(detailsHref("e1")).toBe("/producer/events/e1/details");
    expect(detailsHref("e1", 4)).toBe("/producer/events/e1/details?passo=4");
    expect(editHref("e1", "data")).toBe("/producer/events/e1?editar=data");
    expect(publicEventPath("festival-de-inverno")).toBe("/e/festival-de-inverno");
  });
});

describe("resolvePasso", () => {
  it("shows a passo once the ones before it are done", () => {
    expect(resolvePasso(1, 0, 3)).toEqual({ kind: "show", passo: 1 });
    expect(resolvePasso(2, 1, 3)).toEqual({ kind: "show", passo: 2 });
    expect(resolvePasso(1, 3, 3)).toEqual({ kind: "show", passo: 1 });
    expect(resolvePasso(3, 3, 3)).toEqual({ kind: "show", passo: 3 });
  });

  it("leads a passo not yet open to the first pending one", () => {
    expect(resolvePasso(3, 0, 3)).toEqual({ kind: "redirect", passo: 1 });
    expect(resolvePasso(4, 1, 4)).toEqual({ kind: "redirect", passo: 2 });
    expect(resolvePasso(9, 4, 4)).toEqual({ kind: "redirect", passo: 4 });
  });
});

describe("eventStages", () => {
  it("shows the draft as the current stage with its passo (586:11098)", () => {
    expect(eventStages("draft", "1 de 3")).toEqual([
      { key: "draft", title: "Rascunho", state: "current", detail: "1 de 3" },
      {
        key: "details",
        title: "Detalhes",
        state: "pending",
        detail: "Local, capa, ingressos e reembolso",
      },
      { key: "publication", title: "Publicação", state: "pending", detail: "Revisar e publicar" },
    ]);
  });

  it("shows the draft saved while the details go (588:11718)", () => {
    expect(eventStages("details", "3 de 4").map((item) => [item.state, item.detail])).toEqual([
      ["done", "Salvo"],
      ["current", "3 de 4"],
      ["pending", "Revisar e publicar"],
    ]);
  });
});
