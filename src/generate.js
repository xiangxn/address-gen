import bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import { Keypair } from "@solana/web3.js";
import { hdkey } from '@ethereumjs/wallet';
import fs from "fs";

// 导出地址和私钥到 CSV 文件
export function exportToCSV(filename, data) {
    const csvContent = data.map(item => `${item.address},${item.privateKey}`).join('\n');
    const header = "Address,Private Key\n";
    fs.writeFileSync(filename, header + csvContent, 'utf8');
}

// 随机生成未来时间点（毫秒延迟）
export function generateRandomDelays(n, hours) {
    const now = Date.now();
    const delays = [];
    for (let i = 0; i < n; i++) {
        const delay = Math.floor(Math.random() * hours * 3600 * 1000); // ms
        delays.push(delay);
    }
    return delays.sort((a, b) => a - b); // 升序
}

// 生成 SOL 地址
export function generateSolAddresses(seed, numAddresses, options) {
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
}

// 生成 EVM 地址
export function generateEvmAddresses(seed, numAddresses, options) {
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
}