"use client";

import { Field, FieldDescription, FieldError, FieldLabel } from "@access/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@access/ui/components/input-group";
import { Option, OptionList } from "@access/ui/components/option";
import { MapPin, Search } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import type { City } from "../../../_lib/api/producer";
import { searchCities } from "../../../_lib/api/producer-events";
import { cityLabel } from "../../../_lib/producer/event-form";
import { useSession } from "../../../_lib/session";

/** The search waits for the producer to pause, so each letter is not a request. */
const SEARCH_DELAY_MS = 250;

interface CityFieldProps {
  id: string;
  value: City | null;
  onChange: (city: City) => void;
  help?: string;
  error?: string | null;
}

/**
 * Figma: Cidade, a Campo de texto that searches the IBGE base (Detalhes · 1 Local · Buscando a
 * cidade, 588:11959 and 588:11602): from 2 letters, `GET /api/cities` suggests up to 10 cities as
 * "Nome, UF" in Sugestões; the one chosen shows with map-pin. The city is replaced, never cleared
 * (SPEC-015 §6): leaving the field without choosing brings the chosen one back. A WAI-ARIA combobox.
 */
export function CityField({ id, value, onChange, help, error = null }: CityFieldProps) {
  const { getToken } = useSession();
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  const [text, setText] = useState(value === null ? "" : cityLabel(value));
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<City[]>([]);
  const [active, setActive] = useState(0);
  const listId = `${id}-list`;
  const open = searching && results.length > 0;

  // A city chosen elsewhere (the event read again) shows while the producer is not searching.
  useEffect(() => {
    if (!searching) {
      setText(value === null ? "" : cityLabel(value));
    }
  }, [value, searching]);

  useEffect(() => {
    const term = text.trim();
    if (!searching || term.length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const found = await searchCities(await tokenRef.current(), term, controller.signal);
          setResults(found);
          setActive(0);
        } catch {
          // A newer search took its place, or the search failed: no suggestions this time.
          if (!controller.signal.aborted) {
            setResults([]);
          }
        }
      })();
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text, searching]);

  const choose = (city: City): void => {
    onChange(city);
    setSearching(false);
    setResults([]);
    setText(cityLabel(city));
  };

  const restore = (): void => {
    setSearching(false);
    setResults([]);
    setText(value === null ? "" : cityLabel(value));
  };

  const keyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown" && open) {
      event.preventDefault();
      setActive((current) => (current + 1) % results.length);
    } else if (event.key === "ArrowUp" && open) {
      event.preventDefault();
      setActive((current) => (current - 1 + results.length) % results.length);
    } else if (event.key === "Enter" && open) {
      // Chooses the city instead of sending the form.
      event.preventDefault();
      const city = results[active];
      if (city !== undefined) {
        choose(city);
      }
    } else if (event.key === "Escape" && searching) {
      event.preventDefault();
      restore();
    }
  };

  const described = error !== null ? `${id}-error` : help === undefined ? undefined : `${id}-help`;

  return (
    <Field>
      <FieldLabel htmlFor={id}>Cidade</FieldLabel>
      <div className="relative">
        <InputGroup size="m">
          <InputGroupAddon>
            {searching || value === null ? <Search aria-hidden /> : <MapPin aria-hidden />}
          </InputGroupAddon>
          <InputGroupInput
            id={id}
            role="combobox"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listId}
            aria-activedescendant={open ? `${id}-option-${active}` : undefined}
            aria-invalid={error === null ? undefined : true}
            aria-describedby={described}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setSearching(true);
            }}
            onKeyDown={keyDown}
            onBlur={restore}
          />
        </InputGroup>
        {open ? (
          <OptionList
            id={listId}
            aria-label="Cidades"
            className="absolute inset-x-0 top-full z-20 mt-1"
          >
            {results.map((city, index) => (
              <Option
                key={city.code}
                id={`${id}-option-${index}`}
                active={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(city)}
              >
                {cityLabel(city)}
              </Option>
            ))}
          </OptionList>
        ) : null}
      </div>
      {error !== null ? (
        <FieldError id={`${id}-error`}>{error}</FieldError>
      ) : help === undefined ? null : (
        <FieldDescription id={`${id}-help`}>{help}</FieldDescription>
      )}
    </Field>
  );
}
