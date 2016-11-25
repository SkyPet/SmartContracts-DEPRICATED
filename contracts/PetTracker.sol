/*contract DistributeIncome{
  address[] public owners;
  function DistributeIncome(){

  }
  function receiveFunds(uint funds){
    this.balance+=funds;
  }
}*/
pragma solidity ^0.4.4;
contract PetTracker{
    uint256 constant public costToAdd=100000000000000000;// .1 ether
    address public owner;
    modifier onlyOwner { if (msg.sender == owner) _; } //ensure only owner does some things
    modifier onlyIfHasEnoughEther { if (msg.value>=costToAdd) _; }  
    //modifier onlyIfExists(bytes32 _petid){if (trackNumberRecords[_petid]>0)_;}
    //modifier onlyIfNotExists(bytes32 _petid){if (trackNumberRecords[_petid]>0)_;}
    struct Attribute{
      uint timestamp;
      string jsonText; //must be a json string...if not, wont decrypt in client, and your loss
    }
    function PetTracker(){ //owner is creator of contract
      owner=msg.sender;
    }
    mapping(bytes32=> Attribute[]) public pet; // hash of pet id to array of attributes
    event attributeAdded(bytes32 _petid, string _attribute);
    function addAttribute(bytes32 _petid, string _attribute) onlyIfHasEnoughEther{//see https://blog.ethcore.io/condition-oriented-programming-2/
      msg.sender.send(msg.value-costToAdd);//guaranteed to be at least 0
      pet[_petid].push(Attribute(now, _attribute));
      attributeAdded(_petid, _attribute); //alert watchers that transaction went through
    }
    function kill() onlyOwner{
      selfdestruct(owner); // Makes contract inactive, returns funds
    }
    function getNumberOfAttributes(bytes32 _petid) returns (uint){
      return pet[_petid].length;
    }
    function () {
        throw; // throw reverts state to before call
    }
    function getRevenue() onlyOwner{ //scrape currently obtained revenue.  Dont do this every transaction to save on transaction costs
      owner.send(this.balance);
    }

}