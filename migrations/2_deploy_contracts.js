module.exports = function(deployer) {
  deployer.deploy(SkyPet, '0x72c1bba9cabab4040c285159c8ea98fd36372858');
  //actually 0x72c1bba9cabab4040c285159c8ea98fd36372858?
  deployer.autolink();
  //deployer.deploy(MetaCoin);
};
