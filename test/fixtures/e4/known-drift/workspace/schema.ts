// GENERATED at T0 by src/e4/substrate/scaffold.ts — the app's actual behavior tracks this file,
// never specs/*. Editing specs/openapi.json or specs/CONVENTIONS.md does not change behavior.
export type E4FieldType = "string" | "int" | "decimal" | "bool" | "date" | "ref";
export type E4FieldSchema = { name: string; type: E4FieldType; ref_entity: string | null; required: boolean };
export type E4EntitySchema = { name: string; fields: E4FieldSchema[] };
export type E4ValidationRuleSchema = { entity: string; field: string; kind: "required" | "range" | "enum" | "format"; detail: Record<string, unknown> };

export const entitySchemas: E4EntitySchema[] = [
  {
    "name": "Category",
    "fields": [
      {
        "name": "id",
        "type": "string",
        "ref_entity": null,
        "required": true
      },
      {
        "name": "name",
        "type": "string",
        "ref_entity": null,
        "required": true
      }
    ]
  },
  {
    "name": "Widget",
    "fields": [
      {
        "name": "id",
        "type": "string",
        "ref_entity": null,
        "required": true
      },
      {
        "name": "name",
        "type": "string",
        "ref_entity": null,
        "required": true
      },
      {
        "name": "price",
        "type": "decimal",
        "ref_entity": null,
        "required": true
      },
      {
        "name": "available",
        "type": "bool",
        "ref_entity": null,
        "required": true
      },
      {
        "name": "notes",
        "type": "string",
        "ref_entity": null,
        "required": false
      }
    ]
  }
];

export const validationRules: E4ValidationRuleSchema[] = [
  {
    "entity": "Widget",
    "field": "price",
    "kind": "range",
    "detail": {
      "min": 0
    }
  }
];

export const errorEnvelopeStyle: "code_message" | "type_detail" = "type_detail";
