import { PARALLEL_ROUTE_DEFAULT_NULL_PATH } from '../../client/components/builtin/default-null'
import { DEFAULT_SEGMENT_KEY } from '../../shared/lib/segment'
import type { PartialTransportNode } from '../../shared/lib/rsc-transport'
import type { LoaderTree } from '../lib/app-dir-module'

/**
 * Interception routes use this synthetic loader-tree branch to indicate that
 * a soft navigation should keep the currently active slot. The branch is an
 * instruction for constructing a partial response, not a component to render
 * or a route-tree segment to send to the client.
 */
export function isRetainedParallelRoute(loaderTree: LoaderTree): boolean {
  const [segment, , modules] = loaderTree
  return (
    segment === DEFAULT_SEGMENT_KEY &&
    (modules.defaultPage?.[1]
      .replaceAll('\\', '/')
      .endsWith(PARALLEL_ROUTE_DEFAULT_NULL_PATH) ??
      false)
  )
}

export function hasRetainedParallelRoute(loaderTree: LoaderTree): boolean {
  for (const childLoaderTree of Object.values(loaderTree[1])) {
    if (
      isRetainedParallelRoute(childLoaderTree) ||
      hasRetainedParallelRoute(childLoaderTree)
    ) {
      return true
    }
  }
  return false
}

/**
 * Full prerenders still render retained branches so their LayoutRouter tree
 * can be constructed normally. Remove only their transport entries before
 * serialization; a partial response represents retention by leaving the slot
 * out of its children map.
 */
export function omitRetainedParallelRoutesFromTransportTree(
  loaderTree: LoaderTree,
  transportNode: PartialTransportNode
): void {
  const transportChildren = transportNode.c
  if (transportChildren === undefined) {
    return
  }

  for (const [parallelRouteKey, childLoaderTree] of Object.entries(
    loaderTree[1]
  )) {
    if (isRetainedParallelRoute(childLoaderTree)) {
      transportChildren.delete(parallelRouteKey)
      continue
    }

    const childTransportNode = transportChildren.get(parallelRouteKey)
    if (childTransportNode !== undefined) {
      omitRetainedParallelRoutesFromTransportTree(
        childLoaderTree,
        childTransportNode
      )
    }
  }
}
