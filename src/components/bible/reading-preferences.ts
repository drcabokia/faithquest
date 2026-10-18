"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "faithquest365.reader-preferences.v1";
const DEFAULTS = { textSize: "standard", lineSpacing: "comfortable" } as const;
type Preferences = {
  textSize: "standard" | "large" | "extra-large";
  lineSpacing: "comfortable" | "relaxed";
};
type Snapshot = {
  preferences: Preferences;
  loaded: boolean;
  warning: "unavailable" | "invalid" | null;
};
const server: Snapshot = {
  preferences: DEFAULTS,
  loaded: false,
  warning: null,
};
let snapshot = server;
let initialized = false;
const listeners = new Set<() => void>();

function publish(value: Snapshot) {
  snapshot = value;
  listeners.forEach((listener) => listener());
}
function load() {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    publish({
      preferences: snapshot.preferences,
      loaded: true,
      warning: "unavailable",
    });
    return;
  }
  try {
    if (raw === null) {
      publish({ preferences: DEFAULTS, loaded: true, warning: null });
      return;
    }
    if (raw.length > 1024) throw new Error("Invalid reading settings");
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      !("version" in value) ||
      value.version !== 1 ||
      !("textSize" in value) ||
      typeof value.textSize !== "string" ||
      !["standard", "large", "extra-large"].includes(value.textSize) ||
      !("lineSpacing" in value) ||
      typeof value.lineSpacing !== "string" ||
      !["comfortable", "relaxed"].includes(value.lineSpacing) ||
      Object.keys(value).length !== 3
    )
      throw new Error("Invalid reading settings");
    publish({
      preferences: {
        textSize: value.textSize as Preferences["textSize"],
        lineSpacing: value.lineSpacing as Preferences["lineSpacing"],
      },
      loaded: true,
      warning: null,
    });
  } catch {
    publish({ preferences: DEFAULTS, loaded: true, warning: "invalid" });
  }
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!initialized) {
    initialized = true;
    load();
    // Settings are device preferences, shared across tabs and accounts on this origin.
    window.addEventListener("storage", (event) => {
      if (event.key === STORAGE_KEY || event.key === null) load();
    });
  }
  return () => {
    listeners.delete(listener);
  };
}
function change(patch: Partial<Preferences> | null) {
  const preferences = patch ? { ...snapshot.preferences, ...patch } : DEFAULTS;
  let warning: Snapshot["warning"] = null;
  try {
    if (patch) {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, ...preferences }),
      );
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    warning = "unavailable";
  }
  // Keep the choice usable for this visit even if the browser cannot persist it.
  publish({ preferences, loaded: true, warning });
}
export function useReadingPreferences() {
  const value = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => server,
  );
  return { ...value, change };
}
