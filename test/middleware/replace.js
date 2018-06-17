'use strict'

const { test } = require('ava')

const got = require('got')
const ProxyAgent = require('proxy-agent')

const Straightforward = require('../../')

let basePort = 10600
test.beforeEach(t => { t.context.port = basePort += 1 })

test('should replace text on a site', async (t) => {
  const port = t.context.port
  const proxy = `http://localhost:${port}`
  const reqUrl = 'http://example.com'
  const sf = new Straightforward()
  await sf.listen(port)

  sf.onResponse(sf.middleware.replaceText({
    filterFn: (host, url) => host.includes('example.com'),
    replacerFn: (str) => str.replace(new RegExp('example', 'ig'), 'FOOBAR')
  }))

  const agent = new ProxyAgent(proxy)
  const { statusCode, body } = await got(reqUrl, { agent, throwHttpErrors: false })
  t.is(statusCode, 200)
  t.true(body.includes('FOOBAR'))

  t.false((await got('http://httpbin.org/headers', { agent })).body.includes('FOOBAR'))

  sf.close()
  t.pass()
})
