const bole = require('bole')
const log = bole('backup')
const fs = require('fs')
const path = require('path')
const rimraf = require('rimraf')
const tar = require('tar')

function create (bucket, config) {
  return zipCerts(bucket, config)
    .then(
      bucket.uploadFile.bind(null, config),
      () => {
        log.error('Cert backup failed')
      }
    )
}

function createCertMap (config) {
  return config.domains.map(domain => {
    const crt = path.join(config.certPath, config.base, `cert.pem`)
    const key = path.join(config.certPath, config.base, `privkey.pem`)
    const pem = path.join(config.certPath, config.base, `fullchain.pem`)
    return { domain, crt, key, pem }
  })
}

function getCertPath (config) {
  return path.join(path.resolve(config.certPath), config.base)
}

function restore (bucket, config, runCertBot) {
  const certPath = getCertPath(config)
  return bucket.downloadFile(config)
    .then(
      tarball => {
        if (tarball) {
          return unzipCerts(config, tarball)
            .then(
              map => {
                if (!map || config.renew) {
                  log.info('Ignoring certs from tarball - running certbot')
                  rimraf.sync(certPath)
                  return runCertBot()
                } else {
                  log.info(`Restoring certificates from tarball for domains: ${config.domains.join(', ')}`)
                  return map
                }
              }
            )
        } else {
          log.info('No backup found in configured object store')
          rimraf.sync(certPath)
          return runCertBot()
        }
      },
      err => {
        rimraf.sync(certPath)
        log.info(`Failed to download file:\n\t${err.message}`)
        return runCertBot()
      }
    )
}

function unzipCerts (config, tarball) {
  const certPath = getCertPath(config)
  log.info(`Attempting to unpack tarball into '${tarball.dir}'`)
  return tar.x(
    {
      file: tarball.file,
      C: tarball.dir,
      unlink: true
    }
  ).then(
    () => {
      log.info(`Unpacked tarball to '${tarball.dir}'`)
      return createCertMap(config)
    },
    err => {
      log.error(`Unpacking tarball failed with error:\n\t${err.message}`)
      rimraf.sync(certPath)
      return undefined
    }
  )
}

function writeMetadata (config) {
  const file = path.join(config.certPath, config.base, 'certs.json')
  try {
    const date = {
      createdOn: (new Date()).toUTCString()
    }
    const metadata = Object.assign({}, date, config)
    fs.writeFileSync(file, JSON.stringify(metadata), 'utf8')
  } catch (err) {
    log.error(`Failed to write cert metadata to '${file}' (zip creation and upload will fail):\n\t${err.message}`)
  }
  return file
}

function zipCerts (bucket, config) {
  const metaFile = writeMetadata(config)
  const certs = [
    path.join(config.certPath, config.base, `cert.pem`),
    path.join(config.certPath, config.base, `privkey.pem`),
    path.join(config.certPath, config.base, `fullchain.pem`)
  ]
  const files = [metaFile].concat(certs).map(f => `./${path.basename(f)}`)
  const tgzFile = path.join(process.cwd(), 'certs.tgz')
  return tar.c(
    {
      gzip: true,
      file: tgzFile,
      follow: true,
      C: path.resolve(path.join(config.certPath, config.base))
    },
    files
  ).then(
    () => {
      log.info(`Created tarball with certs '${certs.join(', ')}'`)
      return tgzFile
    },
    err => {
      log.error(`Failed to create tarball for certs - '${certs.join(', ')}' with error:\n\t${err.message}`)
      throw err
    }
  )
}

module.exports = function (bucket, config) {
  return {
    create: create.bind(null, bucket, config),
    restore: restore.bind(null, bucket, config)
  }
}
