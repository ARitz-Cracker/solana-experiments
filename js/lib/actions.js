const Web3 = require("@solana/web3.js");
const SPL = require("@solana/spl-token");
const SPLSwap = require("@solana/spl-token-swap"); // This still appears to reply on deprecated features
const {
	connection,

	payer1,
	payer2,
	mint1Pubkey,
	mint2Pubkey,
	tokenProgramId,
	swapProgramId,

	TRADING_FEE_NUMERATOR,
	TRADING_FEE_DENOMINATOR,
	OWNER_TRADING_FEE_NUMERATOR,
	OWNER_TRADING_FEE_DENOMINATOR,
	OWNER_WITHDRAW_FEE_NUMERATOR,
	OWNER_WITHDRAW_FEE_DENOMINATOR,
	HOST_FEE_NUMERATOR,
	HOST_FEE_DENOMINATOR
} = require("./consts");

const {createAssociatedTokenAccountButAlsoAllowForPrograms} = require("./util");

const printBalances = async function(){
	const p1m1Acc = await SPL.getOrCreateAssociatedTokenAccount(
		connection,
		payer1,
		mint1Pubkey,
		payer1.publicKey
	);
	const p1m2Acc = await SPL.getOrCreateAssociatedTokenAccount(
		connection,
		payer1,
		mint2Pubkey,
		payer1.publicKey
	);
	const p2m1Acc = await SPL.getOrCreateAssociatedTokenAccount(
		connection,
		payer2,
		mint1Pubkey,
		payer2.publicKey
	);
	const p2m2Acc = await SPL.getOrCreateAssociatedTokenAccount(
		connection,
		payer2,
		mint2Pubkey,
		payer2.publicKey
	);

	console.log("Payer1 M1", Number(p1m1Acc.amount) / 1e9);
	console.log("Payer1 M2", Number(p1m2Acc.amount) / 1e9);

	console.log("Payer2 M1", Number(p2m1Acc.amount) / 1e9);
	console.log("Payer2 M2", Number(p2m2Acc.amount) / 1e9);

	console.log("Payer1 SOL", await connection.getBalance(payer1.publicKey) / Web3.LAMPORTS_PER_SOL);
	console.log("Payer2 SOL", await connection.getBalance(payer2.publicKey) / Web3.LAMPORTS_PER_SOL);
};

/** @type {Web3.PublicKey} */
let p1m1Addr;

/** @type {Web3.PublicKey} */
let p2m1Addr;
/** @type {Web3.PublicKey} */
let p2m2Addr;

const initalize = async function(){
	console.log("Payer1 pubkey", payer1.publicKey.toBase58());
	console.log("Payer2 pubkey", payer2.publicKey.toBase58());
	await printBalances();

	p1m1Addr = await SPL.getAssociatedTokenAddress(mint1Pubkey, payer1.publicKey);
	// p1m2Addr = await SPL.getAssociatedTokenAddress(mint2Pubkey, payer1.publicKey);
	p2m1Addr = await SPL.getAssociatedTokenAddress(mint1Pubkey, payer2.publicKey);
	p2m2Addr = await SPL.getAssociatedTokenAddress(mint2Pubkey, payer2.publicKey);
};
/** @type {Web3.PublicKey} */
let tokenPoolMint;
/** @type {Web3.PublicKey} */
let p1PoolAddr;
/** @type {Web3.PublicKey} */
let p2PoolAddr;

/** @type {SPLSwap.TokenSwap} */
let tokenSwapper;

/** @type {Web3.PublicKey} */
let tokenPoolM2Addr;
/** @type {Web3.PublicKey} */
let tokenPoolM1Addr;
/** @type {Web3.PublicKey} */
let tokenPoolFeeAddr;

const createPool = async function(){
	console.log("Create swap pool owned by Payer1");
	const swapAccount = new Web3.Keypair();
	const [poolAuthority] = await Web3.PublicKey.findProgramAddress(
		[swapAccount.publicKey.toBuffer()],
		swapProgramId
	);
	console.log("Create pool mint");
	tokenPoolMint = await SPL.createMint(
		connection,
		payer1,
		poolAuthority,
		undefined,
		2
	);
	console.log(tokenPoolMint.toBase58());

	console.log("Create pool account");
	p1PoolAddr = await SPL.createAccount(connection, payer1, tokenPoolMint, payer1.publicKey);
	console.log(p1PoolAddr.toBase58());

	console.log("Create fee account");
	tokenPoolFeeAddr = p1PoolAddr;
	console.log(tokenPoolFeeAddr.toBase58());

	console.log("Create pool M1 account");
	tokenPoolM1Addr = await createAssociatedTokenAccountButAlsoAllowForPrograms(
		connection,
		payer1,
		mint1Pubkey,
		poolAuthority
	);
	console.log(tokenPoolM1Addr.toBase58());
	// There must be tokens in here for some reason
	await connection.confirmTransaction(
		await SPL.transferChecked(
			connection,
			payer1, // fee payer
			p1m1Addr, // from account
			mint1Pubkey,
			tokenPoolM1Addr, // to account
			payer1, // authorized p1m1 account holder
			20e9,
			9
		)
	);

	console.log("Create pool M2 account");
	tokenPoolM2Addr = await createAssociatedTokenAccountButAlsoAllowForPrograms(
		connection,
		payer1,
		mint2Pubkey,
		poolAuthority
	);
	console.log(tokenPoolM2Addr.toBase58());
	// There must be tokens in here for some reason
	await connection.confirmTransaction(
		await SPL.transferChecked(
			connection,
			payer2, // fee payer
			p2m2Addr, // from account
			mint2Pubkey,
			tokenPoolM2Addr, // to account
			payer2, // authorized p2m2 account holder
			10e9,
			9
		)
	);

	console.log("Create the swap!");
	tokenSwapper = await SPLSwap.TokenSwap.createTokenSwap(
		connection,
		payer1,
		swapAccount,
		poolAuthority,
		tokenPoolM1Addr,
		tokenPoolM2Addr,
		tokenPoolMint,
		mint1Pubkey,
		mint2Pubkey,
		tokenPoolFeeAddr,
		p1PoolAddr,
		swapProgramId,
		tokenProgramId,
		TRADING_FEE_NUMERATOR,
		TRADING_FEE_DENOMINATOR,
		OWNER_TRADING_FEE_NUMERATOR,
		OWNER_TRADING_FEE_DENOMINATOR,
		OWNER_WITHDRAW_FEE_NUMERATOR,
		OWNER_WITHDRAW_FEE_DENOMINATOR,
		HOST_FEE_NUMERATOR,
		HOST_FEE_DENOMINATOR,
		SPLSwap.CurveType.ConstantProduct
	);
};

const performSwap = async function(){
	console.log("payer2 swaps M2 for M1");
	const middleMan = new Web3.Keypair();
	await connection.confirmTransaction(
		await SPL.approve(
			connection,
			payer2,
			p2m2Addr,
			middleMan.publicKey,
			payer2,
			1e9,
			9
		)
	);
	await connection.confirmTransaction(
		await tokenSwapper.swap(
			p2m2Addr,
			tokenPoolM2Addr,
			tokenPoolM1Addr,
			p2m1Addr,
			tokenPoolFeeAddr,
			middleMan,
			1e9,
			1.5e9
		)
	);
	await printBalances();
};

const depositAndWithdraw = async function(){
	console.log("payer2 gets pool tokens");
	const middleMan = new Web3.Keypair();

	await Promise.all([
		SPL.approve(
			connection,
			payer2,
			p2m1Addr,
			middleMan.publicKey,
			payer2,
			1e9,
			9
		),
		SPL.approve(
			connection,
			payer2,
			p2m2Addr,
			middleMan.publicKey,
			payer2,
			0.5e9,
			9
		)
	].map(async tx => connection.confirmTransaction(await tx)));

	p2PoolAddr = await SPL.createAccount(connection, payer2, tokenPoolMint, payer2.publicKey);

	await connection.confirmTransaction(
		await tokenSwapper.depositAllTokenTypes(
			p2m1Addr,
			p2m2Addr,
			p2PoolAddr,
			middleMan,
			0.01e9,
			1e9,
			0.5e9
		)
	);
	const poolTokenAmount = (await SPL.getAccount(connection, p2PoolAddr)).amount;
	console.log("Payer2 pool balance", Number(poolTokenAmount) / 1e9);
	await printBalances();

	console.log("Payer2 withdraws everything");
	await connection.confirmTransaction(
		await SPL.approve(
			connection,
			payer2,
			p2PoolAddr,
			middleMan.publicKey,
			payer2,
			0.01e9
		)
	);
	await connection.confirmTransaction(
		await tokenSwapper.withdrawAllTokenTypes(
			p2m1Addr,
			p2m2Addr,
			p2PoolAddr,
			middleMan,
			0.01e9,
			1,
			1
		)
	);
	await printBalances();
};

module.exports = {
	printBalances,
	initalize,
	createPool,
	performSwap,
	depositAndWithdraw
};
