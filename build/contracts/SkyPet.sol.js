var Web3 = require("web3");
var SolidityEvent = require("web3/lib/web3/event.js");

(function() {
  // Planned for future features, logging, etc.
  function Provider(provider) {
    this.provider = provider;
  }

  Provider.prototype.send = function() {
    this.provider.send.apply(this.provider, arguments);
  };

  Provider.prototype.sendAsync = function() {
    this.provider.sendAsync.apply(this.provider, arguments);
  };

  var BigNumber = (new Web3()).toBigNumber(0).constructor;

  var Utils = {
    is_object: function(val) {
      return typeof val == "object" && !Array.isArray(val);
    },
    is_big_number: function(val) {
      if (typeof val != "object") return false;

      // Instanceof won't work because we have multiple versions of Web3.
      try {
        new BigNumber(val);
        return true;
      } catch (e) {
        return false;
      }
    },
    merge: function() {
      var merged = {};
      var args = Array.prototype.slice.call(arguments);

      for (var i = 0; i < args.length; i++) {
        var object = args[i];
        var keys = Object.keys(object);
        for (var j = 0; j < keys.length; j++) {
          var key = keys[j];
          var value = object[key];
          merged[key] = value;
        }
      }

      return merged;
    },
    promisifyFunction: function(fn, C) {
      var self = this;
      return function() {
        var instance = this;

        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {
          var callback = function(error, result) {
            if (error != null) {
              reject(error);
            } else {
              accept(result);
            }
          };
          args.push(tx_params, callback);
          fn.apply(instance.contract, args);
        });
      };
    },
    synchronizeFunction: function(fn, instance, C) {
      var self = this;
      return function() {
        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {

          var decodeLogs = function(logs) {
            return logs.map(function(log) {
              var logABI = C.events[log.topics[0]];

              if (logABI == null) {
                return null;
              }

              var decoder = new SolidityEvent(null, logABI, instance.address);
              return decoder.decode(log);
            }).filter(function(log) {
              return log != null;
            });
          };

          var callback = function(error, tx) {
            if (error != null) {
              reject(error);
              return;
            }

            var timeout = C.synchronization_timeout || 240000;
            var start = new Date().getTime();

            var make_attempt = function() {
              C.web3.eth.getTransactionReceipt(tx, function(err, receipt) {
                if (err) return reject(err);

                if (receipt != null) {
                  // If they've opted into next gen, return more information.
                  if (C.next_gen == true) {
                    return accept({
                      tx: tx,
                      receipt: receipt,
                      logs: decodeLogs(receipt.logs)
                    });
                  } else {
                    return accept(tx);
                  }
                }

                if (timeout > 0 && new Date().getTime() - start > timeout) {
                  return reject(new Error("Transaction " + tx + " wasn't processed in " + (timeout / 1000) + " seconds!"));
                }

                setTimeout(make_attempt, 1000);
              });
            };

            make_attempt();
          };

          args.push(tx_params, callback);
          fn.apply(self, args);
        });
      };
    }
  };

  function instantiate(instance, contract) {
    instance.contract = contract;
    var constructor = instance.constructor;

    // Provision our functions.
    for (var i = 0; i < instance.abi.length; i++) {
      var item = instance.abi[i];
      if (item.type == "function") {
        if (item.constant == true) {
          instance[item.name] = Utils.promisifyFunction(contract[item.name], constructor);
        } else {
          instance[item.name] = Utils.synchronizeFunction(contract[item.name], instance, constructor);
        }

        instance[item.name].call = Utils.promisifyFunction(contract[item.name].call, constructor);
        instance[item.name].sendTransaction = Utils.promisifyFunction(contract[item.name].sendTransaction, constructor);
        instance[item.name].request = contract[item.name].request;
        instance[item.name].estimateGas = Utils.promisifyFunction(contract[item.name].estimateGas, constructor);
      }

      if (item.type == "event") {
        instance[item.name] = contract[item.name];
      }
    }

    instance.allEvents = contract.allEvents;
    instance.address = contract.address;
    instance.transactionHash = contract.transactionHash;
  };

  // Use inheritance to create a clone of this contract,
  // and copy over contract's static functions.
  function mutate(fn) {
    var temp = function Clone() { return fn.apply(this, arguments); };

    Object.keys(fn).forEach(function(key) {
      temp[key] = fn[key];
    });

    temp.prototype = Object.create(fn.prototype);
    bootstrap(temp);
    return temp;
  };

  function bootstrap(fn) {
    fn.web3 = new Web3();
    fn.class_defaults  = fn.prototype.defaults || {};

    // Set the network iniitally to make default data available and re-use code.
    // Then remove the saved network id so the network will be auto-detected on first use.
    fn.setNetwork("default");
    fn.network_id = null;
    return fn;
  };

  // Accepts a contract object created with web3.eth.contract.
  // Optionally, if called without `new`, accepts a network_id and will
  // create a new version of the contract abstraction with that network_id set.
  function Contract() {
    if (this instanceof Contract) {
      instantiate(this, arguments[0]);
    } else {
      var C = mutate(Contract);
      var network_id = arguments.length > 0 ? arguments[0] : "default";
      C.setNetwork(network_id);
      return C;
    }
  };

  Contract.currentProvider = null;

  Contract.setProvider = function(provider) {
    var wrapped = new Provider(provider);
    this.web3.setProvider(wrapped);
    this.currentProvider = provider;
  };

  Contract.new = function() {
    if (this.currentProvider == null) {
      throw new Error("SkyPet error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("SkyPet error: contract binary not set. Can't deploy new instance.");
    }

    var regex = /__[^_]+_+/g;
    var unlinked_libraries = this.binary.match(regex);

    if (unlinked_libraries != null) {
      unlinked_libraries = unlinked_libraries.map(function(name) {
        // Remove underscores
        return name.replace(/_/g, "");
      }).sort().filter(function(name, index, arr) {
        // Remove duplicates
        if (index + 1 >= arr.length) {
          return true;
        }

        return name != arr[index + 1];
      }).join(", ");

      throw new Error("SkyPet contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of SkyPet: " + unlinked_libraries);
    }

    var self = this;

    return new Promise(function(accept, reject) {
      var contract_class = self.web3.eth.contract(self.abi);
      var tx_params = {};
      var last_arg = args[args.length - 1];

      // It's only tx_params if it's an object and not a BigNumber.
      if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
        tx_params = args.pop();
      }

      tx_params = Utils.merge(self.class_defaults, tx_params);

      if (tx_params.data == null) {
        tx_params.data = self.binary;
      }

      // web3 0.9.0 and above calls new twice this callback twice.
      // Why, I have no idea...
      var intermediary = function(err, web3_instance) {
        if (err != null) {
          reject(err);
          return;
        }

        if (err == null && web3_instance != null && web3_instance.address != null) {
          accept(new self(web3_instance));
        }
      };

      args.push(tx_params, intermediary);
      contract_class.new.apply(contract_class, args);
    });
  };

  Contract.at = function(address) {
    if (address == null || typeof address != "string" || address.length != 42) {
      throw new Error("Invalid address passed to SkyPet.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: SkyPet not deployed or address not set.");
    }

    return this.at(this.address);
  };

  Contract.defaults = function(class_defaults) {
    if (this.class_defaults == null) {
      this.class_defaults = {};
    }

    if (class_defaults == null) {
      class_defaults = {};
    }

    var self = this;
    Object.keys(class_defaults).forEach(function(key) {
      var value = class_defaults[key];
      self.class_defaults[key] = value;
    });

    return this.class_defaults;
  };

  Contract.extend = function() {
    var args = Array.prototype.slice.call(arguments);

    for (var i = 0; i < arguments.length; i++) {
      var object = arguments[i];
      var keys = Object.keys(object);
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        var value = object[key];
        this.prototype[key] = value;
      }
    }
  };

  Contract.all_networks = {
  "3": {
    "abi": [
      {
        "constant": false,
        "inputs": [],
        "name": "kill",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "getRevenue",
        "outputs": [],
        "payable": true,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "_petid",
            "type": "bytes32"
          },
          {
            "name": "index",
            "type": "uint256"
          }
        ],
        "name": "getAttribute",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          },
          {
            "name": "",
            "type": "string"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "owner",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "costToAdd",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "_petid",
            "type": "bytes32"
          }
        ],
        "name": "getNumberOfAttributes",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_petid",
            "type": "bytes32"
          },
          {
            "name": "_attribute",
            "type": "string"
          }
        ],
        "name": "addAttribute",
        "outputs": [],
        "payable": true,
        "type": "function"
      },
      {
        "inputs": [],
        "type": "constructor"
      },
      {
        "payable": false,
        "type": "fallback"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "_petid",
            "type": "bytes32"
          },
          {
            "indexed": false,
            "name": "_attribute",
            "type": "string"
          }
        ],
        "name": "attributeAdded",
        "type": "event"
      }
    ],
    "unlinked_binary": "0x6060604052600080546c0100000000000000000000000033810204600160a060020a03199091161790556105a9806100376000396000f3606060405236156100615760e060020a600035046341c0e1b5811461006e57806348d7d9eb1461009b5780636d665f20146100f15780638da5cb5b146101d1578063bd7c47ef146101e8578063cad36553146101fc578063fe9be4cc14610226575b34610002576102b7610002565b34610002576102b760005433600160a060020a03908116911614156102b957600054600160a060020a0316ff5b6102b760005433600160a060020a03908116911614156102b957600080546040516102b992600160a060020a039283169230163180156108fc02929091818181858888f19350505050155b80156105a657610002565b34610002576102bb6004356024356040805160208181018352600080835285815260019091529182208054849081101561000257906000526020600020906002020160005054600085815260016020526040902080548590811015610002579060005260206000209060020201600050600101600050808054600181600116156101000203166002900480601f0160208091040260200160405190810160405280929190818152602001828054600181600116156101000203166002900480156103775780601f1061034c57610100808354040283529160200191610377565b3461000257610330600054600160a060020a031681565b346100025761021467016345785d8a000081565b34610002576004356000908152600160205260409020545b60408051918252519081900360200190f35b60408051602060046024803582810135601f81018590048502860185019096528585526102b7958335959394604494939290920191819084018382808284375094965050505050505067016345785d8a0000341061042a5760405161042e90600160a060020a0333169067016345785d89ffff19340180156108fc02916000818181858888f19350505050156100e6565b005b565b60405180838152602001806020018281038252838181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f1680156103215780820380516001836020036101000a031916815260200191505b50935050505060405180910390f35b60408051600160a060020a039092168252519081900360200190f35b820191906000526020600020905b81548152906001019060200180831161035a57829003601f168201915b50505050509050915091509250929050565b50505050507f093f4825a54e577374952fbae2d31cb2c3ae3dbd0cb43a924715746efc9bd1a782826040518083600019168152602001806020018281038252838181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f16801561041b5780820380516001836020036101000a031916815260200191505b50935050505060405180910390a15b5050565b600082815260016020819052604090912080549182018082559091908281838015829011610475576002028160020283600052602060002091820191016104759190610503565b5050506000928352602080842060408051808201909152428082528184018890526002958602909201918255865160018084018054818a5298869020969893979496909591841615610100026000190190931693909304601f90810184900483019391929189019083901061057657805160ff19168380011785555b5061038992915061055e565b50506002015b80821115610572576000600082016000506000905560018201600050805460018160011615610100020316600290046000825580601f1061054457506104fd565b601f0160209004906000526020600020908101906104fd91905b80821115610572576000815560010161055e565b5090565b828001600101855582156104f1579182015b828111156104f1578251826000505591602001919060010190610588565b5056",
    "events": {
      "0x093f4825a54e577374952fbae2d31cb2c3ae3dbd0cb43a924715746efc9bd1a7": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "_petid",
            "type": "bytes32"
          },
          {
            "indexed": false,
            "name": "_attribute",
            "type": "string"
          }
        ],
        "name": "attributeAdded",
        "type": "event"
      }
    },
    "updated_at": 1480261365606,
    "links": {},
    "address": "0x72c1bba9cabab4040c285159c8ea98fd36372858"
  },
  "default": {
    "abi": [
      {
        "constant": false,
        "inputs": [],
        "name": "kill",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "getRevenue",
        "outputs": [],
        "payable": true,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "_petid",
            "type": "bytes32"
          },
          {
            "name": "index",
            "type": "uint256"
          }
        ],
        "name": "getAttribute",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          },
          {
            "name": "",
            "type": "string"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "owner",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "costToAdd",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "_petid",
            "type": "bytes32"
          }
        ],
        "name": "getNumberOfAttributes",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_petid",
            "type": "bytes32"
          },
          {
            "name": "_attribute",
            "type": "string"
          }
        ],
        "name": "addAttribute",
        "outputs": [],
        "payable": true,
        "type": "function"
      },
      {
        "inputs": [],
        "type": "constructor"
      },
      {
        "payable": false,
        "type": "fallback"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "_petid",
            "type": "bytes32"
          },
          {
            "indexed": false,
            "name": "_attribute",
            "type": "string"
          }
        ],
        "name": "attributeAdded",
        "type": "event"
      }
    ],
    "unlinked_binary": "0x6060604052600080546c0100000000000000000000000033810204600160a060020a03199091161790556105a9806100376000396000f3606060405236156100615760e060020a600035046341c0e1b5811461006e57806348d7d9eb1461009b5780636d665f20146100f15780638da5cb5b146101d1578063bd7c47ef146101e8578063cad36553146101fc578063fe9be4cc14610226575b34610002576102b7610002565b34610002576102b760005433600160a060020a03908116911614156102b957600054600160a060020a0316ff5b6102b760005433600160a060020a03908116911614156102b957600080546040516102b992600160a060020a039283169230163180156108fc02929091818181858888f19350505050155b80156105a657610002565b34610002576102bb6004356024356040805160208181018352600080835285815260019091529182208054849081101561000257906000526020600020906002020160005054600085815260016020526040902080548590811015610002579060005260206000209060020201600050600101600050808054600181600116156101000203166002900480601f0160208091040260200160405190810160405280929190818152602001828054600181600116156101000203166002900480156103775780601f1061034c57610100808354040283529160200191610377565b3461000257610330600054600160a060020a031681565b346100025761021467016345785d8a000081565b34610002576004356000908152600160205260409020545b60408051918252519081900360200190f35b60408051602060046024803582810135601f81018590048502860185019096528585526102b7958335959394604494939290920191819084018382808284375094965050505050505067016345785d8a0000341061042a5760405161042e90600160a060020a0333169067016345785d89ffff19340180156108fc02916000818181858888f19350505050156100e6565b005b565b60405180838152602001806020018281038252838181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f1680156103215780820380516001836020036101000a031916815260200191505b50935050505060405180910390f35b60408051600160a060020a039092168252519081900360200190f35b820191906000526020600020905b81548152906001019060200180831161035a57829003601f168201915b50505050509050915091509250929050565b50505050507f093f4825a54e577374952fbae2d31cb2c3ae3dbd0cb43a924715746efc9bd1a782826040518083600019168152602001806020018281038252838181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f16801561041b5780820380516001836020036101000a031916815260200191505b50935050505060405180910390a15b5050565b600082815260016020819052604090912080549182018082559091908281838015829011610475576002028160020283600052602060002091820191016104759190610503565b5050506000928352602080842060408051808201909152428082528184018890526002958602909201918255865160018084018054818a5298869020969893979496909591841615610100026000190190931693909304601f90810184900483019391929189019083901061057657805160ff19168380011785555b5061038992915061055e565b50506002015b80821115610572576000600082016000506000905560018201600050805460018160011615610100020316600290046000825580601f1061054457506104fd565b601f0160209004906000526020600020908101906104fd91905b80821115610572576000815560010161055e565b5090565b828001600101855582156104f1579182015b828111156104f1578251826000505591602001919060010190610588565b5056",
    "events": {
      "0x093f4825a54e577374952fbae2d31cb2c3ae3dbd0cb43a924715746efc9bd1a7": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "_petid",
            "type": "bytes32"
          },
          {
            "indexed": false,
            "name": "_attribute",
            "type": "string"
          }
        ],
        "name": "attributeAdded",
        "type": "event"
      }
    },
    "updated_at": 1480172340233,
    "links": {},
    "address": "0xeb9cdb290756247737b6369eeae6e7454d85895c"
  }
};

  Contract.checkNetwork = function(callback) {
    var self = this;

    if (this.network_id != null) {
      return callback();
    }

    this.web3.version.network(function(err, result) {
      if (err) return callback(err);

      var network_id = result.toString();

      // If we have the main network,
      if (network_id == "1") {
        var possible_ids = ["1", "live", "default"];

        for (var i = 0; i < possible_ids.length; i++) {
          var id = possible_ids[i];
          if (Contract.all_networks[id] != null) {
            network_id = id;
            break;
          }
        }
      }

      if (self.all_networks[network_id] == null) {
        return callback(new Error(self.name + " error: Can't find artifacts for network id '" + network_id + "'"));
      }

      self.setNetwork(network_id);
      callback();
    })
  };

  Contract.setNetwork = function(network_id) {
    var network = this.all_networks[network_id] || {};

    this.abi             = this.prototype.abi             = network.abi;
    this.unlinked_binary = this.prototype.unlinked_binary = network.unlinked_binary;
    this.address         = this.prototype.address         = network.address;
    this.updated_at      = this.prototype.updated_at      = network.updated_at;
    this.links           = this.prototype.links           = network.links || {};
    this.events          = this.prototype.events          = network.events || {};

    this.network_id = network_id;
  };

  Contract.networks = function() {
    return Object.keys(this.all_networks);
  };

  Contract.link = function(name, address) {
    if (typeof name == "function") {
      var contract = name;

      if (contract.address == null) {
        throw new Error("Cannot link contract without an address.");
      }

      Contract.link(contract.contract_name, contract.address);

      // Merge events so this contract knows about library's events
      Object.keys(contract.events).forEach(function(topic) {
        Contract.events[topic] = contract.events[topic];
      });

      return;
    }

    if (typeof name == "object") {
      var obj = name;
      Object.keys(obj).forEach(function(name) {
        var a = obj[name];
        Contract.link(name, a);
      });
      return;
    }

    Contract.links[name] = address;
  };

  Contract.contract_name   = Contract.prototype.contract_name   = "SkyPet";
  Contract.generated_with  = Contract.prototype.generated_with  = "3.2.0";

  // Allow people to opt-in to breaking changes now.
  Contract.next_gen = false;

  var properties = {
    binary: function() {
      var binary = Contract.unlinked_binary;

      Object.keys(Contract.links).forEach(function(library_name) {
        var library_address = Contract.links[library_name];
        var regex = new RegExp("__" + library_name + "_*", "g");

        binary = binary.replace(regex, library_address.replace("0x", ""));
      });

      return binary;
    }
  };

  Object.keys(properties).forEach(function(key) {
    var getter = properties[key];

    var definition = {};
    definition.enumerable = true;
    definition.configurable = false;
    definition.get = getter;

    Object.defineProperty(Contract, key, definition);
    Object.defineProperty(Contract.prototype, key, definition);
  });

  bootstrap(Contract);

  if (typeof module != "undefined" && typeof module.exports != "undefined") {
    module.exports = Contract;
  } else {
    // There will only be one version of this contract in the browser,
    // and we can use that.
    window.SkyPet = Contract;
  }
})();
