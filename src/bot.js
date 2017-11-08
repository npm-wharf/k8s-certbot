const path = require('path')
const fs = require('fs')
const Promise = require('bluebird')
const TYPES = ['crt', 'key', 'pem']
const LETS_ENCRYPT_LOG = '/var/log/letsencrypt/letsencrypt.log'

function acquireAll (config, etcd, exec, processes, backup) {
  return createHTTPServer(config, etcd, exec, processes, backup)
    .then(
      null,
      () => {
        console.log(`Failed to fetch or renew certs via LetsEncrypt`)
        process.exit(100)
      }
    )
}

function combineFiles (crt, key, pem) {
  const file1 = fs.readFileSync(crt, 'utf8')
  const file2 = fs.readFileSync(key, 'utf8')
  fs.writeFileSync(pem, [file1, file2].join(''))
}

function createCertMap (config, signed) {
  return config.domains.map(domain => {
    const folder = signed ? config.base : domain
    const crt = path.join(config.certPath, folder, `cert.pem`)
    const key = path.join(config.certPath, folder, `privkey.pem`)
    const pem = path.join(config.certPath, folder, `fullchain.pem`)
    return { domain, crt, key, pem }
  })
}

function createHTTPServer (config, etcd, exec, processes, backup) {
  return processes.create('http', {
    command: 'python',
    args: ['-m', 'SimpleHTTPServer', '80']
  })
  .then(
    onHTTPServer.bind(null, config, etcd, exec, processes, backup),
    err => {
      console.log(`Cannot create SimpleHTTPServer - cannot proceed:\n\t${err.message}`)
      throw err
    }
  )
}

function onHTTPServer (config, etcd, exec, processes, backup, http) {
  const deferred = {
    resolve: null,
    reject: null
  }
  http.on('stdout', console.log)
  http.on('stderr', console.error)
  http.on('crashed', err => {
    console.error('The SimpleHTTPServer process exited unexpectedly:', err)
  })

  http.on('failed', err => {
    console.error('SimpleHTTPServer would not stay up:', err)
    deferred.reject(err)
  })

  http.on('started', () => {
    setTimeout(
      () => {
        console.log('Checking for backups')
        backup
          .restore(
            () => runCertBot(config, etcd, exec, processes)
          )
          .then(
            proceed => {
              processes.stop()
              if (proceed) {
                return backup.create().then(() => proceed)
              } else {
                deferred.reject()
              }
            }
          )
          .then(
            proceed => {
              if (proceed) {
                const certs = createCertMap(config, true)
                return writeCerts(config, etcd, certs)
                  .then(
                    () => { deferred.resolve() },
                    () => { deferred.reject() }
                  )
              } else {
                deferred.reject()
              }
            }
          )
      },
      config.wait * 1000
    )
  })
  console.log('Starting SimpleHTTPServer process ...')
  http.start()
  return new Promise((resolve, reject) => {
    deferred.resolve = resolve
    deferred.reject = reject
  })
}

function runCertBot (config, etcd, exec, processes) {
  const domainList = config
    .domains
    .map(d => `-d ${d}`)
    .join(' ')

  const args = config.staging
    ? `certonly --webroot --staging -w ./ -n --agree-tos --email ${config.email} --no-self-upgrade ${domainList}`
    : `certonly --webroot -w ./ -n --agree-tos --email ${config.email} --no-self-upgrade ${domainList}`
  console.log(`Starting LetsEncrypt certbot with arguments: '${args}'`)
  return exec(console.log, 'certbot', args.split(' '))
    .then(
      () => {
        console.log(`Certificates for '${config.domains.join(', ')}' acquired. Beginning upload to etcd.`)
        return true
      },
      err => {
        if (fs.existsSync(config.logPath || LETS_ENCRYPT_LOG)) {
          console.log('  Dumping certbot logs to stdio ...')
          const varlog = fs.readFileSync(config.logPath || LETS_ENCRYPT_LOG, 'utf8')
          console.log(varlog)
        }
        console.log(`Failed to acquire certs for '${config.domains.join(', ')}':\n\texit code: ${err.code}\n\t${err.output.join('\n')}`)
        return false
      }
    )
}

function selfSignAll (config, etcd, exec) {
  return Promise.all(
    config.domains.map(selfSignForDomain.bind(null, config, etcd, exec))
  ).then(
    certs => {
      console.log(`Generated self-signed certs successfully. Beginning upload to etcd.`)
      return writeCerts(config, etcd, certs)
    },
    err => {
      console.log(`Failed to generate one or more requested self-signed certificates:\n\t${err.message}`)
    }
  )
}

function selfSignForDomain (config, etcd, exec, domain) {
  const base = path.resolve(process.cwd())
  const crt = path.join(base, `${domain}.crt`)
  const key = path.join(base, `${domain}.key`)
  const pem = path.join(base, `${domain}.pem`)
  const args = `req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ${key} -out ${crt} -subj /C=${config.country}/ST=${config.state}/L=${config.local}/O=${config.organization}/OU=${config.unit}/CN=${domain}/emailAddress=${config.email}`.split(' ')
  return exec(() => {}, 'openssl', args)
    .then(
      () => {
        combineFiles(crt, key, pem)
        console.log(`Self-signed cert for '${domain}' created`)
        return { domain, crt, key, pem }
      },
      err => {
        console.log(`Failed to create self-signed cert for domain '${domain}':\n\t${err.createCert.join('')}`)
        throw err
      }
    )
}

function write (etcd, key, file) {
  return new Promise((resolve, reject) => {
    let value = file
    if (fs.existsSync(file)) {
      value = fs.readFileSync(file, 'utf8')
    }
    return etcd.set(key, value, function (err) {
      if (err) {
        reject(err)
      } else {
        console.log(`  successfully wrote file to key '${key}'`)
        resolve()
      }
    })
  })
}

function writeCerts (config, etcd, certs) {
  return Promise.all(
    certs.map(writeCert.bind(null, config, etcd))
  )
}

function writeCert (config, etcd, cert) {
  const key = cert.domain === config.base
    ? `${config.base}.`
    : cert.domain.replace(config.base, '')
  const prefix = `${config.namespace}/${key.replace(/[.]/g, '_')}`
  const promises = TYPES.reduce((acc, type) => {
    if (cert[type]) {
      acc.push(write(etcd, `${prefix}${type}`, cert[type]))
    }
    return acc
  }, [])

  return Promise.all(promises)
  .then(
    null,
    err => {
      console.log(`Error writing certs to etcd '${config.etcd}' for subdomain '${key}'`)
      throw err
    }
  )
}

module.exports = function (config, etcd, exec, processes, backup) {
  return {
    acquireAll: acquireAll.bind(null, config, etcd, exec, processes, backup),
    selfSignAll: selfSignAll.bind(null, config, etcd, exec)
  }
}
