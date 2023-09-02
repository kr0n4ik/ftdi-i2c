# I2C library for Node.js

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