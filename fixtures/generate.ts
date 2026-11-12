/**
 * Generates the parity vault's data notes (`vault/Parity/Data/`): 40 books and 5 authors with deterministic values
 * covering every literal type the views render (strings, numbers, dates, durations, links, lists, tasks, nested list
 * items, sections, and block ids).
 *
 * Usage: `node generate.ts` (from `fixtures/`). The output is committed; rerun after changing this file.
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BOOK_COUNT = 40;
const AUTHOR_COUNT = 5;
const GENRES = ["fiction", "history", "science", "poetry"] as const;
const STATUSES = ["todo", "reading", "done"] as const;

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "vault", "Parity", "Data");

function pad(value: number): string {
    return String(value).padStart(2, "0");
}

function at<T>(values: readonly T[], index: number): T {
    const value = values[index % values.length];
    if (value === undefined) throw new Error(`No value at index ${index}`);
    return value;
}

/** ISO date `offsetDays` after 2020-01-01 (UTC, so the output never depends on the machine's time zone). */
function isoDate(offsetDays: number): string {
    return new Date(Date.UTC(2020, 0, 1 + offsetDays)).toISOString().slice(0, 10);
}

function authorName(index: number): string {
    return `Parity Author ${index}`;
}

function book(index: number): string {
    const genre = at(GENRES, index);
    const status = at(STATUSES, index);
    const rating = ((index * 7) % 5) + 1;
    const author = authorName(index % AUTHOR_COUNT);
    const done = index % 2 === 1 ? "x" : " ";

    return `---
type: book
genre: ${genre}
rating: ${rating}
published: ${isoDate(index * 37)}
pages: ${120 + index * 9}
aliases:
  - PB${pad(index)}
---
# Parity Book ${pad(index)}

#pbook #pbook/${genre}

status:: ${status}
author:: [[${author}]]
readtime:: ${(index % 6) + 1} hours

## Review

A ${genre} book rated ${rating} of 5. ^review-${pad(index)}

## Tasks

- [${done}] Read chapter one
- [ ] Write notes
    - Child note for book ${pad(index)}
`;
}

function author(index: number): string {
    return `---
type: author
born: ${isoDate(-30000 + index * 1000)}
---
# ${authorName(index)}

#pauthor

country:: ${at(["UK", "US", "FR", "JP", "BR"], index)}
`;
}

rmSync(dataDir, { recursive: true, force: true });
mkdirSync(dataDir, { recursive: true });
for (let index = 1; index <= BOOK_COUNT; index++) {
    writeFileSync(join(dataDir, `Parity Book ${pad(index)}.md`), book(index));
}
for (let index = 0; index < AUTHOR_COUNT; index++) {
    writeFileSync(join(dataDir, `${authorName(index)}.md`), author(index));
}
console.log(`Wrote ${readdirSync(dataDir).length} notes to ${dataDir}`);
