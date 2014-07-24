var async = require('async'),
    assert = require('assert'),
    zmq = require('zmq'),
    util = require('util');

var PPQueue = function (options) {
  this.heartbeatLiveness = options.heartbeatLiveness || 5;
  this.heartbeatInterval = options.heartbeatInterval || 1000;

  this.PPP_DELIMITER = new Buffer([]);
  this.PPP_READY = new Buffer([1]);
  this.PPP_HEARTBEAT = new Buffer([2]);

  this.frontend = zmq.socket('router');   // for clients
  this.backend = zmq.socket('router');    // for workers

  this.frontend.bind(options.frontendUrl);
  this.backend.bind(options.backendUrl);

  this.workers = [];

  setInterval(this._doHeartbeat.bind(this), this.heartbeatInterval);

  this.backend
    .on('message', function () {
      var args = Array.apply(null, arguments);
      // mark worker 'identity' as ready/alive/healthy
      this._workerReady(args[0]);
      if (args[1].toString('utf8') === this.PPP_HEARTBEAT.toString('utf8') || args[1].toString('utf8') === this.PPP_READY.toString('utf8')) {
        // we've already marked this worker as ready, above; nothing more to do
      }
      else {
        this.frontend.send([args[1], this.PPP_DELIMITER, args[2]]);
      }
    }.bind(this));

  this.frontend.on('message', function () {
    var args = Array.apply(null, arguments);
    // send frontend message to next available worker
    var nextWorker = this._workerNext();
    assert(nextWorker, 'No workers are ready');
    this.backend.send([nextWorker.identity, args[1], args[0]]);
  }.bind(this));
};

PPQueue.prototype._workerReady = function (identity) {
  var found = false;
  for (var i = 0; i < this.workers.length; ++i) {
    if (this.workers[i].identity.toString('utf8') === identity.toString('utf8')) {
      // reset the timer
      clearTimeout(this.workers[i].timerId);
      this.workers[i].timerId = setTimeout(this._getPurgeWorkerTimeoutFn(identity), this.heartbeatInterval * this.heartbeatLiveness);
      found = true;
      break;
    }
  }
  if (!found) {
    this.workers.push(
      { identity: identity,
        timerId: setTimeout(this._getPurgeWorkerTimeoutFn(identity), this.heartbeatInterval * this.heartbeatLiveness)});
  }
};

PPQueue.prototype._getPurgeWorkerTimeoutFn = function (identity) {
  return function () {
    for (var i = 0; i < this.workers.length; ++i) {
      var worker = this.workers[i];
      if (worker.identity.toString('utf8') === identity.toString('utf8')) {
        this.workers.splice(i, 1);
      }
    }
  }.bind(this);
};

PPQueue.prototype._workerNext = function () {
  var worker = this.workers.shift();
  if (worker) {
    clearTimeout(worker.timerId);
  }
  return worker;
};

PPQueue.prototype._doHeartbeat = function () {
  async.each(this.workers, function (worker, cb) {
    this.backend.send([worker.identity, this.PPP_DELIMITER, this.PPP_HEARTBEAT]);
  }.bind(this));
};

module.exports = PPQueue;
