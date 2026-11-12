import { isDataArray } from "@yankeeinlondon/datacore-shared";
import { options, type VNode } from "preact";

/** Replaces DataArrays in `children` (at any nesting depth) with plain arrays; returns `children` itself if none. */
export function plainChildren(children: unknown): unknown {
    if (isDataArray(children)) return Array.from(children as Iterable<unknown>, plainChildren);
    if (Array.isArray(children) && children.some((child) => isDataArray(child) || Array.isArray(child))) {
        return children.map(plainChildren);
    }
    return children;
}

/**
 * Lets this plugin's Preact render engine `DataArray`s as children, like plain arrays.
 *
 * Preact flattens only values that pass `Array.isArray`. Upstream Datacore got this behaviour from a global
 * `Array.isArray` patch, which every plugin in the vault saw. That patch is gone (Engine Room P2 decision 3), so the
 * views normalize their own children instead: `{dc.array(rows).map(...)}`, Table/List rows from `groupBy()`, and
 * list literals keep rendering. The hook is installed on view-preact's own copy of Preact only.
 *
 * Returns a function that uninstalls the hook.
 */
export function installDataArrayChildren(): () => void {
    // Preact's option hooks are plain functions (no `this`), stored and chained by every Preact add-on.
    // oxlint-disable-next-line typescript/unbound-method
    const previous = options.vnode;
    const hook = (vnode: VNode): void => {
        const props = vnode.props as { children?: unknown } | null | undefined;
        if (props !== null && typeof props === "object" && "children" in props) {
            const children = plainChildren(props.children);
            if (children !== props.children) props.children = children;
        }
        previous?.(vnode);
    };
    options.vnode = hook;
    return () => {
        // Only restore if nothing chained on top of us since.
        if (options.vnode === hook) options.vnode = previous;
    };
}
