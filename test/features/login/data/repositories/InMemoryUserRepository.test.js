//
// Copyright 2020-2021 Perforce Software
//
import { AssertionError } from 'node:assert'
import { assert } from 'chai'
import { before, describe, it } from 'mocha'
import { User } from 'helix-auth-svc/lib/features/login/domain/entities/User.js'
import { InMemoryUserRepository } from 'helix-auth-svc/lib/features/login/data/repositories/InMemoryUserRepository.js'

describe('InMemoryUser repository', function () {
  let repository

  before(function () {
    repository = new InMemoryUserRepository()
  })

  it('should raise an error for invalid input', function () {
    assert.throws(() => repository.add(null), AssertionError)
    assert.throws(() => repository.add('foobar', null), AssertionError)
    assert.throws(() => repository.take(null), AssertionError)
  })

  it('should return null for missing user entity', async function () {
    // act
    const user = await repository.take('foobar')
    // assert
    assert.isNull(user)
  })

  it('should find an existing user entity once', async function () {
    // arrange
    const userId = 'joeuser'
    const tUser = new User(userId, { name: 'joe', email: 'joe@example.com' })
    repository.add(userId, tUser)
    // act
    const user = await repository.take(userId)
    // assert
    assert.equal(user.id, userId)
    assert.property(user, 'profile')
    assert.property(user.profile, 'email')
    // cannot retrieve the same entity a second time
    assert.isNull(await repository.take(userId))
  })
})
