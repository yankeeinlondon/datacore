/**
 * A small `Result` implementation for the views (script loading, file reads). The engine has its own; results built
 * here never cross into the engine, so the views need only the contract's `Result` shape, not the engine's classes.
 */
import type * as Contract from "@yankeeinlondon/datacore-contract";

export type Result<T, E> = Contract.Result<T, E>;

class SuccessResult<T, E> implements Contract.Success<T, E> {
    public readonly successful = true;

    public constructor(public readonly value: T) {}

    public map<U>(f: (a: T) => U): Result<U, E> {
        return new SuccessResult<U, E>(f(this.value));
    }

    public flatMap<U>(f: (a: T) => Result<U, E>): Result<U, E> {
        return f(this.value);
    }

    public mapErr<U>(_f: (e: E) => U): Result<T, U> {
        return this.castErr();
    }

    public bimap<T2, E2>(succ: (a: T) => T2, _fail: (b: E) => E2): Result<T2, E2> {
        return new SuccessResult<T2, E2>(succ(this.value));
    }

    public orElse(_value: T): T {
        return this.value;
    }

    public cast<U>(): Result<U, E> {
        return this as unknown as Result<U, E>;
    }

    public castErr<U>(): Result<T, U> {
        return this as unknown as Result<T, U>;
    }

    public orElseThrow(_message?: (e: E) => string): T {
        return this.value;
    }
}

class FailureResult<T, E> implements Contract.Failure<T, E> {
    public readonly successful = false;

    public constructor(public readonly error: E) {}

    public map<U>(_f: (a: T) => U): Result<U, E> {
        return this.cast();
    }

    public flatMap<U>(_f: (a: T) => Result<U, E>): Result<U, E> {
        return this.cast();
    }

    public mapErr<U>(f: (e: E) => U): Result<T, U> {
        return new FailureResult<T, U>(f(this.error));
    }

    public bimap<T2, E2>(_succ: (a: T) => T2, fail: (b: E) => E2): Result<T2, E2> {
        return new FailureResult<T2, E2>(fail(this.error));
    }

    public orElse(value: T): T {
        return value;
    }

    public cast<U>(): Result<U, E> {
        return this as unknown as Result<U, E>;
    }

    public castErr<U>(): Result<T, U> {
        return this as unknown as Result<T, U>;
    }

    public orElseThrow(message?: (e: E) => string): T {
        throw new Error(message ? message(this.error) : String(this.error));
    }
}

/** Construct results. */
export const Result = {
    success<T, E>(value: T): Result<T, E> {
        return new SuccessResult<T, E>(value);
    },
    failure<T, E>(error: E): Result<T, E> {
        return new FailureResult<T, E>(error);
    },
};
