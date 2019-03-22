# DB Editor

Database editor without HandsOnTable

## Example usage

```typescript
const editor = new DbEditor({
    el: document.getElementById("App")!,
    endpoint: "/api/editor/",
    convert: md2html,
    columns: [
        {name: "deck", width: 200, type: "one-line", required: true},
        {name: "front", width: 500, type: "markdown", required: true},
        {name: "back", width: 500, type: "markdown"},
        {name: "tag", width: 150, type: "list", newEntry: false},
        {name: "mnemonic", width: 300, type: "markdown", newEntry: false},
        {name: "srsLevel", width: 150, type: "number", label: "SRS Level", newEntry: false},
        {name: "nextReview", width: 200, type: "datetime", label: "Next Review", newEntry: false}
    ]
});
```

```typescript
const editor = new DbEditor({
    el: document.getElementById("App")!,
    endpoint: "/api/editor/",
    convert: md2html,
    readOnly: true,
    newEntry: false,
    columns: [
        {name: "deck", width: 200, type: "one-line", required: true},
        {name: "front", width: 600, type: "markdown", required: true},
        {name: "back", width: 600, type: "markdown"},
        {name: "tag", width: 150, type: "list", newEntry: false}
    ]
});
```
