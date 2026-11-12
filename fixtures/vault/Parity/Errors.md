# Errors

## Invalid query

```dcx
return function View() {
    const books = dc.useQuery("@page and (");
    return <p>{books.length}</p>;
}
```

## Thrown error

```dcx
return function View() {
    throw new Error("parity: thrown on purpose");
}
```

## Syntax error

```dcx
return function View() {
    return <p>unclosed
}
```

## Nothing returned

```dcx
const unused = 1;
```
