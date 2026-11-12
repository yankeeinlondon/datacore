---
title: Quickstart
sidebar_position: 2
---

Want to just see something on your screen? Follow this (hopefully simple) guide to get something you can put your eyeballs on.
Note that this is using the Datacore Javascript API - the non-Javascript functionality is not available yet, so if you don't
know Javascript, the plugin may not be ready for you!

## Installation

Install and enable **Datacore Engine** and **Datacore View: Preact** (see [Installation](installation.md) for the BRAT
steps). The engine indexes your vault in the background; views work straight away, though results may be incomplete
until the first index finishes.

## The Most Trivial of Views

To immediately get something on the screen, add a `dcx` code block (JSX) to any page of your choice. Here's a starter one which just live-updates to
show how many markdown pages you have in your vault:

~~~
```dcx
// All datacore views should return a React component.
return function View() {
    const pages = dc.useQuery("@page").length;

    return <p>You have {pages} pages in your vault!</p>;
}
```
~~~

Alternatively, if a trivial component that shows how many pages you have is too pedestrian, here is the classic table view:

~~~
```dcx
// A list of columns to show in the table.
const COLUMNS = [
    { id: "Name", value: page => page.$link },
    { id: "Rating", value: page => page.value("rating") }
];

return function View() {
    // Selecting `#game` pages, for example.
    const pages = dc.useQuery("@page and #game");

    // Uses the built in table component for showing objects in a table!
    return <dc.Table columns={COLUMNS} rows={pages} />;
}
```
~~~

For more of an explanation of how each of the pieces here is working, check out:

- [Queries](data/query.md) for writing queries that fetch data from your vault.
- [Views](code-views/index.md) for writing the code to actually create views over your queried data.