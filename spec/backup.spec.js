require('./setup')
const fs = require('fs')
const path = require('path')
const tar = require('tar')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const hasher = require('folder-hash')

const bucket = {
  downloadFile: () => {},
  uploadFile: () => {}
}

const config = {
  base: 'test_domain_org',
  certPath: './spec/certs',
  bucket: 'test_bucket',
  domains: ['test.io']
}

const tgzPath = path.join(
  path.resolve(config.certPath),
  config.base,
  'certs.tgz'
)
const basePath = path.dirname(tgzPath)
const certPath = path.dirname(basePath)
const jsonPath = path.join(basePath, 'certs.json')

const backup = require('../src/backup')(
  bucket,
  config
)

describe('Backup', function () {
  describe('when backup tarball is missing', function () {
    describe('and download succeeds', function () {
      let bucketMock
      before(function (done) {
        bucketMock = sinon.mock(bucket)
        bucketMock
          .expects('downloadFile')
          .withArgs({
            bucket: 'test_bucket',
            certPath: './spec/certs',
            base: 'test_domain_org',
            domains: ['test.io']
          })
          .resolves(undefined)

        backup.restore(() => {
          done()
        })
      })

      it('should invoke callback', function () {
        bucketMock.verify()
      })

      it('should remove empty cert folder', function () {
        // lets encrypt will blow up and refuse to do anything
        // if there's an empty folder where it's going
        // to create one anyway. This is great behavior!
        fs.existsSync(
          path.join(path.resolve(config.certPath), config.base)
        ).should.equal(false)
      })
    })

    describe('and download fails', function () {
      let bucketMock
      before(function (done) {
        bucketMock = sinon.mock(bucket)
        bucketMock
          .expects('downloadFile')
          .withArgs({
            bucket: 'test_bucket',
            certPath: './spec/certs',
            base: 'test_domain_org',
            domains: ['test.io']
          })
          .rejects(new Error('nope'))

        backup.restore(() => {
          done()
        })
      })

      it('should invoke callback', function () {
        bucketMock.verify()
      })

      it('should remove empty cert folder', function () {
        // lets encrypt will blow up and refuse to do anything
        // if there's an empty folder where it's going
        // to create one anyway. This is great behavior!
        fs.existsSync(
          path.join(path.resolve(config.certPath), config.base)
        ).should.equal(false)
      })
    })
  })

  describe('when backup tarball exists and renew is falsey', function () {
    let bucketMock
    before(function (done) {
      bucketMock = sinon.mock(bucket)
      console.log(basePath)
      mkdirp.sync(basePath)
      fs.copyFileSync(
        './spec/certs/certs.tgz',
        tgzPath
      )
      bucketMock
        .expects('downloadFile')
        .withArgs({
          bucket: 'test_bucket',
          certPath: './spec/certs',
          base: 'test_domain_org',
          domains: ['test.io']
        })
        .resolves({
          dir: basePath,
          file: tgzPath
        })

      backup.restore()
        .then(() => {
          done()
        })
    })

    it('should invoke callback', function () {
      const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
      json.should.eql({
        createdOn: 'Wed, 08 Nov 2017 05:12:23 GMT',
        base: 'test.domain.org',
        bucket: 'test_domain_org',
        certPath: './spec/certs/'
      })
      bucketMock.verify()
    })

    after(function () {
      fs.unlinkSync(jsonPath)
      fs.unlinkSync(tgzPath)
    })
  })

  describe('when backup tarball exists and renew is truthy', function () {
    let bucketMock, restored
    before(function (done) {
      config.renew = 'true'
      bucketMock = sinon.mock(bucket)
      mkdirp.sync(basePath)
      fs.copyFileSync(
        './spec/certs/certs.tgz',
        tgzPath
      )
      bucketMock
        .expects('downloadFile')
        .withArgs({
          bucket: 'test_bucket',
          certPath: './spec/certs',
          base: 'test_domain_org',
          domains: ['test.io'],
          renew: 'true'
        })
        .resolves({
          dir: basePath,
          file: tgzPath
        })

      backup.restore(() => {
        restored = true
        return restored
      })
      .then(() => {
        done()
      })
    })

    it('should invoke callback', function () {
      fs.existsSync(jsonPath).should.equal(false)
      fs.existsSync(tgzPath).should.equal(false)
      restored.should.equal(true)
      bucketMock.verify()
    })

    after(function () {
      delete config.renew
    })
  })

  describe('when backup tarball exists and unzip fails', function () {
    let bucketMock
    before(function (done) {
      config.base = 'bad_path'
      bucketMock = sinon.mock(bucket)
      bucketMock
        .expects('downloadFile')
        .withArgs({
          bucket: 'test_bucket',
          certPath: './spec/certs',
          base: 'bad_path',
          domains: ['test.io']
        })
        .resolves({
          dir: basePath,
          file: tgzPath
        })

      backup.restore(() => {
        done()
      })
    })

    it('should invoke callback', function () {
      bucketMock.verify()
    })

    it('should remove empty cert folder', function () {
      // lets encrypt will blow up and refuse to do anything
      // if there's an empty folder where it's going
      // to create one anyway. This is great behavior!
      fs.existsSync(
        path.join(path.resolve(config.certPath), config.base)
      ).should.equal(false)
    })

    after(function () {
      config.base = 'test_domain_org'
    })
  })

  describe('when certs are acquired', function () {
    describe('and zipping succeeds', function () {
      let bucketMock, uploader
      before(function (done) {
        uploader = require('../src/backup')(
          bucket,
          {
            base: 'live',
            certPath: './spec/certs',
            bucket: 'test_bucket',
            domains: ['test.io']
          }
        )
        bucketMock = sinon.mock(bucket)
        bucketMock
          .expects('uploadFile')
          .withArgs({
            base: 'live',
            certPath: './spec/certs',
            bucket: 'test_bucket',
            domains: ['test.io']
          },
          path.join(process.cwd(), 'certs.tgz')
          )
          .returns()

        uploader
          .create()
          .then(() => { done() })
      })

      it('should create tarball that follows symlinks', function () {
        mkdirp.sync('./spec/verify')
        bucketMock.verify()
        return hasher.hashElement('./spec/certs/live')
          .then(sourceHash => {
            return tar.x({
              file: './certs.tgz',
              C: './spec/verify'
            }).then(
              () => {
                return hasher.hashElement('./spec/verify')
                  .then(hash => {
                    return hash.children.should.eql(sourceHash.children)
                  })
              }
            )
          })
      })

      after(function () {
        rimraf.sync('./spec/verify')
        fs.unlinkSync('./certs.tgz')
        fs.unlinkSync('./spec/certs/live/certs.json')
      })
    })

    describe('and zipping fails', function () {
      let bucketMock, uploader
      before(function () {
        uploader = require('../src/backup')(
          bucket,
          {
            base: 'live',
            certPath: './spec/bad_path',
            bucket: 'test_bucket',
            domains: ['test.io']
          }
        )
        bucketMock = sinon.mock(bucket)
        bucketMock
          .expects('uploadFile')
          .never()

        return uploader
          .create()
      })

      it('should reject with error', function () {
        bucketMock.verify()
      })
    })
    after(function () {
      fs.unlink('./certs.tgz')
    })
  })
})
