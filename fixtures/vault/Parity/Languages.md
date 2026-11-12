# Languages

## JavaScript

```dc
return function View() {
    return dc.preact.h("p", null, "js block: ", dc.query("@page and #pauthor").length, " authors");
};
```

## TypeScript

```dct
return function View() {
    const count: number = dc.query("@page and #pauthor").length;
    return dc.preact.h("p", null, `ts block: ${count} authors`);
};
```

## TSX

```dctx
return function View() {
    const books: Array<{ $name: string }> = dc.useQuery("@page and #pbook and genre = \"poetry\"");
    return <p>tsx block: {books.length} poetry books</p>;
};
```

## Returning an element directly

```dcx
return <p>a plain element</p>;
```
