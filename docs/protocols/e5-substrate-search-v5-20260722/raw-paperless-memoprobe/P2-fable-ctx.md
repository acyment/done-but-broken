# P2 — fable, in-context framing — verbatim final output (archived at collection, 2026-07-22)
# (note: `->` appears HTML-escaped as `-&gt;` in the harness notification transport; content otherwise untouched)

Here is the updated method. The only change is the added `custom_fields` block at the end; everything else is untouched.

```python
    @staticmethod
    def from_document(doc) -&gt; "DocumentMetadataOverrides":
        """
        Fills in the overrides from a document object
        """
        overrides = DocumentMetadataOverrides()
        overrides.title = doc.title
        overrides.correspondent_id = doc.correspondent.id if doc.correspondent else None
        overrides.document_type_id = doc.document_type.id if doc.document_type else None
        overrides.storage_path_id = doc.storage_path.id if doc.storage_path else None
        overrides.owner_id = doc.owner.id if doc.owner else None
        overrides.tag_ids = list(doc.tags.values_list("id", flat=True))
        overrides.created = doc.created

        overrides.view_users = list(
            get_users_with_perms(
                doc,
                only_with_perms_in=["view_document"],
            ).values_list("id", flat=True),
        )
        overrides.change_users = list(
            get_users_with_perms(
                doc,
                only_with_perms_in=["change_document"],
            ).values_list("id", flat=True),
        )

        groups_with_perms = get_groups_with_perms(
            doc,
            attach_perms=True,
        )
        overrides.view_groups = [
            group.id
            for group in groups_with_perms
            if "view_document" in groups_with_perms[group]
        ]
        overrides.change_groups = [
            group.id
            for group in groups_with_perms
            if "change_document" in groups_with_perms[group]
        ]

        overrides.custom_fields = {
            custom_field.field.id: custom_field.value
            for custom_field in doc.custom_fields.all()
        }

        return overrides
```

Notes for a reviewer:

1. **Key choice is the load-bearing decision.** The dict must be keyed by `custom_field.field.id` — the id of the `CustomField` *definition* — not by `custom_field.id`, the id of the per-document `CustomFieldInstance` row. Instance ids are unique per (document, field) pair, so keying by instance id would make the same logical field appear under different keys for different source documents. Worse, in the merge path `update()` does `self.custom_fields.update(other.custom_fields)`: with definition ids, two source documents sharing a field correctly collapse to one entry (first document wins, consistent with the "only if empty" semantics of the scalar fields); with instance ids, values from different documents can silently collide or duplicate under unrelated keys. The `unique_document_field` constraint on `CustomFieldInstance` guarantees definition-id keys are unique within one document, so the comprehension can't self-clobber.

2. **Value shape.** `custom_field.value` dispatches through `TYPE_TO_DATA_STORE_NAME_MAP`, so the dict values are the native stored types (`str`, `bool`, `int`, `float`, `datetime.date`, `list[int]` for document links, select option id as a string). The consumer applying the overrides needs to accept these types; if it expects only JSON-serializable primitives, `value_date` (a `date` object) is the one to watch — worth checking the consumer's handling or adding a round-trip test with a date field.

3. **Soft deletes.** `CustomFieldInstance` is a `SoftDeleteModel`; assuming its default manager filters out soft-deleted rows (the usual pattern), `doc.custom_fields.all()` only carries live values. If the default manager includes deleted rows in this codebase, this should filter them explicitly.

4. **Query cost.** The comprehension touches `custom_field.field`, so `doc.custom_fields.select_related("field").all()` would avoid N+1 queries. Harmless either way at merge-sized N, but cheap to add.

5. **Suggested test.** Merge two documents where doc A and doc B both have field X (different values) and doc B additionally has field Y: the merged document should get A's X value and B's Y value, and nothing else.

result: Implemented `DocumentMetadataOverrides.from_document()` custom-field carryover as a dict keyed by CustomField definition id (`custom_field.field.id`) mapping to the instance's typed `.value`, with reviewer notes on why instance-id keys would corrupt merges, value-type caveats, soft-delete and N+1 considerations.
