contract('PetTracker', function(accounts) {
  it("should create a new item on ethereum", function() {
    // Get a reference to the deployed MetaCoin contract, as a JS object.
    var skypet = PetTracker.deployed();

    // Get the MetaCoin balance of the first account and assert that it's 10000.
    return skypet.addAttribute.call("SomePetId", 1, "helloworld").then(function(balance) {
      assert.equal(balance.valueOf(), 10000, "10000 wasn't in the first account");
    });
  });
});