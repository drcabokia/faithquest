"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { useReadingPreferences } from "./reading-preferences";

export function ReadingComfort() {
  const { preferences, loaded, warning, change } = useReadingPreferences();
  const id = useId();
  const headingId = id + "-heading";
  const descriptionId = id + "-description";
  const sizeId = id + "-size";
  const spacingId = id + "-spacing";
  return (
    <section className="reading-comfort card" aria-labelledby={headingId}>
      <div>
        <h2 id={headingId}>Reading comfort</h2>
        <p id={descriptionId} className="small muted">
          Adjust Scripture text. These settings are shared by anyone using this
          browser.
        </p>
      </div>
      <div
        className="reading-comfort-controls"
        aria-describedby={descriptionId}
      >
        <div className="reading-comfort-field">
          <label htmlFor={sizeId}>Scripture text size</label>
          <select
            id={sizeId}
            value={preferences.textSize}
            disabled={!loaded}
            onChange={(event) =>
              change({
                textSize: event.target.value as typeof preferences.textSize,
              })
            }
          >
            <option value="standard">Standard</option>
            <option value="large">Large</option>
            <option value="extra-large">Extra large</option>
          </select>
        </div>
        <div className="reading-comfort-field">
          <label htmlFor={spacingId}>Line spacing</label>
          <select
            id={spacingId}
            value={preferences.lineSpacing}
            disabled={!loaded}
            onChange={(event) =>
              change({
                lineSpacing: event.target
                  .value as typeof preferences.lineSpacing,
              })
            }
          >
            <option value="comfortable">Comfortable</option>
            <option value="relaxed">Relaxed</option>
          </select>
        </div>
        <Button
          variant="secondary"
          disabled={!loaded}
          onClick={() => change(null)}
        >
          Reset reading settings
        </Button>
      </div>
      <p className="small muted" role="status" aria-live="polite">
        {!loaded
          ? "Loading reading settings…"
          : warning === "unavailable"
            ? "Reading settings apply for this visit, but this browser could not remember them. Change a setting or reset to retry."
            : warning === "invalid"
              ? "Saved reading settings could not be read. Choose new settings or reset to replace them."
              : "Remembered in this browser on this device."}
      </p>
    </section>
  );
}
