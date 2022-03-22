const Web3 = require("@solana/web3.js");
const SPL = require("@solana/spl-token");
const SPLSwap = require("@solana/spl-token-swap"); // This still appears to reply on deprecated features

const connection = new Web3.Connection(process.env.sol_network, "confirmed");

// const cliPayerPubkey = new Web3.PublicKey(process.env.test_acc0_pub);
const payer1 = Web3.Keypair.fromSecretKey(Buffer.from(process.env.test_acc1_priv, "base64"));
const payer2 = Web3.Keypair.fromSecretKey(Buffer.from(process.env.test_acc2_priv, "base64"));

const tokenProgramId = new Web3.PublicKey(process.env.test_token_program);
const mint1Pubkey = new Web3.PublicKey(process.env.test_token1);
const mint2Pubkey = new Web3.PublicKey(process.env.test_token2);

const swapProgramId = new Web3.PublicKey(process.env.test_swapper_id);

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

/**
 * Because for some reason the function provided by the token library doesn't allow you to specify that you may
 * actually _do_ want to use a PDA.
 */
const createAssociatedTokenAccountButAlsoAllowForPrograms = async function(
	/** @type {Web3.Connection}*/ connection,
	/** @type {Web3.Signer}*/ payer,
	/** @type {Web3.PublicKey}*/ mint,
	/** @type {Web3.PublicKey}*/ owner,
	/** @type {Web3.ConfirmOptions}*/ confirmOptions,
	amISmartEnoughToKnowThatIAmCreatingAnAccountForAProgram = true,
	programId = SPL.TOKEN_PROGRAM_ID,
	associatedTokenProgramId = SPL.ASSOCIATED_TOKEN_PROGRAM_ID
){
	const associatedToken = await SPL.getAssociatedTokenAddress(
		mint,
		owner,
		amISmartEnoughToKnowThatIAmCreatingAnAccountForAProgram, // I shouldn't have to do this
		programId,
		associatedTokenProgramId
	);

	const transaction = new Web3.Transaction().add(
		SPL.createAssociatedTokenAccountInstruction(
			payer.publicKey,
			associatedToken,
			owner,
			mint,
			programId,
			associatedTokenProgramId
		)
	);

	await Web3.sendAndConfirmTransaction(connection, transaction, [payer], confirmOptions);

	return associatedToken;
};
// Pool fees
const TRADING_FEE_NUMERATOR = 25;
const TRADING_FEE_DENOMINATOR = 10000;
const OWNER_TRADING_FEE_NUMERATOR = 5;
const OWNER_TRADING_FEE_DENOMINATOR = 10000;
const OWNER_WITHDRAW_FEE_NUMERATOR = 0;
const OWNER_WITHDRAW_FEE_DENOMINATOR = 0;
const HOST_FEE_NUMERATOR = 20;
const HOST_FEE_DENOMINATOR = 100;


(async() => {
try{
	console.log("Payer1 pubkey", payer1.publicKey.toBase58());
	console.log("Payer2 pubkey", payer2.publicKey.toBase58());
	await printBalances();

	const p1m1Addr = await SPL.getAssociatedTokenAddress(mint1Pubkey, payer1.publicKey);
	// const p1m2Addr = await SPL.getAssociatedTokenAddress(mint2Pubkey, payer1.publicKey);
	const p2m1Addr = await SPL.getAssociatedTokenAddress(mint1Pubkey, payer2.publicKey);
	const p2m2Addr = await SPL.getAssociatedTokenAddress(mint2Pubkey, payer2.publicKey);

	console.log("Scenerio: Payer 1 owns creates swap pool, trades with Payer 2");

	const swapAccount = new Web3.Keypair();
	const [poolAuthority] = await Web3.PublicKey.findProgramAddress(
		[swapAccount.publicKey.toBuffer()],
		swapProgramId
	);
	console.log("Create pool mint");
	const tokenPoolMint = await SPL.createMint(
		connection,
		payer1,
		poolAuthority,
		undefined,
		2
	);
	console.log(tokenPoolMint.toBase58());

	console.log("Create pool account");
	const tokenPoolAddr = await SPL.createAccount(connection, payer1, tokenPoolMint, payer1.publicKey);
	console.log(tokenPoolAddr.toBase58());

	console.log("Create fee account");
	const tokenPoolFeeAddr = tokenPoolAddr;
	console.log(tokenPoolFeeAddr.toBase58());

	console.log("Create pool M1 account");
	const tokenPoolM1Addr = await createAssociatedTokenAccountButAlsoAllowForPrograms(
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
	const tokenPoolM2Addr = await createAssociatedTokenAccountButAlsoAllowForPrograms(
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
	const tokenSwapper = await SPLSwap.TokenSwap.createTokenSwap(
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
		tokenPoolAddr,
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

	console.log("payer2 gets pool tokens");

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

	const p2PoolAddr = await SPL.createAccount(connection, payer2, tokenPoolMint, payer2.publicKey);

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
}catch(ex){
	console.error(ex);
	process.exitCode = 1;
}
})();
