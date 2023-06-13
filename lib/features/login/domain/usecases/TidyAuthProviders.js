//
// Copyright 2023 Perforce Software
//
import * as assert from 'node:assert'
import * as fs from 'node:fs/promises'
import * as url from 'node:url'
import { MetadataReader } from 'passport-saml-metadata'

/**
 * Prepare the authentication provider objects for general use. As a
 * side-effect, the providers will be sorted in place according to their labels.
 * Any incomplete providers based on default settings will be removed.
 *
 * @param {Array} providers - auth providers as from getAuthProviders.
 * @return {Promise} resolves to the modified and filtered list.
 */
export default ({ validateAuthProvider }) => {
  assert.ok(validateAuthProvider, 'validateAuthProvider must be defined')
  return async (providers) => {
    assert.ok(providers, 'providers must be defined')
    // attempt to assign a protocol as it is easy to forget
    ensureProtocol(providers)
    // generate labels using the available information
    await ensureLabels(providers)
    // Assign unique identifiers to each provider, sorting them by label for
    // consistent numbering. While this only matters during the runtime of the
    // service, it is important that multiple service instances use the same
    // identifiers for the same set of providers.
    //
    // Any provider whose id is equal to their protocol (`oidc` or `saml`)
    // represents an auto-converted instance based on the classic settings. For
    // backward compatibility and predictable login URLs, these are not given
    // new identifiers as that would result in a "multi" login scenario when it
    // would not be appropriate.
    ensureIdentifiers(providers)
    // make sure boolean properties are either true or false
    ensureBooleaness(providers)
    // retain only the valid providers, especially useful to remove the
    // incomplete providers generated by the default settings
    return providers.filter((e) => validateAuthProvider(e) === null)
  }
}

function ensureProtocol(providers) {
  providers.forEach((e) => {
    if (!('protocol' in e)) {
      // OIDC must always have an issuerUri whereas SAML does not
      if (e.issuerUri) {
        e.protocol = 'oidc'
      } else {
        e.protocol = 'saml'
      }
    }
  })
}

async function ensureLabels(providers) {
  for (const provider of providers) {
    if (provider.protocol === 'oidc') {
      ensureLabel(provider, 'issuerUri')
    } else if (provider.protocol === 'saml') {
      ensureLabel(provider, 'metadataUrl')
      ensureLabel(provider, 'idpEntityId')
      ensureLabel(provider, 'signonUrl')
      if (!provider.label && 'metadataFile' in provider) {
        const filename = provider['metadataFile']
        const contents = await fs.readFile(filename, 'utf8')
        provider['metadata'] = contents.trim()
        delete provider['metadataFile']
      }
      if (!provider.label && 'metadata' in provider) {
        const reader = new MetadataReader(provider['metadata'])
        if (reader.entityId) {
          provider['label'] = reader.entityId
        }
      }
    }
  }
}

function ensureLabel(provider, uriName) {
  if (!provider.label && uriName in provider) {
    const maybeUri = provider[uriName]
    try {
      const u = new url.URL(maybeUri)
      provider['label'] = u.hostname
    } catch (err) {
      // maybe not a URL but an entity ID
      provider['label'] = maybeUri
    }
  }
}

// side-effect: sorts providers by label
function ensureIdentifiers(providers) {
  providers.sort((a, b) => {
    if (a.label && b.label) {
      return a.label.localeCompare(b.label)
    }
    return 0
  })
  providers.forEach((e, idx) => {
    if (e.id && e.label === undefined) {
      delete e.id
    } else if (e.label && e.id === undefined) {
      // need predictably consistent identifiers across instances
      e.id = `${e.protocol}-${idx}`
    }
  })
}

function ensureBooleaness(providers) {
  providers.forEach((p) => {
    p.forceAuthn = assessTruth(p.forceAuthn)
    if (p.protocol === 'oidc') {
      p.selectAccount = assessTruth(p.selectAccount)
    } else if (p.protocol === 'saml') {
      p.wantAssertionSigned = assessTruth(p.wantAssertionSigned)
      p.wantResponseSigned = assessTruth(p.wantResponseSigned)
    }
  })
}

// Check if setting is defined and equals 'false', otherwise return true.
function assessTruth(value) {
  if (typeof value === 'boolean') {
    return value
  }
  if (value === undefined || value === null || value.toString().toLowerCase() === 'false') {
    return false
  }
  return true
}