/**
 * Type guards for engine values. They check structure and brands rather than classes, so they work on values created
 * by the engine's bundle (never use `instanceof` on engine values). The implementation is shared with the engine and
 * the views (datacore-shared).
 */
export {
    hasIndexType,
    isBlock,
    isCanvas,
    isCanvasCard,
    isCodeblock,
    isDataArray,
    isDatablock,
    isDateTime,
    isDuration,
    isFile,
    isIndexable,
    isLink,
    isListBlock,
    isListItem,
    isMarkdownPage,
    isSection,
    isTask,
} from "@yankeeinlondon/datacore-shared";
