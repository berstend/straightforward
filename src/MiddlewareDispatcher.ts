/**
 * 'next' function, passed to a middleware
 */
export type Next = () => void | Promise<void>

/**
 * A middleware
 */
export type Middleware<T> = (context: T, next: Next) => Promise<void> | void

/**
 * A middleware container and invoker
 */
export class MiddlewareDispatcher<T> {
  middlewares: Middleware<T>[]

  constructor() {
    this.middlewares = []
  }

  /**
   * Add a middleware function.
   */
  use(...mw: Middleware<T>[]): void {
    this.middlewares.push(...mw)
  }

  /**
   * Execute the chain of middlewares, in the order they were added on a
   * given Context.
   */
  dispatch(context: T): Promise<void> {
    return invokeMiddlewares(context, this.middlewares)
  }
}

/**
 * Helper function for invoking a chain of middlewares on a context.
 */
async function invokeMiddlewares<T>(
  context: T,
  middlewares: Middleware<T>[]
): Promise<void> {
  if (!middlewares.length) return

  const mw = middlewares[0]

  return mw(context, async () => {
    await invokeMiddlewares(context, middlewares.slice(1))
  })
}
