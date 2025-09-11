#!/usr/bin/env node
import { Command,Option } from "commander";
import { generateSolAddresses, generateEvmAddresses } from "./generate.js";
import { startEvmTrading, collectEvmFunds } from "./evm-trade.js";
import bip39 from "bip39";
import "./console.js"

const program = new Command();

// 生成助记词和地址
program
    .command("generate")
    .description("生成助记词和地址")
    .option("-m, --mnemonic <string>", "助记词")
    .option("-g, --generate", "随机生成一个新的 24 词助记词")
    .option("-n, --number <number>", "生成的地址数量", "10")
    .option("-t, --time <hours>", "时间范围（小时）")
    .option("-f, --file <string>", "导出地址和私钥到 CSV 文件")
    .addOption(
        new Option("-T, --type <string>", "地址类型 (sol/evm)")
            .choices(["sol", "evm"])
            .default("sol")
    )
    .action(async (options) => {
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

        if (options.type === "sol") {
            await generateSolAddresses(seed, numAddresses, options);
        } else if (options.type === "evm") {
            await generateEvmAddresses(seed, numAddresses, options);
        } else {
            console.error("❌ 无效的地址类型，请使用 'sol' 或 'evm'");
            process.exit(1);
        }
    });



// 交易功能
program
    .command("trade")
    .description("执行交易功能")
    .requiredOption("--config <path>", "交易配置文件路径")
    .requiredOption("--file <path>", "地址 CSV 文件路径")
    .requiredOption("--start-address <address>", "起始交易地址")
    .option("-T, --type <string>", "地址类型 (sol/evm)", "evm")
    .action(async (options) => {
        if (options.type === "evm") {
            console.log("\n🚀 开始 EVM 链交易...");
            await startEvmTrading(options.config, options.file, options.startAddress);
        } else {
            console.error("❌ 目前仅支持 EVM 链交易");
            process.exit(1);
        }
    });

// 资金归集功能
program
    .command("collect")
    .description("资金归集功能")
    .requiredOption("--config <path>", "交易配置文件路径")
    .requiredOption("--file <path>", "地址 CSV 文件路径")
    .option("-T, --type <string>", "地址类型 (sol/evm)", "evm")
    .action(async (options) => {
        if (options.type === "evm") {
            console.log("\n💰 开始 EVM 链资金归集...");
            await collectEvmFunds(options.config, options.file);
        } else {
            console.error("❌ 目前仅支持 EVM 链资金归集");
            process.exit(1);
        }
    });

program.parse(process.argv);
