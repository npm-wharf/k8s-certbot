const spawn = require('child_process').spawn

function exec (log, command, args) {
  return new Promise((resolve, reject) => {
    const out = []
    const err = []
    const pid = spawn(command, args, { cwd: process.cwd() })
    pid.stdout.on('data', (data) => {
      log(data.toString())
      out.push(data.toString())
    })
    pid.stderr.on('data', (data) => {
      log(data.toString())
      err.push(data.toString())
    })
    pid.on('close', (code) => {
      if (code !== 0) {
        const error = new Error(`command '${command}', failed with\n\t${err.join('\n')}`)
        error.command = command
        error.args = args
        error.output = err
        error.code = code
        reject(error)
      } else {
        resolve(out)
      }
    })
  })
}

module.exports = exec
