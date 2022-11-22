#!/usr/bin/env node
// @ts-check

const yargs = require("yargs")
const pkg = require("./package.json")

const argv = yargs
  // @ts-ignore
  .usage("Usage: $0 --port 9191 [options]")
  .option("port", {
    alias: "p",
    default: 9191,
    describe: `Port to bind on`,
    type: "number",
  })
  .option("auth", {
    alias: "a",
    describe: `Enable proxy authentication`,
    type: "string",
  })
  .option("dynamic-auth", {
    // alias: "a",
    describe: `Enable proxy authentication with no validation`,
    type: "boolean",
  })
  .example('$0 --auth "user:pass"', "Require authentication")
  .option("echo", {
    alias: "e",
    describe: `Enable echo mode (mock all http responses)`,
    type: "boolean",
  })
  .example("$0 --echo", "Mock responses for all http requests")
  .option("debug", {
    alias: "d",
    describe: `Enabled debug output`,
    type: "boolean",
  })
  .option("cluster", {
    alias: "c",
    describe: `Run a cluster of proxies (using number of CPUs)`,
    type: "boolean",
  })
  .option("cluster-count", {
    describe: `Specify how many cluster workers to spawn`,
    type: "number",
  })
  .option("quiet", {
    alias: "q",
    describe: `Suppress request logs`,
    type: "boolean",
  })
  .option("silent", {
    alias: "s",
    describe: `Don't print anything to stdout`,
    type: "boolean",
  })
  .help("h")
  .alias("h", "help")
  .epilog(`Report issues at ${pkg.bugs.url}`).argv

if (argv.debug) {
  process.env.DEBUG += ",straightforward"
}

const { Straightforward, middleware } = require("./dist/index.js")

async function cli() {
  const sf = new Straightforward()

  if (!argv.silent) {
    sf.on("listen", (port) => {
      console.log(`
      straightforward forward-proxy running on localhost:${port}
      `)
    })
    sf.on("serverError", (err) => console.error("An error occured.", err))
  }

  if (argv.auth && !argv.dynamicAuth) {
    const [user, pass] = argv.auth.split(":")
    sf.onRequest.use(middleware.auth({ user, pass }))
    sf.onConnect.use(middleware.auth({ user, pass }))
  }

  if (argv.dynamicAuth) {
    sf.onRequest.use(middleware.auth({ dynamic: true }))
    sf.onConnect.use(middleware.auth({ dynamic: true }))
  }

  if (argv.echo) {
    sf.onRequest.use(middleware.echo)
  }

  if (!argv.quiet && !argv.silent && !argv.debug) {
    sf.onRequest.use(async ({ req, res }, next) => {
      console.log(`\t ${req.method} \t\t ${req.url}`)
      return next()
    })
    sf.onConnect.use(async ({ req }, next) => {
      console.log(`\t ${req.method} \t ${req.url}`)
      return next()
    })
  }
  argv.cluster
    ? await sf.cluster(argv.port, argv.clusterCount)
    : await sf.listen(argv.port)
}

cli()
