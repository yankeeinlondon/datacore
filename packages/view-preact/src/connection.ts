/**
 * The view plugin's link to Datacore Engine. Wraps `getDatacore()` from the client and keeps a single, observable
 * state: connecting, connected (with the reconnecting engine handle), or unavailable (with the reason). When the engine
 * is missing, disabled, or incompatible it waits for the next engine to activate and tries again, so enabling the
 * engine after this plugin loaded just works.
 */
import {
    getDatacore,
    type AppLike,
    type ConsumerLike,
    type DatacoreHandle,
    type GetDatacoreFailure,
} from "@yankeeinlondon/datacore-client";
import type { Disposable } from "@yankeeinlondon/datacore-contract";
import { getOrCreateRegistry, onProviderEvent } from "@yankeeinlondon/datacore-shared";

/** Why the views cannot reach the engine right now. `revoked`: it was connected, then unloaded (disabled/reloading). */
export type UnavailableReason = GetDatacoreFailure | "revoked";

export type ConnectionState =
    | { readonly status: "connecting" }
    | { readonly status: "connected"; readonly engine: DatacoreHandle }
    | { readonly status: "unavailable"; readonly reason: UnavailableReason; readonly message: string };

export interface EngineConnectionOptions {
    /** The lowest engine API version the views support (caret semantics; passed to `getDatacore`). */
    minApi?: string;
    /** How long to wait for an engine that has not loaded yet (passed to `getDatacore`). */
    timeoutMs?: number;
    /** Where the registry lives (default: the main `window`). For tests. */
    host?: object;
}

export class EngineConnection {
    private current: ConnectionState = { status: "connecting" };
    private readonly listeners = new Set<(state: ConnectionState) => void>();
    private stopWaiting: (() => void) | undefined;
    private attempt = 0;
    private stopped = false;

    public constructor(
        private readonly app: AppLike,
        private readonly consumer: ConsumerLike,
        private readonly options: EngineConnectionOptions = {}
    ) {}

    /** The current state. */
    public get state(): ConnectionState {
        return this.current;
    }

    /** Called on every state change. */
    public onChange(listener: (state: ConnectionState) => void): Disposable {
        this.listeners.add(listener);
        return { dispose: () => this.listeners.delete(listener) };
    }

    /** Connect (resolves once the first attempt settles; later reconnects happen in the background). */
    public start(): Promise<void> {
        return this.connect();
    }

    /** Stop listening and notifying (the client handle itself is disposed with the consumer). */
    public stop(): void {
        this.stopped = true;
        this.stopWaiting?.();
        this.stopWaiting = undefined;
        this.listeners.clear();
    }

    private async connect(): Promise<void> {
        const attempt = ++this.attempt;
        this.set({ status: "connecting" });

        const result = await getDatacore(this.app, {
            consumer: this.consumer,
            reconnect: true,
            minApi: this.options.minApi,
            timeoutMs: this.options.timeoutMs,
            host: this.options.host,
        });
        if (this.stopped || attempt !== this.attempt) return;

        if (result.ok) {
            this.attach(result.engine);
        } else {
            this.set({ status: "unavailable", reason: result.reason, message: result.message });
            this.retryOnNextEngine();
        }
    }

    private attach(engine: DatacoreHandle): void {
        engine.onRevoked(() =>
            this.set({
                status: "unavailable",
                reason: "revoked",
                message: "Datacore Engine stopped (it was disabled or is reloading).",
            })
        );
        engine.onReconnected(() => this.set({ status: "connected", engine }));
        this.set({ status: "connected", engine });
    }

    /** Wait for an engine to activate, then try again (an incompatible engine stays put until another one arrives). */
    private retryOnNextEngine(): void {
        this.stopWaiting?.();
        const registry = getOrCreateRegistry(this.options.host ?? window);
        this.stopWaiting = onProviderEvent(registry, (event) => {
            if (event.type !== "activated") return;
            this.stopWaiting?.();
            this.stopWaiting = undefined;
            void this.connect();
        });
    }

    private set(state: ConnectionState): void {
        if (this.stopped) return;
        this.current = state;
        for (const listener of Array.from(this.listeners)) listener(state);
    }
}

/** Text shown in a code block while the engine is not available. */
export function unavailableMessage(state: ConnectionState): string {
    switch (state.status) {
        case "connected":
            return "";
        case "connecting":
            return "Waiting for Datacore Engine…";
        case "unavailable":
            switch (state.reason) {
                case "not-installed":
                    return "This view needs the Datacore Engine plugin, which is not installed.";
                case "disabled":
                    return "This view needs the Datacore Engine plugin. Enable it in Settings → Community plugins.";
                case "revoked":
                    return "Datacore Engine is not running (it was disabled or is reloading).";
                default:
                    return state.message;
            }
    }
}
