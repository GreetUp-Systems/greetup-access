import { ProducerContextNotFoundError } from "@access/database";

import { type UserWithWallet, UsersRepository } from "../users/users.repository";
import { ProducerSalesRepository } from "./producer-sales.repository";
import { ProducerSalesService } from "./producer-sales.service";
import { calendarDays, salesDate } from "./producer-sales.types";

const principal = { privyUserId: "did:privy:producer", sessionId: "session", accessToken: "jwt" };
const user = { id: "00000000-0000-4000-8000-000000000001", wallet: {} } as UserWithWallet;

describe("sales dates", () => {
  it("takes the calendar day in Brasília, not in UTC", () => {
    expect(salesDate(new Date("2026-10-08T02:59:00Z"))).toBe("2026-10-07");
    expect(salesDate(new Date("2026-10-08T03:00:00Z"))).toBe("2026-10-08");
  });

  it("lists consecutive days ending at the given one, across months and years", () => {
    expect(calendarDays("2026-03-01", 3)).toEqual(["2026-02-27", "2026-02-28", "2026-03-01"]);
    expect(calendarDays("2027-01-01", 2)).toEqual(["2026-12-31", "2027-01-01"]);
  });
});

describe("ProducerSalesService", () => {
  let repository: jest.Mocked<Pick<ProducerSalesRepository, "dailySales" | "recentSales">>;
  let service: ProducerSalesService;

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date("2026-10-08T12:00:00Z") });
    repository = { dailySales: jest.fn().mockResolvedValue([]), recentSales: jest.fn() };
    service = new ProducerSalesService(
      { findByPrivyUserId: jest.fn().mockResolvedValue(user) } as unknown as UsersRepository,
      repository as unknown as ProducerSalesRepository,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("reads twice the period and splits it into the current and the previous one", async () => {
    repository.dailySales.mockResolvedValue([
      { day: "2026-09-25", tickets: 1, salesCents: 8_000 },
      { day: "2026-10-01", tickets: 2, salesCents: 16_000 },
      { day: "2026-10-02", tickets: 3, salesCents: 24_000 },
      { day: "2026-10-08", tickets: 1, salesCents: 9_000 },
    ]);

    const summary = await service.summary(principal, { period: "7d" });

    expect(repository.dailySales).toHaveBeenCalledWith(user.id, "2026-09-25", "2026-10-08");
    expect(summary).toMatchObject({
      period: "7d",
      tickets: 4,
      salesCents: 33_000,
      previous: { tickets: 3, salesCents: 24_000 },
    });
    expect(summary.daily.map((day) => day.date)).toEqual(calendarDays("2026-10-08", 7));
    expect(summary.daily[0]).toEqual({ date: "2026-10-02", tickets: 3, salesCents: 24_000 });
    expect(summary.daily[3]).toEqual({ date: "2026-10-05", tickets: 0, salesCents: 0 });
  });

  it("refuses an unknown period and reports a missing producer profile", async () => {
    await expect(service.summary(principal, { period: "1y" })).rejects.toMatchObject({
      response: { code: "invalid_sales_query", fields: ["period"] },
    });

    repository.dailySales.mockRejectedValue(new ProducerContextNotFoundError());
    await expect(service.summary(principal, { period: "30d" })).rejects.toMatchObject({
      response: { code: "producer_not_found" },
    });
  });

  it("returns recent sales with only event, type, quantity, subtotal and date", async () => {
    repository.recentSales.mockResolvedValue([
      {
        quantity: 2,
        subtotalCents: 16_000,
        paymentConfirmedAt: new Date("2026-10-07T03:30:00Z"),
        event: { name: "Festival Access" },
        ticketType: { name: "Pista" },
      },
    ]);

    await expect(service.recent(principal, {})).resolves.toEqual([
      {
        eventName: "Festival Access",
        ticketTypeName: "Pista",
        quantity: 2,
        subtotalCents: 16_000,
        confirmedAt: "2026-10-07T03:30:00.000Z",
      },
    ]);
    expect(repository.recentSales).toHaveBeenCalledWith(user.id, 5);

    await service.recent(principal, { limit: "20" });
    expect(repository.recentSales).toHaveBeenLastCalledWith(user.id, 20);
    for (const limit of ["0", "21", "abc", "1.5"]) {
      await expect(service.recent(principal, { limit })).rejects.toMatchObject({
        response: { code: "invalid_sales_query" },
      });
    }
  });
});
