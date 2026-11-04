"use client";

import { CoverField, type CoverFieldState } from "@access/ui/components/cover-field";

import type { EventDetail } from "../../../_lib/api/producer-events";
import { coverAccept, coverProblemText } from "../../../_lib/producer/event-cover";
import { useEventFlow } from "./EventFlowProvider";

/**
 * Detalhes · 2 Capa (590:12190, 590:11793; Erro no arquivo 590:12385, 590:11903): the image goes to
 * R2 and becomes the cover as soon as it is chosen, without waiting for "Continuar"; "Trocar capa"
 * repeats it. The interface never removes a cover (SPEC-015 E7).
 */
export function CoverUpload({ event }: { event: EventDetail }) {
  const flow = useEventFlow();
  const upload = flow.cover(event.id);
  let state: CoverFieldState = event.coverUrl === null ? "empty" : "sent";
  if (upload.status === "uploading") {
    state = "uploading";
  } else if (upload.status === "error") {
    state = "error";
  }
  return (
    <div className="flex flex-col gap-4">
      <CoverField
        state={state}
        previewUrl={event.coverUrl}
        progress={upload.status === "uploading" ? upload.progress : 0}
        errorDetail={
          upload.status === "error" ? coverProblemText(upload.problem).detail : undefined
        }
        accept={coverAccept}
        onFileSelect={(file) => flow.chooseCover(event.id, file)}
      />
      <p className="type-body-s text-text-tertiary">
        Obrigatória para publicar. Se ainda não tiver, envie depois.
      </p>
    </div>
  );
}
