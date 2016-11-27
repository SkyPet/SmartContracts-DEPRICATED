module.exports = {
  build: {
    "index.html": "index.html",
    "app.js": [
      "javascripts/app.js"
    ],
    "app.css": [
      "stylesheets/app.css"
    ],
    "images/": "images/"
  },
  rpc: {
    host: "localhost",
    port: 8545
  },
  networks: {
    "main": {
      network_id: 1,
      gas: 4712388
    },
    "testnet": {
      network_id: 3,
      gas: 4712388
    }
  }
};
