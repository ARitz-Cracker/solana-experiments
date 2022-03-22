const Web3 = require("@solana/web3.js");
const connection = new Web3.Connection(process.env.sol_network, "confirmed");

const payer1 = Web3.Keypair.fromSecretKey(Buffer.from(process.env.test_acc1_priv, "base64"));
const payer2 = Web3.Keypair.fromSecretKey(Buffer.from(process.env.test_acc2_priv, "base64"));

const tokenProgramId = new Web3.PublicKey(process.env.test_token_program);
const mint1Pubkey = new Web3.PublicKey(process.env.test_token1);
const mint2Pubkey = new Web3.PublicKey(process.env.test_token2);
const swapProgramId = new Web3.PublicKey(process.env.test_swapper_id);

// Pool fees
const TRADING_FEE_NUMERATOR = 25;
const TRADING_FEE_DENOMINATOR = 10000;
const OWNER_TRADING_FEE_NUMERATOR = 5;
const OWNER_TRADING_FEE_DENOMINATOR = 10000;
const OWNER_WITHDRAW_FEE_NUMERATOR = 0;
const OWNER_WITHDRAW_FEE_DENOMINATOR = 0;
const HOST_FEE_NUMERATOR = 20;
const HOST_FEE_DENOMINATOR = 100;

module.exports = {
	connection,
	payer1,
	payer2,
	tokenProgramId,
	mint1Pubkey,
	mint2Pubkey,
	swapProgramId,
	TRADING_FEE_NUMERATOR,
	TRADING_FEE_DENOMINATOR,
	OWNER_TRADING_FEE_NUMERATOR,
	OWNER_TRADING_FEE_DENOMINATOR,
	OWNER_WITHDRAW_FEE_NUMERATOR,
	OWNER_WITHDRAW_FEE_DENOMINATOR,
	HOST_FEE_NUMERATOR,
	HOST_FEE_DENOMINATOR
};
