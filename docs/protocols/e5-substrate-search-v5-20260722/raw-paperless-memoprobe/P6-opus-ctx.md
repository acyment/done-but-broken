# P6 — opus, in-context framing — verbatim final output (archived at collection, 2026-07-22)
# (note: `->` appears HTML-escaped as `-&gt;` in the harness notification transport; content otherwise untouched)

This is a self-contained coding task from the code shown, so I'll answer directly.

## Updated `from_document()`

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
            instance.field_id: instance.value
            for instance in doc.custom_fields.all()
        }

        return overrides
```

## Notes for the reviewer

- **Shape of the dict.** `custom_fields` is keyed by the `CustomField` id (`instance.field_id`), with the stored value taken via the `CustomFieldInstance.value` property. That property routes through `TYPE_TO_DATA_STORE_NAME_MAP` and returns the correct backing column per data type (e.g. `value_select` returns the option id, `value_document_ids` returns the id list), so every field type is carried faithfully without special-casing. Please confirm this `{field_id: value}` shape is exactly what the consumer's `DocumentMetadataOverrides` applier expects — that's the contract this hinges on, and it lives in the other module I couldn't see.

- **Merge behavior is consistent.** `update()` merges custom fields with `dict.update()`. Because both sides are keyed by `field_id`, merging two sources means the later document wins on a shared field, which matches the "last-writer" merge already used for the scalar overrides (title, correspondent, etc.). No accidental cross-field clobbering.

- **`field_id` vs. `field.id`.** I used `instance.field_id` to avoid a per-instance query on the `field` FK. If you prefer the source document to always arrive with `custom_fields` prefetched, `instance.field.id` reads the same but would N+1 without a `prefetch_related`/`select_related`. Worth a `prefetch_related("custom_fields")` on the caller if it isn't already there.

- **Empty case.** A document with no custom fields yields `{}` rather than `None`. That's a deliberate, harmless difference from the other fields, but note it: in `update()`, `{}` is not `None`, so an empty source dict still takes the `elif other.custom_fields is not None` branch (a no-op `update({})`). If any downstream code distinguishes "no override" (`None`) from "empty override" (`{}`), consider emitting `None` when there are no instances. I left it as `{}` since it's simpler and behaviorally equivalent for the applier.

- **Soft-delete.** `CustomFieldInstance` is a `SoftDeleteModel`; `doc.custom_fields.all()` uses the default manager, which should already exclude soft-deleted instances — worth a quick confirmation so tombstoned fields don't leak into the merged document.

result: Delivered the updated `from_document()` that populates `overrides.custom_fields = {instance.field_id: instance.value for instance in doc.custom_fields.all()}`, plus reviewer notes on dict shape/consumer contract, merge consistency, field_id prefetch, empty-vs-None, and soft-delete.
