const {
	initalize,
	createPool,
	performSwap,
	depositAndWithdraw
} = require("./lib/actions");

(async() => {
	try{
		await initalize();
		await createPool();
		await performSwap();
		await depositAndWithdraw();
	}catch(ex){
		console.error(ex);
		process.exitCode = 1;
	}
})();
