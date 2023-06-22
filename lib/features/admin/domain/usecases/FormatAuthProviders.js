//
// Copyright 2023 Perforce Software
//
import * as assert from 'node:assert'
import {
  oidcNameMapping,
  samlNameMapping
} from 'helix-auth-svc/lib/constants.js'

/**
 * If AUTH_PROVIDERS exists in the map/repository object, format the value such
 * that it is ready to be written to persistent storage.
 *
 * @param {Map} settings - partial or complete collection of settings.
 */
export default ({ defaultsRepository }) => {
  assert.ok(defaultsRepository, 'defaultsRepository must be defined')
  return async (settings) => {
    if (settings.has('AUTH_PROVIDERS')) {
      const content = settings.get('AUTH_PROVIDERS')
      const anonymous = content.map((p) => {
        // remove the identifier that is only assigned at runtime
        const clone = Object.assign({}, p)
        delete clone.id
        // filter default values
        const mapping = p.protocol === 'oidc' ? oidcNameMapping : samlNameMapping
        for (const [env, prov] of Object.entries(mapping)) {
          if (defaultsRepository.has(env) && p[prov] !== undefined) {
            const value = p[prov]
            // intentionally using == to detect more duplicates (e.g. 1 == '1')
            // although it will not catch everything (e.g. false == 'false')
            const defawlt = defaultsRepository.get(env)
            if (defawlt == value || defawlt === value.toString()) {
              delete clone[prov]
            }
          }
        }
        return clone
      })
      const formatted = { providers: anonymous }
      settings.set('AUTH_PROVIDERS', JSON.stringify(formatted))
    }
  }
}