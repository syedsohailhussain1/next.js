import { nextTestSetup } from 'e2e-utils'
import { createRouterAct } from 'router-act'
import cheerio from 'cheerio'

const prunedRoutes: Array<[path: string, layoutId: string]> = [
  ['/named-catchall/anything', 'named-catchall-layout'],
  ['/children-catchall/foo', 'children-catchall-layout'],
  ['/children-catchall/bar', 'children-catchall-layout'],
  ['/optional-children-catchall', 'optional-children-catchall-layout'],
  ['/optional-children-catchall/anything', 'optional-children-catchall-layout'],
  ['/split-matcher/anything', 'split-matcher-layout'],
  ['/nested-parallel/anything', 'nested-parallel-layout'],
  ['/grouped/anything', 'grouped-layout'],
]

const namedOnlyParallelRouteKeys = `(() => {
  const root = window.history.state?.__PRIVATE_NEXTJS_INTERNALS_TREE?.tree

  function findSegment(node) {
    if (!node) return null
    const segment = Array.isArray(node[0]) ? node[0][1] : node[0]
    if (segment === 'named-only-catchalls') {
      return Object.keys(node[1]).sort()
    }
    for (const child of Object.values(node[1])) {
      const result = findSegment(child)
      if (result) return result
    }
    return null
  }

  return findSegment(root)
})()`

describe('parallel-routes-pruned-matchers', () => {
  const { next, isNextStart } = nextTestSetup({
    files: __dirname,
  })

  it.each(prunedRoutes)(
    'omits the permanently-not-found matcher for %s',
    async (path, layoutId) => {
      const response = await next.fetch(path)
      const $ = cheerio.load(await response.text())

      expect(response.status).toBe(404)
      expect($.root().text()).toContain('root not found')
      expect($(`#${layoutId}`).length).toBe(0)
    }
  )

  it.each(prunedRoutes)(
    'renders the same 404 after client navigation to %s',
    async (path, layoutId) => {
      let act: ReturnType<typeof createRouterAct>
      const responseStatuses: number[] = []
      const browser = await next.browser('/', {
        beforePageLoad(page) {
          page.on('response', (response) => {
            if (new URL(response.url()).pathname === path) {
              responseStatuses.push(response.status())
            }
          })
          act = createRouterAct(page, { allowErrorStatusCodes: [404] })
        },
      })

      await act!(async () => {
        await browser.elementByCss(`button[data-router-push="${path}"]`).click()
      })

      await browser.waitForElementByCss('#root-not-found')
      expect(await browser.elementById('root-not-found').text()).toBe(
        'root not found'
      )
      expect(await browser.hasElementByCss(`#${layoutId}`)).toBe(false)
      expect(responseStatuses).toContain(404)
    }
  )

  it('keeps a named-only matcher when every declared slot matches', async () => {
    const $ = await next.render$('/named-catchall/foo')

    expect($('#named-catchall-page').text()).toBe('named catch-all')
    expect($('#named-specific-page').text()).toBe('named specific page')
  })

  it('keeps a broad matcher composed entirely from named slots', async () => {
    const browser = await next.browser('/named-only-catchalls/anything')

    expect(await browser.elementById('named-only-left-catchall').text()).toBe(
      'left catch-all'
    )
    expect(await browser.elementById('named-only-right-catchall').text()).toBe(
      'right catch-all'
    )
    expect(await browser.eval(namedOnlyParallelRouteKeys)).toEqual([
      'left',
      'right',
    ])
  })

  it('keeps the named-only tree without children after client navigation', async () => {
    let act: ReturnType<typeof createRouterAct>
    const path = '/named-only-catchalls/anything'
    const browser = await next.browser('/', {
      beforePageLoad(page) {
        act = createRouterAct(page)
      },
    })

    await act!(async () => {
      await browser.elementByCss(`button[data-router-push="${path}"]`).click()
    })

    await browser.waitForElementByCss('#named-only-catchalls-layout')
    expect(await browser.eval(namedOnlyParallelRouteKeys)).toEqual([
      'left',
      'right',
    ])
  })

  it('keeps a named catch-all when children has an explicit default', async () => {
    const $ = await next.render$('/children-default/anything')

    expect($('#children-default').text()).toBe('children default')
    expect($('#children-default-slot-catchall').text()).toBe('slot catch-all')
  })

  it('keeps a catch-all matcher when every slot has catch-all coverage', async () => {
    const $ = await next.render$('/complete-catchalls/anything')

    expect($('#complete-children-catchall').text()).toBe('children catch-all')
    expect($('#complete-slot-catchall').text()).toBe('slot catch-all')
  })

  it('keeps a catch-all matcher when the sibling slot has a default', async () => {
    const $ = await next.render$('/valid/foo')

    expect($('#valid-catchall-page').text()).toBe('valid catch-all')
    expect($('#valid-slot-default').text()).toBe('valid slot default')
  })

  it('keeps a catch-all matcher when every sibling slot matches', async () => {
    const $ = await next.render$('/valid/special')

    expect($('#valid-catchall-page').text()).toBe('valid catch-all')
    expect($('#valid-slot-page').text()).toBe('valid slot page')
  })

  it('keeps the specific sibling of a pruned optional catch-all', async () => {
    const $ = await next.render$('/optional-children-catchall/specific')

    expect($('#optional-specific-page').text()).toBe('optional specific page')
    expect($('#optional-slot-page').text()).toBe('optional slot page')
  })

  it.each(['foo', 'bar'])(
    'keeps /split-matcher/%s while pruning the broader matcher',
    async (segment) => {
      const $ = await next.render$(`/split-matcher/${segment}`)

      expect($(`#split-${segment}-page`).text()).toBe(`${segment} page`)
      expect($('#split-slot-catchall').text()).toBe('split slot catch-all')
    }
  )

  it('keeps a matcher when an explicit default calls notFound', async () => {
    const response = await next.fetch('/default-not-found/anything')

    expect(response.status).toBe(404)
  })

  it('prunes a matcher with an incomplete nested parallel route', async () => {
    const $ = await next.render$('/nested-parallel/specific')

    expect($('#nested-specific-page').text()).toBe('nested specific page')
    expect($('#nested-outer-specific-page').text()).toBe(
      'nested outer specific page'
    )
    expect($('#nested-inner-specific-page').text()).toBe(
      'nested inner specific page'
    )
  })

  it('keeps the specific sibling of a pruned route-group matcher', async () => {
    const $ = await next.render$('/grouped/specific')

    expect($('#grouped-specific-page').text()).toBe('grouped specific page')
    expect($('#grouped-slot-page').text()).toBe('grouped slot page')
  })

  if (isNextStart) {
    it('does not emit entrypoints for pruned matchers', async () => {
      const manifest = JSON.parse(
        await next.readFile('.next/server/app-paths-manifest.json')
      )
      const appPaths = Object.keys(manifest)

      expect(
        appPaths.filter(
          (path) =>
            path.includes('/named-catchall/@catchall/[...slug]/') ||
            path.startsWith('/children-catchall/') ||
            path.includes('/optional-children-catchall/[[...slug]]/') ||
            path.includes('/split-matcher/[...parts]/') ||
            path.includes('/nested-parallel/[...slug]/') ||
            path.includes('/grouped/[...slug]/')
        )
      ).toEqual([])
      expect(appPaths).toContain('/named-catchall/@specific/foo/page')
      expect(
        appPaths.some(
          (path) =>
            path.includes('/named-only-catchalls/') &&
            path.includes('/[...slug]/page')
        )
      ).toBe(true)
      expect(
        appPaths.some(
          (path) =>
            path.includes('/children-default/') &&
            path.includes('/[...slug]/page')
        )
      ).toBe(true)
      expect(
        appPaths.filter(
          (path) =>
            path.includes('/complete-catchalls/') &&
            path.includes('/[...slug]/page')
        )
      ).toHaveLength(2)
      expect(appPaths).toContain('/valid/[...slug]/page')
      expect(appPaths).toContain('/optional-children-catchall/specific/page')
      expect(appPaths).toContain('/split-matcher/foo/page')
      expect(appPaths).toContain('/split-matcher/bar/page')
      expect(appPaths).toContain('/default-not-found/[...slug]/page')
      expect(appPaths).toContain('/nested-parallel/specific/page')
      expect(appPaths).toContain('/(pruning-group)/grouped/specific/page')
    })
  }
})
