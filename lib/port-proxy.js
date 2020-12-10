const SerialPort = require('serialport')
const net = require('net')
const Debug = require('debug')

const log = {
  info: Debug('ser2nodenet:portproxy'),
  error: Debug('ser2nodenet:portproxy:error'),
  debug: Debug('ser2nodenet:portproxy:debug'),
  data: Debug('ser2nodenet:portproxy:data'),
}

module.exports = class PortProxy {

  constructor({
    path,
    baudrate = 115200,
    socketPort,
    socketAddress = '0.0.0.0',
    rtscts = false,
    autoOpen = false,
  }) {
    this.config = {
      path,
      baudrate,
      socketPort,
      socketAddress,
      rtscts,
      autoOpen,
    }

    Debug.enable([
      log.info.namespace,
      log.error.namespace,
    ].join(','))
  }

  async start() {
    log.info('Opening serial port')
    await this.initSerial()
    log.info('Starting socket server')
    await this.initSocket()
  }

  async stop() {
    if (this.serialPort.isOpen) {
      log.info('Closing serial port ...')
      this.serialPort.close()
      this.serialPort.destroy()
    }

    if (this.socketServer) {
      if (this.socket) {
        log.info('Closing socket ...')
        this.socket.end()
        this.socket.destroy()
        log.info('Closing socket finished')
      }
      log.info('Closing socketServer ...')
      this.socketServer.close()
      log.info('Closing socketServer finished')
    }
  }

  async initSerial() {
    const serialPortOptions = {
      baudRate: this.config.baudrate,
      rtscts: this.config.rtscts,
      autoOpen: this.config.autoOpen,
    }

    log.info(`Initiating serial port with path: ${this.config.path}, options:`, serialPortOptions)
    this.serialPort = new SerialPort(this.config.path, serialPortOptions)

    this.serialPort.on('data', async data => {
      log.data(`SerialPort data received: ${data}`)
      await this.sendDataToSocket(data)
    })

    return new Promise((resolve, reject) => {
      log.debug('Opening port')
      this.serialPort.open(async err => {
        if (err) {
          reject(new Error(`Failed to open SerialPort, check your settings. Reason: ${err.message}`))
          if (this.serialPort.isOpen) {
            this.serialPort.close()
          }
        }
        log.info('SerialPort opened')
        resolve()
      })
    })
  }

  async initSocket() {
    this.socketServer = net.createServer(this.socketConnectionHandler.bind(this))
    this.socketServer.listen(this.config.socketPort, this.config.socketAddress)
    log.info(`Port ${this.config.path} listening for connections on ${this.config.socketAddress}:${this.config.socketPort}`)
  }

  socketConnectionHandler(socket) {
    log.debug('Client connected')
    this.socket = socket

    this.socket.on('data', this.onSocketData.bind(this))

    this.socket.on('close', (hadError) => {
      if (hadError) {
        log.error('Some error occured when client disconnected.')
      }
      log.debug('Client disconnected')
      this.socket = undefined
    })
  }

  onSocketData = (data) => {
    log.data(`Data received from client: ${data}`)
    this.serialPort.write(data, (err, bytesWritten) => {
      if (err) {
        // Failed to write to serialport
        log.error('Failed to write to serialport.', err)
        return
      }
      log.debug(`Data from client written to serialport. bytesWritten: ${bytesWritten}`)
    })
  }


  async sendDataToSocket(data) {
    if (this.socket) {
      this.socket.write(data)
      log.debug('Serial data written to the client socket')
    }
  }
}
