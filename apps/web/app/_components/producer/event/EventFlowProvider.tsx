"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  confirmCover,
  CoverUploadError,
  createEvent,
  createTicketType,
  type EventDetail,
  getEvent,
  publishEvent,
  requestCoverUpload,
  type TicketType,
  updateEvent,
  type UpdateEventInput,
  updateTicketType,
  uploadCover,
} from "../../../_lib/api/producer-events";
import {
  checkCover,
  type CoverProblem,
  coverContentType,
} from "../../../_lib/producer/event-cover";
import {
  coverProblem,
  eventSaveProblem,
  type EventSaveProblem,
  publishProblem,
  type PublishProblem,
  ticketTypeSaveProblem,
  type TicketTypeSaveProblem,
} from "../../../_lib/producer/event-errors";
import {
  createEventInput,
  type DraftForm,
  draftChanges,
  emptyDraft,
  type LocationForm,
  type TextsForm,
} from "../../../_lib/producer/event-form";
import {
  createTicketTypeInput,
  fitsInCapacity,
  seatsInTypes,
  ticketTypeChanges,
  type TicketTypeForm,
} from "../../../_lib/producer/ticket-types";
import { useSession } from "../../../_lib/session";
import { useProducer } from "../ProducerContext";

/** An event read in this flow: on its way, there, gone (another producer's or deleted), or failed. */
export type EventEntry =
  | { status: "loading" }
  | { status: "ready"; event: EventDetail }
  | { status: "gone" }
  | { status: "failed" };

/**
 * The cover of an event on its way to R2 (SPEC-015 §6): idle (the event's cover, if any, is the
 * one sent), uploading with its progress, the image refused (Erro no arquivo), or a failure of the
 * API that the same file may get past ("Tentar de novo").
 */
export type CoverUploadState =
  | { status: "idle" }
  | { status: "uploading"; progress: number }
  | { status: "error"; problem: CoverProblem }
  | { status: "failed"; file: File };

export type SaveResult<P> = { ok: true; event: EventDetail } | { ok: false; problem: P };

interface EventFlowValue {
  /** The draft's three passos as typed, kept while the passos go back and forth. */
  draft: DraftForm;
  setDraft: (fields: Partial<DraftForm>) => void;
  /** The last passo of the draft the producer went on from. */
  draftConfirmed: number;
  confirmDraft: (passo: number) => void;
  /** The draft created in this flow: its last passo then says "Continuar" and saves the changes. */
  createdId: string | null;
  /** "Criar rascunho" (POST), or "Continuar" once the draft exists (PATCH, only what changed). */
  saveDraft: () => Promise<SaveResult<EventSaveProblem>>;
  /** The draft just created, for the toast of the details' first passo. */
  justCreated: string | null;
  dismissCreated: () => void;

  entry: (eventId: string) => EventEntry | undefined;
  /** Reads the event once (again with `force`), keeping the one on the screen while it comes. */
  loadEvent: (eventId: string, force?: boolean) => void;
  saveEvent: (eventId: string, changes: UpdateEventInput) => Promise<SaveResult<EventSaveProblem>>;
  saveTicketType: (
    eventId: string,
    ticketTypeId: string | null,
    form: TicketTypeForm,
  ) => Promise<{ ok: true } | { ok: false; problem: TicketTypeSaveProblem }>;
  publish: (eventId: string) => Promise<"published" | PublishProblem>;

  /** The details typed and not saved yet, by event (Local, Descrição e reembolso). */
  location: (eventId: string) => LocationForm | undefined;
  setLocation: (eventId: string, form: LocationForm) => void;
  texts: (eventId: string) => TextsForm | undefined;
  setTexts: (eventId: string, form: TextsForm) => void;

  cover: (eventId: string) => CoverUploadState;
  /** Checks the image and sends it to R2, confirming it as the cover right away. */
  chooseCover: (eventId: string, file: File) => void;
  retryCover: (eventId: string) => void;

  /** Goes forward, as a new history entry. */
  go: (href: string) => void;
  /** Notes a link that goes forward (the link navigates by itself). */
  reachForward: (href: string) => void;
  /**
   * Goes back: to where the flow came from when it got here, or else to `fallback`, in place of
   * this entry (the page opened straight at this address).
   */
  back: (current: string, fallback: string) => void;
}

const EventFlowContext = createContext<EventFlowValue | null>(null);

export function useEventFlow(): EventFlowValue {
  const context = useContext(EventFlowContext);
  if (context === null) {
    throw new Error("useEventFlow must be used inside the event's layout.");
  }
  return context;
}

/** The event of an address, read once when the page opens it. */
export function useEvent(eventId: string): EventEntry {
  const { entry, loadEvent } = useEventFlow();
  useEffect(() => {
    loadEvent(eventId);
  }, [eventId, loadEvent]);
  return entry(eventId) ?? { status: "loading" };
}

const isAbort = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "AbortError";

/**
 * The event's flow (SPEC-015 §6, E4), in the memory of the page at the layout of the creation, the
 * details and the event page: the draft's passos, the events read, the details typed, the covers on
 * their way, and the history the passos make. A reload starts the creation over, empty; the details
 * and the event page read the event again.
 */
export function EventFlowProvider({ children }: { children: ReactNode }) {
  const { reloadEvents, reloadProducer } = useProducer();
  const { getToken } = useSession();
  const router = useRouter();
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;

  const [draft, setDraftState] = useState<DraftForm>(emptyDraft);
  const [draftConfirmed, setDraftConfirmed] = useState(0);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const [entries, setEntries] = useState<Record<string, EventEntry>>({});
  const [locations, setLocations] = useState<Record<string, LocationForm>>({});
  const [textForms, setTextForms] = useState<Record<string, TextsForm>>({});
  const [covers, setCovers] = useState<Record<string, CoverUploadState>>({});
  // The entries as the last render saw them, for the callbacks that decide on them.
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  // A newer cover for an event makes an older upload's answer stale.
  const coverRuns = useRef<Record<string, { run: number; controller: AbortController | null }>>({});
  // The addresses reached going forward in the flow, for "Voltar" to step back in history.
  const reachedForward = useRef(new Set<string>());

  useEffect(
    () => () => {
      for (const { controller } of Object.values(coverRuns.current)) {
        controller?.abort();
      }
    },
    [],
  );

  const setEvent = useCallback((event: EventDetail) => {
    setEntries((current) => ({ ...current, [event.id]: { status: "ready", event } }));
  }, []);

  const loadEvent = useCallback(
    (eventId: string, force = false) => {
      const current = entriesRef.current[eventId];
      if (!force && (current?.status === "ready" || current?.status === "loading")) {
        return;
      }
      if (current?.status !== "ready") {
        setEntries((all) => ({ ...all, [eventId]: { status: "loading" } }));
      }
      void (async () => {
        try {
          setEvent(await getEvent(await tokenRef.current(), eventId));
        } catch (error) {
          const problem = eventSaveProblem(error);
          setEntries((all) =>
            // A failed re-read keeps the event on the screen.
            all[eventId]?.status === "ready" && problem.kind !== "gone"
              ? all
              : { ...all, [eventId]: { status: problem.kind === "gone" ? "gone" : "failed" } },
          );
        }
      })();
    },
    [setEvent],
  );

  const eventOf = (eventId: string): EventDetail | null => {
    const current = entriesRef.current[eventId];
    return current?.status === "ready" ? current.event : null;
  };

  const setDraft = useCallback((fields: Partial<DraftForm>) => {
    setDraftState((current) => ({ ...current, ...fields }));
  }, []);

  const confirmDraft = useCallback((passo: number) => {
    setDraftConfirmed((current) => Math.max(current, passo));
  }, []);

  const saveDraft = useCallback(async (): Promise<SaveResult<EventSaveProblem>> => {
    try {
      const token = await tokenRef.current();
      if (createdId === null) {
        const input = createEventInput(draft);
        if (input === null) {
          return { ok: false, problem: { kind: "failed" } };
        }
        const event = await createEvent(token, input);
        setEvent(event);
        setCreatedId(event.id);
        setJustCreated(event.id);
        void reloadEvents();
        return { ok: true, event };
      }
      const saved = entriesRef.current[createdId];
      if (saved?.status !== "ready") {
        return { ok: false, problem: { kind: "failed" } };
      }
      const changes = draftChanges(saved.event, draft);
      if (Object.keys(changes).length === 0) {
        return { ok: true, event: saved.event };
      }
      const event = await updateEvent(token, createdId, changes);
      setEvent(event);
      void reloadEvents();
      return { ok: true, event };
    } catch (error) {
      const seats = createdId === null ? 0 : seatsInTypes(eventOf(createdId)?.ticketTypes ?? []);
      return { ok: false, problem: eventSaveProblem(error, seats) };
    }
  }, [createdId, draft, reloadEvents, setEvent]);

  const dismissCreated = useCallback(() => setJustCreated(null), []);

  const saveEvent = useCallback(
    async (eventId: string, changes: UpdateEventInput): Promise<SaveResult<EventSaveProblem>> => {
      const current = eventOf(eventId);
      if (current !== null && Object.keys(changes).length === 0) {
        return { ok: true, event: current };
      }
      try {
        const event = await updateEvent(await tokenRef.current(), eventId, changes);
        setEvent(event);
        void reloadEvents();
        return { ok: true, event };
      } catch (error) {
        return {
          ok: false,
          problem: eventSaveProblem(error, seatsInTypes(current?.ticketTypes ?? [])),
        };
      }
    },
    [reloadEvents, setEvent],
  );

  const saveTicketType = useCallback(
    async (
      eventId: string,
      ticketTypeId: string | null,
      form: TicketTypeForm,
    ): Promise<{ ok: true } | { ok: false; problem: TicketTypeSaveProblem }> => {
      const event = eventOf(eventId);
      if (event === null) {
        return { ok: false, problem: { kind: "failed" } };
      }
      const rules = {
        minimumCents: event.ticketMinPriceCents,
        fits: fitsInCapacity(event.capacity, event.ticketTypes, ticketTypeId),
      };
      try {
        const token = await tokenRef.current();
        let saved: TicketType;
        if (ticketTypeId === null) {
          const input = createTicketTypeInput(form);
          if (input === null) {
            return { ok: false, problem: { kind: "failed" } };
          }
          saved = await createTicketType(token, eventId, input);
        } else {
          const current = event.ticketTypes.find((type) => type.id === ticketTypeId);
          if (current === undefined) {
            return { ok: false, problem: { kind: "failed" } };
          }
          const changes = ticketTypeChanges(current, form);
          if (Object.keys(changes).length === 0) {
            return { ok: true };
          }
          saved = await updateTicketType(token, eventId, ticketTypeId, changes);
        }
        setEntries((all) => {
          const entry = all[eventId];
          if (entry?.status !== "ready") {
            return all;
          }
          const types = entry.event.ticketTypes;
          const ticketTypes = types.some((type) => type.id === saved.id)
            ? types.map((type) => (type.id === saved.id ? saved : type))
            : [...types, saved];
          return { ...all, [eventId]: { status: "ready", event: { ...entry.event, ticketTypes } } };
        });
        return { ok: true };
      } catch (error) {
        return { ok: false, problem: ticketTypeSaveProblem(error, rules) };
      }
    },
    [],
  );

  const publish = useCallback(
    async (eventId: string): Promise<"published" | PublishProblem> => {
      try {
        setEvent(await publishEvent(await tokenRef.current(), eventId));
        void reloadEvents();
        return "published";
      } catch (error) {
        const problem = publishProblem(error);
        if (problem === "event") {
          loadEvent(eventId, true);
        } else if (problem === "producer") {
          await reloadProducer();
        }
        return problem;
      }
    },
    [loadEvent, reloadEvents, reloadProducer, setEvent],
  );

  const setLocation = useCallback((eventId: string, form: LocationForm) => {
    setLocations((current) => ({ ...current, [eventId]: form }));
  }, []);

  const setTexts = useCallback((eventId: string, form: TextsForm) => {
    setTextForms((current) => ({ ...current, [eventId]: form }));
  }, []);

  const setCover = useCallback((eventId: string, state: CoverUploadState) => {
    setCovers((current) => ({ ...current, [eventId]: state }));
  }, []);

  const chooseCover = useCallback(
    (eventId: string, file: File) => {
      const previous = coverRuns.current[eventId];
      previous?.controller?.abort();
      const run = (previous?.run ?? 0) + 1;
      const controller = new AbortController();
      coverRuns.current[eventId] = { run, controller };
      const current = (): boolean => coverRuns.current[eventId]?.run === run;

      const problem = checkCover(file);
      const contentType = coverContentType(file);
      if (problem !== null || contentType === null) {
        setCover(eventId, { status: "error", problem: problem ?? { kind: "type" } });
        return;
      }
      setCover(eventId, { status: "uploading", progress: 0 });
      void (async () => {
        try {
          const upload = await requestCoverUpload(await tokenRef.current(), eventId, contentType);
          await uploadCover(
            upload.uploadUrl,
            file,
            contentType,
            (progress) => {
              if (current()) {
                setCover(eventId, { status: "uploading", progress });
              }
            },
            controller.signal,
          );
          const event = await confirmCover(await tokenRef.current(), eventId, upload.key);
          if (!current()) {
            return;
          }
          setEvent(event);
          setCover(eventId, { status: "idle" });
          void reloadEvents();
        } catch (error) {
          if (!current() || isAbort(error)) {
            return;
          }
          // R2 refusing the upload, or the API the object, is the image's error; the rest is a
          // failure that the same file may get past.
          const refused = error instanceof CoverUploadError || coverProblem(error) === "refused";
          setCover(
            eventId,
            refused
              ? { status: "error", problem: { kind: "refused" } }
              : { status: "failed", file },
          );
        }
      })();
    },
    [reloadEvents, setCover, setEvent],
  );

  const retryCover = useCallback(
    (eventId: string) => {
      const state = covers[eventId];
      if (state?.status === "failed") {
        chooseCover(eventId, state.file);
      }
    },
    [covers, chooseCover],
  );

  const reachForward = useCallback((href: string) => {
    reachedForward.current.add(href);
  }, []);

  const go = useCallback(
    (href: string) => {
      reachedForward.current.add(href);
      router.push(href);
    },
    [router],
  );

  const back = useCallback(
    (current: string, fallback: string) => {
      if (reachedForward.current.has(current)) {
        router.back();
      } else {
        router.replace(fallback);
      }
    },
    [router],
  );

  const value = useMemo<EventFlowValue>(
    () => ({
      draft,
      setDraft,
      draftConfirmed,
      confirmDraft,
      createdId,
      saveDraft,
      justCreated,
      dismissCreated,
      entry: (eventId) => entries[eventId],
      loadEvent,
      saveEvent,
      saveTicketType,
      publish,
      location: (eventId) => locations[eventId],
      setLocation,
      texts: (eventId) => textForms[eventId],
      setTexts,
      cover: (eventId) => covers[eventId] ?? { status: "idle" },
      chooseCover,
      retryCover,
      go,
      reachForward,
      back,
    }),
    [
      draft,
      setDraft,
      draftConfirmed,
      confirmDraft,
      createdId,
      saveDraft,
      justCreated,
      dismissCreated,
      entries,
      loadEvent,
      saveEvent,
      saveTicketType,
      publish,
      locations,
      setLocation,
      textForms,
      setTexts,
      covers,
      chooseCover,
      retryCover,
      go,
      reachForward,
      back,
    ],
  );

  return <EventFlowContext.Provider value={value}>{children}</EventFlowContext.Provider>;
}
