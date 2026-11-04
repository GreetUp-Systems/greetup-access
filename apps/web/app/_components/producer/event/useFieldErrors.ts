"use client";

import { useCallback, useState } from "react";

type Errors<F extends string> = Partial<Record<F, string>>;

/**
 * The errors under a form's fields, as Seus dados shows them (SPEC-015 §6, design guide "Erro que
 * ensina"): a field's error shows when the producer leaves it filled, or when the form is sent; a
 * corrected field loses it at once, while a new one only shows when leaving the field. The API's
 * field errors join them.
 */
export function useFieldErrors<F extends string>() {
  const [errors, setErrors] = useState<Errors<F>>({});

  /** After a change: drop the errors the values no longer have. */
  const settle = useCallback((problems: Errors<F>) => {
    setErrors((current) => {
      const kept: Errors<F> = {};
      let changed = false;
      for (const field of Object.keys(current) as F[]) {
        if (problems[field] === undefined) {
          changed = true;
        } else {
          kept[field] = current[field];
        }
      }
      return changed ? kept : current;
    });
  }, []);

  /** Leaving a field: its problem shows, when the field has something typed. */
  const leave = useCallback((field: F, problems: Errors<F>, filled: boolean) => {
    if (!filled) {
      return;
    }
    setErrors((current) => {
      const problem = problems[field];
      if (problem === current[field]) {
        return current;
      }
      const next = { ...current };
      if (problem === undefined) {
        delete next[field];
      } else {
        next[field] = problem;
      }
      return next;
    });
  }, []);

  /** On "Continuar": every problem shows. */
  const showAll = useCallback((problems: Errors<F>) => setErrors(problems), []);

  /** An error the API answered for a field. */
  const set = useCallback((field: F, message: string) => {
    setErrors((current) => ({ ...current, [field]: message }));
  }, []);

  return { errors, settle, leave, showAll, set };
}
