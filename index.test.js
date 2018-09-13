import test from 'ava'
import express from 'express'
import fetch from 'node-fetch'
import chaosMiddleware from './index'

const spy = {
  exitCode: null,
  callcounts: {
    exit: 0,
    kill: 0,
    reject: 0,
  }
}

const origExit = process.exit.bind(process)
process.exit = (code) => {
  if(code === 255) {
    process.emit('exit', code)
  } else {
    origExit(code)
  }
}

const origReject = Promise.reject
Promise.reject = (e) => {
  spy.callcounts.reject++
}

process.on('exit', (code) => {
  spy.exitCode = code
  spy.callcounts.exit++
})

process.on('SIGUSR2', () => {
  spy.callcounts.kill++
})

const timeout = (amount) => new Promise((resolve, reject) => {
  setTimeout(resolve, amount)
})

const startServer = (random) => {
  return new Promise((resolve, reject) => {
    const app = express()

    app.use((req, res, next) => {
      req.data = {
        start: new Date(),
      }
      next()
    })

    app.use(chaosMiddleware({
      random,
      probability: 0.1,
      rules: [
        {
          weight: 10,
          event: 'httpStatus',
          params: 500
        },
        {
          weight: 10,
          event: 'delay',
          params: 3000,
        },
        {
          weight: 10,
          event: 'close',
        },
        {
          weight: 10,
          event: 'exit',
          params: 255,
        },
        {
          weight: 10,
          event: 'kill',
          params: 'SIGUSR2',
        },
        {
          weight: 10,
          event: 'throwError',
          params: new Error('throwError'),
        },
        {
          weight: 10,
          event: 'reject',
          params: new Error('reject'),
        },
      ]
    }))
    app.use((req, res, next) => {
      req.data.end = new Date()
      req.data.msg = 'ok'
      res.write(JSON.stringify(req.data))
      res.end()
    })
    app.use((err, req, res, next) => {
      req.data.end = new Date()
      req.data.msg = 'err'
      res.write(JSON.stringify(req.data))
      res.end()
    })

    const server = app.listen(0, '127.0.0.1', () => resolve({ app, server}))
    server.on('error', reject)
  })
}

test.beforeEach(async t => {
  const holder = { value: [0, 0] }
  const random = () => holder.value.shift()
  const { app, server } = await startServer(random)

  const adr = server.address()
  const address = `${adr.address}:${adr.port}`

  t.context = {
    app,
    server,
    address,

    async request(v){
      holder.value = v
      return await Promise.race([fetch(`http://${address}`), timeout(5000).then(() => { throw 'timeout' })])
    },
  }
})

test.afterEach(async t => {
  const { server } = t.context
  await new Promise((resolve, reject) => {
    server.close(resolve)
  })
})

test('probability', async t => {
  const { request } = t.context

  const res = await request([0.2])
  const { msg } = await res.json()

  t.is(msg, 'ok')
})

test('httpStatus', async t => {
  const { request } = t.context

  const res = await request([0.01, (1.0 / 7 - 0.01)])

  t.is(res.status, 500)
})

test('delay', async t => {
  const { request } = t.context

  const res = await request([0.01, (2.0 / 7 - 0.01)])
  const { start, end } = await res.json()
  const delta =(new Date(end)).getTime() - (new Date(start)).getTime()

  t.true(delta > 2000)
})

test('close', async t => {
  const { request } = t.context

  await t.throws(request([0.01, (3.0 / 7 - 0.01)]))
})

test('exit', async t => {
  const { request } = t.context

  t.is(spy.callcounts.exit, 0)
  await request([0.01, (4.0 / 7 - 0.01)])

  t.is(spy.callcounts.exit, 1)
  t.is(spy.exitCode, 255)
})

test('kill', async t => {
  const { request } = t.context

  t.is(spy.callcounts.kill, 0)
  await request([0.01, (5.0 / 7 - 0.01)])
  await timeout(1000)

  t.is(spy.callcounts.kill, 1)
})

test('throwError', async t => {
  const { request } = t.context

  const res = await request([0.01, (6.0 / 7 - 0.01)])
  const { msg } = await res.json()

  t.is(msg, 'err')
})

test('reject', async t => {
  const { request } = t.context

  t.is(spy.callcounts.reject, 0)
  await request([0.01, (7.0 / 7 - 0.01)])
  await timeout(1000)
  t.is(spy.callcounts.reject, 1)
})
