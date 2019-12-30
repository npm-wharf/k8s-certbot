# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

<a name="1.1.2"></a>
## [1.1.2](https://github.com/arobson/k8s-certbot/compare/v1.1.1...v1.1.2) (2019-12-30)


### Bug Fixes

* change python module from SimpleHTTP to http.server ([3808425](https://github.com/arobson/k8s-certbot/commit/3808425))
* correct Dockerfile to use new Node build approach ([65d2967](https://github.com/arobson/k8s-certbot/commit/65d2967))



<a name="1.1.1"></a>
## [1.1.1](https://github.com/arobson/k8s-certbot/compare/v1.1.0...v1.1.1) (2019-12-18)


### Bug Fixes

* add certbot arg to point to LetsEncrypt's ACMEv2 URL ([c81424d](https://github.com/arobson/k8s-certbot/commit/c81424d))



<a name="1.1.0"></a>
# 1.1.0 (2018-03-26)


### Bug Fixes

* add missing chalk declaration in index.js ([baed44e](https://github.com/arobson/k8s-certbot/commit/baed44e))


### Features

* add a way to change the port that certbot makes http requests against ([ae79287](https://github.com/arobson/k8s-certbot/commit/ae79287))
* changes behavior to push/restore letsencrypt certs to a s3/GSE bucket ([224155b](https://github.com/arobson/k8s-certbot/commit/224155b))
