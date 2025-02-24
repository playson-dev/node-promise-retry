'use strict';

var expect = require('expect.js');
var retry = require('../');
var promiseDelay = require('sleep-promise');

describe('promise-retry', function () {
    it('should call fn again if retry was called', function () {
        var count = 0;

        return retry.promiseRetry(function (retry) {
            count += 1;

            return promiseDelay(10)
            .then(function () {
                if (count <= 2) {
                    retry(new Error('foo'));
                }

                return 'final';
            });
        }, { factor: 1 })
        .then(function (value) {
            expect(value).to.be('final');
            expect(count).to.be(3);
        }, function () {
            throw new Error('should not fail');
        });
    });

    it('should call fn with the attempt number', function () {
        var count = 0;

        return retry.promiseRetry(function (retry, number) {
            count += 1;
            expect(count).to.equal(number);

            return promiseDelay(10)
            .then(function () {
                if (count <= 2) {
                    retry(new Error('foo'));
                }

                return 'final';
            });
        }, { factor: 1 })
        .then(function (value) {
            expect(value).to.be('final');
            expect(count).to.be(3);
        }, function () {
            throw new Error('should not fail');
        });
    });

    it('should not retry on fulfillment if retry was not called', function () {
        var count = 0;

        return retry.promiseRetry(function () {
            count += 1;

            return promiseDelay(10)
            .then(function () {
                return 'final';
            });
        })
        .then(function (value) {
            expect(value).to.be('final');
            expect(count).to.be(1);
        }, function () {
            throw new Error('should not fail');
        });
    });

    it('should not retry on rejection if retry was not called', function () {
        var count = 0;

        return retry.promiseRetry(function () {
            count += 1;

            return promiseDelay(10)
            .then(function () {
                throw new Error('foo');
            });
        })
        .then(function () {
            throw new Error('should not succeed');
        }, function (err) {
            expect(err.message).to.be('foo');
            expect(count).to.be(1);
        });
    });

    it('should not retry on rejection if nr of retries is 0', function () {
        var count = 0;

        return retry.promiseRetry(function (retry) {
            count += 1;

            return promiseDelay(10)
            .then(function () {
                throw new Error('foo');
            })
            .catch(retry);
        }, { retries : 0 })
        .then(function () {
            throw new Error('should not succeed');
        }, function (err) {
            expect(err.message).to.be('foo');
            expect(count).to.be(1);
        });
    });

    it('should reject the promise if the retries were exceeded', function () {
        var count = 0;

        return retry.promiseRetry(function (retry) {
            count += 1;

            return promiseDelay(10)
            .then(function () {
                throw new Error('foo');
            })
            .catch(retry);
        }, { retries: 2, factor: 1 })
        .then(function () {
            throw new Error('should not succeed');
        }, function (err) {
            expect(err.message).to.be('foo');
            expect(count).to.be(3);
        });
    });

    it('should pass options to the underlying retry module', function () {
        var count = 0;

        return retry.promiseRetry(function (retry) {
            return promiseDelay(10)
            .then(function () {
                if (count < 2) {
                    count += 1;
                    retry(new Error('foo'));
                }

                return 'final';
            });
        }, { retries: 1, factor: 1 })
        .then(function () {
            throw new Error('should not succeed');
        }, function (err) {
            expect(err.message).to.be('foo');
        });
    });

    it('should convert direct fulfillments into promises', function () {
        return retry.promiseRetry(function () {
            return 'final';
        }, { factor: 1 })
        .then(function (value) {
            expect(value).to.be('final');
        }, function () {
            throw new Error('should not fail');
        });
    });

    it('should convert direct rejections into promises', function () {
      retry.promiseRetry(function () {
            throw new Error('foo');
        }, { retries: 1, factor: 1 })
        .then(function () {
            throw new Error('should not succeed');
        }, function (err) {
            expect(err.message).to.be('foo');
        });
    });

    it('should not crash on undefined rejections', function () {
        return retry.promiseRetry(function () {
            throw undefined;
        }, { retries: 1, factor: 1 })
        .then(function () {
            throw new Error('should not succeed');
        }, function (err) {
            expect(err).to.be(undefined);
        })
        .then(function () {
            return retry.promiseRetry(function (retry) {
                retry();
            }, { retries: 1, factor: 1 });
        })
        .then(function () {
            throw new Error('should not succeed');
        }, function (err) {
            expect(err).to.be(undefined);
        });
    });

    it('should retry if retry() was called with undefined', function () {
        var count = 0;

        return retry.promiseRetry(function (retry) {
            count += 1;

            return promiseDelay(10)
            .then(function () {
                if (count <= 2) {
                    retry();
                }

                return 'final';
            });
        }, { factor: 1 })
        .then(function (value) {
            expect(value).to.be('final');
            expect(count).to.be(3);
        }, function () {
            throw new Error('should not fail');
        });
    });

    it('should work with several retries in the same chain', function () {
        var count = 0;

        return retry.promiseRetry(function (retry) {
            count += 1;

            return promiseDelay(10)
            .then(function () {
                retry(new Error('foo'));
            })
            .catch(function (err) {
                retry(err);
            });
        }, { retries: 1, factor: 1 })
        .then(function () {
            throw new Error('should not succeed');
        }, function (err) {
            expect(err.message).to.be('foo');
            expect(count).to.be(2);
        });
    });

    it('should allow options to be passed first', function () {
        var count = 0;

        return retry.promiseRetry({ factor: 1 }, function (retry) {
            count += 1;

            return promiseDelay(10)
                .then(function () {
                    if (count <= 2) {
                        retry(new Error('foo'));
                    }

                    return 'final';
                });
        }).then(function (value) {
            expect(value).to.be('final');
            expect(count).to.be(3);
        }, function () {
            throw new Error('should not fail');
        });
    });
});


describe('Retry decorator', function () {
  it('should retry the decorated method until success', function (done) {
    function TestClass() {
      this.count = 0;
    }
    TestClass.prototype.doSomething = function () {
      this.count++;
      var self = this;
      return promiseDelay(10).then(function () {
        if (self.count < 3) {
          throw new Error('fail');
        }
        return 'final';
      });
    };

    var descriptor = Object.getOwnPropertyDescriptor(TestClass.prototype, 'doSomething');
    descriptor = retry.Retry({ retries: 3, minTimeout: 10, maxTimeout: 50, errors: [Error] })(TestClass.prototype, 'doSomething', descriptor) || descriptor;
    Object.defineProperty(TestClass.prototype, 'doSomething', descriptor);

    var instance = new TestClass();
    instance.doSomething().then(function (result) {
      expect(result).to.be('final');
      expect(instance.count).to.be(3);
      done();
    }).catch(function (err) {
      done(err);
    });
  });

  it('should not retry if method succeeds on the first call', function (done) {
    function TestClass() {
      this.count = 0;
    }
    TestClass.prototype.doSomething = function () {
      this.count++;
      return promiseDelay(10).then(function () {
        return 'success';
      });
    };

    var descriptor = Object.getOwnPropertyDescriptor(TestClass.prototype, 'doSomething');
    descriptor = retry.Retry({ retries: 3, minTimeout: 10, maxTimeout: 50, errors: [Error] })(TestClass.prototype, 'doSomething', descriptor) || descriptor;
    Object.defineProperty(TestClass.prototype, 'doSomething', descriptor);

    var instance = new TestClass();
    instance.doSomething().then(function (result) {
      expect(result).to.be('success');
      expect(instance.count).to.be(1);
      done();
    }).catch(function (err) {
      done(err);
    });
  });

  it('should not retry if the error is not in the allowed list', function (done) {
    function TestClass() {
      this.count = 0;
    }
    function CustomError(message) {
      this.message = message;
      this.name = 'CustomError';
    }
    CustomError.prototype = Object.create(Error.prototype);
    CustomError.prototype.constructor = CustomError;

    TestClass.prototype.doSomething = function () {
      this.count++;
      return promiseDelay(10).then(function () {
        throw new Error('fail');
      });
    };

    var descriptor = Object.getOwnPropertyDescriptor(TestClass.prototype, 'doSomething');
    descriptor = retry.Retry({ retries: 3, minTimeout: 10, maxTimeout: 50, errors: [CustomError] })(TestClass.prototype, 'doSomething', descriptor) || descriptor;
    Object.defineProperty(TestClass.prototype, 'doSomething', descriptor);

    var instance = new TestClass();
    instance.doSomething().then(function () {
      done(new Error('should not succeed'));
    }).catch(function (err) {
      expect(err.message).to.be('fail');
      expect(instance.count).to.be(1);
      done();
    });
  });

  it('should log warnings if a logger exists on the instance', function (done) {
    var warnCount = 0;
    function TestClass() {
      this.count = 0;
      this.logger = {
        warn: function () {
          warnCount++;
        }
      };
    }
    TestClass.prototype.doSomething = function () {
      this.count++;
      var self = this;
      return promiseDelay(10).then(function () {
        if (self.count < 3) {
          throw new Error('fail');
        }
        return 'done';
      });
    };

    var descriptor = Object.getOwnPropertyDescriptor(TestClass.prototype, 'doSomething');
    descriptor = retry.Retry({ retries: 3, minTimeout: 10, maxTimeout: 50, errors: [Error] })(TestClass.prototype, 'doSomething', descriptor) || descriptor;
    Object.defineProperty(TestClass.prototype, 'doSomething', descriptor);

    var instance = new TestClass();
    instance.doSomething().then(function (result) {
      expect(result).to.be('done');
      expect(instance.count).to.be(3);
      expect(warnCount).to.be(2);
      done();
    }).catch(function (err) {
      done(err);
    });
  });

  it('should pass arguments to the original method', function (done) {
    function TestClass() {}
    TestClass.prototype.add = function (a, b) {
      return a + b;
    };

    var descriptor = Object.getOwnPropertyDescriptor(TestClass.prototype, 'add');
    descriptor = retry.Retry({ retries: 3, minTimeout: 10, maxTimeout: 50, errors: [Error] })(TestClass.prototype, 'add', descriptor) || descriptor;
    Object.defineProperty(TestClass.prototype, 'add', descriptor);

    var instance = new TestClass();
    try {
      var result = instance.add(2, 3);
      Promise.resolve(result).then(function (value) {
        expect(value).to.be(5);
        done();
      }).catch(function (err) {
        done(err);
      });
    } catch (err) {
      done(err);
    }
  });
});

// patch
