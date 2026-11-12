/** Success/failure results for operations that can fail without throwing. */

/** Methods shared by successful and failed results. */
export interface ResultMethods<T, E> {
    /** Transform the success value. */
    map<U>(f: (a: T) => U): Result<U, E>;
    /** Chain another fallible operation on the success value. */
    flatMap<U>(f: (a: T) => Result<U, E>): Result<U, E>;
    /** Transform the error value. */
    mapErr<U>(f: (e: E) => U): Result<T, U>;
    /** Transform both the success and error values. */
    bimap<T2, E2>(succ: (a: T) => T2, fail: (b: E) => E2): Result<T2, E2>;
    /** The success value, or the given default. */
    orElse(value: T): T;
    /** Reinterpret the success type. */
    cast<U>(): Result<U, E>;
    /** Reinterpret the error type. */
    castErr<U>(): Result<T, U>;
    /** The success value, or throw an error (optionally with a custom message). */
    orElseThrow(message?: (e: E) => string): T;
}

/** A successful result. */
export interface Success<T, E> extends ResultMethods<T, E> {
    readonly successful: true;
    readonly value: T;
}

/** A failed result. */
export interface Failure<T, E> extends ResultMethods<T, E> {
    readonly successful: false;
    readonly error: E;
}

/** Either a success (`successful: true`, `value`) or a failure (`successful: false`, `error`). */
export type Result<T, E> = Success<T, E> | Failure<T, E>;
