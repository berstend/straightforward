'use strict'

const { test } = require('ava')

const got = require('got')
const ProxyAgent = require('proxy-agent')
const timeout = require('p-timeout')

const Straightforward = require('../')

let basePort = 10300
test.beforeEach(t => { t.context.port = basePort += 1 })

test('will trigger onRequest', async (t) => {
  const port = t.context.port
  const sf = new Straightforward()
  await sf.listen(port)

  const hookPromise = new Promise(resolve => {
    sf.onRequest(async ({ req, res }, next) => { resolve() })
  })

  const agent = new ProxyAgent(`http://localhost:${port}`)
  const reqPromise = got('http://example.com', { agent })
  await timeout(Promise.all([hookPromise, reqPromise]), 5000)

  sf.close()
  t.pass()
})

test('will trigger onResponse', async (t) => {
  const port = t.context.port
  const sf = new Straightforward()
  await sf.listen(port)

  const hookPromise = new Promise(resolve => {
    sf.onResponse(async ({ req, res }, next) => {
      resolve()
      return next()
    })
  })

  const agent = new ProxyAgent(`http://localhost:${port}`)
  const reqPromise = got('http://example.com', { agent })
  await timeout(Promise.all([hookPromise, reqPromise]), 5000)

  sf.close()
  t.pass()
})

test('will trigger onConnect', async (t) => {
  const port = t.context.port
  const sf = new Straightforward()
  await sf.listen(port)

  const hookPromise = new Promise(resolve => {
    sf.onConnect(async ({ req, res }, next) => { resolve() })
  })

  const agent = new ProxyAgent(`http://localhost:${port}`)
  const reqPromise = got('https://example.com', { agent })
  await timeout(Promise.all([hookPromise, reqPromise]), 5000)

  sf.close()
  t.pass()
})
