/*contract DistributeIncome{
  address[] public owners;
  function DistributeIncome(){

  }
  function receiveFunds(uint funds){
    this.balance+=funds;
  }
}*/
pragma solidity ^0.4.4;
contract SkyPet{
    uint256 constant public costToAdd=100000000000000000;// .1 ether
    uint constant public maxMsgLength=128;//maximum message at a time is 128 characters
    address public owner;
    modifier onlyOwner { if (msg.sender == owner) _; } //ensure only owner does some things
    modifier onlyIfHasEnoughEther { if (msg.value>=costToAdd) _; }  //see https://blog.ethcore.io/condition-oriented-programming-2/
    
    struct Attribute{
      uint timestamp;
      string jsonText; //must be a json string...if not, wont decrypt in client, and your loss
    }
    function SkyPet(){ //owner is creator of contract
      owner=msg.sender;
    }
    mapping(bytes32=> Attribute[]) private pet; // hash of pet id to array of attributes
    event attributeAdded(bytes32 _petid, string _attribute);
    function checkSendFunds(bool hasError) private{
      if(hasError){
        throw;
      }
    }
    function checkStringLength(string _attribute){
      if(bytes(_attribute).length>maxMsgLength){
        throw;
      }
    }
    function addAttribute(bytes32 _petid, string _attribute) onlyIfHasEnoughEther payable {
      checkSendFunds(!msg.sender.send(msg.value-costToAdd));//guaranteed to be at least 0...note that this sends back any excess funds that the sender may have provided.
      checkStringLength(_attribute);
      pet[_petid].push(Attribute(now, _attribute));
      attributeAdded(_petid, _attribute); //alert watchers that transaction went through
    }
    function kill() onlyOwner{
      selfdestruct(owner); // Makes contract inactive, returns funds
    }
    function getNumberOfAttributes(bytes32 _petid) public constant returns (uint){
      return pet[_petid].length;
    }
    function getAttribute(bytes32 _petid, uint index) public constant returns(uint, string){
      return(pet[_petid][index].timestamp, pet[_petid][index].jsonText);
    }
    function () {
        throw; // throw reverts state to before call
    }
    function getRevenue() onlyOwner payable{ //scrape currently obtained revenue.  Dont do this every transaction to save on transaction costs
      checkSendFunds(!owner.send(this.balance));
    }
}