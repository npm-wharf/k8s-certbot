function handle (bot) {
  return bot.acquireAll()
}

module.exports = function (bot) {
  return {
    command: 'getlegit',
    desc: 'attempt to acquire certificates from LetsEncrypt',
    handler: handle.bind(null, bot)
  }
}
