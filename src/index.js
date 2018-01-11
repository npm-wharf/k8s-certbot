const Etcd = require('node-etcd')
const config = require('./config')()
const processes = require('processhost')()
const exec = require('./exec')
const api = require('./api')
const bucket = require('./bucket')(api)
const backup = require('./backup')(bucket, config)
const Bot = require('./bot')
const bole = require('bole')

const levelColors = {
  debug: 'gray',
  info: 'white',
  warn: 'yellow',
  error: 'red'
}

const debugOut = {
  write: function (data) {
    const entry = JSON.parse(data)
    const levelColor = levelColors[entry.level]
    console.log(`${chalk[levelColor](entry.time)} - ${chalk[levelColor](entry.level)} ${entry.message}`)
  }
}

bole.output({
  level: 'info',
  stream: debugOut
})

module.exports = function () {
  const etcd = new Etcd(config.etcd)
  const bot = Bot(config, etcd, exec, processes, backup)
  return {
    acquireAll: bot.acquireAll,
    selfSignAll: bot.selfSignAll
  }
}
