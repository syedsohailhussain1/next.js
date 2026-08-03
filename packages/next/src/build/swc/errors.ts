import type { Issue } from './types'

export class TurbopackEntrypointsError extends Error {
  constructor(readonly issues: Issue[]) {
    super('Entrypoints could not be constructed due to compilation errors')
    this.name = 'TurbopackEntrypointsError'
  }
}
