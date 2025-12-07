/**
 * Speech Writer - write speeches with tone, occasion, and variants.
 *
 * Design goals:
 * - Users create multiple speeches (different occasions).
 * - Each speech can have several versions (tones, durations).
 * - Metadata for audience, occasion, and target duration.
 */

import { defineTable, column, NOW } from "astro:db";

export const Speeches = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),
    title: column.text(),                             // e.g. "Team Meeting - Q1 Update"
    occasion: column.text({ optional: true }),        // "wedding", "conference", "toast"
    audience: column.text({ optional: true }),        // "team", "students", "executives"
    language: column.text({ optional: true }),
    notes: column.text({ optional: true }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const SpeechVersions = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    speechId: column.text({
      references: () => Speeches.columns.id,
    }),
    versionLabel: column.text({ optional: true }),    // "formal", "short version", etc.
    tone: column.text({ optional: true }),            // "formal", "motivational", "humorous"
    targetDurationMinutes: column.number({ optional: true }),
    scriptText: column.text(),                        // full speech content
    isPreferred: column.boolean({ default: false }),
    createdAt: column.date({ default: NOW }),
  },
});

export const tables = {
  Speeches,
  SpeechVersions,
} as const;
