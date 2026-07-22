You are working on Shelfware, an internal Django digital-asset-management service. The team is adding a merge operation: users select several assets and merge them into one; the backend creates a new asset and a background worker applies an `AssetMetadataOverrides` object to the newly created asset (the worker lives in another module).

Work only from the code shown in this message; do not explore the filesystem or the web. Reply directly with your answer.

Relevant existing code:

```python
# assets/models.py (excerpt)
class CustomField(models.Model):
    """
    Defines the name and type of a custom field
    """

    class FieldDataType(models.TextChoices):
        STRING = ("string", "String")
        DATE = ("date", "Date")
        INT = ("integer", "Integer")

    name = models.CharField(max_length=128, unique=True)

    data_type = models.CharField(
        max_length=50,
        choices=FieldDataType.choices,
        editable=False,
    )

    def __str__(self) -> str:
        return f"{self.name} : {self.data_type}"


class CustomFieldValue(models.Model):
    """
    A single value of a custom field, attached to a CustomField for the name
    and type and attached to a single Asset to be metadata for it
    """

    asset = models.ForeignKey(
        Asset,
        blank=False,
        null=False,
        on_delete=models.CASCADE,
        related_name="custom_fields",
        editable=False,
    )

    field = models.ForeignKey(
        CustomField,
        blank=False,
        null=False,
        on_delete=models.CASCADE,
        related_name="values",
        editable=False,
    )

    # Actual data storage
    value_text = models.CharField(max_length=128, null=True)

    value_date = models.DateField(null=True)

    value_int = models.IntegerField(null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["asset", "field"],
                name="%(app_label)s_%(class)s_unique_asset_field",
            ),
        ]

    @property
    def value(self):
        """
        Based on the data type, access the actual value this row stores
        """
        if self.field.data_type == CustomField.FieldDataType.DATE:
            return self.value_date
        if self.field.data_type == CustomField.FieldDataType.INT:
            return self.value_int
        return self.value_text
```

```python
# assets/data_models.py (excerpt)
@dataclasses.dataclass
class AssetMetadataOverrides:
    """
    Manages overrides for asset fields which normally would
    be set from content or matching.  All fields default to None,
    meaning no override is happening
    """

    title: str | None = None
    collection_id: int | None = None
    tag_ids: list[int] | None = None
    custom_fields: dict | None = None

    @staticmethod
    def from_asset(asset) -> "AssetMetadataOverrides":
        """
        Fills in the overrides from an asset object
        """
        overrides = AssetMetadataOverrides()
        overrides.title = asset.title
        overrides.collection_id = asset.collection.id if asset.collection else None
        overrides.tag_ids = list(asset.tags.values_list("id", flat=True))

        return overrides
```

Task: `from_asset()` does not yet carry over custom-field metadata. Implement that: populate `overrides.custom_fields` from the source asset's custom-field values, so that an asset produced by a merge gets the same custom-field metadata as the source asset. Reply with the complete updated `from_asset()` method, plus any brief notes you'd give a reviewer.
