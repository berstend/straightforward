'use strict'

const { test } = require('ava')

const got = require('got')
const ProxyAgent = require('proxy-agent')
const timeout = require('p-timeout')
const url = require('url')

const Straightforward = require('../../')

let basePort = 10400
test.beforeEach(t => { t.context.port = basePort += 1 })

test('adds data to http request', async (t) => {
  const port = t.context.port
  const proxy = `http://localhost:${port}`
  const reqUrl = 'http://example.com'
  const sf = new Straightforward()
  await sf.listen(port)

  const hookPromise = new Promise((resolve, reject) => {
    sf.onRequest(async ({ req, res }, next) => {
      t.deepEqual(req.urlParts, url.parse(reqUrl))
      t.is(req.isConnect, false)
      resolve()
    })
  })

  const agent = new ProxyAgent(proxy)
  const reqPromise = got(reqUrl, { agent })
  await timeout(Promise.all([hookPromise, reqPromise]), 5000)

  sf.close()
  t.pass()
})

test('adds data to https request', async (t) => {
  const port = t.context.port
  const proxy = `http://localhost:${port}`
  const reqUrl = 'https://example.com'
  const sf = new Straightforward()
  await sf.listen(port)

  const hookPromise = new Promise((resolve, reject) => {
    sf.onConnect(async ({ req, res }, next) => {
      t.deepEqual(req.urlParts, { host: 'example.com', port: '443' })
      t.is(req.isConnect, true)
      resolve()
    })
  })

  const agent = new ProxyAgent(proxy)
  const reqPromise = got(reqUrl, { agent })
  await timeout(Promise.all([hookPromise, reqPromise]), 5000)

  sf.close()
  t.pass()
})
