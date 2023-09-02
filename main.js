const FTDI = require('ftdi-d2xx')

// константы
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

    /**
     * проверка количества байт приема и чтение
     * @param {int} count - количество байт према
     * @returns {buffer} - принятые байты
     */
    async read(count) {
        for (let i = 0; i < 1000000; i++) {
            if (this.#device.status.rx_queue_bytes == count) {
                break
            }
        }
        return await this.#device.read(this.#device.status.rx_queue_bytes)
    }

    /**
     * команда старт
     */
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

    /**
     * команда стоп
     */
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

    /**
     * соеденение с чипом и настройка работы по шине i2c
     * @param {byte} addr адрес i2c устройства
     * @returns {boolean} при успешном соеденении вернет true
     */
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
        // переход в режим MPSSE
        this.#device.setBitMode(0x00, FTDI.FT_BITMODE_MPSSE)
        // отправка тестовго байта 0xAA
        await this.#device.write(Uint8Array.from([0xAA]))
        let response = await this.read(2)
        if (response[0] != 0xFA || response[1] != 0xAA) {
            this.close()
            return false
        }
        // отправка тестовго байта 0xAB
        await this.#device.write(Uint8Array.from([0xAB]))
        response = await this.read(2)
        if (response[0] != 0xFA || response[1] != 0xAB) {
            this.close()
            return false
        }
        // настройка фазы и полярности тактовых импульсов SCL
        await this.#device.write(Uint8Array.from([0x8A, 0x97, 0x8C]))
        // настройка частоты тактовых импульсов SCL
        await this.#device.write(Uint8Array.from([0x80, 0x03, 0x13, 0x86, (this.#clock_divider & 0xFF), ((this.#clock_divider >> 8) & 0xFF)]))
        await this.#device.write(Uint8Array.from([0x85]))
        this.#addr = addr
        return true
    }

    /**
     * отсоедение от чипа
     * @returns {boolean} при успешном отсоедение вернет true
     */
    close() {
        if (this.#device) {
            this.#device.close()
            this.#device = null
            return true
        }
        return false
    }

    /**
     * данные на запись в линию i2c байта
     * @param {byte} val значение байта  
     */
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

    /**
     * данные на чтение из линии i2c байта
     * @param {boolean} ask  
     */
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

    /**
     * чтение регистра устройства
     * @param {byte} addr адрес регистра
     * @param {int} count количество байт для чтения
     * @returns {array|null} массив байт или null, в случае неудачи
     */
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
        // проверка принятых данных
        if (!result || (result[0] & 1) != 0 || (result[1] & 1) != 0 || (result[2] & 1) != 0) {
            return null
        }
        // отсекаем данные от writeByte
        result.splice(0, 3)
        return result
    }

    /**
     * запись байта в регистр
     * @param {byte} addr адрес регистра
     * @param {byte} val значение для записи
     * @returns {boolean} вернет true при успешной записи
     */
    async writeRegister(addr, val) {
        if (!this.#device) {
            return false
        }
        this.#buf = []
        this.setStart()
        this.writeByte((this.#addr << 1) | 0)
        this.writeByte(addr)
        this.writeByte(val)
        this.setStop()
        await this.#device.write(Uint8Array.from(this.#buf))
        const result = await this.read(3)
        // проверка данных
        if ((result[0] & 1) != 0 || (result[1] & 1) != 0 || (result[2] & 1) != 0) {
            return false
        }
        return true
    }
    
}

module.exports = I2C