import {
  createMetadataVaryParamsAccumulator,
  createVaryParamsAccumulator,
  type VaryParamsAccumulator,
} from './vary-params'
import {
  workUnitAsyncStorage,
  type WorkUnitStore,
} from './work-unit-async-storage.external'
import type { LoaderTree } from '../lib/app-dir-module'

/**
 * Per-request, per-segment AsyncLocalStorage.
 *
 * Every route segment has its own SegmentStore, accessible via the module graph
 * (the LoaderTree nodes act as the keys into the store). Conceptually it's
 * as if every route module exports its own SegmentStore.
 *
 * The SegmentStore itself is also stored per request via the WorkUnitStore.
 * So it can contain per-request state, like vary param tracking.
 *
 * Fields are owned by their respective domains and accessed through the
 * helpers below; they start `null` and are populated lazily on first use.
 * This module only provides the record and its per-(work unit, segment)
 * identity.
 *
 * TODO: the segment's `searchParams` and `params` prop objects will move in
 * here too, memoized the same way, so that everything a segment receives
 * from the request is created and accessed through one per-segment store.
 */
export type SegmentStore = {
  /**
   * The segment's vary-params accumulator: tracks which params the segment
   * accessed during a prerender, for the segment's transport node. `null`
   * until first requested, and stays `null` when the current render doesn't
   * track vary params.
   */
  varyParamsAccumulator: VaryParamsAccumulator | null
}

function createSegmentStore(): SegmentStore {
  return { varyParamsAccumulator: null }
}

/**
 * Returns the SegmentStore for a given layout or page segment.
 */
export function getSegmentStore(
  workUnitStore: WorkUnitStore,
  // We use the LoaderTree node as the key into the SegmentStore because it's
  // unique per segment and corresponds directly to the module graph.
  segment: LoaderTree
): SegmentStore {
  const segmentStores = (workUnitStore.segmentStore ??= new WeakMap())
  let segmentStore = segmentStores.get(segment)
  if (segmentStore === undefined) {
    segmentStore = createSegmentStore()
    segmentStores.set(segment, segmentStore)
  }
  return segmentStore
}

/**
 * The metadata "segment": conceptually a segment in almost every way, except
 * it doesn't map to a route segment — it's the same for the whole page. This
 * roughly matches how metadata tracking is modeled on the client. Everything
 * a segment gets (vary-params tracking, props) follows the same patterns
 * through this store.
 *
 * Because it's page-wide, it lives as its own field on the work unit store,
 * next to the route segments' map — mirroring how the response-level
 * structures are laid out (e.g. `ResponseVaryParamsAccumulator.metadata`
 * next to `segments`).
 */
export function getMetadataSegmentStore(
  workUnitStore: WorkUnitStore
): SegmentStore {
  return (workUnitStore.metadataSegmentStore ??= createSegmentStore())
}

function getOrCreateVaryParamsAccumulator(
  segmentStore: SegmentStore
): VaryParamsAccumulator | null {
  if (segmentStore.varyParamsAccumulator === null) {
    // `createVaryParamsAccumulator` returns `null` when the ambient render
    // isn't tracking vary params. Caching a non-null accumulator keeps it a
    // single create-once (and a single registration into the response
    // accumulator); the `null` case has no side effect, so re-running it on a
    // later access is harmless.
    segmentStore.varyParamsAccumulator = createVaryParamsAccumulator()
  }
  return segmentStore.varyParamsAccumulator
}

/**
 * The single source of truth for a segment's vary-params accumulator. Created
 * lazily on first access and stored on the segment, so every consumer that
 * tracks the segment's param access shares the one accumulator that ends up
 * embedded in the segment's transport node. Returns `null` when the current
 * render doesn't track vary params.
 *
 * `segment` is the segment's stable key (see `SegmentStore`): its loader tree
 * node.
 */
export function getSegmentVaryParamsAccumulator(
  workUnitStore: WorkUnitStore,
  segment: LoaderTree
): VaryParamsAccumulator | null {
  return getOrCreateVaryParamsAccumulator(
    getSegmentStore(workUnitStore, segment)
  )
}

/**
 * The metadata segment's vary-params accumulator: same as
 * `getSegmentVaryParamsAccumulator`, but for the page-wide metadata segment
 * (see `getMetadataSegmentStore`). Reads from the ambient work unit store
 * because metadata's consumers don't hold one.
 *
 * Unlike a route segment's accumulator — which is embedded in the rendered
 * tree, so it's created and written under the same work unit store — the
 * metadata accumulator is serialized once at the response level, and the
 * payload is constructed and rendered under different work unit stores. So
 * the underlying object is response-scoped
 * (`createMetadataVaryParamsAccumulator` get-or-creates the response's
 * single metadata accumulator, exactly like root params); the segment store
 * just caches the per-store pointer to it.
 */
export function getMetadataVaryParamsAccumulator(): VaryParamsAccumulator | null {
  const workUnitStore = workUnitAsyncStorage.getStore()
  if (!workUnitStore) {
    return null
  }
  const segmentStore = getMetadataSegmentStore(workUnitStore)
  if (segmentStore.varyParamsAccumulator === null) {
    segmentStore.varyParamsAccumulator = createMetadataVaryParamsAccumulator()
  }
  return segmentStore.varyParamsAccumulator
}

// The metadata and viewport are always delivered in a single payload, so they
// don't need to be tracked separately. This may change in the future, but for
// now this is just an alias.
export const getViewportVaryParamsAccumulator = getMetadataVaryParamsAccumulator
