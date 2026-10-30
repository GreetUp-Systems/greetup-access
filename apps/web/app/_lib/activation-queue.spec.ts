import {
  activateAndConfirm,
  type ActivationRoutes,
  type ConfirmedActivation,
  type SignStellarHash,
  type StellarActivationView,
} from "./account-activation";
import { createActivationQueue } from "./activation-queue";
import { ApiError } from "./api/client";

/** A promise settled from outside, to hold a task where the test wants it. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Lets every pending callback run, so "not called yet" means it is really waiting.
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe("createActivationQueue", () => {
  it("starts the next activation only after the previous one ended", async () => {
    const queue = createActivationQueue<string>();
    const first = deferred<string>();
    const second = jest.fn(() => Promise.resolve("producer"));

    const account = queue.run("account", () => first.promise);
    const producer = queue.run("producer", second);
    await settle();
    expect(second).not.toHaveBeenCalled();

    first.resolve("account");
    await expect(account).resolves.toBe("account");
    await expect(producer).resolves.toBe("producer");
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("lets the next one run when the previous failed", async () => {
    const queue = createActivationQueue<string>();
    const failure = new ApiError(503, "account_activation_failed", "", null);

    const account = queue.run("account", () => Promise.reject(failure));
    const producer = queue.run("producer", () => Promise.resolve("producer"));

    await expect(account).rejects.toBe(failure);
    await expect(producer).resolves.toBe("producer");
  });

  it("joins an activation asked again while it waits or runs, without running it twice", async () => {
    const queue = createActivationQueue<string>();
    const running = deferred<string>();
    const task = jest.fn(() => running.promise);

    const first = queue.run("producer", task);
    const again = queue.run("producer", task);
    await settle();

    expect(again).toBe(first);
    expect(task).toHaveBeenCalledTimes(1);
    running.resolve("done");
    await expect(again).resolves.toBe("done");
  });

  it("runs the same activation anew once the previous run ended", async () => {
    const queue = createActivationQueue<string>();
    const task = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(new Error("user closed Privy"))
      .mockResolvedValueOnce("done");

    await expect(queue.run("producer", task)).rejects.toThrow("user closed Privy");
    await expect(queue.run("producer", task)).resolves.toBe("done");
    expect(task).toHaveBeenCalledTimes(2);
  });
});

describe("the buyer's and the producer's activations in the queue (SPEC-015 R7)", () => {
  const hash = "a".repeat(64);
  const getToken = (): Promise<string> => Promise.resolve("tok");
  const signature = `0x${"b".repeat(128)}` as const;

  // Every step of both activations, in the order they happened.
  let log: string[];
  beforeEach(() => {
    log = [];
  });

  function routes(name: string, prepared: Array<() => Promise<StellarActivationView>>) {
    const routesOf: ActivationRoutes = {
      prepare: () => {
        log.push(`${name}:prepare`);
        const next = prepared.shift();
        return next === undefined ? Promise.reject(new Error("no answer")) : next();
      },
      submitSignature: () => {
        log.push(`${name}:submit`);
        return Promise.resolve({ status: "submitted", transactionHash: hash });
      },
    };
    return routesOf;
  }

  const signer =
    (name: string): SignStellarHash =>
    () => {
      log.push(`${name}:sign`);
      return Promise.resolve(signature);
    };

  const signing = (): Promise<StellarActivationView> =>
    Promise.resolve({ status: "signing", hashToSign: hash });
  const submitted = (): Promise<StellarActivationView> =>
    Promise.resolve({ status: "submitted", transactionHash: hash });
  const active = (): Promise<StellarActivationView> =>
    Promise.resolve({ status: "active", transactionHash: hash });

  it("prepares the producer's account only after the network confirmed the buyer's", async () => {
    const queue = createActivationQueue<ConfirmedActivation>();
    const confirmation = deferred<void>();
    const wait = jest.fn(() => confirmation.promise);

    const account = queue.run("account", () =>
      activateAndConfirm(routes("account", [signing, active]), getToken, signer("account"), {
        wait,
      }),
    );
    const producer = queue.run("producer", () =>
      activateAndConfirm(routes("producer", [signing, active]), getToken, signer("producer"), {
        wait,
      }),
    );
    await settle();
    // The buyer's transaction is submitted, not yet in the ledger: the producer's waits.
    expect(log).toEqual(["account:prepare", "account:sign", "account:submit"]);

    confirmation.resolve();
    await expect(account).resolves.toEqual({ status: "active", transactionHash: hash });
    await expect(producer).resolves.toEqual({ status: "active", transactionHash: hash });
    expect(log).toEqual([
      "account:prepare",
      "account:sign",
      "account:submit",
      "account:prepare",
      "producer:prepare",
      "producer:sign",
      "producer:submit",
      "producer:prepare",
    ]);
  });

  it("asks the wallet once when the producer's activation is asked twice", async () => {
    const queue = createActivationQueue<ConfirmedActivation>();
    const producerRoutes = routes("producer", [signing, active]);
    const run = () =>
      queue.run("producer", () =>
        activateAndConfirm(producerRoutes, getToken, signer("producer"), {
          wait: () => Promise.resolve(),
        }),
      );

    const [first, second] = await Promise.all([run(), run()]);

    expect(first).toEqual({ status: "active", transactionHash: hash });
    expect(second).toBe(first);
    expect(log.filter((step) => step.endsWith(":sign"))).toEqual(["producer:sign"]);
  });

  it("lets the producer's activation run when the buyer's ends in error", async () => {
    const queue = createActivationQueue<ConfirmedActivation>();
    const failure = new ApiError(502, "account_activation_failed", "", null);

    const account = queue.run("account", () =>
      activateAndConfirm(
        routes("account", [() => Promise.reject(failure)]),
        getToken,
        signer("account"),
      ),
    );
    const producer = queue.run("producer", () =>
      activateAndConfirm(routes("producer", [submitted, active]), getToken, signer("producer"), {
        wait: () => Promise.resolve(),
      }),
    );

    await expect(account).rejects.toBe(failure);
    await expect(producer).resolves.toEqual({ status: "active", transactionHash: hash });
    expect(log).toEqual(["account:prepare", "producer:prepare", "producer:prepare"]);
  });
});
