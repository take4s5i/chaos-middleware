'use strict';

const createChaos = (random, events, rules) => {
  const _rules = rules.map(r => {
    const run = events[r.event].apply(null, Array.isArray(r.params) ? r.params : [r.params])
    return {
      weight: r.weight || 1,
      run,
    }
  })

  return (req, res, next) => {
    const max = _rules.map(r => r.weight).reduce((a, b) => a + b, 0)
    const rand = Math.floor(random() * max)
    let acc = 0
    for(const rule of _rules){
      acc += rule.weight
      if(rand <= acc){
        rule.run(req, res, next)
        return
      }
    }

    next()
  }
}

const chaosMiddleware = (opts = {}) => {
  const random = opts.random || Math.random
  const rules = opts.rules || []
  const probability = opts.probability || 0.1

  const chaos = createChaos(random, chaosMiddleware.events, rules)

  return (req, res, next) => {
    if(random() <= probability){
      chaos(req, res, next)
    } else {
      next()
    }
  }
}

chaosMiddleware.events = {
  httpStatus(status = 500){
    return (req, res, next) => {
      res.status(status)
      res.end()
    }
  },

  delay(amount = 3000){
    return (req, res, next) => {
      setTimeout(next, amount)
    }
  },

  close(){
    return (req, res, next) => req.destroy()
  },

  exit(exitCode = 1){
    return (req, res, next) => {
      process.exit(exitCode)
      next()
    }
  },

  kill(signal = 'SIGHUP'){
    return (req, res, next) => {
      process.kill(process.pid, signal)
      next()
    }
  },

  throwError(err){
    return (req, res, next) => {
      throw err
    }
  },

  reject(err){
    return (req, res, next) => {
      Promise.reject(err)
      next()
    }
  },
}

module.exports = chaosMiddleware
