const SerialPort = require('serialport')
const net = require('net')

const serialPath = (process.argv.length >= 2) ? process.argv[2] : undefined

if (!serialPath) {
  console.error('Please define the path to the serialport.')
  process.exit(1)
}

const conf = {
  serial: {
    path: serialPath,
    baudRate: 115200
  }
}

const run = async () => {
  let connectedClientSocket

  const serialPortOptions = {
    baudRate: conf.serial.baudRate,
    rtscts: false,
    autoOpen: false
  }
  const serialPort = new SerialPort(conf.serial.path, serialPortOptions, err => {
    if (err) {
      console.error('Failed to initiate SerialPort, check your settings.', err)
      process.exit(1)
    }

    console.log('SerialPort initiated!')
  })

  serialPort.on('data', data => {
    console.log('SerialPort data received:', data.toString())
    if (connectedClientSocket) {
      connectedClientSocket.write(data)
      console.log('Serial data written to the client socket')
    }
  })


  const socketServer = net.createServer((socket) => {
    console.debug('Client connected')
    connectedClientSocket = socket

    socket.on('data', data => {
      console.debug(`Data received from client: ${data}`)
      serialPort.write(data, (err, bytesWritten) => {
        if (err) {
          // Failed to write to serialport
          console.error('Failed to write to serialport.', err)
          return
        }
        console.debug(`Data from client written to serialport. bytesWritten: ${bytesWritten}`)
      })
    })

    socket.on('close', (hadError) => {
      if (hadError) {
        console.warn('Some error occured when client disconnected.')
      }
      console.debug('Client disconnected')
      connectedClientSocket = undefined
    })
  })
  socketServer.listen(2004, '0.0.0.0')

  serialPort.open(async err => {
    if (err) {
      console.error('Failed to open SerialPort, check your settings.', err)
      process.exit(1)
    }

    console.log('SerialPort opened!')
  })
}

run().catch( err => {
  console.error('Exception during run()', err)
  process.exit(1)
})
