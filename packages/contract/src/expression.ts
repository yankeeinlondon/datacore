/** Expression AST of the datacore query/expression language. */
/* Ported from the engine's expression/expression.ts. Pure types: keep in sync via `implements` checks in the engine. */
import type { Literal } from "./values";

/** Comparison operators which yield true/false. */
export type CompareOp = ">" | ">=" | "<=" | "<" | "=" | "!=";
/** Arithmetic operators which yield numbers and other values. */
export type ArithmeticOp = "+" | "-" | "*" | "/" | "%" | "&" | "|";
/** Index a value into another value. */
export type LogicalOp = "index";
/** All valid binary operators. */
export type BinaryOp = CompareOp | ArithmeticOp | LogicalOp;

export type Expression =
    | LiteralExpression
    | VariableExpression
    | ListExpression
    | ObjectExpression
    | BinaryOpExpression
    | FunctionExpression
    | MethodExpression
    | LambdaExpression
    | NegatedExpression;

/** Literal representation of some field type. */
export interface LiteralExpression {
    type: "literal";
    value: Literal;
}

/** A variable field for a variable with a given name. */
export interface VariableExpression {
    type: "variable";
    name: string;
}

/** A list literal, which is an ordered collection of fields. */
export interface ListExpression {
    type: "list";
    values: Expression[];
}

/** An object literal, which is a mapping of name to field. */
export interface ObjectExpression {
    type: "object";
    values: Record<string, Expression>;
}

/** A binary operator expression which combines two subnodes somehow. */
export interface BinaryOpExpression {
    type: "binaryop";
    left: Expression;
    right: Expression;
    op: BinaryOp;
}

/** A function expression which calls a function on 0 or more arguments. */
export interface FunctionExpression {
    type: "function";
    /** Either the name of the function being called or a Function object. */
    func: Expression;
    /** The list of arguments being passed to the function. */
    arguments: Expression[];
}

/** A method call of the form `expr.function()`. Checks if the expression is an object which has that function; otherwise, falls back to a function call. */
export interface MethodExpression {
    type: "method";
    /** The target the method is being called on. */
    target: Expression;
    /** The name of the function being called. */
    func: string;
    /** The list of arguments being passed to the function call. */
    arguments: Expression[];
}

/** An inline function accepting one or more arguments and producing a value. */
export interface LambdaExpression {
    type: "lambda";
    /** An ordered list of named arguments. */
    arguments: string[];
    /** The field which will be evaluated using the arguments in context. */
    value: Expression;
}

/** An expression which negates the value of the original field. */
export interface NegatedExpression {
    type: "negated";

    /** The child field to negate. */
    child: Expression;
}
