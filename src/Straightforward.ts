import http from "http"
import net from "net"
import cluster from "cluster"
import { EventEmitter } from "events"
import internal from "stream"

import { MiddlewareDispatcher } from "./MiddlewareDispatcher"

import { auth } from "./middleware/auth"
import { echo } from "./middleware/echo"

import os from "os"
const numCPUs = os.cpus().length

import Debug from "debug"
const debug = Debug("straightforward")

export interface StraightforwardOptions {
  requestTimeout: number
}

export type Request = http.IncomingMessage & RequestAdditions

export interface RequestLocals {
  isConnect: boolean
  urlParts: { host: string; port: number; path: string }
}

export interface RequestAdditions {
  locals: RequestLocals
}

export type Response = http.ServerResponse<http.IncomingMessage> & {
  req: http.IncomingMessage
}

export type ProxyResponse = http.IncomingMessage

export type RequestContext<
  Locals extends { locals: Record<string, any> } = { locals: {} }
> = {
  req: Request & Locals
  res: Response
}

export type ResponseContext<
  Locals extends { locals: Record<string, any> } = { locals: {} }
> = {
  req: Request
  res: Response
  proxyRes: ProxyResponse
}

export type ConnectContext<
  Locals extends { locals: Record<string, any> } = { locals: {} }
> = {
  req: Request & Locals
  clientSocket: internal.Duplex
  head: Buffer
}

/** Typeguard to check if a context belongs to a http request (rather than a connect request) */
export function isRequest(ctx: any): ctx is RequestContext {
  return ctx.res !== undefined
}

/** Typeguard to check if a context belongs to a connect request (rather than a http request) */
export function isConnect(ctx: any): ctx is ConnectContext {
  return ctx.clientSocket !== undefined
}

export class Straightforward extends EventEmitter {
  public server: http.Server = http.createServer()
  public instanceId = Math.random()
  public opts: StraightforwardOptions

  public onRequest = new MiddlewareDispatcher<RequestContext<any>>()
  public onResponse = new MiddlewareDispatcher<ResponseContext<any>>()
  public onConnect = new MiddlewareDispatcher<ConnectContext<any>>()

  public stats = {
    onRequest: 0,
    onConnect: 0,
  }

  constructor(opts: Partial<StraightforwardOptions> = {}) {
    super()
    this.opts = {
      requestTimeout: opts.requestTimeout || 60 * 1000, // 60s
    }
    debug("constructor: \t %o", {
      instanceId: this.instanceId,
      ...opts,
      pid: process.pid,
    })
  }

  public async cluster(port: number, count: number = numCPUs) {
    if (cluster.isWorker) {
      return this.listen(port)
    }
    for (let i = 0; i < count; i++) {
      cluster.fork()
    }
  }

  public async listen(port: number = 9191) {
    this.server.on("request", this._onRequest.bind(this))
    this.server.on("connect", this._onConnect.bind(this))
    this.server.on("error", this._onServerError.bind(this))
    this.server.on("clientError", this._onRequestError.bind(this))
    this.server.on("upgrade", this._onUpgrade.bind(this))
    process.on("uncaughtException", this._onUncaughtException.bind(this))

    return new Promise((resolve) =>
      this.server.listen(port, () => {
        debug("listen: \t %o", { port, pid: process.pid })
        this.emit("listen", port, process.pid, this.server)
        resolve(this)
      })
    )
  }

  public close() {
    debug("close")
    try {
      this.server.close()
    } catch (err) {
      debug("close err", err)
    }
    this.emit("close")
  }

  private async _onRequest(req: Request, res: Response) {
    debug("onRequest: \t %s %s", req.method, req.url)
    this._populateUrlParts(req)
    this.stats.onRequest++
    await this.onRequest.dispatch({ req, res })

    if (!req.destroyed && !res.writableEnded) {
      this._proxyRequest(req, res)
    } else {
      debug("onRequest - ended: \t %s %s", req.method, req.url)
    }
  }

  private _proxyRequest(req: Request, res: Response) {
    // debug("proxyReq: \t %s %s", req.method, req.url, req.locals)

    // https://nodejs.org/api/http.html#http_http_request_options_callback
    const proxyReq = http.request({
      method: req.method,
      headers: req.headers,
      ...req.locals.urlParts,
    })
    proxyReq.removeHeader("proxy-connection")

    req.on("destroyed", () => {
      debug("proxyReq - destroyed: \t %s %s", req.method, req.url)
      proxyReq.destroy()
    })

    proxyReq.on("error", (err) => {
      debug("proxyReq - error: \t %s %s", req.method, req.url, err)
      req.destroy(err)
    })

    proxyReq.on("response", (proxyRes) => this._onResponse(req, res, proxyRes))

    proxyReq.on("socket", (socket) => {
      socket.setTimeout(this.opts.requestTimeout, () => {
        debug("proxyReq: onTimeout", this.opts.requestTimeout)
        proxyReq.destroy()
      })
      if (req.destroyed) {
        return proxyReq.destroy()
      }
      req.pipe(proxyReq).on("error", (e) => {
        debug("req.pipe(proxyReq) has error: " + e.message)
      })
    })
  }

  private async _onResponse(
    req: Request,
    res: Response,
    proxyRes: ProxyResponse
  ) {
    debug("onResponse: \t %s %s", req.method, req.url)
    proxyRes.on("error", (err) => debug("proxyRes: onError: %o", err))

    await this.onResponse.dispatch({ req, res, proxyRes })

    if (!res.headersSent) {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers)
    }
    if (!res.writableEnded) {
      proxyRes.pipe(res).on("error", (e) => {
        debug("proxyRes.pipe(res) has error: " + e.message)
      })
    }
  }

  private async _onConnect(
    req: Request,
    clientSocket: internal.Duplex,
    head: Buffer
  ) {
    debug("onConnect: \t %s %s", req.method, req.url)
    this._populateUrlParts(req)
    this.stats.onConnect++
    await this.onConnect.dispatch({ req, clientSocket, head })
    if (!req.destroyed && clientSocket.writable) {
      this._proxyConnect(req, clientSocket, head)
    }
  }

  private _proxyConnect(
    req: Request,
    clientSocket: internal.Duplex,
    head: Buffer
  ) {
    const serverSocket = net.connect(
      req.locals.urlParts.port,
      req.locals.urlParts.host,
      () => {
        clientSocket.write(
          "HTTP/1.1 200 Connection Established\r\n" +
            "Proxy-agent: straightforward\r\n" +
            "\r\n"
        )

        serverSocket.write(head)
        if (!req.destroyed && clientSocket.writable) {
          serverSocket.pipe(clientSocket).on("error", (e) => {
            debug("serverSocket.pipe(clientSocket) has error: " + e.message)
          })
          clientSocket.pipe(serverSocket).on("error", (e) => {
            debug("clientSocket.pipe(serverSocket) has error: " + e.message)
          })
        }
      }
    )

    clientSocket.on("destroyed", () => {
      debug("clientSocket - destroyed: \t %s %s", req.method, req.url)
      serverSocket.destroy()
    })

    // https://github.com/nodejs/node/issues/23169#issuecomment-573377044
    serverSocket.on("error", (err) => {
      debug("serverSocket error", err)
      clientSocket.destroy()
    })
  }

  private _onUpgrade(
    req: Request,
    clientSocket: internal.Duplex,
    head: Buffer
  ) {
    debug("onUpgrade: \t %s %s", req.headers.upgrade, req.url)
    debug("Unencrypted websockets are not supported.")
    this.emit("upgrade", req, clientSocket, head)
    clientSocket.end()
  }

  private _onRequestError(err: Error, socket: internal.Duplex) {
    // Work with err.code here, e.g ECONNRESET
    debug("onRequestError: \t %o", err)
    this.emit("requestError", err, socket)
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n")
  }

  private _onServerError(err: Error) {
    debug("onServerError: \t %o", err)
    this.emit("serverError", err)
  }

  private _onUncaughtException(err: Error) {
    debug("onUncaughtException: \t %o", err)
    this.emit("uncaughtException", err)
  }

  private _populateUrlParts(req: Request) {
    if (!req.method || !req.url) {
      throw new Error("Invalid request")
    }
    ;(req.locals as any) = {}
    req.locals.isConnect = req.method.toLowerCase() === "connect"
    if (req.locals.isConnect) {
      const [hostname, port] = req.url.split(":", 2) // format is: hostname:port
      req.locals.urlParts = { host: hostname, port: parseInt(port), path: "" }
    } else {
      const urlParts = new URL(req.url)
      req.locals.urlParts = {
        host: urlParts.host,
        port: parseInt(urlParts.port || "80"),
        path: urlParts.pathname + urlParts.search,
      }
    }
  }
}
