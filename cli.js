#!/usr/bin/env node

const yargs = require('yargs')
const pkg = require('./package.json')

const argv = yargs
  .usage('Usage: $0 --port 9191 [options]')
  .option('port', {
    alias: 'p',
    default: 9191,
    describe: `Port to bind on`,
    type: 'number'
  })
  .option('auth', {
    alias: 'a',
    describe: `Enable proxy authentication`,
    type: 'string'
  })
  .example('$0 --auth "user:pass"', 'Require authentication')
  .option('blacklist-host', {
    describe: `Allow all requests except to blacklist`,
    type: 'string'
  })
  .example('$0 --whitelist-host "a.com,b.net"', 'Allow specific hosts ')
  .option('whitelist-host', {
    describe: `Deny all requests except to whitelist`,
    type: 'string'
  })
  .example('$0 --blacklist-host "a.com,b.net"', 'Block specific hosts ')
  .option('block-msg', {
    describe: `Show custom block message (http only)`,
    type: 'string'
  })
  .example('$0 --block-msg "<h1>Nope ಠ_ಠ</h1>"', 'Custom block message')
  .option('replace-text', {
    describe: `Replace text on websites (http only)`,
    type: 'string'
  })
  .example('$0 --replace-text "cloud:butt"', 'Replace all occurences of cloud with butt')
  .option('debug', {
    alias: 'd',
    describe: `Enabled debug output`,
    type: 'boolean'
  })
  .option('cluster', {
    alias: 'c',
    describe: `Run a cluster of proxies (using number of CPUs)`,
    type: 'boolean'
  })
  .option('cluster-count', {
    describe: `Specify how many cluster workers to spawn`,
    type: 'number'
  })
  .option('quiet', {
    alias: 'q',
    describe: `Suppress request logs`,
    type: 'boolean'
  })
  .option('silent', {
    alias: 's',
    describe: `Don't print anything to stdout`,
    type: 'boolean'
  })
  .help('h')
  .alias('h', 'help')
  .epilog(`Report issues at ${pkg.bugs.url}`)
  .argv

if (argv.debug) { process.env.DEBUG += ',straightforward' }

const Straightforward = require('.')

async function cli () {
  const sf = new Straightforward()

  if (!argv.silent) {
    sf.on('listen', (port) => {
      console.log(`
      straightforward forward-proxy running on localhost:${port}
      `)
    })
    sf.on('serverError', (err) => console.error('An error occured.', err))
  }

  if (argv.auth) {
    const [ user, pass ] = argv.auth.split(':')
    sf.onRequest(sf.middleware.proxyAuth({ user, pass }))
    sf.onConnect(sf.middleware.proxyAuth({ user, pass }))
  }

  if (argv.replaceText) {
    const [ before, after ] = argv.replaceText.split(':')
    sf.onResponse(sf.middleware.replaceText({
      filterFn: (host, url) => true,
      // Try not to replace strings in html tags :-)
      replacerFn: (str) => str.replace(new RegExp(`(${before})(?!(.(?!<))*?(>))`, 'ig'), after)
    }))
  }

  if (argv.blacklistHost || argv.whitelistHost) {
    const blockRequest = sf.middleware.blockRequest({
      filterFn: (host, url) => {
        console.log('asdasd', host, url)
        if (argv.whitelistHost) {
          return !argv.whitelistHost.split(',').includes(host)
        }
        if (argv.blacklistHost) {
          return argv.blacklistHost.split(',').includes(host)
        }
      },
      responseMsg: argv.blockMsg
    })
    sf.onRequest(blockRequest)
    sf.onConnect(blockRequest)
  }

  if (!argv.quiet && !argv.silent && !argv.debug) {
    sf.onRequest(async ({ req, res }, next) => {
      console.log(`\t ${req.method} \t\t ${req.url}`)
      return next()
    })
    sf.onConnect(async ({ req, res }, next) => {
      console.log(`\t ${req.method} \t ${req.url}`)
      return next()
    })
  }
  argv.cluster ? await sf.cluster(argv.port, argv.clusterCount) : await sf.listen(argv.port)
}

cli()
