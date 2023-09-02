# I2C library for Node.js

## Features
- Asynchronous, non-blocking functions (use [`Promises`](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous/Promises) or [`async/await`](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous/Promises#async_and_await))
- Pre-compiled for Windows / macOS / Linux
- Compatible with [Electron](https://www.electronjs.org/) (see [the note](#note-to-electron-users) below)
- Includes static FTDI Driver vendor libraries
- Written in pure C language using [Node-API](https://nodejs.org/api/n-api.html#node-api)
- Detailed error messages and codes are thrown without crashing Node.js
- Includes TypeScript typings for auto-completion and validation
- Compiled with [CMake.js](https://github.com/cmake-js/cmake-js) (no `gyp` / no Python required)


## Installation
###### In your Node.js project folder, run:
```bash
npm install ftdi-i2c
```
###### On the top of your JavaScript file, add:
```js
const I2C = require("ftdi-i2c")
```


## Quick example
```js
const i2c = new I2C()
if (await i2c.open(0x57)) {
    await i2c.writeRegister(0x02, 0xC0)
    const val = await i2c.readRegister(0x02)
    console.log(val)
}
```


## Use ftdi-d2xx
- [ftdi-d2xx](https://github.com/motla/ftdi-d2xx)