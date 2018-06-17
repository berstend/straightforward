'use strict'

const EventEmitter = require('events').EventEmitter
const http = require('http')
const net = require('net')
const cluster = require('cluster')
const numCPUs = require('os').cpus().length

const debug = require('debug')('straightforward')

const utils = require('./utils')
const middleware = require('./middleware')

class Straightforward extends EventEmitter {
  constructor (opts = { requestTimeout: null }) {
    super()

    this.requestTimeout = opts.requestTimeout || 60 * 1000 // 60s

    this._hooks = {}
    this.publicHooks.forEach(name => {
      this._hooks[name] = []
      this[name] = (fn) => this._hooks[name].push(fn)
    })
    debug('constructor: \t %o', { ...opts, pid: process.pid })
  }

  get utils () { return utils }
  get middleware () { return middleware }

  get publicHooks () {
    return ['onRequest', 'onResponse', 'onConnect']
  }

  async cluster (port, count = numCPUs) {
    if (cluster.isWorker) { return this.listen(port) }
    for (let i = 0; i < count; i++) { cluster.fork() }
  }

  listen (port) {
    this.server = http.createServer()
    this.server.on('request', this._onRequest.bind(this))
    this.server.on('connect', this._onConnect.bind(this))
    this.server.on('error', this._onServerError.bind(this))
    this.server.on('clientError', this._onRequestError.bind(this))
    this.server.on('upgrade', this._onUpgrade.bind(this))
    process.on('uncaughtException', this._onUncaughtException.bind(this))

    return new Promise(resolve => this.server.listen(port, () => {
      debug('listen: \t %o', { port, pid: process.pid })
      this.emit('listen', port, process.pid, this.server)
      resolve(this)
    }))
  }

  async _onRequest (req, res) {
    debug('onRequest: \t %s %s', req.method, req.url)
    // add internal middleware at the beginning
    this._hooks.onRequest.unshift(this.middleware.basics)
    await this.utils.compose(this._hooks.onRequest)({ req, res })

    if (!req.aborted && !res.finished) {
      this._proxyRequest(req, res)
    }
  }

  _proxyRequest (req, res) {
    // https://nodejs.org/api/http.html#http_http_request_options_callback
    const proxyReq = http.request({
      method: req.method,
      headers: req.headers,
      ...req.urlParts
    })
    proxyReq.removeHeader('proxy-connection')

    req.on('aborted', () => { proxyReq.abort() })

    proxyReq.on('error', (err) => { req.destroy(err) })

    proxyReq.on('response', (proxyRes) => this._onResponse(req, res, proxyRes))

    proxyReq.on('socket', (socket) => {
      socket.setTimeout(this.requestTimeout, () => {
        debug('proxyReq: onTimeout')
        proxyReq.abort()
      })
      if (req.aborted) { return proxyReq.abort() }
      req.pipe(proxyReq)
    })
  }

  async _onResponse (req, res, proxyRes) {
    debug('onResponse: \t %s %s', req.method, req.url)
    proxyRes.on('error', (err) => debug('proxyRes: onError: %o', err))

    this._hooks['onResponse'].push(async ({ req, res, proxyRes }, next) => {
      if (!res._headerSent) { res.writeHead(proxyRes.statusCode, proxyRes.headers) }
      if (!res.finished && !req.aborted) { proxyRes.pipe(res) }
    })

    await this.utils.compose(this._hooks.onResponse)({ req, res, proxyRes })
  }

  async _onConnect (req, clientSocket, head) {
    debug('onConnect: \t %s %s', req.method, req.url)
    // add internal middleware at the beginning
    this._hooks.onConnect.unshift(this.middleware.basics)
    await this.utils.compose(this._hooks.onConnect)({ req, res: clientSocket, clientSocket, head })
    if (!req.aborted && clientSocket.writable) {
      this._proxyConnect(req, clientSocket, head)
    }
  }

  _proxyConnect (req, clientSocket, head) {
    const serverSocket = net.connect(req.urlParts.port, req.urlParts.host, () => {
      clientSocket.write(
        'HTTP/1.1 200 Connection Established\r\n' +
        'Proxy-agent: straightforward\r\n' +
        '\r\n'
      )
      if (!req.aborted && clientSocket.writable) {
        clientSocket.pipe(serverSocket).pipe(clientSocket)
      }
    })
  }

  _onUpgrade (req, clientSocket, head) {
    debug('onUpgrade: \t %s %s', req.headers.upgrade, req.url)
    debug('Unencrypted websockets are not supported.')
    this.emit('upgrade', req, clientSocket, head)
    clientSocket.end()
  }

  _onRequestError (err, socket) {
    // Work with err.code here, e.g ECONNRESET
    debug('onRequestError: \t %o', err)
    this.emit('requestError', err, socket)
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
  }

  _onServerError (err) {
    debug('onServerError: \t %o', err)
    this.emit('serverError', err)
  }

  _onUncaughtException (err) {
    debug('onUncaughtException: \t %o', err)
    this.emit('uncaughtException', err)
  }

  close () {
    this.server.close()
    this.emit('close')
  }
}

module.exports = Straightforward
