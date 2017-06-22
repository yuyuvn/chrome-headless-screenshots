const CDP = require('chrome-remote-interface');
const argv = require('minimist')(process.argv.slice(2));
const file = require('mz/fs');
const timeout = require('delay');

// CLI Args
const url = argv.url || 'https://www.google.com';
const format = argv.format === 'jpeg' ? 'jpeg' : 'png';
const viewportWidth = argv.viewportWidth || 1440;
const viewportHeight = argv.viewportHeight || 900;
const delay = argv.delay || 0;
const userAgent = argv.userAgent;
const fullPage = argv.full;
const output = argv.output || `output.${format === 'png' ? 'png' : 'jpg'}`;

init();

function init() {
  var client, DOM, Emulation, Network, Page, Runtime;
  CDP((c) => {
    client = c;
    DOM = client.DOM;
    Emulation = client.Emulation;
    Network = client.Network;
    Page = client.Page;
    Runtime = client.Runtime;

    Promise.all([
        Network.enable(),
        Page.enable(),
        DOM.enable
    ]).then(() => {
      const deviceMetrics = {
        width: viewportWidth,
        height: viewportHeight,
        deviceScaleFactor: 0,
        mobile: false,
        fitWindow: false,
      };
      return Emulation.setDeviceMetricsOverride(deviceMetrics);
    }).then(() => Emulation.setVisibleSize({
        width: viewportWidth,
        height: viewportHeight,
      }))
    .then(() => Page.navigate({url}))
    .then(() => Page.loadEventFired())
    .then(() => timeout(delay))
    .then(() => {
      if (fullPage) {
        return DOM.getDocument().then((document) => {
          const documentNodeId = document.root.nodeId;
          return DOM.querySelector({
            selector: 'body',
            nodeId: documentNodeId,
          })
        }).then((querySelector) => {
          const bodyNodeId =  querySelector.nodeId;
          return DOM.getBoxModel({nodeId: bodyNodeId});
        }).then((boxModel) => {
          const height = boxModel.model.height;
          return Emulation.setVisibleSize({width: viewportWidth, height: height});
        }).then(() => Emulation.forceViewport({x: 0, y: 0, scale: 1}))
      } else {
        return Promise.resolve();
      }
    }).then(() => Page.captureScreenshot({format, fromSurface: true}))
    .then((screenshot) => {
      const buffer = new Buffer(screenshot.data, 'base64');
      return file.writeFile(output, buffer, 'base64');
    }).then(() => {
      console.log('Screenshot saved');
      client.close();
      process.exit(1);
    }).catch(() => {
      console.error('Exception while taking screenshot:', err);
      process.exit();
    })
  }).on('error', (err) => {
    console.error(err);
    process.exit(1);
  });
}
process.stdin.resume();
