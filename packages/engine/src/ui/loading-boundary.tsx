import type { DatacoreApi, Disposable, IndexProgress } from "@yankeeinlondon/datacore-contract";
import { PropsWithChildren, useCallback, useEffect, useRef, useState } from "preact/compat";
import { Literal } from "expression/literal";
import { FunctionComponent, JSX, VNode, createElement, isValidElement } from "preact";
import { ErrorMessage, Lit } from "./markdown";

import "./errors.css";

/** Simple view which shows datacore's current loading progress when it is still indexing on startup. */
function LoadingProgress({ engine }: { engine: DatacoreApi }) {
    const subscription = useRef<Disposable>();
    const attach = useCallback(
        (element: HTMLParagraphElement | null) => {
            subscription.current?.dispose();
            subscription.current = undefined;

            if (!element) return;

            const render = ({ initialized, total }: IndexProgress) => {
                element.textContent = `${initialized} / ${total}`;
            };

            render(engine.status().progress);
            subscription.current = engine.on("index-progress", render);
        },
        [engine]
    );

    return <p ref={attach} />;
}

/** Loading boundary which shows a loading screen while Datacore is initializing. */
export function LoadingBoundary({ children, engine }: PropsWithChildren<{ engine: DatacoreApi }>) {
    const [initialized, setInitialized] = useState(engine.initialized);

    // Syncs the boundary with datacore's initialization state.
    // TODO: Add an event to datacore which indicates when a reindex happens (i.e., initialized
    // returns back to 'false').
    useEffect(() => {
        if (initialized) return;

        const listener = engine.on("initialized", () => setInitialized(true));
        return () => listener.dispose();
    }, [initialized, engine]);

    if (initialized) {
        return <>{children}</>;
    } else {
        return (
            <div className="datacore-loading-boundary">
                <h4 className="datacore-loading-title">Datacore is getting ready...</h4>
                <div className="datacore-loading-content">
                    <LoadingProgress engine={engine} />
                </div>
            </div>
        );
    }
}

/**
 * Executes a vanilla javascript function lazily one time. Mainly useful to only run a script
 * once the parent loading boundary is actually ready.
 */
export function ScriptContainer({
    executor,
    sourcePath,
}: {
    executor: () => Promise<Literal | VNode | Function>;
    sourcePath: string;
}) {
    const [element, setElement] = useState<JSX.Element | undefined>(undefined);
    const [error, setError] = useState<Error | undefined>(undefined);

    useEffect(() => {
        setElement(undefined);
        setError(undefined);

        // TODO: Avoid multiple concurrent executions of the same script.
        (async () => {
            try {
                const result = await executor();
                setElement(makeRenderableElement(result, sourcePath));
            } catch (error) {
                setError(error instanceof Error ? error : new Error(String(error)));
            }
        })();
    }, [executor, sourcePath]);

    // Propogate error upwards.
    if (error) {
        throw error;
    }

    return <>{element ?? <ErrorMessage message="< View is rendering >" />}</>;
}

/** Make a renderable element from the returned object; if this transformation is not possible, throw an exception. */
export function makeRenderableElement(object: unknown, sourcePath: string): JSX.Element {
    if (typeof object === "function") {
        return createElement(object as FunctionComponent<unknown>, {});
    } else if (Array.isArray(object)) {
        return createElement(
            "div",
            {},
            (object as unknown[]).map((x) => makeRenderableElement(x, sourcePath))
        );
    } else if (isValidElement(object)) {
        return object;
    } else {
        return <Lit value={object as Literal | undefined} sourcePath={sourcePath} />;
    }
}
