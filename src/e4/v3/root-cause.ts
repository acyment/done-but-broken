// E5 P0-V item 6 (proposal §2): root-cause-clustered burden as a FROZEN SECONDARY readout,
// published ALONGSIDE the symptom count, never instead of it. The v3-M6 adversarial review
// quantified the granularity amplification the raw burden carries: one unarchived rename ≈ 25
// counted items (every endpoint, field, and entity symptom of a single underlying divergence).
// Clustering collapses the symptoms of one divergence into one counted root so cross-arm burden
// comparisons stop being dominated by how many ITEMS a single mistake happens to touch.
//
// The clustering rule (e4-root-cause-burden-v1, sealed):
//   1. Every discrepancy maps to a FAMILY key derived from its item_id alone:
//      - convention:* items are their own family (`convention:<id>`);
//      - canonical ids (entity:<Name>, field:<Entity>.<field>, rule:<Entity>.<field>.<kind>,
//        endpoint:<Entity>:<kind>) map to the entity's collection segment via the sealed
//        pluralizer (`family:<segment>`);
//      - concrete stale-claim ids (endpoint:<METHOD> /<segment>/...) map to the first path
//        segment (`family:<segment>`).
//   2. Families that co-occur on the same semantic_item_uid are UNION-MERGED: a rename's stale
//      claims (old-name family) share endpoint uids with the new surface's symptoms (new-name
//      family), so the old- and new-name families collapse into one root — the meter's lineage
//      resolution did the identity work already; this step just reads it back.
//   3. Clustered burden at a checkpoint = number of clusters among that record's discrepancies.
// Reads ONLY the recorded drift report — no substrate regeneration, no hidden truth.
import type { E4Discrepancy, E4DriftReport } from "../types";
import { pluralizeEntityName } from "../substrate/v2/pluralize";

export const E4_V3_ROOT_CAUSE_BURDEN_ID = "e4-root-cause-burden-v1";

export type E4V3RootCauseCluster = {
  root: string; // representative family key (lexicographically first in the cluster)
  families: string[];
  item_count: number;
  classes: Record<string, number>;
};

export type E4V3RootCauseBurden = {
  root_cause_burden_id: typeof E4_V3_ROOT_CAUSE_BURDEN_ID;
  raw_burden: number; // the symptom count (identical to the sealed burdenAtCheckpoint sum)
  clustered_burden: number;
  clusters: E4V3RootCauseCluster[];
};

function familyKey(discrepancy: E4Discrepancy): string {
  const { item_id } = discrepancy;

  if (item_id.startsWith("convention:")) {
    return item_id;
  }

  const concreteEndpoint = item_id.match(/^endpoint:[A-Z]+ \/([^/?]+)/);

  if (concreteEndpoint) {
    return `family:${concreteEndpoint[1].toLowerCase()}`;
  }

  const canonicalEndpoint = item_id.match(/^endpoint:([^:]+):/);

  if (canonicalEndpoint) {
    return `family:${pluralizeEntityName(canonicalEndpoint[1])}`;
  }

  const entityScoped = item_id.match(/^(?:entity|field|rule):([A-Za-z0-9_]+)/);

  if (entityScoped) {
    return `family:${pluralizeEntityName(entityScoped[1])}`;
  }

  return `family:${item_id}`; // fail-closed: unrecognized forms cluster by their own id
}

class UnionFind {
  private parent = new Map<string, string>();

  find(key: string): string {
    let root = this.parent.get(key) ?? key;

    if (root !== key) {
      root = this.find(root);
      this.parent.set(key, root);
    }

    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);

    if (rootA !== rootB) {
      // deterministic: the lexicographically smaller key wins as the representative
      const [winner, loser] = rootA < rootB ? [rootA, rootB] : [rootB, rootA];
      this.parent.set(loser, winner);
    }
  }
}

export function computeE4V3RootCauseBurden(drift: Pick<E4DriftReport, "discrepancies">): E4V3RootCauseBurden {
  const discrepancies = drift.discrepancies;
  const unionFind = new UnionFind();
  const familiesByUid = new Map<string, string[]>();

  for (const discrepancy of discrepancies) {
    const family = familyKey(discrepancy);
    unionFind.find(family); // register

    const list = familiesByUid.get(discrepancy.semantic_item_uid) ?? [];
    list.push(family);
    familiesByUid.set(discrepancy.semantic_item_uid, list);
  }

  for (const families of familiesByUid.values()) {
    for (let index = 1; index < families.length; index += 1) {
      unionFind.union(families[0], families[index]);
    }
  }

  const clusters = new Map<string, E4V3RootCauseCluster>();

  for (const discrepancy of discrepancies) {
    const family = familyKey(discrepancy);
    const root = unionFind.find(family);
    const cluster = clusters.get(root) ?? { root, families: [], item_count: 0, classes: {} };

    if (!cluster.families.includes(family)) {
      cluster.families.push(family);
      cluster.families.sort();
    }

    cluster.item_count += 1;
    cluster.classes[discrepancy.class] = (cluster.classes[discrepancy.class] ?? 0) + 1;
    clusters.set(root, cluster);
  }

  return {
    root_cause_burden_id: E4_V3_ROOT_CAUSE_BURDEN_ID,
    raw_burden: discrepancies.length,
    clustered_burden: clusters.size,
    clusters: [...clusters.values()].toSorted((a, b) => a.root.localeCompare(b.root))
  };
}
