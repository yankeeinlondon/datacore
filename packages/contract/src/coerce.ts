/** Coercion of arbitrary literals into specific types. */
import type { DateTime, Duration } from "luxon";
import type { Link, Literal } from "./values";

/** Convert values into a specific type, or `undefined` if that is not possible. Available as `dc.coerce`. */
export interface Coerce {
    string(value: Literal): string | undefined;
    boolean(value: Literal): boolean | undefined;
    number(value: Literal): number | undefined;
    date(value: Literal): DateTime | undefined;
    duration(value: Literal): Duration | undefined;
    link(value: Literal): Link | undefined;
    array(value: Literal): Literal[] | undefined;
}
