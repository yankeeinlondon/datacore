/**
 * Identity-safe helpers for the engine's literal values (replacements for the engine's `Literals.*` and `Groupings.*`).
 * The implementation lives in the private `datacore-shared` package, which the engine uses too, so the engine, the views,
 * and every consumer compare, sort, and stringify values identically.
 */
export {
    DEFAULT_LITERAL_STRING_SETTINGS,
    compare,
    equals,
    groupingSize,
    isDataObject,
    isGroupElement,
    isGroupLeaf,
    isGrouping,
    isLiteralArray,
    isTruthy,
    literalToString,
    mapLeaves,
    sliceGrouping,
    typeOf,
    wrapValue,
    type LiteralStringSettings,
    type WrappedLiteral,
} from "@yankeeinlondon/datacore-shared";
