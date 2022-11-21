import { Middleware, RequestContext } from ".."

import Debug from "debug"
const debug = Debug("straightforward:middleware")

/** Echo an incoming proxy request by returning it's data */
export const echo: Middleware<RequestContext> = async ({ req, res }, next) => {
  debug("echoing incoming request")
  const data = {
    url: req.url || "",
    locals: req.locals,
  }
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" })
  res.end(JSON.stringify(data, null, 2))
}
