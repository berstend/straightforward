# 🏴 straightforward ![npm bundle size](https://img.shields.io/bundlephobia/min/straightforward) [![ ](https://img.shields.io/npm/v/straightforward.svg)](https://www.npmjs.com/package/straightforward)

<a href="https://github.com/berstend/straightforward"><img src="https://i.imgur.com/B9KXKGS.jpg" width="214px" height="790px" align="right" /></a>

> A straightforward forward-proxy written in Node.js

## Goals

- Extremely focused (~200 SLOC), no-fuzz **forward proxy**
- **Support HTTP, HTTPS, CONNECT & Websockets** (wss)
- Performant: By default all requests/responses are streamed
- No external dependencies, small, self-contained, tested
- Support both cli and extensible programmatic usage
- Straightforward: no implicit magic or abstractions

### What you can do with it

- Start an explicit forwarding proxy in seconds that just works
- Optionally use authentication
- Mock responses to test code using a proxy
- Allow others to surf with your IP address
- Use it programmatically to do whatever you want

### What this is not

- A [ssl-intercepting] proxy (https can be filtered but not modified)
- A [reverse proxy to load-balance stuff] to internal servers
- A [general purpose webserver] framework
- A [proxy middleware] for express
- A [transparent] forward proxy
- A [caching] proxy
- A [sni] proxy

[ssl-intercepting]: https://mitmproxy.org/
[reverse proxy to load-balance stuff]: https://github.com/nodejitsu/node-http-proxy
[general purpose webserver]: https://github.com/fastify/fastify
[proxy middleware]: https://github.com/villadora/express-http-proxy
[transparent]: https://wiki.alpinelinux.org/wiki/Setting_up_Explicit_Squid_Proxy#transparent_forward_proxy
[caching]: https://www.linuxlinks.com/webcaches/
[sni]: https://github.com/jornane/node-snip

## Installation

```bash
# Use directly with no installation (npx is part of npm):
❯❯❯ npx straightforward --port 9191

# Or install globally:
❯❯❯ npm install -g straightforward
```

## Usage (cli)

```bash
❯❯❯ straightforward --help

Usage: straightforward --port 9191 [options]

Options:
      --version        Show version number                             [boolean]
  -p, --port           Port to bind on                  [number] [default: 9191]
  -a, --auth           Enable proxy authentication                      [string]
  -e, --echo           Enable echo mode (mock all http responses)      [boolean]
  -d, --debug          Enabled debug output                            [boolean]
  -c, --cluster        Run a cluster of proxies (using number of CPUs) [boolean]
      --cluster-count  Specify how many cluster workers to spawn        [number]
  -q, --quiet          Suppress request logs                           [boolean]
  -s, --silent         Don't print anything to stdout                  [boolean]
  -h, --help           Show help                                       [boolean]

Examples:
  straightforward --auth "user:pass"  Require authentication
  straightforward --echo              Mock responses for all http requests

Use with cURL:
  curl --proxy https://localhost:9191 'http://example.com' -v
  curl --proxy https://user:pass@localhost:9191 'http://example.com' -v
```

## Usage (code)

```js
// ESM/TS: import { Straightforward, middleware } from "straightforward"
const { Straightforward, middleware } = require("straightforward")

;(async () => {
  // Start proxy server
  const sf = new Straightforward()
  await sf.listen(9191)
  console.log(`Proxy listening on http://localhost:9191`)

  // Log http requests
  sf.onRequest.use(async ({ req, res }, next) => {
    console.log(`http request: ${req.url}`)
    // Note the common middleware pattern, use `next()`
    // to pass the request to the next handler.
    return next()
  })

  // Log connect (https) requests
  sf.onConnect.use(async ({ req }, next) => {
    console.log(`connect request: ${req.url}`)
    return next()
  })

  // Use built-in middleware for authentication
  sf.onRequest.use(middleware.auth({ user: "bob", pass: "alice" }))
  sf.onConnect.use(middleware.auth({ user: "bob", pass: "alice" }))

  // Use built-in middleware to mock responses for all http requests
  sf.onRequest.use(middleware.echo)
})()
```

## In action

```bash
❯❯❯ straightforward --port 9191
```

![foobar](https://i.imgur.com/ZOxVhxE.png)

## Example: Secure proxy on fresh server in 30 seconds

Let's say you have a fresh linux server and want to use it as an authenticated forward proxy quickly.

- Make sure [nvm](https://github.com/creationix/nvm#install-script) is installed:
  - `curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.sh | bash`
- Make sure a recent version of Node.js is installed:
  - `nvm install node && nvm use node && node --version`
- Add [forever](https://www.npmjs.com/package/forever) (process manager) and straightforward:
  - `npm install -g forever straightforward`
- Start proxy daemon:
  - `forever start --id "proxy1" $( which straightforward ) --port 9191 --quiet --auth 'user:foobar'`
- Test your proxy from a different machine:
  - `curl --proxy http://user:foobar@SERVER:9191/ http://canhazip.com`
- List all running forever services:
  - `forever list`
- Stop our proxy service daemon:
  - `forever stop proxy1`

## API

### onRequest

Middlewares triggered when http requests occur

```js
sf.onRequest.use(async ({ req, res }, next) => {
  console.log(`http request: ${req.url}`)
  // Note the common middleware pattern, use `next()`
  // to pass the request to the next handler.
  return next()
})
```

Middlwares can be chained:

```js
sf.onRequest.use(
  async ({ req, res }, next) => {
    console.log(`middleware1`)
    return next()
  },
  async ({ req, res }, next) => {
    console.log(`middleware2`)
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
    res.end("Hello world")
  }
)
```

### onResponse

Middlewares triggered when http request responses are available

```js
sf.onResponse.use(async ({ req, res, proxyRes }, next) => {
  console.log(`http response`)
  return next()
})
```

### onConnect

Middlewares triggered when https and wss requests occur

```js
sf.onConnect.use(async ({ req, clientSocket, head }, next) => {
  console.log(`connect request`)
  return next()
})
```

## License

MIT
