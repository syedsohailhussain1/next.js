import { nextTestSetup } from 'e2e-utils'
import { createRouterAct } from 'router-act'

const describeViewport =
  process.env.__NEXT_CACHE_COMPONENTS === 'true' ? describe.skip : describe

describeViewport('strict route matching viewport limitation', () => {
  const { next } = nextTestSetup({
    files: __dirname,
  })

  it('documents that a viewport error is swallowed only on initial load', async () => {
    const response = await next.fetch('/viewport-error')

    // TODO(strict-route-matching): This intentionally asserts the current
    // broken behavior. The initial loader tree has no children page to own the
    // MetadataOutlet, so the viewport error is swallowed.
    expect(response.status).toBe(200)

    const browser = await next.browser('/viewport-error')
    expect(await browser.elementByCss('#viewport-page').text()).toBe(
      'Viewport page'
    )

    let act: ReturnType<typeof createRouterAct>
    const navigationBrowser = await next.browser('/success', {
      beforePageLoad(page) {
        act = createRouterAct(page, { allowErrorStatusCodes: [500] })
      },
    })

    await act!(async () => {
      await navigationBrowser
        .elementByCss('input[data-link-accordion="/viewport-error"]')
        .click()
      await navigationBrowser.elementByCss('a[href="/viewport-error"]').click()
    })

    expect(await navigationBrowser.elementByCss('#root-error').text()).toBe(
      'Root error'
    )
  })
})
