import type { Batch } from "@/domain";

export class SnapshotImmutabilityError extends Error {
  constructor(batchId: string) {
    super(
      `Batch.snapshot is immutable and cannot be changed (batch ${batchId})`,
    );
    this.name = "SnapshotImmutabilityError";
  }
}

/** Deep-equal via JSON (snapshots are plain JSON-friendly values). */
export function snapshotsEqual(
  a: Batch["snapshot"],
  b: Batch["snapshot"],
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function assertSnapshotUnchanged(
  existing: Batch,
  nextSnapshot: Batch["snapshot"],
): void {
  if (!snapshotsEqual(existing.snapshot, nextSnapshot)) {
    throw new SnapshotImmutabilityError(existing.id);
  }
}
