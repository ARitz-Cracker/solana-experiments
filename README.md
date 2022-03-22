# solana-experiments

Experiments with Solana, SPL, TokenSwap

Just go and run `start.sh` with the repo as its working directory!

start.sh does the following to ensure js/main.js functions:

* Create 2 test accounts using a random key pair
* Create 2 tokens to trade with
* Ensure both test accounts have some SOL
* Ensure each trading token tokens are given to one of the test accounts
* Deploy the SPL Swap program
* Start the test validator if no network is specified through the sol_network enviroment variable

main.js does the following:

* Create a new swap pool using the program provided by start.sh
	* Along with its required accounts and intermediary token
* Perform a swap between the 2 test accounts
* Have a test account depoist and withdraw funds
