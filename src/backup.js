const fs = require('fs')
const path = require('path')
const rimraf = require('rimraf')
const tar = require('tar')

function create (bucket, config) {
  return zipCerts(bucket, config)
    .then(
      bucket.uploadFile.bind(null, config),
      () => {
        console.log('Cert backup failed')
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
                  rimraf.sync(certPath)
                  return runCertBot()
                } else {
                  return map
                }
              }
            )
        } else {
          rimraf.sync(certPath)
          return runCertBot()
        }
      },
      err => {
        rimraf.sync(certPath)
        console.log(`Failed to download file:\n\t${err.message}`)
        return runCertBot()
      }
    )
}

function unzipCerts (config, tarball) {
  const certPath = getCertPath(config)
  console.log(tarball.dir)
  return tar.x(
    {
      file: tarball.file,
      C: tarball.dir,
      unlink: true
    }
  ).then(
    () => {
      console.log(`Unpacked tarball to '${tarball.dir}'`)
      return createCertMap(config)
    },
    err => {
      console.log(`Unpacking tarball failed with error:\n\t${err.message}`)
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
    console.log(`Failed to write cert metadata to '${file}' (zip creation and upload will fail):\n\t${err.message}`)
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
      console.log(`Created tarball with certs '${certs.join(', ')}'`)
      return tgzFile
    },
    err => {
      console.log(`Failed to create tarball for certs - '${certs.join(', ')}' with error:\n\t${err.message}`)
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
