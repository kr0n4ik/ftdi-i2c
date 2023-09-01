const FTDI = require('ftdi-d2xx')

const SDA_LO_SCL_LO = 0x00
const SDA_IN_SCL_IN = 0x00
const SDA_IN_SCL_OUT = 0x01
const SDA_OUT_SCL_IN = 0x02
const SDA_OUT_SCL_OUT = 0x03
const MSB_RISING_EDGE_CLOCK_BYTE_IN = 0x20;
const MSB_FALLING_EDGE_CLOCK_BYTE_OUT = 0x11;
const MSB_RISING_EDGE_CLOCK_BIT_IN = 0x22;
const MSB_FALLING_EDGE_CLOCK_BIT_OUT = 0x13

class I2C {
    #device = null
    #clock_divider = 0x005F
    #addr = 0xFF
    #buf = []

    async read(count) {
        for (let i = 0; i < 1000000; i++) {
            if (this.#device.status.rx_queue_bytes == count) {
                break
            }
        }
        return await this.#device.read(this.#device.status.rx_queue_bytes)
    }

    setStart() {
        // SDA 1 SCL 1
        for (let i = 0; i < 6; i++) {
            this.#buf.push(0x80)
            this.#buf.push(SDA_LO_SCL_LO)
            this.#buf.push(SDA_IN_SCL_IN)
        }
        // SDA 0 SCL 1
        for (let i = 0; i < 6; i++) {
            this.#buf.push(0x80)
            this.#buf.push(SDA_LO_SCL_LO)
            this.#buf.push(SDA_OUT_SCL_IN)
        }
        // SDA 0 SCL 0
        for (let i = 0; i < 6; i++) {
            this.#buf.push(0x80)
            this.#buf.push(SDA_LO_SCL_LO)
            this.#buf.push(SDA_OUT_SCL_OUT)
        }
    }

    setStop() {
        // SDA 0 SCL 0
        for (let i = 0; i < 6; i++) {
            this.#buf.push(0x80)
            this.#buf.push(SDA_LO_SCL_LO)
            this.#buf.push(SDA_OUT_SCL_OUT)
        }
        // SDA 0 SCL 1
        for (let i = 0; i < 6; i++) {
            this.#buf.push(0x80)
            this.#buf.push(SDA_LO_SCL_LO)
            this.#buf.push(SDA_OUT_SCL_IN)
        }
        // SDA 1 SCL 1
        for (let i = 0; i < 6; i++) {
            this.#buf.push(0x80)
            this.#buf.push(SDA_LO_SCL_LO)
            this.#buf.push(SDA_IN_SCL_IN)
        }
    }

    async open(addr) {
        if (this.#device) {
            return false
        }
        this.#device = await FTDI.openDevice("A")
        if (!this.#device) {
            return false
        }
        this.#device.resetDevice()
        await this.read(this.#device.status.rx_queue_bytes)
        this.#device.setLatencyTimer(16)
        this.#device.setUSBParameters(65535, 65535)
        this.#device.setTimeouts(1000, 1000)
        this.#device.setBitMode(0x00, FTDI.FT_BITMODE_RESET)
        this.#device.setBitMode(0x00, FTDI.FT_BITMODE_MPSSE)
        await this.#device.write(Uint8Array.from([0xAA]))
        let response = await this.read(2)
        if (response[0] != 0xFA || response[1] != 0xAA) {
            console.log("Нет синхранизации с MPPSE")
            this.close()
            return false
        }
        await this.#device.write(Uint8Array.from([0xAB]))
        response = await this.read(2)
        if (response[0] != 0xFA || response[1] != 0xAB) {
            console.log("Нет синхранизации с MPPSE")
            this.close()
            return false
        }
        await this.#device.write(Uint8Array.from([0x8A, 0x97, 0x8C]))
        await this.#device.write(Uint8Array.from([0x80, 0x03, 0x13, 0x86, (this.#clock_divider & 0xFF), ((this.#clock_divider >> 8) & 0xFF)]))
        await this.#device.write(Uint8Array.from([0x85]))
        this.#addr = addr
        console.log("Синхранизации с MPPSE")
        return true
    }

    close() {
        if (this.#device) {
            this.#device.close()
            this.#device = null
            return true
        }
        return false
    }


    writeByte(val) {
        this.#buf.push(0x80)
        this.#buf.push(SDA_LO_SCL_LO)
        this.#buf.push(SDA_OUT_SCL_OUT)

        this.#buf.push(MSB_FALLING_EDGE_CLOCK_BYTE_OUT)
        this.#buf.push(0x00)
        this.#buf.push(0x00)
        this.#buf.push(val)

        this.#buf.push(0x80)
        this.#buf.push(SDA_LO_SCL_LO)
        this.#buf.push(SDA_IN_SCL_OUT)

        this.#buf.push(MSB_RISING_EDGE_CLOCK_BIT_IN)
        this.#buf.push(0x00)

        this.#buf.push(0x87)
    }

    readByte(ask = false) {
        this.#buf.push(0x80)
        this.#buf.push(SDA_LO_SCL_LO)
        this.#buf.push(SDA_IN_SCL_OUT)

        this.#buf.push(MSB_RISING_EDGE_CLOCK_BYTE_IN)
        this.#buf.push(0x00)
        this.#buf.push(0x00)

        this.#buf.push(0x80)
        this.#buf.push(SDA_LO_SCL_LO)
        this.#buf.push(SDA_OUT_SCL_OUT)

        this.#buf.push(MSB_FALLING_EDGE_CLOCK_BIT_OUT)
        this.#buf.push(0x00)
        this.#buf.push(ask ? 0x00 : 0xFF)

        this.#buf.push(0x80)
        this.#buf.push(SDA_LO_SCL_LO)
        this.#buf.push(SDA_IN_SCL_OUT)

        this.#buf.push(0x87)
    }

    async readRegister(addr, count = 1) {
        if (!this.#device) {
            return null
        }
        this.#buf = []
        this.setStart()
        this.writeByte((this.#addr << 1) | 0)
        this.writeByte(addr)
        this.setStart()
        this.writeByte((this.#addr << 1) | 1)
        for (let i = 0; i < count; i++){
            this.readByte(i != count - 1)
        }
        this.setStop()
        await this.#device.write(Uint8Array.from(this.#buf))
        let result = [...await this.read(count + 3)]
        if (!result || (result[0] & 1) != 0 || (result[1] & 1) != 0 || (result[2] & 1) != 0) {
            return null
        }
        result.splice(0, 3)
        return result
    }

    async writeRegister(addr, val) {
        if (!this.#device) {
            return null
        }
        this.#buf = []
        this.setStart()
        this.writeByte((this.#addr << 1) | 0)
        this.writeByte(addr)
        this.writeByte(val)
        this.setStop()
        await this.#device.write(Uint8Array.from(this.#buf))
        const result = await this.read(3)
        if ((result[0] & 1) != 0 || (result[1] & 1) != 0 || (result[2] & 1) != 0) {
            console.log(result)
            return false
        }
        return true
    }
    
}

module.exports = I2C