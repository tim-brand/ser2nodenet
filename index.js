const Config = require('./lib/config')
const PortProxy = require('./lib/port-proxy')

const portProxyList = []

const run = async () => {
  const configPath = process.argv[2]
  let config

  try {
    config = await Config.loadFromFile(configPath)
  } catch (err) {
    console.error('Error while loading the config file.', err.message)
    process.exit(1)
  }



  for(const portConfig of config.ports) {
    const portProxy = new PortProxy(portConfig)
    await portProxy.start()

    portProxyList.push(portProxy)
  }
}

let handlingExit = false
const handleExit = (signal) => {
  if (handlingExit) return
  handlingExit = true
  console.log(`${signal} received`)
  for (const portProxy of portProxyList) {
    portProxy.stop()
  }
}

run().catch( err => {
  console.error('Exception during run()', err)
  process.exit(1)
})

process.on('SIGTERM', handleExit)
process.on('SIGINT', handleExit)
process.on('SIGQUIT', handleExit)
