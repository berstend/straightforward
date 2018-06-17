# 🏴 straightforward [![ ](https://travis-ci.org/berstend/straightforward.svg?branch=master)](https://travis-ci.org/berstend/straightforward) [![ ](https://packagephobia.now.sh/badge?p=straightforward@2.0.3)](https://packagephobia.now.sh/result?p=straightforward) [![ ](https://img.shields.io/npm/v/straightforward.svg)](https://www.npmjs.com/package/straightforward)

<a href="https://github.com/berstend/straightforward"><img src="https://i.imgur.com/B9KXKGS.jpg" width="214px" height="790px" align="right" /></a>

> A straightforward forward-proxy written in Node.js

## Goals
* Extremely focused (~200 SLOC), no-fuzz **forward proxy**
* **Support HTTP, HTTPS, CONNECT & Websockets** (wss)
* Performant: By default all requests/responses are streamed
* No external dependencies, small, self-contained, tested
* Support both cli and extensible programmatic usage
* Straightforward: no implicit magic or abstractions

### What you can do with it
* Start an explicit forwarding proxy in seconds that just works
* Optionally use authentication and a white-/blacklist for hosts
* Block requests, fake or modify responses
* Allow others to surf with your IP address 
* Use it programmatically to do whatever you want

### What this is not
* A [ssl-intercepting] proxy (https can be filtered but not modified)
* A [reverse proxy to load-balance stuff] to internal servers
* A [general purpose webserver] framework
* A [proxy middleware] for express
* A [transparent] forward proxy
* A [caching] proxy
* A [sni] proxy

[ssl-intercepting]:https://mitmproxy.org/
[reverse proxy to load-balance stuff]:https://github.com/nodejitsu/node-http-proxy
[general purpose webserver]:https://github.com/fastify/fastify
[proxy middleware]:https://github.com/villadora/express-http-proxy
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
  --version         Show version number                                [boolean]
  --port, -p        Port to bind on                     [number] [default: 9191]
  --auth, -a        Enable proxy authentication                         [string]
  --blacklist-host  Allow all requests except to blacklist              [string]
  --whitelist-host  Deny all requests except to whitelist               [string]
  --block-msg       Show custom block message (http only)               [string]
  --replace-text    Replace text on websites (http only)                [string]
  --debug, -d       Enabled debug output                               [boolean]
  --cluster, -c     Run a cluster of proxies (using number of CPUs)    [boolean]
  --cluster-count   Specify how many cluster workers to spawn           [number]
  --quiet, -q       Suppress request logs                              [boolean]
  --silent, -s      Dont print anything to stdout                     [boolean]
  -h, --help        Show help                                          [boolean]

Examples:
  straightforward --auth "user:pass"               Require authentication
  straightforward --whitelist-host "a.com,b.net"   Allow specific hosts
  straightforward --blacklist-host "a.com,b.net"   Block specific hosts
  straightforward --block-msg "<h1>Nope ಠ_ಠ</h1>"  Custom block message
  straightforward --replace-text "cloud:butt"      Replace all occurences of cloud with butt

Use with cURL:
  curl --proxy https://localhost:9191 'http://example.com' -v
```

## Usage (code)
```es6
const Straightforward = require('straightforward')

;(async () => {
  // Start proxy server
  const sf = await new Straightforward().listen(9191)
  console.log(`Proxy listening on http://localhost:9191`)

  // Log http requests
  sf.onRequest(async ({ req, res }, next) => {
    console.log(`http request: ${req.url}`)
    // Note the common middleware pattern, use `next()`
    // to pass the request to the next handler.
    return next()
  })

  // Log connect (https) requests
  sf.onConnect(async ({ req, res }, next) => {
    console.log(`connect request: ${req.url}`)
    return next()
  })

  // Filter some requests dynamically
  const blockRequest = sf.middleware.blockRequest({
    filterFn: (host, url) => host.includes('malware.com'),
    responseMsg: `<h1>None shall pass. 🐗</h1>`
  })
  sf.onRequest(blockRequest) // for http
  sf.onConnect(blockRequest) // for https

  // Replace text on http://example.com for fun and glory
  sf.onResponse(sf.middleware.replaceText({
    filterFn: (host, url) => host.includes('example.com'),
    replacerFn: (str) => str.replace(/example/ig, 'FOOBAR')
  }))
})()
```

![foobar](https://i.imgur.com/ZOxVhxE.png)



## API

#### onRequest

#### onResponse

#### onConnect


## License

MIT

