# Errors

## Invalid query

```datacorejsx
return function View() {
    const books = dc.useQuery("@page and (");
    return <p>{books.length}</p>;
}
```

## Thrown error

```datacorejsx
return function View() {
    throw new Error("parity: thrown on purpose");
}
```

## Syntax error

```datacorejsx
return function View() {
    return <p>unclosed
}
```

## Nothing returned

```datacorejsx
const unused = 1;
```
