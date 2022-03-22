const Web3 = require("@solana/web3.js");
const SPL = require("@solana/spl-token");
/**
 * Because for some reason the function provided by the token library doesn't allow you to specify that you may
 * actually _do_ want to use a PDA.
 * @async
 * @param {Web3.Connection} connection
 * @param {Web3.Signer} payer
 * @param {Web3.PublicKey} mint
 * @param {Web3.PublicKey} owner
 * @param {Web3.ConfirmOptions} confirmOptions
 * @param {boolean} [amISmartEnoughToKnowThatIAmCreatingAnAccountForAProgram]
 * @param {Web3.PublicKey} [programId]
 * @param {Web3.PublicKey} [associatedTokenProgramId]
 * @returns {Promise<Web3.PublicKey>}
 */
const createAssociatedTokenAccountButAlsoAllowForPrograms = async function(
	connection,
	payer,
	mint,
	owner,
	confirmOptions,
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

module.exports = {createAssociatedTokenAccountButAlsoAllowForPrograms};
