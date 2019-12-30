require('./setup')
const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const EventEmitter = require('events')

const etcd = {
  set: () => {}
}

const exec = () => {}

const processes = {
  create: () => {},
  stop: () => {}
}

const backup = {
  create: () => {},
  restore: () => {}
}

const Bot = require('../src/bot')

describe('Bot', function () {
  const exit = process.exit // audible_gasp.js
  let exited = null
  before(function () {
    process.exit = (code) => {
      exited = code
    }
  })
  describe('acquireAll', function () {
    describe('when creating HTTP process wrapper fails', function () {
      let bot
      let processMock
      let config
      before(function () {
        config = {}
        bot = Bot(config, etcd, exec, processes, backup)
        processMock = sinon.mock(processes)
        processMock.expects('create')
          .withArgs('http', {
            command: 'python',
            args: ['-m', 'http.server', '80']
          })
          .rejects(new Error('no'))
        return bot.acquireAll()
      })

      it('should exit process', function () {
        processMock.verify()
        exited.should.equal(100)
      })

      after(function () {
        exited = null
      })
    })

    describe('when HTTP process fails', function () {
      let bot
      let processMock
      let config
      let http
      before(function () {
        config = {}
        http = new EventEmitter()
        http.start = () => {
          http.emit('failed', new Error('ohno'))
        }
        bot = Bot(config, etcd, exec, processes, backup)
        processMock = sinon.mock(processes)

        processMock.expects('create')
          .withArgs('http', {
            command: 'python',
            args: ['-m', 'http.server', '80']
          })
          .resolves(http)

        return bot.acquireAll()
      })

      it('should exit process', function () {
        processMock.verify()
        exited.should.equal(100)
      })

      after(function () {
        exited = null
      })
    })

    describe('when certbot process fails', function () {
      let bot
      let processMock
      let config
      let http
      let backupMock
      let execStub
      let args
      before(function () {
        config = {
          email: 'me@test.io',
          domains: [ 'test.io', 'test.org' ],
          logPath: './spec/fake.log',
          port: 80
        }
        args = [
          'certonly',
          '--webroot',
          '--server',
          'https://acme-v02.api.letsencrypt.org/directory',
          '-w',
          './',
          '-n',
          '--agree-tos',
          '--http-01-port',
          '80',
          '--email',
          'me@test.io',
          '--no-self-upgrade',
          '-d',
          'test.io',
          '-d',
          'test.org'
        ]
        http = new EventEmitter()
        http.start = () => {
          http.emit('started')
        }
        execStub = sinon.stub()
        backupMock = sinon.mock(backup)
        processMock = sinon.mock(processes)
        bot = Bot(config, etcd, execStub, processes, backup)

        fs.writeFileSync('./spec/fake.log', '', 'utf8')

        processMock.expects('create')
          .withArgs('http', {
            command: 'python',
            args: ['-m', 'http.server', '80']
          })
          .resolves(http)

        processMock.expects('stop')
          .once()

        backupMock.expects('restore')
          .callsArg(0)
          .resolves(false)

        const err = new Error('oops')
        err.code = 1
        err.output = ['oh', 'no']
        execStub
          .withArgs(console.log, 'certbot', args)
          .rejects(err)

        return bot.acquireAll()
      })

      it('should exit process', function () {
        backupMock.verify()
        execStub.calledWithExactly(console.log, 'certbot', args)
        processMock.verify()
        exited.should.equal(100)
      })

      after(function () {
        exited = null
        fs.unlinkSync('./spec/fake.log')
      })
    })

    describe('when writing certs fails', function () {
      let bot
      let processMock
      let config
      let http
      let backupMock
      let execStub
      let etcdMock
      let args
      before(function () {
        config = {
          namespace: 'prod',
          base: 'test.io',
          certPath: './spec/certs',
          email: 'me@test.io',
          domains: [ 'test.io', 'www.test.io' ],
          port: 80
        }
        args = [
          'certonly',
          '--webroot',
          '--server',
          'https://acme-v02.api.letsencrypt.org/directory',
          '-w',
          './',
          '-n',
          '--agree-tos',
          '--http-01-port',
          '80',
          '--email',
          'me@test.io',
          '--no-self-upgrade',
          '-d',
          'test.io',
          '-d',
          'www.test.io'
        ]
        http = new EventEmitter()
        http.start = () => {
          http.emit('started')
        }
        execStub = sinon.stub()
        backupMock = sinon.mock(backup)
        processMock = sinon.mock(processes)
        etcdMock = sinon.mock(etcd)
        bot = Bot(config, etcd, execStub, processes, backup)

        processMock.expects('create')
          .withArgs('http', {
            command: 'python',
            args: ['-m', 'http.server', '80']
          })
          .resolves(http)

        processMock.expects('stop')
          .once()

        backupMock.expects('restore')
          .callsArg(0)
          .resolves(true)

        backupMock.expects('create')
          .resolves()

        etcdMock.expects('set')
          .withArgs('prod/test_io_crt', 'spec/certs/test.io/cert.pem', sinon.match.func)
          .callsArgWith(2, new Error('no thanks'))

        etcdMock.expects('set')
          .withArgs('prod/test_io_key', 'spec/certs/test.io/privkey.pem', sinon.match.func)
          .callsArgWith(2, new Error('no thanks'))

        etcdMock.expects('set')
          .withArgs('prod/test_io_pem', 'spec/certs/test.io/fullchain.pem', sinon.match.func)
          .callsArgWith(2, new Error('no thanks'))

        etcdMock.expects('set')
          .withArgs('prod/www_crt', 'spec/certs/test.io/cert.pem', sinon.match.func)
          .callsArgWith(2, new Error('no thanks'))

        etcdMock.expects('set')
          .withArgs('prod/www_key', 'spec/certs/test.io/privkey.pem', sinon.match.func)
          .callsArgWith(2, new Error('no thanks'))

        etcdMock.expects('set')
          .withArgs('prod/www_pem', 'spec/certs/test.io/fullchain.pem', sinon.match.func)
          .callsArgWith(2, new Error('no thanks'))

        execStub
          .withArgs(console.log, 'certbot', args)
          .resolves()

        return bot.acquireAll()
      })

      it('should exit process', function () {
        backupMock.verify()
        execStub.calledWithExactly(console.log, 'certbot', args)
        processMock.verify()
        etcdMock.verify()
        exited.should.equal(100)
      })

      after(function () {
        exited = null
      })
    })

    describe('when writing certs succeeds', function () {
      let bot
      let processMock
      let config
      let http
      let backupMock
      let execStub
      let etcdMock
      let args
      before(function () {
        config = {
          namespace: 'prod',
          base: 'test.io',
          certPath: './spec/certs',
          email: 'me@test.io',
          domains: [ 'test.io', 'www.test.io' ],
          port: 80
        }
        args = [
          'certonly',
          '--webroot',
          '--server',
          'https://acme-v02.api.letsencrypt.org/directory',
          '-w',
          './',
          '-n',
          '--agree-tos',
          '--http-01-port',
          '80',
          '--email',
          'me@test.io',
          '--no-self-upgrade',
          '-d',
          'test.io',
          '-d',
          'www.test.io'
        ]
        http = new EventEmitter()
        http.start = () => {
          http.emit('started')
        }
        execStub = sinon.stub()
        backupMock = sinon.mock(backup)
        processMock = sinon.mock(processes)
        etcdMock = sinon.mock(etcd)
        bot = Bot(config, etcd, execStub, processes, backup)

        processMock.expects('create')
          .withArgs('http', {
            command: 'python',
            args: ['-m', 'http.server', '80']
          })
          .resolves(http)

        processMock.expects('stop')
          .once()

        backupMock.expects('restore')
          .callsArg(0)
          .resolves(true)

        backupMock.expects('create')
          .resolves()

        etcdMock.expects('set')
          .withArgs('prod/test_io_crt', 'spec/certs/test.io/cert.pem', sinon.match.func)
          .callsArgWith(2)

        etcdMock.expects('set')
          .withArgs('prod/test_io_key', 'spec/certs/test.io/privkey.pem', sinon.match.func)
          .callsArgWith(2)

        etcdMock.expects('set')
          .withArgs('prod/test_io_pem', 'spec/certs/test.io/fullchain.pem', sinon.match.func)
          .callsArgWith(2)

        etcdMock.expects('set')
          .withArgs('prod/www_crt', 'spec/certs/test.io/cert.pem', sinon.match.func)
          .callsArgWith(2)

        etcdMock.expects('set')
          .withArgs('prod/www_key', 'spec/certs/test.io/privkey.pem', sinon.match.func)
          .callsArgWith(2)

        etcdMock.expects('set')
          .withArgs('prod/www_pem', 'spec/certs/test.io/fullchain.pem', sinon.match.func)
          .callsArgWith(2)

        execStub
          .withArgs(console.log, 'certbot', args)
          .resolves()

        return bot.acquireAll()
      })

      it('should complete successfully', function () {
        backupMock.verify()
        execStub.calledWithExactly(console.log, 'certbot', args)
        processMock.verify()
        etcdMock.verify()
        expect(exited).to.equal(null)
      })

      after(function () {
        exited = null
      })
    })
  })

  describe('selfSignAll', function () {
    describe('when openSSL succeeds', function () {
      let config
      let etcdMock
      let execStub
      let args
      let bot
      before(function () {
        config = {
          namespace: 'prod',
          domains: [ 'test.io' ],
          certPath: 'certs',
          base: 'test.io',
          country: 'US',
          state: 'California',
          city: 'Oakland',
          local: '',
          organization: 'MochaHut',
          unit: 'QA',
          email: 'me@me.io'
        }
        args = [
          'req',
          '-x509',
          '-nodes',
          '-days',
          '365',
          '-newkey',
          'rsa:2048',
          '-keyout',
          path.resolve('test.io.key'),
          '-out',
          path.resolve('test.io.crt'),
          '-subj',
          `/C=${config.country}/ST=${config.state}/L=${config.local}/O=${config.organization}/OU=${config.unit}/CN=test.io/emailAddress=${config.email}`
        ]

        etcdMock = sinon.mock(etcd)
        execStub = sinon.stub()
        bot = Bot(config, etcd, execStub, processes, backup)

        execStub
          .withArgs(sinon.match.func, 'openssl', args)
          .resolves({})

        etcdMock.expects('set')
          .withArgs('prod/test_io_crt', 'cert\n', sinon.match.func)
          .callsArgWith(2)

        etcdMock.expects('set')
          .withArgs('prod/test_io_key', 'key\n', sinon.match.func)
          .callsArgWith(2)

        etcdMock.expects('set')
          .withArgs('prod/test_io_pem', 'cert\nkey\n', sinon.match.func)
          .callsArgWith(2)

        fs.writeFileSync('./test.io.key', 'key\n', 'utf8')
        fs.writeFileSync('./test.io.crt', 'cert\n', 'utf8')
        return bot.selfSignAll()
      })

      it('should have created and combined files in the correct order', function () {
        const final = fs.readFileSync('./test.io.pem', 'utf8')
        final.should.eql('cert\nkey\n')
        etcdMock.verify()
      })

      after(function () {
        fs.unlinkSync('./test.io.key')
        fs.unlinkSync('./test.io.crt')
        fs.unlinkSync('./test.io.pem')
      })
    })

    describe('when openSSL fails', function () {
      let config
      let etcdMock
      let execStub
      let args
      let bot
      before(function () {
        config = {
          namespace: 'prod',
          domains: [ 'test.io' ],
          certPath: 'certs',
          base: 'test.io',
          country: 'US',
          state: 'California',
          city: 'Oakland',
          local: '',
          organization: 'MochaHut',
          unit: 'QA',
          email: 'me@me.io'
        }
        args = [
          'req',
          '-x509',
          '-nodes',
          '-days',
          '365',
          '-newkey',
          'rsa:2048',
          '-keyout',
          path.resolve('test.io.key'),
          '-out',
          path.resolve('test.io.crt'),
          '-subj',
          `/C=${config.country}/ST=${config.state}/L=${config.local}/O=${config.organization}/OU=${config.unit}/CN=test.io/emailAddress=${config.email}`
        ]

        etcdMock = sinon.mock(etcd)
        execStub = sinon.stub()
        bot = Bot(config, etcd, execStub, processes, backup)

        execStub
          .withArgs(sinon.match.func, 'openssl', args)
          .rejects(new Error('nope'))

        etcdMock
          .expects('set')
          .never()

        return bot.selfSignAll()
      })

      it('should have created and combined files in the correct order', function () {
        fs.existsSync('./test.io.pem').should.equal(false)
        etcdMock.verify()
      })

      after(function () {
      })
    })
  })
  after(function () {
    process.exit = exit
  })
})
