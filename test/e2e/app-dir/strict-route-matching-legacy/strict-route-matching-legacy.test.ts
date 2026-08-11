import { nextTestSetup } from 'e2e-utils'

describe('strict-route-matching-legacy', () => {
  const { next } = nextTestSetup({
    files: __dirname,
  })

  it('keeps the synthetic children slot when explicitly disabled', async () => {
    const browser = await next.browser('/named-only/anything')
    const parallelRouteKeys = await browser.eval(`(() => {
      const root = window.history.state?.__PRIVATE_NEXTJS_INTERNALS_TREE?.tree

      function findSegment(node) {
        if (!node) return null
        const segment = Array.isArray(node[0]) ? node[0][1] : node[0]
        if (segment === 'named-only') {
          return Object.keys(node[1]).sort()
        }
        for (const child of Object.values(node[1])) {
          const result = findSegment(child)
          if (result) return result
        }
        return null
      }

      return findSegment(root)
    })()`)

    expect(parallelRouteKeys).toEqual(['children', 'left', 'right'])
  })
})
