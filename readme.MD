## SkyPet Smart Contracts

This is the repository for SkyPet smart contracts.  These include the "main" governing smart contract and the tests for the smart contracts.  We do NOT use truffle for html creation of apps; merely as a development and testing framework for smart contracts.  See https://medium.com/zeppelin-blog/the-hitchhikers-guide-to-smart-contracts-in-ethereum-848f08001f05#.hkb6fsw7t and https://truffle.readthedocs.io/en/latest/getting_started/testing/ and http://ethereum.stackexchange.com/questions/7775/testing-contracts-with-truffle.

##To run unit tests

Install testrpc `npm install -g testrpc`

Run testrpc `testrpc`

Install our fork of truffle `https://github.com/SkyPet/truffle`.

In a seperate terminal, cd to the repository and type 
`path/to/skypet/truffle/cli.js test`

##To compile contracts (includes abi and bytecode)

Install our fork of truffle `https://github.com/SkyPet/truffle`.

In a seperate terminal, cd to the repository and type 
`path/to/skypet/truffle/cli.js compile`

##Todo
Make contracts deployable to testrpc, testnet, and mainnet.
