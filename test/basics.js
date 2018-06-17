'use strict'

const { test } = require('ava')

const got = require('got')
const ProxyAgent = require('proxy-agent')

const Straightforward = require('../')

let basePort = 10200
test.beforeEach(t => { t.context.port = basePort += 1 })

test('can start and stop a server', async (t) => {
  const port = t.context.port
  const sf = new Straightforward()
  await sf.listen(port)
  sf.close()
  t.pass()
})

test('can proxy basic http requests', async (t) => {
  const port = t.context.port
  const sf = new Straightforward()
  await sf.listen(port)

  const agent = new ProxyAgent(`http://localhost:${port}`)
  const { body } = await got('http://example.com', { agent })
  t.true(body.includes(`<h1>Example`))

  sf.close()
  t.pass()
})

test('can proxy basic https requests', async (t) => {
  const port = t.context.port
  const sf = new Straightforward()
  await sf.listen(port)

  const agent = new ProxyAgent(`http://localhost:${port}`)
  const { body } = await got('https://example.com', { agent })
  t.true(body.includes(`<h1>Example`))

  sf.close()
  t.pass()
})
