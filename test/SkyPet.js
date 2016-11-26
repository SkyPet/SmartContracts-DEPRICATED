contract('SkyPet', function(accounts) {
  //console.log(web3);
  //console.log(web3.eth.getBalance(accounts[0]).toNumber());
  //console.log(accounts[0].getBalance());
  it("should give the cost to add", function() {
    var skypet = SkyPet.deployed();
    return skypet.costToAdd().then((cost)=>{
      assert.equal(cost, 100000000000000000, "Cost to add incorrect");
    });
    
  });
  it("should create a new item on ethereum", function() {
    // Get a reference to the deployed SkyPet contract, as a JS object.
    var skypet = SkyPet.deployed();
    return skypet.addAttribute.call("SomePetId",  "helloworld").then((balance)=>{
      //console.log(balance);
      return skypet.getNumberOfAttributes("SomePetId").then((result)=>{
        console.log(result);
        //console.log(nr);
        assert.equal(result, 1, "account not added");
      });
      
    });
  });
  /*it("should fail from lack of funds", function() {
    // Get a reference to the deployed MetaCoin contract, as a JS object.
    var skypet = SkyPet.deployed();

    // Get the MetaCoin balance of the first account and assert that it's 10000.
    return skypet.addAttribute.call("SomePetId",  "helloworld").then(function(balance) {
      assert.equal(skypet.getNumberOfAttributes("SomePetId"), 1, "account not added");
    });
  });*/
});