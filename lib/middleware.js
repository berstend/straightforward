'use strict'

const { promisify } = require('util')
const zlib = require('zlib')
const url = require('url')

const utils = require('./utils')

exports.basics = async ({ req, res }, next) => {
  req.isConnect = (req.method.toLowerCase() === 'connect')
  if (req.isConnect) {
    const [ hostname, port ] = req.url.split(':', 2) // format is: hostname:port
    req.urlParts = { host: hostname, port }
  } else {
    req.urlParts = url.parse(req.url)
  }
  return next()
}

exports.proxyAuth = ({ user, pass }) => async ({ req, res }, next) => {
  const sendAuthRequired = () => {
    if (req.isConnect) {
      return res.end(
        'HTTP/1.1 407\r\n' +
        'Proxy-Authenticate: basic\r\n' +
        '\r\n'
      )
    }
    res.writeHead(407, { 'Proxy-Authenticate': 'Basic' })
    res.end()
  }
  const proxyAuth = req.headers['proxy-authorization']
  if (!proxyAuth) { return sendAuthRequired(req) }
  const [ proxyUser, proxyPass ] = Buffer.from(proxyAuth.replace('Basic ', ''), 'base64').toString().split(':')
  if (user !== proxyUser || pass !== proxyPass) { return sendAuthRequired(req) }
  return next()
}

exports.replaceText = ({ filterFn, replacerFn, contentTypeFn }) => async ({ req, res, proxyRes }, next) => {
  contentTypeFn = contentTypeFn || ((ct) => ct.includes('text'))
  if (!contentTypeFn(proxyRes.headers['content-type'] || '')) { return next() }
  if (!filterFn(req.urlParts.host, req.url, req)) { return next() }

  const encoding = proxyRes.headers['content-encoding']

  let buffer = await utils.waitForBuffer(proxyRes)
  if (encoding === 'gzip') {
    buffer = await promisify(zlib.gunzip)(buffer)
  } else if (encoding === 'deflate') {
    buffer = await promisify(zlib.inflate)(buffer)
  }

  let body = replacerFn(buffer.toString('utf-8'))
  if (encoding === 'gzip') {
    body = await promisify(zlib.gzip)(body)
  } else if (encoding === 'deflate') {
    body = await promisify(zlib.deflate)(body)
  }

  proxyRes.headers['content-length'] = Buffer.byteLength(body)
  res.writeHead(proxyRes.statusCode, proxyRes.headers)
  res.end(body)
}

exports.blockRequest = ({ filterFn, responseMsg = '', responseCode = 403, responseCt = 'text/html; charset=utf-8' }) => async ({ req, res }, next) => {
  if (!filterFn(req.urlParts.host, req.url, req)) { return next() }
  if (!responseMsg) { return res.end() }
  if (req.isConnect) {
    res.end('HTTP/1.1 403 Forbidden\r\n\r\n')
  } else {
    res.writeHead(responseCode, { 'Content-Type': responseCt })
    res.end(responseMsg)
  }
}
