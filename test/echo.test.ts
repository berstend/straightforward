import anyTest, { TestFn } from "ava"

const test = anyTest as TestFn<{ port: number }>

import { Straightforward, middleware } from "../src"
import got from "got-cjs"

import { makeProxyAgents, timeout } from "./utils"

let basePort = 10300
test.beforeEach((t) => {
  t.context.port = basePort += 1
})

test("will echo requests", async (t) => {
  const port = t.context.port
  const sf = new Straightforward()
  sf.onRequest.use(middleware.echo)
  await sf.listen(port)

  const data = (await got("http://example.com", {
    agent: makeProxyAgents(port),
  }).json()) as any
  t.deepEqual(data, {
    url: "http://example.com/",
    locals: {
      isConnect: false,
      urlParts: {
        host: "example.com",
        port: 80,
        path: "/",
      },
    },
  })
  t.is(sf.stats.onRequest, 1)

  sf.close()
  t.pass()
})
