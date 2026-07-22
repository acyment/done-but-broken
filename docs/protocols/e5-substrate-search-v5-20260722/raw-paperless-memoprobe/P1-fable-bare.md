# P1 — fable, bare framing — verbatim final output (archived at collection, 2026-07-22)
# (note: `->` appears HTML-escaped as `-&gt;` in the harness notification transport; content otherwise untouched)

Here's the implementation. The key design decision is what to key the `custom_fields` dict by — it must be the `CustomField` primary key, since field names, while currently unique, aren't the stable identifier the rest of the schema uses (all FKs point at the id).

```python
@staticmethod
def from_asset(asset) -&gt; "AssetMetadataOverrides":
    """
    Fills in the overrides from an asset object
    """
    overrides = AssetMetadataOverrides()
    overrides.title = asset.title
    overrides.collection_id = asset.collection.id if asset.collection else None
    overrides.tag_ids = list(asset.tags.values_list("id", flat=True))
    overrides.custom_fields = {
        custom_field.field_id: custom_field.value
        for custom_field in asset.custom_fields.select_related("field")
    }

    return overrides
```

Notes for a reviewer:

1. **Keyed by `field_id`, not the `CustomFieldValue` row's own id and not the field name.** The `(asset, field)` unique constraint guarantees one entry per field per asset, so keying by the field's PK can never collide or silently drop a value, and it's what the worker needs to recreate `CustomFieldValue` rows against the new asset. Using `custom_field.field_id` (the FK column) rather than `custom_field.field.id` avoids triggering a lazy load per row. This is also the spot where a subtle bug is easy to write: keying by the wrong id (e.g., the value row's `id`, or an index) produces dicts that look plausible in tests but wire values to the wrong fields after a merge.

2. **`.value` (the typed property), not `value_text`.** The property dispatches on `data_type`, so date fields yield `datetime.date` and integer fields yield `int`. If this dataclass ever gets serialized (e.g., sent through a celery/task queue as JSON), `date` objects won't survive naively — worth checking how the worker receives this object. If it's passed in-process or pickled, it's fine as-is.

3. **`select_related("field")`** because the `.value` property reads `self.field.data_type`; without it this is an N+1 query per custom field.

4. **Empty vs. None semantics preserved.** An asset with no custom-field values produces `{}`, not `None`. Since `None` means "no override" per the docstring, `{}` correctly says "override with no custom fields" — for a merge source that genuinely has none, that's the right meaning (the new asset should end up with none from this source). If the worker instead treats `{}` as "skip", that's a behavior to confirm.

5. A field whose stored value is `NULL` (e.g., a string field with `value_text=None`) will appear in the dict with value `None`. The worker should be prepared to either recreate that as a null-valued `CustomFieldValue` or skip it — worth a test either way.

result: Implemented `AssetMetadataOverrides.from_asset()` custom-field carryover as `{field_id: typed value}` via `select_related("field")`, with reviewer notes on collision-safe keying, typed-value serialization, and empty-dict vs None override semantics.
