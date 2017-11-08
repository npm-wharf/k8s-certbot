const fs = require('fs')
let gs, s3
if (process.env.GS_PROJECT_ID) {
  const GS = require('@google-cloud/storage')
  const file = fs.readFileSync(process.env.GS_USER_KEY, 'utf8').toString()
  const privateKey = Buffer.from(file, 'utf8')
  gs = new GS({
    projectId: process.env.GS_PROJECT_ID,
    credentials: {
      client_email: process.env.GS_USER_ID,
      private_key: privateKey
    }
  })
} else {
  const AWS = require('aws-sdk')
  s3 = new AWS.S3({apiVersion: '2006-03-01'})
}

module.exports = {
  gs,
  s3
}
