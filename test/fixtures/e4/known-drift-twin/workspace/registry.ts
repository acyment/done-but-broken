// GENERATED at T0 by src/e4/substrate/scaffold.ts — do not hand-edit route wiring here.
export type E4RouteDefinition = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  entity: string;
  kind: "create" | "read" | "update" | "delete" | "list" | "analytics";
};

export const routeRegistry: E4RouteDefinition[] = [
  {
    "method": "POST",
    "path": "/categories",
    "entity": "Category",
    "kind": "create"
  },
  {
    "method": "GET",
    "path": "/categories/{id}",
    "entity": "Category",
    "kind": "read"
  },
  {
    "method": "PUT",
    "path": "/categories/{id}",
    "entity": "Category",
    "kind": "update"
  },
  {
    "method": "GET",
    "path": "/categories",
    "entity": "Category",
    "kind": "list"
  },
  {
    "method": "GET",
    "path": "/categories/stats",
    "entity": "Category",
    "kind": "analytics"
  },
  {
    "method": "POST",
    "path": "/widgets",
    "entity": "Widget",
    "kind": "create"
  },
  {
    "method": "GET",
    "path": "/widgets/{id}",
    "entity": "Widget",
    "kind": "read"
  },
  {
    "method": "PATCH",
    "path": "/widgets/{id}",
    "entity": "Widget",
    "kind": "update"
  },
  {
    "method": "DELETE",
    "path": "/widgets/{id}",
    "entity": "Widget",
    "kind": "delete"
  },
  {
    "method": "GET",
    "path": "/widgets",
    "entity": "Widget",
    "kind": "list"
  },
  {
    "method": "GET",
    "path": "/widgets/stats",
    "entity": "Widget",
    "kind": "analytics"
  }
];
