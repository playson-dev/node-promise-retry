'use strict';

var errcode = require('err-code');
var retry = require('retry');

var hasOwn = Object.prototype.hasOwnProperty;

function isRetryError(err) {
  return err && err.code === 'EPROMISERETRY' && hasOwn.call(err, 'retried');
}

function promiseRetry(fn, options) {
  var temp;
  var operation;

  if (typeof fn === 'object' && typeof options === 'function') {
    // Swap options and fn when using alternate signature (options, fn)
    temp = options;
    options = fn;
    fn = temp;
  }

  operation = retry.operation(options);

  return new Promise(function(resolve, reject) {
    return operation.attempt(function(number) {
      return Promise.resolve()
        .then(function() {
          return fn(function(err) {
            if (isRetryError(err)) {
              err = err.retried;
            }

            throw errcode(new Error('Retrying'), 'EPROMISERETRY', { retried: err });
          }, number);
        })
        .then(resolve, function(err) {
          if (isRetryError(err)) {
            err = err.retried;

            if (operation.retry(err || new Error())) {
              return;
            }
          }

          reject(err);
        });
    });
  });
}

/**
 * A method decorator that automatically retries a method call using promiseRetry.
 *
 * @param {Object} options - The configuration options for retrying the method.
 * @param {number} options.retries - Number of retry attempts.
 * @param {number} [options.minTimeout=100] - Minimum wait time (ms) between retries.
 * @param {number} [options.maxTimeout=500] - Maximum wait time (ms) between retries.
 * @param {Function[]} [options.errors=[Error]] - Array of Error constructors; method is retried if error is instance of one.
 * @returns {Function} A decorator function.
 */
function Retry(options) {
  return function (target, propertyKey, descriptor) {
    var originalMethod = descriptor.value;
    var retries = options.retries;
    var minTimeout = options.minTimeout === undefined ? 100 : options.minTimeout;
    var maxTimeout = options.maxTimeout === undefined ? 500 : options.maxTimeout;
    var errors = options.errors || [Error];
    var retryOptions = { retries: retries, minTimeout: minTimeout, maxTimeout: maxTimeout };

    descriptor.value = function () {
      var args = arguments;
      var self = this;
      return promiseRetry(function (retry, attempt) {
        return Promise.resolve(originalMethod.apply(self, args))
          .catch(function (error) {
            var shouldRetry = errors.some(function (err) {
              return error instanceof err;
            });
            if (shouldRetry) {
              if (self.logger && typeof self.logger.warn === 'function') {
                self.logger.warn({ error: error, attempt: attempt }, 'Retrying method ' + propertyKey);
              }
              retry(error);
              throw error;
            } else {
              throw error;
            }
          });
      }, retryOptions);
    };
    return descriptor;
  };
}

// Exports
module.exports = { promiseRetry: promiseRetry, Retry: Retry };
