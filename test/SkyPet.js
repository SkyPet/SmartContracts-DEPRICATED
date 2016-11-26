contract('SkyPet', function(accounts) {
  var testSha=web3.sha3("SomePetId");
  it("should give the cost to add", function() {
    var skypet = SkyPet.deployed();
    return skypet.costToAdd().then((cost)=>{
      assert.equal(cost, 100000000000000000, "Cost to add incorrect");
    });
  });
  it("account has enough funds", function() {
    var skypet = SkyPet.deployed();
    return skypet.costToAdd().then((cost)=>{
      assert(cost<web3.eth.getBalance(accounts[0]), "Not enough funds!");
    });
  });
  it("should create a new item on ethereum", function() {
    // Get a reference to the deployed SkyPet contract, as a JS object.
    var skypet = SkyPet.deployed();
    return skypet.costToAdd().then((cost)=>{
      return skypet.addAttribute.sendTransaction(testSha, "helloworld", {value:cost, gas:3000000}).then((newIndex)=>{
        return skypet.getAttribute(testSha, 0).then((result)=>{
          assert.equal(result[1], "helloworld", "account not added");
        });
      });
    });
  });
  it("should get number of items", function() {
    // Get a reference to the deployed SkyPet contract, as a JS object.
    var skypet = SkyPet.deployed();
    return skypet.costToAdd().then((cost)=>{
      return skypet.addAttribute.sendTransaction(testSha, "helloworld", {value:cost, gas:3000000}).then((newIndex)=>{
        return skypet.getNumberOfAttributes(testSha).then((result)=>{
          assert.equal(result, 2, "attributes not working");
        });        
      });
    });
  });
});