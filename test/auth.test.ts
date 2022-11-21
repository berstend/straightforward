import anyTest, { TestFn } from "ava"

const test = anyTest as TestFn<{ port: number }>

import { Straightforward, middleware } from "../src"
import got from "got-cjs"

import { makeProxyAgents, timeout } from "./utils"

let basePort = 10400
test.beforeEach((t) => {
  t.context.port = basePort += 1
})

test("will require auth", async (t) => {
  const port = t.context.port
  const sf = new Straightforward()
  sf.onRequest.use(middleware.auth({ dynamic: true }), middleware.echo)
  await sf.listen(port)

  const user = "foo"
  const pass = "bar"

  const authHeader = `Basic ${Buffer.from(`${user}:${pass}`).toString(
    "base64"
  )}`

  const data = (await got("http://example.com", {
    agent: makeProxyAgents(port),
    headers: { "proxy-authorization": authHeader },
  }).json()) as any
  t.deepEqual(data, {
    url: "http://example.com/",
    locals: {
      isConnect: false,
      proxyPass: "bar",
      proxyUser: "foo",
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
