//
// Copyright 2022 Perforce Software
//
import { assert } from 'chai'
import { describe, it } from 'mocha'
import { MapSettingsRepository } from 'helix-auth-svc/lib/common/data/repositories/MapSettingsRepository.js'

describe('MapSettingsRepository', function () {
  it('should return string or undefined from get()', function () {
    const settings = new Map()
    settings.set('SETTING_VALUE', 'a_value')
    const sut = new MapSettingsRepository(settings)
    assert.equal(sut.get('SETTING_VALUE'), 'a_value')
    assert.isUndefined(sut.get('SETTING_UNDEFINED'))
  })

  it('should return true or false from getBool()', function () {
    const settings = new Map()
    settings.set('SETTING_TRUE', 'true')
    settings.set('SETTING_NONE', 'none')
    settings.set('SETTING_FALSE', 'false')
    const sut = new MapSettingsRepository(settings)
    assert.isTrue(sut.getBool('SETTING_TRUE'))
    assert.isFalse(sut.getBool('SETTING_NONE'))
    assert.isFalse(sut.getBool('SETTING_FALSE'))
    assert.isFalse(sut.getBool('SETTING_UNDEFINED'))
  })
})
