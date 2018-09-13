# chaos-middleware
Express middleware for chaos testing

# Usage

```javascript
const chaos = require('chaos-middleware')
const express = require('express')
const app = express()

const options = {
  probability: 0.5,
  rules: [
    { event: 'httpStatus', params: { status: 500 } }
  ]
}

app.use(chaos(options))
```

## chaos(options)
create a chaos middleware instance.

- `options` Object
  - `probability` Number (default = 0.1) - probability that is chaos happens. (0.0 - 1.0)
  - `rules` Array<Rule> - rules for chaos.

## Rule
- `event` String - event name. (eg. `httpStatus`)
- `params` Any - parameter for the event.
- `weight` Number ( defualt = 1) - weight for select this rule among the rules.

## Events
An event is a function exposed in `chaos.events`.

### events.httpStatus(status)
Return response with specific status code.

- `status` Number - status code.

### events.delay(amount)
Return normal response with some delay.

- `amount` Number - millseconds to delay.

### events.close()
Close connections.

### events.exit(exitCode = 1)
Exit node process.

- `exitCode` Number - exit code.

### events.kill(signal = "SIGHUP")
Send the signal to self process.

- `signal` Number|String - the signal name or number.

### events.throwError(err)
Throw `err`.

- `err` Any - An error to throw.

### events.reject(err)
Rise `unhandledRejection`.

- `err` Any - An error to reject promises.
