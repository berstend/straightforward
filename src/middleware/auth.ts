import {
  Middleware,
  RequestContext,
  ConnectContext,
  isRequest,
  isConnect,
} from ".."

import Debug from "debug"
const debug = Debug("straightforward:middleware")

export interface AuthOpts {
  user?: string
  pass?: string
  dynamic?: boolean
}

export interface RequestAdditionsAuth {
  locals: { proxyUser: string; proxyPass: string }
}

/**
 * Authenticate an incoming proxy request
 * Supports static `user` and `pass` or `dynamic`,
 * in which case `ctx.req.locals` will be populated with `proxyUser` and `proxyPass`
 * This middleware supports both onRequest and onConnect
 */
export const auth =
  ({
    user,
    pass,
    dynamic,
  }: AuthOpts): Middleware<
    RequestContext<RequestAdditionsAuth> | ConnectContext<RequestAdditionsAuth>
  > =>
  async (ctx, next) => {
    debug("authenticating incoming request")

    const sendAuthRequired = () => {
      if (isRequest(ctx)) {
        ctx.res.writeHead(407, { "Proxy-Authenticate": "Basic" })
        ctx.res.end()
      } else if (isConnect(ctx)) {
        ctx.clientSocket.end(
          "HTTP/1.1 407\r\n" + "Proxy-Authenticate: basic\r\n" + "\r\n"
        )
      }
    }
    const proxyAuth = ctx.req.headers["proxy-authorization"]
    if (!proxyAuth) {
      return sendAuthRequired()
    }
    const [proxyUser, proxyPass] = Buffer.from(
      proxyAuth.replace("Basic ", ""),
      "base64"
    )
      .toString()
      .split(":")

    if (!dynamic && !!(!!user && !!pass)) {
      if (user !== proxyUser || pass !== proxyPass) {
        return sendAuthRequired()
      }
    }
    ctx.req.locals.proxyUser = proxyUser
    ctx.req.locals.proxyPass = proxyPass

    return next()
  }
