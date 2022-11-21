import anyTest, { TestFn } from "ava"

const test = anyTest as TestFn<{ port: number }>

import { Straightforward } from "../src"
import got from "got-cjs"

import { makeProxyAgents, timeout } from "./utils"

test("fn() returns foo", (t) => {
  const fn = () => "foo"
  t.is(fn(), "foo")
})

let basePort = 10200
test.beforeEach((t) => {
  t.context.port = basePort += 1
})

test("can start and stop a server", async (t) => {
  const port = t.context.port
  const sf = new Straightforward()
  await sf.listen(port)
  sf.close()
  t.pass()
})

test("can proxy basic http requests", async (t) => {
  const port = t.context.port
  const sf = new Straightforward()
  await sf.listen(port)

  const { body } = await got("http://example.com", {
    agent: makeProxyAgents(port),
  })
  t.true(body.includes(`<h1>Example`))
  t.is(sf.stats.onRequest, 1)

  sf.close()
  t.pass()
})

test("can proxy basic https requests through CONNECT", async (t) => {
  const port = t.context.port
  const sf = new Straightforward()
  await sf.listen(port)

  const { body } = await got("https://example.com", {
    agent: makeProxyAgents(port),
  })
  t.true(body.includes(`<h1>Example`))
  t.is(sf.stats.onConnect, 1)

  sf.close()
  t.pass()
})

test("will trigger onRequest", async (t) => {
  const port = t.context.port
  const sf = new Straightforward()
  await sf.listen(port)

  const eventPromise = new Promise((resolve) => {
    sf.onRequest.use(async ({ req, res }, next) => {
      resolve(true)
    })
  })

  const reqPromise = got("http://example.com", {
    agent: makeProxyAgents(port),
  })

  await timeout([eventPromise, reqPromise], 5 * 1000)

  sf.close()
  t.pass()
})

test("will trigger onResponse", async (t) => {
  const port = t.context.port
  const sf = new Straightforward()
  await sf.listen(port)

  const eventPromise = new Promise((resolve) => {
    sf.onResponse.use(async ({ req, res }, next) => {
      resolve(true)
      return next()
    })
  })

  const reqPromise = got("http://example.com", {
    agent: makeProxyAgents(port),
  })
  await timeout([eventPromise, reqPromise], 5 * 1000)

  sf.close()
  t.pass()
})

test("will trigger onConnect", async (t) => {
  const port = t.context.port
  const sf = new Straightforward()
  await sf.listen(port)

  const eventPromise = new Promise((resolve) => {
    sf.onConnect.use(async ({ req }, next) => {
      resolve(true)
    })
  })

  const reqPromise = got("https://example.com", {
    agent: makeProxyAgents(port),
  })
  await timeout([eventPromise, reqPromise], 5 * 1000)

  sf.close()
  t.pass()
})
