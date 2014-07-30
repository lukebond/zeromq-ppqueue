var PPQueue = require('../index');
var ppq = new PPQueue({backendUrl: 'tcp://127.0.0.1:9001', frontendUrl: 'tcp://127.0.0.1:9000'})
  .on('frontend', function (message) {
    console.log(Date.now() + ' - Proxying worker message through to frontend:', message.toString('utf8'));
  })
  .on('backend', function (message) {
    console.log(Date.now() + ' - Proxying client message through to backend:', message.toString('utf8'));
  });
