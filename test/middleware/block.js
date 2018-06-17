'use strict'

const { test } = require('ava')

const got = require('got')
const ProxyAgent = require('proxy-agent')

const Straightforward = require('../../')

let basePort = 10500
test.beforeEach(t => { t.context.port = basePort += 1 })

test('should block blacklisted http request', async (t) => {
  const port = t.context.port
  const proxy = `http://localhost:${port}`
  const reqUrl = 'http://example.com'
  const sf = new Straightforward()
  await sf.listen(port)

  const blockRequest = sf.middleware.blockRequest({
    filterFn: (host, url) => host === 'example.com',
    responseMsg: 'nope'
  })
  sf.onRequest(blockRequest)

  const agent = new ProxyAgent(proxy)
  const { statusCode, body } = await got(reqUrl, { agent, throwHttpErrors: false })
  t.is(statusCode, 403)
  t.is(body, 'nope')

  sf.close()
  t.pass()
})

test('should block blacklisted https request', async (t) => {
  const port = t.context.port
  const proxy = `http://localhost:${port}`
  const reqUrl = 'https://example.com'
  const sf = new Straightforward()
  await sf.listen(port)

  const blockRequest = sf.middleware.blockRequest({
    filterFn: (host, url) => host === 'example.com',
    responseMsg: 'nope'
  })
  sf.onConnect(blockRequest)

  const agent = new ProxyAgent(proxy)
  const { statusCode, body } = await got(reqUrl, { agent, throwHttpErrors: false })
  t.is(statusCode, 403)
  t.is(body, '')

  sf.close()
  t.pass()
})

test('should whitelist certain requests', async (t) => {
  const port = t.context.port
  const proxy = `http://localhost:${port}`
  const sf = new Straightforward()
  await sf.listen(port)

  const blockRequest = sf.middleware.blockRequest({
    filterFn: (host, url) => host === 'example.com',
    responseMsg: 'nope'
  })
  sf.onRequest(blockRequest)
  sf.onConnect(blockRequest)
  const agent = new ProxyAgent(proxy)

  t.is((await got('http://example.com', {
    agent, throwHttpErrors: false
  })).statusCode, 403)

  t.is((await got('https://example.com', {
    agent, throwHttpErrors: false
  })).statusCode, 403)

  t.is((await got('http://www.example.com', {
    agent, throwHttpErrors: false
  })).statusCode, 200)

  t.is((await got('https://www.example.com', {
    agent, throwHttpErrors: false
  })).statusCode, 200)

  sf.close()
  t.pass()
})
