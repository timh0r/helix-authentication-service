//
// Copyright 2023 Perforce Software
//
import * as fs from 'node:fs'
import { assert } from 'chai'
import { after, describe, it, run } from 'mocha'
import request from 'supertest'
// Load the test environment before the bulk of our code initializes, otherwise
// it will be too late due to the `import` early-binding behavior.
import 'helix-auth-svc/test/env.js'
import createApp from 'helix-auth-svc/lib/app.js'
import { createServer } from 'helix-auth-svc/lib/server.js'
import container from 'helix-auth-svc/lib/container.js'

// Tests must be run with `mocha --delay --exit` otherwise we do not give the
// server enough time to start up, and the server hangs indefinitely because
// mocha no longer exits after the tests complete.

const settings = container.resolve('settingsRepository')
const temporary = container.resolve('temporaryRepository')
const dotenv = container.resolve('configuredRepository')
const app = createApp()
const server = createServer(app, settings)
const agent = request.agent(server)
// create a test dot.env file every time for repeatability
const dotenvFile = 'test/test-dot.env'
fs.writeFileSync(dotenvFile, 'HAS_UNIT_OLD1="oldvalue"')
dotenv.reload()

//
// Give the server a chance to start up asynchronously. This works in concert
// with the --delay flag to the mocha command. A timeout of zero is not quite
// sufficient, so this timing is somewhat fragile.
//
setTimeout(function () {
  describe('Settings requests', function () {

    after(function () {
      // remove the file to prevent other tests from failing
      fs.unlinkSync(dotenvFile)
    })

    describe('Success cases', function () {
      it('should retrieve configuration settings', function (done) {
        getToken('scott', 'tiger').then((webToken) => {
          agent
            .get('/settings')
            .trustLocalhost(true)
            .set('Authorization', 'Bearer ' + webToken)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .expect(res => {
              assert.equal(Object.keys(res.body).length, 13)
              assert.equal(res.body.HAS_UNIT_OLD1, 'oldvalue')
              assert.equal(res.body.SESSION_SECRET, 'keyboard cat')
              assert.equal(res.body.TOKEN_TTL, '3600')
            })
            .end(done)
        })
      })

      it('should modify configuration settings', function (done) {
        getToken('scott', 'tiger').then((webToken) => {
          agent
            .post('/settings')
            .trustLocalhost(true)
            .set('Authorization', 'Bearer ' + webToken)
            .send({ HAS_UNIT_NEW1: 'newvalue' })
            .expect(200, { status: 'ok' }, done)
        })
      })

      it('should fetch modified settings', function (done) {
        getToken('scott', 'tiger').then((webToken) => {
          agent
            .get('/settings')
            .trustLocalhost(true)
            .set('Authorization', 'Bearer ' + webToken)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .expect(res => {
              assert.equal(res.body.HAS_UNIT_OLD1, 'oldvalue')
              assert.equal(res.body.HAS_UNIT_NEW1, 'newvalue')
            })
            // eslint-disable-next-line no-unused-vars
            .end(function (err, res) {
              if (err) {
                return done(err)
              }
              // verify new setting not yet applied to environment
              assert.notProperty(process.env, 'HAS_UNIT_NEW1')
              done()
            })
        })
      })

      it('should fetch all auth providers', function (done) {
        temporary.set('AUTH_PROVIDERS', [
          {
            clientId: 'unique-client-identifier',
            clientCert: '-----BEGIN CERTIFICATE-----',
            clientKey: '-----BEGIN PRIVATE KEY-----',
            issuerUri: 'https://oidc.example.com',
            selectAccount: 'false',
            signingAlgo: 'RS256',
            label: 'oidc.example.com',
            protocol: 'oidc',
            id: 'oidc-1'
          }
        ])
        getToken('scott', 'tiger').then((webToken) => {
          agent
            .get('/settings/providers')
            .trustLocalhost(true)
            .set('Authorization', 'Bearer ' + webToken)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .expect(res => {
              assert.property(res.body, 'providers')
              const providers = res.body.providers
              assert.lengthOf(providers, 1)
              const oidcProvider = providers.find((e) => e.protocol === 'oidc')
              assert.exists(oidcProvider)
              assert.propertyVal(oidcProvider, 'signingAlgo', 'RS256')
              assert.equal(oidcProvider.clientCert, '-----BEGIN CERTIFICATE-----')
              // private key should be concealed
              assert.notProperty(oidcProvider, 'clientKey')
            })
            .end(function (err) {
              temporary.delete('AUTH_PROVIDERS')
              done(err)
            })
        })
      })

      it('should fetch a specific auth provider', function (done) {
        temporary.set('AUTH_PROVIDERS', [
          {
            clientId: 'unique-client-identifier',
            clientCert: '-----BEGIN CERTIFICATE-----',
            clientKey: '-----BEGIN PRIVATE KEY-----',
            issuerUri: 'https://oidc.example.com',
            selectAccount: 'false',
            signingAlgo: 'RS256',
            label: 'oidc.example.com',
            protocol: 'oidc',
            id: 'oidc-1'
          }
        ])
        getToken('scott', 'tiger').then((webToken) => {
          agent
            .get('/settings/providers/oidc-1')
            .trustLocalhost(true)
            .set('Authorization', 'Bearer ' + webToken)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .expect(res => {
              assert.propertyVal(res.body, 'clientId', 'unique-client-identifier')
              assert.equal(res.body.clientCert, '-----BEGIN CERTIFICATE-----')
              assert.equal(res.body.issuerUri, 'https://oidc.example.com')
              assert.isFalse(res.body.selectAccount)
              assert.equal(res.body.signingAlgo, 'RS256')
              assert.equal(res.body.label, 'oidc.example.com')
              assert.equal(res.body.protocol, 'oidc')
              assert.equal(res.body.id, 'oidc-1')
              // private key should be concealed
              assert.notProperty(res.body, 'clientKey')
            })
            .end(function (err) {
              temporary.delete('AUTH_PROVIDERS')
              done(err)
            })
        })
      })

      it('should post new auth provider', function (done) {
        getToken('scott', 'tiger').then((webToken) => {
          agent
            .post('/settings/providers')
            .trustLocalhost(true)
            .set('Authorization', 'Bearer ' + webToken)
            .send({
              clientId: 'client-id',
              clientSecret: 'client-secret',
              issuerUri: 'https://oidc.example.com',
              selectAccount: 'false',
              signingAlgo: 'RS256',
              label: 'Provider',
              protocol: 'oidc',
              id: 'this-will-be-assigned'
            })
            .expect(200)
            .end(function (err, res) {
              if (err) {
                return done(err)
              }
              assert.equal(res.body.status, 'ok')
              assert.equal(res.body.id, 'oidc-0')
              const testenv = fs.readFileSync('test/test-dot.env', 'utf8')
              assert.include(testenv, 'https://oidc.example.com')
              done()
            })
        })
      })

      it('should return the one new auth provider', function (done) {
        getToken('scott', 'tiger').then((webToken) => {
          agent
            .get('/settings/providers')
            .trustLocalhost(true)
            .set('Authorization', 'Bearer ' + webToken)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .expect(res => {
              assert.property(res.body, 'providers')
              const providers = res.body.providers
              assert.lengthOf(providers, 1)
              const oidcProvider = providers.find((e) => e.protocol === 'oidc')
              assert.exists(oidcProvider)
              assert.propertyVal(oidcProvider, 'clientId', 'client-id')
              assert.propertyVal(oidcProvider, 'clientSecret', 'client-secret')
              assert.propertyVal(oidcProvider, 'issuerUri', 'https://oidc.example.com')
              assert.propertyVal(oidcProvider, 'label', 'Provider')
            })
            .end(function (err) {
              // simulate a restart by clearing all temporary settings
              temporary.clear()
              done(err)
            })
        })
      })

      it('should post new OIDC provider when SAML already exists', function (done) {
        temporary.set('SAML_IDP_METADATA_URL', 'https://saml.example.com/metadata')
        getToken('scott', 'tiger').then((webToken) => {
          agent
            .post('/settings/providers')
            .trustLocalhost(true)
            .set('Authorization', 'Bearer ' + webToken)
            .send({
              clientId: 'client-id',
              clientSecret: 'client-secret',
              issuerUri: 'https://oidc.example.com',
              selectAccount: 'false',
              signingAlgo: 'RS256',
              label: 'Provider',
              protocol: 'oidc',
              id: 'this-will-be-assigned'
            })
            .expect(200)
            .end(function (err, res) {
              if (err) {
                return done(err)
              }
              assert.equal(res.body.status, 'ok')
              assert.equal(res.body.id, 'oidc-0')
              const testenv = fs.readFileSync('test/test-dot.env', 'utf8')
              assert.include(testenv, 'https://oidc.example.com')
              done()
            })
        })
      })

      it('should return the existing and new providers', function (done) {
        getToken('scott', 'tiger').then((webToken) => {
          agent
            .get('/settings/providers')
            .trustLocalhost(true)
            .set('Authorization', 'Bearer ' + webToken)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .expect(res => {
              assert.property(res.body, 'providers')
              const providers = res.body.providers
              assert.lengthOf(providers, 2)
              const oidcProvider = providers.find((e) => e.protocol === 'oidc')
              assert.exists(oidcProvider)
              assert.propertyVal(oidcProvider, 'clientId', 'client-id')
              assert.propertyVal(oidcProvider, 'clientSecret', 'client-secret')
              assert.propertyVal(oidcProvider, 'issuerUri', 'https://oidc.example.com')
              assert.propertyVal(oidcProvider, 'label', 'Provider')
              const samlProvider = providers.find((e) => e.protocol === 'saml')
              assert.exists(samlProvider)
              assert.propertyVal(samlProvider, 'metadataUrl', 'https://saml.example.com/metadata')
            })
            .end(function (err) {
              // simulate a restart by clearing all temporary settings
              temporary.clear()
              done(err)
            })
        })
      })

      it('should update an existing auth provider', function (done) {
        temporary.set('AUTH_PROVIDERS', [
          {
            clientId: 'unique-client-identifier',
            clientSecret: 'shared secrets are bad',
            issuerUri: 'https://oidc.example.com',
            selectAccount: 'false',
            signingAlgo: 'RS256',
            label: 'oidc.example.com',
            protocol: 'oidc',
            id: 'oidc-1'
          }
        ])
        getToken('scott', 'tiger').then((webToken) => {
          agent
            .put('/settings/providers/oidc-1')
            .trustLocalhost(true)
            .set('Authorization', 'Bearer ' + webToken)
            .send({
              clientId: 'client-id',
              clientSecret: 'updated-client-secret',
              issuerUri: 'https://oidc.example.com',
              selectAccount: 'false',
              signingAlgo: 'RS256',
              label: 'Provider',
              protocol: 'oidc',
              id: 'oidc-1'
            })
            .expect(200, { status: 'ok' })
            .end(function (err) {
              if (err) {
                return done(err)
              }
              const testenv = fs.readFileSync('test/test-dot.env', 'utf8')
              assert.include(testenv, 'updated-client-secret')
              done()
            })
        })
      })

      it('should return the one updated auth provider', function (done) {
        getToken('scott', 'tiger').then((webToken) => {
          agent
            .get('/settings/providers')
            .trustLocalhost(true)
            .set('Authorization', 'Bearer ' + webToken)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .expect(res => {
              assert.property(res.body, 'providers')
              const providers = res.body.providers
              assert.lengthOf(providers, 1)
              const oidcProvider = providers.find((e) => e.protocol === 'oidc')
              assert.exists(oidcProvider)
              assert.propertyVal(oidcProvider, 'clientId', 'client-id')
              assert.propertyVal(oidcProvider, 'clientSecret', 'updated-client-secret')
              assert.propertyVal(oidcProvider, 'issuerUri', 'https://oidc.example.com')
              assert.propertyVal(oidcProvider, 'label', 'Provider')
            })
            .end(function (err) {
              // simulate a restart by clearing all temporary settings
              temporary.clear()
              done(err)
            })
        })
      })

      it('should delete a classic auth provider', function (done) {
        temporary.set('SAML_IDP_METADATA_URL', 'https://saml.example.com/metadata')
        getToken('scott', 'tiger').then((webToken) => {
          agent
            .delete('/settings/providers/saml')
            .trustLocalhost(true)
            .set('Authorization', 'Bearer ' + webToken)
            .expect(200, { status: 'ok' })
            .end(done)
        })
      })

      it('should return zero auth providers', function (done) {
        getToken('scott', 'tiger').then((webToken) => {
          agent
            .get('/settings/providers')
            .trustLocalhost(true)
            .set('Authorization', 'Bearer ' + webToken)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .expect(res => {
              assert.property(res.body, 'providers')
              const providers = res.body.providers
              assert.lengthOf(providers, 0)
            })
            .end(function (err) {
              // simulate a restart by clearing all temporary settings
              temporary.clear()
              done(err)
            })
        })
      })

      it('should delete an existing auth provider', function (done) {
        temporary.set('AUTH_PROVIDERS', [
          {
            clientId: 'unique-client-identifier',
            clientSecret: 'shared secrets are bad',
            issuerUri: 'https://oidc.example.com',
            selectAccount: 'false',
            signingAlgo: 'RS256',
            label: 'oidc.example.com',
            protocol: 'oidc',
            id: 'oidc-1'
          },
          {
            metadataUrl: 'https://saml.example.com/metadata',
            spEntityId: 'urn:example:sp',
            label: 'saml.example.com',
            protocol: 'saml',
            id: 'saml-1'
          }
        ])
        getToken('scott', 'tiger').then((webToken) => {
          agent
            .delete('/settings/providers/oidc-1')
            .trustLocalhost(true)
            .set('Authorization', 'Bearer ' + webToken)
            .expect(200, { status: 'ok' })
            .end(function (err) {
              if (err) {
                return done(err)
              }
              const testenv = fs.readFileSync('test/test-dot.env', 'utf8')
              assert.include(testenv, 'urn:example:sp')
              assert.notInclude(testenv, 'unique-client-identifier')
              done()
            })
        })
      })

      it('should return the one remaining auth provider', function (done) {
        getToken('scott', 'tiger').then((webToken) => {
          agent
            .get('/settings/providers')
            .trustLocalhost(true)
            .set('Authorization', 'Bearer ' + webToken)
            .expect(200)
            .expect('Content-Type', /application\/json/)
            .expect(res => {
              assert.property(res.body, 'providers')
              const providers = res.body.providers
              assert.lengthOf(providers, 1)
              const samlProvider = providers.find((e) => e.protocol === 'saml')
              assert.exists(samlProvider)
              assert.propertyVal(samlProvider, 'metadataUrl', 'https://saml.example.com/metadata')
              assert.propertyVal(samlProvider, 'spEntityId', 'urn:example:sp')
              assert.propertyVal(samlProvider, 'label', 'saml.example.com')
            })
            .end(function (err) {
              // simulate a restart by clearing all temporary settings
              temporary.clear()
              done(err)
            })
        })
      })

      it('should provide new service address', function (done) {
        getToken('scott', 'tiger').then((webToken) => {
          agent
            .post('/settings/apply')
            .trustLocalhost(true)
            .set('Authorization', 'Bearer ' + webToken)
            .expect('Location', /localhost/)
            .expect(200, { status: 'ok' }, done)
          // We could try to verify that the setting has _now_ been applied to
          // environment, however, to test this properly we would need a means
          // of allowing the Node.js server instance to be rebuilt and wrapped
          // by superagent, which is probably more difficult than it's worth
          // for automated testing.
        })
      })
    })

    describe('Failure cases', function () {
      it('should reject fetch without Authorization', function (done) {
        agent
          .get('/settings')
          .trustLocalhost(true)
          .expect(401, /Unauthorized/, done)
      })

      it('should reject malformed web token', function (done) {
        agent
          .get('/settings')
          .trustLocalhost(true)
          .set('Authorization', 'Bearer notavalidtokenatall')
          .expect(500, /invalid json web token/, done)
      })

      it('should reject web token signed by another party', function (done) {
        const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsIng1dCI6Ik1yNS1BVWliZkJpaTdOZDFqQmViYXhib1hXMCIsImtpZCI6Ik1yNS1BVWliZkJpaTdOZDFqQmViYXhib1hXMCJ9.eyJhdWQiOiJhcGk6Ly8yNWIxN2NkYi00YzhkLTQzNGMtOWEyMS04NmQ2N2FjNTAxZDEiLCJpc3MiOiJodHRwczovL3N0cy53aW5kb3dzLm5ldC83MTlkODhmMy1mOTU3LTQ0Y2YtOWFhNS0wYTFhM2E0NGY3YjkvIiwiaWF0IjoxNjQwMDM4OTY2LCJuYmYiOjE2NDAwMzg5NjYsImV4cCI6MTY0MDEyNTY2NiwiYWlvIjoiRTJaZ1lLaStuWnA3NmQ0TDdRc0Y2Zzk1TGF3NUFBPT0iLCJhcHBpZCI6ImYzNjRmZjE3LTllNDItNGY3ZS1iNzAwLTExZTE5YmEyYWM2ZiIsImFwcGlkYWNyIjoiMiIsImlkcCI6Imh0dHBzOi8vc3RzLndpbmRvd3MubmV0LzcxOWQ4OGYzLWY5NTctNDRjZi05YWE1LTBhMWEzYTQ0ZjdiOS8iLCJvaWQiOiI0ZGJkZjQ1MC05NThkLTRjNjQtODhiMi1hYmJhMmU0NmYxZmYiLCJyaCI6IjAuQVN3QTg0aWRjVmY1ejBTYXBRb2FPa1QzdVJmX1pQTkNubjVQdHdBUjRadWlyRzhzQUFBLiIsInJvbGVzIjpbIlBlcmZvcmNlLkNhbGwiXSwic3ViIjoiNGRiZGY0NTAtOTU4ZC00YzY0LTg4YjItYWJiYTJlNDZmMWZmIiwidGlkIjoiNzE5ZDg4ZjMtZjk1Ny00NGNmLTlhYTUtMGExYTNhNDRmN2I5IiwidXRpIjoiNm5XeVVFbjJGMC00OVlVNG02bDBBQSIsInZlciI6IjEuMCJ9.fS2f3IoYxr2VlJd4BCxT4o3ikqdyjJY1AGVRe7-tBWmpZSbyKOAs39WIYReWp5vMShW1JKv_r37bYSMbIHhz0bfKM-OkQELEdOsfVoBbywkXSoxCoGXAj5q1RxuCPUEnX59UlgCNa2_Z6Rc765O9BSz7BbYBlaW2Bh6OIzTywBW2Lyn987PxiewsIECSUCP_v4lY9VsS5PUo3iQgAygQ1qUQQf3FKunZhL8SOYuz-PcGpkZqC9F8FCah3wMbyekfLu5Tjhujg7lL_RiBgQqkRjXc5WZDft0md4j-4zGQDmPCE73NP2Xh-9mkpu8cZFw-lz-wOZ8SXF43yjfpy1CxSQ'
        agent
          .get('/settings')
          .trustLocalhost(true)
          .set('Authorization', 'Bearer ' + token)
          .expect(401, /Unauthorized/, done)
      })

      it('should reject request of wrong content-type', function (done) {
        getToken('scott', 'tiger').then((webToken) => {
          agent
            .post('/settings')
            .trustLocalhost(true)
            .set('Authorization', 'Bearer ' + webToken)
            .send('plain text request body')
            .expect(400, /Content-Type must be application\/json/, done)
        })
      })

      it('should return 404 for missing provider on GET', function (done) {
        getToken('scott', 'tiger').then((webToken) => {
          agent
            .get('/settings/providers/foobar')
            .trustLocalhost(true)
            .set('Authorization', 'Bearer ' + webToken)
            .expect(404, /"not found"/, done)
        })
      })

      it('should return 404 for missing provider on DELETE', function (done) {
        getToken('scott', 'tiger').then((webToken) => {
          agent
            .delete('/settings/providers/foobar')
            .trustLocalhost(true)
            .set('Authorization', 'Bearer ' + webToken)
            .expect(404, /"not found"/, done)
        })
      })

      it('should return 400 for an invalid auth provider', function (done) {
        getToken('scott', 'tiger').then((webToken) => {
          agent
            .post('/settings/providers')
            .trustLocalhost(true)
            .set('Authorization', 'Bearer ' + webToken)
            .send({
              clientId: 'client-id',
              clientSecret: 'client-secret',
              selectAccount: 'false',
              signingAlgo: 'RS256',
              label: 'Provider',
              protocol: 'oidc',
              id: 'oidc-2'
            })
            .expect(400, done)
        })
      })

      it('should reject PUT of a new auth provider', function (done) {
        getToken('scott', 'tiger').then((webToken) => {
          agent
            .put('/settings/providers/oidc-1')
            .trustLocalhost(true)
            .set('Authorization', 'Bearer ' + webToken)
            .send({
              clientId: 'client-id-3',
              clientSecret: 'client-secret-3',
              issuerUri: 'https://oidc3.example.com',
              selectAccount: 'false',
              signingAlgo: 'RS256',
              label: 'Provider',
              protocol: 'oidc'
            })
            .expect(404, done)
        })
      })
    })
  })

  run()
}, 500)

function getToken(username, password) {
  return new Promise((resolve, reject) => {
    agent
      .post('/tokens')
      .trustLocalhost(true)
      .send({ grant_type: 'password', username, password })
      .expect(200)
       
      .end(function (err, res) {
        if (err) {
          reject(err)
        } else {
          resolve(res.body.access_token)
        }
      })
  })
}
