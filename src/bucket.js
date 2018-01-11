const bole = require('bole')
const log = bole('bucket')
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')

function downloadFile (api, config) {
  const dir = path.join(path.resolve(config.certPath), config.base)
  if (!fs.existsSync(dir)) {
    log.info(`  ${dir} is missing, creating it`)
    mkdirp.sync(dir)
  }
  const file = path.join(dir, 'certs.tgz')
  if (api.gs) {
    log.info(`Attempting to download cert backup from '${config.bucket}' to '${file}'`)
    return api.gs
      .bucket(config.bucket)
      .file('certs.tgz')
      .download({
        destination: file
      })
      .then(
        () => {
          log.info('Downloaded tarball with certs successfully')
          return { file, dir }
        },
        err => {
          log.error(`Could not download tarball with certs:\n\t${err.message}`)
          return undefined
        }
      )
  } else {
    log.info(`Attempting to download cert backup from '${config.bucket}' to '${file}'`)
    return new Promise((resolve, reject) => {
      const download = api.s3.downloadFile({
        localFile: file,
        s3Params: {
          Bucket: config.bucket,
          Key: `certs.tgz`
        }
      })
      download.on('error', err => {
        log.error(`Could not download tarball with certs:\n\t${err.message}`)
        resolve(undefined)
      })
      download.on('end', () => {
        log.info('Downloaded tarball with certs successfully')
        resolve({
          file, dir
        })
      })
    })
  }
}

function uploadFile (api, config, file) {
  const dir = path.dirname(file)
  if (api.gs) {
    return api.gs
      .bucket(config.bucket)
      .upload(file)
      .then(
        () => {
          log.info(`Uploaded tarball with certs to bucket '${config.bucket}' successfully`)
          return { file, dir }
        },
        err => {
          log.error(`Could not upload tarball with certs to bucket '${config.bucket}':\n\t${err.message}`)
          throw err
        }
      )
  } else {
    return new Promise((resolve, reject) => {
      const upload = api.s3.uploadFile({
        localFile: file,
        s3Params: {
          Bucket: config.bucket,
          Key: `certs.tgz`
        }
      })
      upload.on('error', err => {
        log.info(`Could not upload tarball with certs to bucket '${config.bucket}':\n\t${err.message}`)
        reject(err)
      })
      upload.on('end', () => {
        log.error(`Uploaded tarball with certs to bucket '${config.bucket}' successfully`)
        resolve({ file, dir })
      })
    })
  }
}

module.exports = function (api) {
  return {
    downloadFile: downloadFile.bind(null, api),
    uploadFile: uploadFile.bind(null, api)
  }
}
