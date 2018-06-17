'use strict'

const { test } = require('ava')

const got = require('got')
const ProxyAgent = require('proxy-agent')

const Straightforward = require('../../')

let basePort = 10500
test.beforeEach(t => { t.context.port = basePort += 1 })

test('should protect http request', async (t) => {
  const port = t.context.port
  const proxy = `http://localhost:${port}`
  const reqUrl = 'http://example.com'
  const user = 'bob'
  const pass = 'swordfish'
  const sf = new Straightforward()
  await sf.listen(port)

  sf.onRequest(sf.middleware.proxyAuth({ user, pass }))

  const agent = new ProxyAgent(proxy)
  const { statusCode } = await got(reqUrl, { agent, throwHttpErrors: false })
  t.is(statusCode, 407)

  sf.close()
  t.pass()
})

test('should protect https request', async (t) => {
  const port = t.context.port
  const proxy = `http://localhost:${port}`
  const reqUrl = 'https://example.com'
  const user = 'bob'
  const pass = 'swordfish'
  const sf = new Straightforward()
  await sf.listen(port)

  sf.onConnect(sf.middleware.proxyAuth({ user, pass }))

  const agent = new ProxyAgent(proxy)
  const { statusCode } = await got(reqUrl, { agent, throwHttpErrors: false })
  t.is(statusCode, 407)

  sf.close()
  t.pass()
})

test('should allow http request with correct credentials', async (t) => {
  const port = t.context.port
  const proxy = `http://localhost:${port}`
  const reqUrl = 'http://example.com'
  const user = 'bob'
  const pass = 'swordfish'
  const sf = new Straightforward()
  await sf.listen(port)

  sf.onConnect(sf.middleware.proxyAuth({ user, pass }))

  const authHeader = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`

  const agent = new ProxyAgent(proxy)
  const { statusCode } = await got(reqUrl, {
    agent,
    headers: { 'proxy-authorization': authHeader }
  })
  t.is(statusCode, 200)

  sf.close()
  t.pass()
})
