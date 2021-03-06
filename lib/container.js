//
// Copyright 2020 Perforce Software
//
const awilix = require('awilix')

//
// Use dependency injection (inversion of control) to register many of the
// things that our application will need. Especially helpful for separating
// concerns to make unit testing feasible.
//
// awilix is particularly nice in that it always passes the registered values as
// an object to the registered constructors/functions. The functions then use
// destructuring to extract the desired values. For instance, the FindRequest
// use case expects a valued named 'requestRepository', which is registered in
// the cradle with exactly that name.
//

const ReceiveUserProfile = require('@login/domain/usecases/ReceiveUserProfile')
const FindRequest = require('@login/domain/usecases/FindRequest')
const FindUserProfile = require('@login/domain/usecases/FindUserProfile')
const GetUserById = require('@login/domain/usecases/GetUserById')
const StartRequest = require('@login/domain/usecases/StartRequest')
const logger = require('@lib/logging')

let RequestRepository = null
let UserRepository = null
if (process.env.REDIS_URL) {
  logger.debug('container: registering redis repositories')
  RequestRepository = require('@login/data/repositories/RedisRequestRepository')
  UserRepository = require('@login/data/repositories/RedisUserRepository')
} else {
  logger.debug('container: registering in-memory repositories')
  RequestRepository = require('@login/data/repositories/InMemoryRequestRepository')
  UserRepository = require('@login/data/repositories/InMemoryUserRepository')
}

// create the injection container
const container = awilix.createContainer({
  injectionMode: awilix.InjectionMode.PROXY
})

container.register({
  // register the data repositories as classes
  requestRepository: awilix.asClass(RequestRepository),
  userRepository: awilix.asClass(UserRepository),

  // register the use cases as functions
  findRequest: awilix.asFunction(FindRequest),
  findUserProfile: awilix.asFunction(FindUserProfile),
  getUserById: awilix.asFunction(GetUserById),
  receiveUserProfile: awilix.asFunction(ReceiveUserProfile),
  startRequest: awilix.asFunction(StartRequest),

  // register singletons as values
  logger: awilix.asValue(logger),

  // register default values used in multiple modules
  serviceCert: awilix.asValue(process.env.SP_CERT_FILE || 'certs/server.crt'),
  serviceKey: awilix.asValue(process.env.SP_KEY_FILE || 'certs/server.key')
})

module.exports = container
