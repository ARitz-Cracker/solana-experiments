#!/bin/sh
original_wd=$(pwd);

[ -n "$wipe" ] &&
	rm -rf test-ledger solana-program-library js/node_modules js/package-lock.json config;

# Check if we have what we need
if
	! which solana > /dev/null ||
	! which git > /dev/null ||
	! which node > /dev/null ||
	! which cargo > /dev/null;
then
	echo "start.sh: Expected solana, git, node, and cargo to exist";
	exit 1;
fi;

echo "start.sh: Ensure required npm packages are available";
if
	! [ -d "node_modules" ] &&
	! cd js &&
	! npm install;
then
	echo "start.sh: npm failed";
	exit 1;
fi;

cd "$original_wd";

# This script was writtin with the assumption that this wouldn't be inside a git repo.
# Otherwise, I would have set up a submodule
echo "start.sh: Solana programs should be cloned";
if ! [ -d "solana-program-library" ]; then
	if
		! git clone git@github.com:solana-labs/solana-program-library.git ||
		! cd solana-program-library ||
		! git checkout b7a3fc62431fcd00001df625aaa61a29ce7d1e29;
	then
		echo "start.sh: git failed";
		exit 1;
	fi;
	cd "$original_wd";
fi;

echo "Build token-swap"
if ! [ -f "solana-program-library/target/deploy/spl_token_swap.so" ]; then
	if
		! cd solana-program-library/token-swap/program ||
		! cargo build-bpf;
	then
		echo "start.sh: token-swap build failed";
		exit 1;
	fi;
	cd "$original_wd";
fi;

# Load config if it exists
[ -f "config" ] && . ./config;

export test_acc0_pub=$(solana address);

if [ -z "$test_acc1_pub" ]; then
	node js/keypair-gen.js --name test_acc1;
fi;

if [ -z "$test_acc2_pub" ]; then
	node js/keypair-gen.js --name test_acc2;
fi;

# Reload anything that might have changed
. ./config;

if [ -z "$sol_network" ]; then
	echo "start.sh: No network selected, running a test validator";
	export sol_network="http://127.0.0.1:8899";
	pkill solana-test-validator;
	solana-test-validator -q &
	validator_pid=$!;
	echo "start.sh: Sleeping for 10 seconds so things settle";
	sleep 10;
	echo "start.sh: Test validator (probably) started";
fi;
echo "sol_network=$sol_network";
echo "validator_pid=$validator_pid";

echo "start.sh: Test account 1 pubkey is $test_acc1_pub";
echo "start.sh: Test account 2 pubkey is $test_acc2_pub";

if [ "$(solana balance | grep -o \^[0-9]\*)" -lt 3 ]; then
	echo "start.sh: Requesting airdrop of 3 sol for main account";
	if ! solana airdrop 3; then
		echo "start.sh: Airdrop failed";
		kill $validator_pid;
		exit 1;
	fi;
fi;

if [ "$(solana balance $test_acc1_pub | grep -o \^[0-9]\*)" -lt 1 ]; then
	echo "start.sh: Account 1 needs at least 1 sol, transferring";
	if ! solana transfer --allow-unfunded-recipient $test_acc1_pub 1; then
		echo "start.sh: Transfer failed";
		kill $validator_pid;
		exit 1;
	fi;
fi;

if [ "$(solana balance $test_acc2_pub | grep -o \^[0-9]\*)" -lt 1 ]; then
	echo "start.sh: Account 2 needs at least 1 sol, transferring";
	if ! solana transfer --allow-unfunded-recipient $test_acc2_pub 1; then
		echo "start.sh: Transfer failed";
		kill $validator_pid;
		exit 1;
	fi;
fi;
if [ -z "$test_token1" ]; then
	export test_token1=$(spl-token create-token | grep -oP '(?<=Creating token ).*');
	spl-token create-account $test_token1;
	echo "export test_token1=$test_token1" >> config;
fi;

if [ -z "$test_token2" ]; then
	export test_token2=$(spl-token create-token | grep -oP '(?<=Creating token ).*');
	spl-token create-account $test_token2;
	echo "export test_token2=$test_token2" >> config;
fi;

echo "start.sh: Test token mint 1 is $test_token1";
echo "start.sh: Test token mint 2 is $test_token2";
export test_token_program=$(solana account $test_token1 | grep -oP '(?<=Owner\: ).*');
echo "start.sh: Token program is $test_token_program"

if
	# Command fails if token account doesn't exist
	! spl-token balance $test_token1 --owner $test_acc1_pub > /dev/null ||
	[ "$(spl-token balance $test_token1 --owner $test_acc1_pub | grep -o \^[0-9]\*)" -lt 100 ];
then
	echo "start.sh: Minting 100 token1s to account 1";
	if
		! spl-token mint $test_token1 100 ||
		! spl-token transfer --allow-unfunded-recipient --fund-recipient $test_token1 100 $test_acc1_pub;
	then
		echo "start.sh: mint 1 failed";
		kill $validator_pid;
		exit 1;
	fi;
fi;

if
	# Command fails if token account doesn't exist
	! spl-token balance $test_token2 --owner $test_acc2_pub > /dev/null ||
	[ "$(spl-token balance $test_token2 --owner $test_acc2_pub | grep -o \^[0-9]\*)" -lt 100 ];
then
	echo "start.sh: Minting 100 token2s to account 2";
	if
		! spl-token mint $test_token2 100 ||
		! spl-token transfer --allow-unfunded-recipient --fund-recipient $test_token2 100 $test_acc2_pub;
	then
		echo "start.sh: mint 2 failed";
		kill $validator_pid;
		exit 1;
	fi;
fi;

if [ -z "$test_swapper_id" ]; then
	export test_swapper_id=$(solana program deploy solana-program-library/target/deploy/spl_token_swap.so | grep -oP '(?<=Program Id\: ).*');
	echo "export test_swapper_id=$test_swapper_id" >> config;
fi;

# Reload anything that might have changed
. ./config;

echo "Swapper is $test_swapper_id";

echo "start.sh: Everything required should exist now";

echo "-- starting main.js --";
node js/main.js;
echo "-- end main.js --";

if ! [ -z "$validator_pid" ]; then
	echo "Stopping validator";
	kill $validator_pid;
fi;


# sol_balance=$(solana balance | grep -o \^[0-9]\*)