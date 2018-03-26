# k8s-certbot

A certbot based image with some useful add-ons and scripts to help with populating etcd keys with self-signed and then LetsEncrypt certs.

## Goal

Provide full automation around the acquisition, renewal, and configuration of SSL certificates for our ingress points (right now, NGiNX) in Kubernetes.

## What's on it

`k8s-certbot` command with two commands.

Each command expects a set of environment variables:

 * `CERT_ETCD_NAMESPACE` - the namespace the secret should be stored in
 * `CERT_ECTD_URL` - the URL for the etcd server
 * `CERT_DOMAINS` - list of domains to acquire a cert for
 * `CERT_BASE_DOMAIN` - the base domain the certs are acquired for
 * `CERT_EMAIL`
 * `CERT_COUNTRY`
 * `CERT_STATE`
 * `CERT_LOCAL`
 * `CERT_ORG`
 * `CERT_UNIT`
 * `CERT_WAIT` - number of seconds to wait before starting
 * `CERT_BUCKET` - the name of the bucket/object store to back up LetsEncrypt certs to
 * `CERT_STAGING` - uses LetsEncrypt's staging environment instead of their prod so that you can test (and not hit the rate limit as quickly)
 * `CERT_RENEW` - ignore any backup certs in the bucket/object store and acquire new certs
 * `CERT_HTTP_PORT` - controls the port for the `--http-01-port` argument (default `80`)

### LetsEncrypt Certs

The `getlegit` command requires AWS or GCE credentials that map to an IAM principle with S3/GS permissions so that it can back up the acquired certificates to a bucket for future retrieval.

AWS:

 * `AWS_ACCESS_KEY_ID`
 * `AWS_SECRET_ACCESS_KEY`

GS:

 * `GS_PROJECT_ID`
 * `GS_USER_ID`
 * `GS_USER_KEY`

Finally, it wants the name of a bucket/object store it can use to backup the certificates to. This is very important as LetsEncrypt has fairly restrictive rate limits that they cannot provide overrides for.

### Renewal

If the the `getlegit` command is run without `CERT_RENEW` being set truthy, then the job will just attempt to restore the certs from a backup and only replace them if the backup is missing.

If `CERT_RENEW` is set, then it will ignore the backup and re-acquire a new certificate for your domains. This environment variable is intended for use with a Kubernetes cron job. See the [`renew-cert-job`]('./blob/master/deploy/renew-cert-job.toml') for an example.

## Use

Add a command argument for the entrypoint script:

`selfsign` will create etcd keys with self-signed certificates using the environment variable information for each domain specified.

`getlegit` updates the etcd keys with a valid cert from LetsEncrypt via CertBot.

The intended use is to create a job using the `selfsign` command during initialization so that NGiNX as an ingress container can come up with the self-signed certs temporarily and then create a follow-up job with the `getlegit` using NGiNX to direct the traffic to that job which will update the cert keys in place.

You can look at [`arobson/alpine-nginx`](https://github.com/arobson/alpine-nginx) for an example of how the container uses [kickerd](https://github.com/npm-wharf/kickerd) to roll the NGiNX containers, one at a time, when the certs are updated.

### Examples

See the [`deploy`](./blob/master/deploy) folder for a set of [mcgonagall](https://github.com/npm-wharf/mcgonagall) specifications to see how you can include/deploy this to your Kubernetes cluster with [hikaru](https://github.com/npm-wharf/hikaru).


## FAQ

### Why LetsEncrypt?

If you have a lot of subdomains and need to nest more than a single level (and we do), then buying individual wild card certs for each subdomain gets very expensive, very quickly.

LetsEncrypt also provides us with an API that we can build an automation strategy around.

### Why etcd?

We already use etcd for a lot of our configuration management and it has a great API for watching entire key spaces for changes. It was a simple way to allow for ingress containers that "restart themselves" when the certs are created or renewed, keeping the entire flow fully automated.

See [kickerd](https://github.com/npm-wharf/kickerd). It works really well for etcd and I'm not convinced it would be as simple to create the same solution on top of another alternative. 

Clustering etcd in Kubernetes is also a thing etcd has a packaged solution for. There are lots of other reasons, but these are good starters.

### Why NGiNX?

This is tougher, but it's a mix of level of comfort, knowledge level of folks involved (me, heh), and (perceived?) ease to templatize and automate all of this along with getting it to work well within the ingress strategy we want/need in the context of Kubernetes. YMMV - we're scratching our own itch here, not telling you your LB/Proxy of choice is ugly.

### Why AWS/GS - Why Backup At All?

AWS/GS because that's where we're Kubernet ... ying? If/as that changes, we will add more.

The backups are primarily because, if your etcd goes away, you need a place to restore your certs from. LetsEncrypt is a non-profit and hammering away at their API is not ok and they protect themselves from this with very strongly enforced rate limits. 

Secondarily - in the case of failures, it's much faster to restore certs from a tarball in an object store than re-acquire certs from LetsEncrypt. In the event that you're having issues with the ingress point, you wouldn't be able to get the certs from LetsEncrypt anyway.

