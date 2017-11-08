function handle (bot) {
  return bot.selfSignAll()
}

module.exports = function (bot) {
  return {
    command: 'selfsign',
    desc: 'create self-signed certificates as placeholders for all domains',
    handler: handle.bind(null, bot)
  }
}
