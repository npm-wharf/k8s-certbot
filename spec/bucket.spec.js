require('./setup')
const path = require('path')
const EventEmitter = require('events')
const rimraf = require('rimraf')

const gsBucket = {
  file: () => {},
  upload: () => {}
}

const gsFile = {
  download: () => {}
}

const gsAPI = {
  gs: {
    bucket: () => {}
  }
}

const s3API = {
  s3: {
    downloadFile: () => {},
    uploadFile: () => {}
  }
}

const Bucket = require('../src/bucket')

describe('Bucket', function () {
  describe('with S3', function () {
    describe('when downloading file', function () {
      describe('and download fails', function () {
        let s3Mock, bucket, result
        before(function () {
          const downloads = new EventEmitter()
          const fullPath = path.resolve('./spec/downloads/test.io/certs.tgz')
          bucket = Bucket(s3API)
          s3Mock = sinon.mock(s3API.s3)
          s3Mock
            .expects('downloadFile')
            .withArgs({
              localFile: fullPath,
              s3Params: {
                Bucket: 'test-bucket',
                Key: 'certs.tgz'
              }
            })
            .returns(downloads)

          bucket.downloadFile({
            bucket: 'test-bucket',
            certPath: './spec/downloads',
            base: 'test.io'
          })
          .then(
            x => { result = x }
          )
          process.nextTick(() => {
            downloads.emit('error', new Error('ohno'))
          })
        })

        it('should return undefined', function () {
          expect(result).to.equal(undefined)
          s3Mock.verify()
        })
      })

      describe('and download succeeds', function () {
        let s3Mock, bucket, result, fullPath
        before(function () {
          const downloads = new EventEmitter()
          fullPath = path.resolve('./spec/downloads/test.io/certs.tgz')
          bucket = Bucket(s3API)
          s3Mock = sinon.mock(s3API.s3)
          s3Mock
            .expects('downloadFile')
            .withArgs({
              localFile: fullPath,
              s3Params: {
                Bucket: 'test-bucket',
                Key: 'certs.tgz'
              }
            })
            .returns(downloads)

          bucket.downloadFile({
            bucket: 'test-bucket',
            certPath: './spec/downloads',
            base: 'test.io'
          })
          .then(
            x => { result = x }
          )
          process.nextTick(() => {
            downloads.emit('end')
          })
        })

        it('should resolve with metadata', function () {
          expect(result).to.eql({
            dir: path.dirname(fullPath),
            file: fullPath
          })
          s3Mock.verify()
        })
      })
    })

    describe('when uploading file', function () {
      describe('and upload fails', function () {
        let s3Mock, bucket, result
        before(function () {
          const uploads = new EventEmitter()
          const fullPath = path.resolve('./spec/downloads/test.io/certs.tgz')
          bucket = Bucket(s3API)
          s3Mock = sinon.mock(s3API.s3)
          s3Mock
            .expects('uploadFile')
            .withArgs({
              localFile: fullPath,
              s3Params: {
                Bucket: 'test-bucket',
                Key: 'certs.tgz'
              }
            })
            .returns(uploads)

          bucket.uploadFile({
            bucket: 'test-bucket',
            certPath: './spec/downloads',
            base: 'test.io'
          },
          fullPath)
          .then(
            null,
            err => { result = err }
          )
          process.nextTick(() => {
            uploads.emit('error', new Error('ohno'))
          })
        })

        it('should reject with error', function () {
          expect(result.message).to.equal('ohno')
          s3Mock.verify()
        })
      })

      describe('and upload succeeds', function () {
        let s3Mock, bucket, result, fullPath
        before(function () {
          const uploads = new EventEmitter()
          fullPath = path.resolve('./spec/downloads/test.io/certs.tgz')
          bucket = Bucket(s3API)
          s3Mock = sinon.mock(s3API.s3)
          s3Mock
            .expects('uploadFile')
            .withArgs({
              localFile: fullPath,
              s3Params: {
                Bucket: 'test-bucket',
                Key: 'certs.tgz'
              }
            })
            .returns(uploads)

          bucket.uploadFile({
            bucket: 'test-bucket',
            certPath: './spec/downloads',
            base: 'test.io'
          },
          fullPath)
          .then(
            x => { result = x }
          )
          process.nextTick(() => {
            uploads.emit('end')
          })
        })

        it('should resolve with metadata', function () {
          expect(result).to.eql({
            dir: path.dirname(fullPath),
            file: fullPath
          })
          s3Mock.verify()
        })
      })
    })

    after(function () {
      rimraf.sync('./spec/downloads')
    })
  })

  describe('with GS', function () {
    describe('when downloading file', function () {
      describe('and download fails', function () {
        let gsMock, bucketMock, fileMock, bucket, result
        before(function () {
          const fullPath = path.resolve('./spec/downloads/test.io/certs.tgz')
          bucket = Bucket(gsAPI)
          gsMock = sinon.mock(gsAPI.gs)
          bucketMock = sinon.mock(gsBucket)
          fileMock = sinon.mock(gsFile)
          gsMock
            .expects('bucket')
            .withArgs('test-bucket')
            .returns(gsBucket)
          bucketMock
            .expects('file')
            .withArgs('certs.tgz')
            .returns(gsFile)
          fileMock
            .expects('download')
            .withArgs({
              destination: fullPath
            })
            .rejects(new Error('ohno'))

          return bucket.downloadFile({
            bucket: 'test-bucket',
            certPath: './spec/downloads',
            base: 'test.io'
          })
          .then(
            x => { result = x }
          )
        })

        it('should return undefined', function () {
          expect(result).to.equal(undefined)
          gsMock.verify()
          bucketMock.verify()
          fileMock.verify()
        })
      })

      describe('and download succeeds', function () {
        let gsMock, bucketMock, fileMock, bucket, result, fullPath
        before(function () {
          fullPath = path.resolve('./spec/downloads/test.io/certs.tgz')
          bucket = Bucket(gsAPI)
          gsMock = sinon.mock(gsAPI.gs)
          bucketMock = sinon.mock(gsBucket)
          fileMock = sinon.mock(gsFile)
          gsMock
            .expects('bucket')
            .withArgs('test-bucket')
            .returns(gsBucket)
          bucketMock
            .expects('file')
            .withArgs('certs.tgz')
            .returns(gsFile)
          fileMock
            .expects('download')
            .withArgs({
              destination: fullPath
            })
            .resolves({
              file: fullPath,
              dir: path.dirname(fullPath)
            })

          return bucket.downloadFile({
            bucket: 'test-bucket',
            certPath: './spec/downloads',
            base: 'test.io'
          })
          .then(
            x => { result = x }
          )
        })

        it('should resolve with metadata', function () {
          expect(result).to.eql({
            dir: path.dirname(fullPath),
            file: fullPath
          })
          gsMock.verify()
          bucketMock.verify()
          fileMock.verify()
        })
      })
    })

    describe('when uploading file', function () {
      describe('and upload fails', function () {
        let gsMock, bucketMock, bucket, result
        before(function () {
          const fullPath = path.resolve('./spec/downloads/test.io/certs.tgz')
          bucket = Bucket(gsAPI)
          gsMock = sinon.mock(gsAPI.gs)
          bucketMock = sinon.mock(gsBucket)
          gsMock
            .expects('bucket')
            .withArgs('test-bucket')
            .returns(gsBucket)
          bucketMock
            .expects('upload')
            .withArgs(fullPath)
            .rejects(new Error('ohno'))

          return bucket.uploadFile({
            bucket: 'test-bucket',
            certPath: './spec/downloads',
            base: 'test.io'
          }, fullPath)
          .then(
            null,
            err => { result = err }
          )
        })

        it('should return undefined', function () {
          result.message.should.equal('ohno')
          gsMock.verify()
          bucketMock.verify()
        })
      })

      describe('and upload succeeds', function () {
        let gsMock, bucketMock, bucket, result, fullPath
        before(function () {
          fullPath = path.resolve('./spec/downloads/test.io/certs.tgz')
          bucket = Bucket(gsAPI)
          gsMock = sinon.mock(gsAPI.gs)
          bucketMock = sinon.mock(gsBucket)
          gsMock
            .expects('bucket')
            .withArgs('test-bucket')
            .returns(gsBucket)
          bucketMock
            .expects('upload')
            .withArgs(fullPath)
            .resolves({})

          return bucket.uploadFile({
            bucket: 'test-bucket',
            certPath: './spec/downloads',
            base: 'test.io'
          }, fullPath)
          .then(
            x => { result = x }
          )
        })

        it('should return undefined', function () {
          result.should.eql({
            dir: path.dirname(fullPath),
            file: fullPath
          })
          gsMock.verify()
          bucketMock.verify()
        })
      })
    })

    after(function () {
      rimraf.sync('./spec/downloads')
    })
  })
})
