// Note: hpagent always uses CONNECT (even for http targets)
import { HttpsProxyAgent } from "hpagent"

// proxy-agent uses requests for http targets
import ProxyAgent from "proxy-agent"

export const makeProxyAgents = (port: number) => {
  return {
    http: new ProxyAgent(`http://localhost:${port}`),
    https: new HttpsProxyAgent({ proxy: `http://localhost:${port}` }),
  }
}

export const delay = (ms: number) => new Promise((_) => setTimeout(_, ms))

export const timeout = async (promises: Promise<any>[], ms: number) =>
  await Promise.race([
    Promise.all(promises),
    delay(5 * 1000).then(() => {
      throw new Error("Timeout exceeded")
    }),
  ])
