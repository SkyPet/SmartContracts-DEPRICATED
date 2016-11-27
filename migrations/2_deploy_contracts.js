module.exports = function(deployer) {
  deployer.deploy(SkyPet, '0x69De4ADbb566c1c68e8dB1274229adA4A3D9f8A8');
  deployer.autolink();
  //deployer.deploy(MetaCoin);
};
