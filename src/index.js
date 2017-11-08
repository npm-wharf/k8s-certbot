const Etcd = require('node-etcd')
const config = require('./config')()
const processes = require('processhost')()
const exec = require('./exec')
const api = require('./api')
const bucket = require('./bucket')(api)
const backup = require('./backup')(bucket, config)
const Bot = require('./bot')

module.exports = function () {
  const etcd = new Etcd(config.etcd)
  const bot = Bot(config, etcd, exec, processes, backup)
  return {
    acquireAll: bot.acquireAll,
    selfSignAll: bot.selfSignAll
  }
}
