/** @module ui */
import type { DatacoreApi, Indexable, IndexQuery, Result, SearchResult } from "@yankeeinlondon/datacore-contract";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { DataObject, Literal } from "@yankeeinlondon/datacore-contract";
import { equals } from "@yankeeinlondon/datacore-shared";
import { CURRENT_FILE_CONTEXT } from "./markdown";
import { isValidElement } from "preact";
import { ReactNode } from "preact/compat";
import { Lit } from "ui/markdown";

/** Hook that updates the view whenever the revision updates, returning the newest revision.  */
export function useIndexUpdates(engine: DatacoreApi, settings?: { debounce?: number }): number {
    const [revision, setRevision] = useState(engine.revision);

    // The engine debounces (default 500 ms; 0 updates immediately).
    useEffect(() => {
        const subscription = engine.onRevision(setRevision, { debounce: settings?.debounce });
        return () => subscription.dispose();
    }, [engine, settings?.debounce]);

    return revision;
}

/** A hook which updates whenever file metadata for a specific file updates. */
export function useFileMetadata(
    engine: DatacoreApi,
    path: string,
    settings?: { debounce?: number }
): Indexable | undefined {
    const indexRevision = useIndexUpdates(engine, settings);

    // TODO: I think load returns consistent objects so it should be okay.
    return useMemo(() => engine.load(path), [indexRevision, path]);
}

/** Settings which control how automatic query reloading should work. */
export interface UseQuerySettings {
    /**
     * If present, debounce repeated query updates so that an update only occurs every \<debounce\> milliseconds. This
     * defaults to the overall default debounce settings.
     */
    debounce?: number;
}

/** Perform a live, synchronous query which updates its results whenever the backing query would change. */
export function tryUseFullQuery(
    engine: DatacoreApi,
    query: IndexQuery,
    settings?: UseQuerySettings
): Result<SearchResult<Indexable>, string> {
    // Track index updates with customizable debouncing.
    const indexRevision = useIndexUpdates(engine, settings);

    // We "intern" the query, meaning we reuse the oldest version if it is semantically equal but just a different object.
    const internedQuery = useInterning(query, (first, second) =>
        equals(first as unknown as DataObject, second as unknown as DataObject)
    );

    // Intern the output as well so react diffing "just works" with the result of useQuery.
    const internedResult = useRef<Result<SearchResult<Indexable>, string> | undefined>(undefined);

    // On every index revision update, re-run the query and check if it produced meaningfully new values.
    return useMemo(() => {
        const newResult = engine.tryFullQuery(query);

        // Set failure if the new request is a failure.
        if (!newResult.successful) return (internedResult.current = newResult);

        // If there is no current interned state (or it was a failure), update it and return.
        const oldResult = internedResult.current;
        if (oldResult === undefined || !oldResult.successful) return (internedResult.current = newResult);

        // Both are successful, check if they are different.
        if (
            oldResult.value.revision != newResult.value.revision ||
            !sameObjects(oldResult.value.results, newResult.value.results)
        ) {
            return (internedResult.current = newResult);
        }

        // Same revision and same objects, this is the same query result, so return the old object.
        return oldResult;
    }, [internedQuery, indexRevision]);
}

/** Perform a live, synchronous query which updates its results whenever the backing query would change.  */
export function useFullQuery(
    engine: DatacoreApi,
    query: IndexQuery,
    settings?: UseQuerySettings
): SearchResult<Indexable> {
    return tryUseFullQuery(engine, query, settings).orElseThrow((e) => "Failed to search: " + e);
}

/** Simpler version of useFullQuery which just directly returns results.  */
export function tryUseQuery(
    engine: DatacoreApi,
    query: IndexQuery,
    settings?: UseQuerySettings
): Result<Indexable[], string> {
    return tryUseFullQuery(engine, query, settings).map((result) => result.results);
}

/** Simpler version of useFullQuery which just directly returns results.  */
export function useQuery(engine: DatacoreApi, query: IndexQuery, settings?: UseQuerySettings): Indexable[] {
    return useFullQuery(engine, query, settings).results;
}

/** Determines if the two sets of objects are the same. Only uses revision comparison for performance. */
function sameObjects(old: readonly Indexable[], incoming: readonly Indexable[]) {
    if (old.length != incoming.length) return false;

    const olds: Record<string, number> = {};
    for (const indexable of old) {
        olds[indexable.$id] = indexable.$revision!;
    }

    for (const indexable of incoming) {
        const value = olds[indexable.$id];
        if (value == undefined) return false;
        if (value != indexable.$revision) return false;
    }

    return true;
}

/**
 * "Interns" the incoming value, returning the oldest equal instance. This is a trick to improve React diffing
 *  behavior, as two objects which are equals via equality(a, b) will return the same object reference after being
 *  interned.
 */
export function useInterning<T>(value: T, equality: (a: T, b: T) => boolean): T {
    const ref = useRef<T>();

    if (ref.current === undefined || !equality(ref.current, value)) {
        ref.current = value;
    }

    return ref.current;
}

/** Use a stable callback which hides mutable state behind a stable reference. Reduces react re-renders.  */
export function useStableCallback<T>(callback: T, deps: unknown[]): T {
    const ref = useRef<T>();

    useEffect(() => {
        ref.current = callback;
    }, [callback, ...deps]);

    return useCallback(
        (...args: unknown[]) => {
            (ref.current as Function)(...args);
        },
        [ref]
    ) as T;
}

const NO_OP_UPDATE = (_x: unknown) => {};

/** Use state that will default to an external controlled value if set; otherwise, will track an internal value.  */
export function useControlledState<T>(
    initialState: T,
    override?: T,
    update?: (value: T) => void
): [T, (value: T) => void] {
    const [state, setState] = useState(override ?? initialState);
    if (override !== undefined) {
        if (state != override) setState(override);

        return [override, update ?? NO_OP_UPDATE];
    }

    const setStateWithUpdate = useCallback(
        (value: T) => {
            setState(value);
            if (update) update(value);
        },
        [setState, update]
    );

    return [state, setStateWithUpdate];
}

/**
 * Ensure that a given literal or element input is rendered as a JSX.Element.
 * @hidden
 */
export function useAsElement(element: ReactNode | Literal): ReactNode {
    const sourcePath = useContext(CURRENT_FILE_CONTEXT);

    return useMemo(() => {
        if (isValidElement(element)) {
            return element as ReactNode;
        } else {
            return <Lit sourcePath={sourcePath} inline={true} value={element as Literal} />;
        }
    }, [element]);
}
