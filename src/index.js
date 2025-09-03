#!/usr/bin/env node
import { Command,Option } from "commander";
import bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import { Keypair } from "@solana/web3.js";
import { hdkey } from '@ethereumjs/wallet';
import fs from "fs";

const program = new Command();

program
    .option("-m, --mnemonic <string>", "助记词")
    .option("-g, --generate", "随机生成一个新的 24 词助记词")
    .option("-n, --number <number>", "生成的地址数量", "10")
    .option("-t, --time <hours>", "时间范围（小时）")
    .option("-f, --file <string>", "导出地址和私钥到 CSV 文件")
program.addOption(
    new Option("-T, --type <string>", "地址类型 (sol/evm)")
        .choices(["sol", "evm"])
        .default("sol")
);

program.parse(process.argv);

const options = program.opts();

let mnemonic = options.mnemonic;

if (options.generate) {
    mnemonic = bip39.generateMnemonic(256); // 24 词
    console.log("\n🌱 随机生成新的 24 词助记词：\n");
    console.log(mnemonic, "\n");
}

if (!mnemonic) {
    console.error("❌ 请输入助记词 (--mnemonic) 或使用 --generate 生成一个新的助记词");
    process.exit(1);
}

if (!bip39.validateMnemonic(mnemonic)) {
    console.error("❌ 无效的助记词");
    process.exit(1);
}

const seed = bip39.mnemonicToSeedSync(mnemonic);
const numAddresses = parseInt(options.number);

// 导出地址和私钥到 CSV 文件
function exportToCSV(filename, data) {
    const csvContent = data.map(item => `${item.address},${item.privateKey}`).join('\n');
    const header = "Address,Private Key\n";
    fs.writeFileSync(filename, header + csvContent, 'utf8');
}

// 随机生成未来时间点（毫秒延迟）
function generateRandomDelays(n, hours) {
    const now = Date.now();
    const delays = [];
    for (let i = 0; i < n; i++) {
        const delay = Math.floor(Math.random() * hours * 3600 * 1000); // ms
        delays.push(delay);
    }
    return delays.sort((a, b) => a - b); // 升序
}

if (options.type === "sol") {
    if (options.time) {
        const hours = parseFloat(options.time);
        const delays = generateRandomDelays(numAddresses, hours);

        console.log(`\n🎯 将在未来 ${hours} 小时内随机生成 ${numAddresses} 个 SOL 地址\n`);

        const csvData = [];
        delays.forEach((delay, i) => {
            setTimeout(() => {
                const path = `m/44'/501'/${i}'/0'`;
                const derived = derivePath(path, seed.toString("hex"));
                const keypair = Keypair.fromSeed(derived.key);
                const address = keypair.publicKey.toBase58();
                const privateKey = Buffer.from(keypair.secretKey).toString('hex');
                console.log(`${new Date().toISOString()} → ${address}`);
                csvData.push({ address, privateKey });
                if (i === numAddresses - 1 && options.file) {
                    exportToCSV(options.file, csvData);
                    console.log(`\n✅ 地址和私钥已导出到 ${options.file}`);
                }
            }, delay);
        });
    } else {
        // 一次性生成
        console.log(`\n🎯 一次性生成 ${numAddresses} 个 SOL 地址\n`);
        const csvData = [];
        for (let i = 0; i < numAddresses; i++) {
            const path = `m/44'/501'/${i}'/0'`;
            const derived = derivePath(path, seed.toString("hex"));
            const keypair = Keypair.fromSeed(derived.key);
            const address = keypair.publicKey.toBase58();
            const privateKey = Buffer.from(keypair.secretKey).toString('hex');
            console.log(address);
            csvData.push({ address, privateKey });
        }
        if (options.file) {
            exportToCSV(options.file, csvData);
            console.log(`\n✅ 地址和私钥已导出到 ${options.file}`);
        }
    }
} else if (options.type === "evm") {
    if (options.time) {
        const hours = parseFloat(options.time);
        const delays = generateRandomDelays(numAddresses, hours);

        console.log(`\n🎯 将在未来 ${hours} 小时内随机生成 ${numAddresses} 个 EVM 地址\n`);

        const csvData = [];
        delays.forEach((delay, i) => {
            setTimeout(() => {
                const path = `m/44'/60'/0'/0/${i}`;
                const wallet = hdkey.EthereumHDKey.fromMasterSeed(seed).derivePath(path).getWallet();
                const address = wallet.getAddressString();
                const privateKey = wallet.getPrivateKeyString();
                console.log(`${new Date().toISOString()} → ${address}`);
                csvData.push({ address, privateKey });
                if (i === numAddresses - 1 && options.file) {
                    exportToCSV(options.file, csvData);
                    console.log(`\n✅ 地址和私钥已导出到 ${options.file}`);
                }
            }, delay);
        });
    } else {
        // 一次性生成
        console.log(`\n🎯 一次性生成 ${numAddresses} 个 EVM 地址\n`);
        const csvData = [];
        for (let i = 0; i < numAddresses; i++) {
            const path = `m/44'/60'/0'/0/${i}`;
            const wallet = hdkey.EthereumHDKey.fromMasterSeed(seed).derivePath(path).getWallet();
            const address = wallet.getAddressString();
            const privateKey = wallet.getPrivateKeyString();
            console.log(address);
            csvData.push({ address, privateKey });
        }
        if (options.file) {
            exportToCSV(options.file, csvData);
            console.log(`\n✅ 地址和私钥已导出到 ${options.file}`);
        }
    }
} else {
    console.error("❌ 无效的地址类型，请使用 'sol' 或 'evm'");
    process.exit(1);
}
