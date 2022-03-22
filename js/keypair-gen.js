const {program} = require("commander");
const {name} = program.requiredOption("-n, --name <string>").parse()
	.opts();

const fs = require("fs");
const web3 = require("@solana/web3.js");
const keypair = new web3.Keypair();

fs.appendFileSync("config", `export ${name}_priv=${Buffer.from(keypair.secretKey).toString("base64")}\n`);
fs.appendFileSync("config", `export ${name}_pub=${keypair.publicKey.toBase58()}\n`);
