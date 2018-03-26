const BASE = 'CERT_BASE_DOMAIN'
const BUCKET = 'CERT_BUCKET'
const CERT_PATH = 'CERT_PATH'
const DOMAINS = 'CERT_DOMAINS'
const COUNTRY = 'CERT_COUNTRY'
const STATE = 'CERT_STATE'
const LOCAL = 'CERT_LOCAL'
const ORGANIZATION = 'CERT_ORG'
const UNIT = 'CERT_UNIT'
const EMAIL = 'CERT_EMAIL'
const ETCD = 'CERT_ECTD_URL'
const NAMESPACE = 'CERT_ETCD_NAMESPACE'
const WAIT = 'CERT_WAIT'
const RENEW = 'CERT_RENEW'
const STAGING = 'CERT_STAGING'
const DEFAULT_CERT_PATH = '/etc/letsencrypt/live'
const PORT = 'CERT_HTTP_PORT'

const Joi = require('joi')
const definition = {
  domains: Joi.string().required(),
  base: Joi.string().required(),
  country: Joi.string().required(),
  state: Joi.string().required(),
  local: Joi.string().required(),
  organization: Joi.string().required(),
  unit: Joi.string().required(),
  email: Joi.string().required(),
  etcd: Joi.string().uri({allowRelative: false}).required(),
  namespace: Joi.string().required(),
  key: Joi.string().required()
}

const serviceSchema = Joi.compile(definition)

function validateConfig (config) {
  return Joi.validate(config, serviceSchema, {
    allowUnknown: true
  })
}

function split (string) {
  return string.split(',').map(d => d.trim())
}

function getConfiguration () {
  const config = {
    domains: split(process.env[ DOMAINS ]),
    base: process.env[ BASE ],
    country: process.env[ COUNTRY ],
    state: process.env[ STATE ],
    local: process.env[ LOCAL ],
    organization: process.env[ ORGANIZATION ],
    unit: process.env[ UNIT ],
    email: process.env[ EMAIL ],
    wait: process.env[ WAIT ] || 10,
    etcd: process.env[ ETCD ],
    namespace: process.env[ NAMESPACE ],
    bucket: process.env[ BUCKET ],
    certPath: process.env[ CERT_PATH ] || DEFAULT_CERT_PATH,
    staging: process.env[ STAGING ] || false,
    renew: process.env[ RENEW ] || false,
    port: process.env[ PORT ] || 80
  }

  validateConfig(config)
  return config
}

module.exports = getConfiguration
