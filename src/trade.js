import { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from "@solana/web3.js";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import fs from "fs";

export async function startTrading(configPath, addressCSV, startAddress) {
    // 读取配置文件
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    
    // 读取地址CSV文件
    const addresses = fs.readFileSync(addressCSV, "utf8")
        .split("\n")
        .slice(1) // 跳过表头
        .filter(line => line.trim() !== "")
        .map(line => {
            const [address, privateKey] = line.split(",");
            return { address, privateKey };
        });
    
    // 初始化Solana连接
    const connection = new Connection(config.rpcUrl);
    
    // 找到起始地址
    let currentIndex = addresses.findIndex(addr => addr.address === startAddress);
    if (currentIndex === -1) {
        throw new Error(`起始地址 ${startAddress} 未找到`);
    }
    
    // 交易循环
    while (currentIndex < addresses.length) {
        const currentAddress = addresses[currentIndex];
        const keypair = Keypair.fromSecretKey(Buffer.from(currentAddress.privateKey, "hex"));
        
        // 检查余额
        const balance = await connection.getBalance(new PublicKey(currentAddress.address));
        if (balance === 0) {
            console.log(`地址 ${currentAddress.address} 余额为0，停止交易`);
            break;
        }
        
        // 随机交易逻辑
        const amount = Math.random() * (config.amountRange[1] - config.amountRange[0]) + config.amountRange[0];
        
        // 创建交易
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: new PublicKey(currentAddress.address),
                toPubkey: new PublicKey(config.receiverAddress),
                lamports: amount * 1e9, // SOL to lamports
            })
        );
        
        // 发送交易
        const signature = await sendAndConfirmTransaction(connection, transaction, [keypair]);
        console.log(`交易成功: ${signature}`);
        
        // 随机选择下一个地址
        currentIndex = Math.floor(Math.random() * addresses.length);
    }
}

export async function collectFunds(configPath, addressCSV) {
    // 归集功能实现
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const addresses = fs.readFileSync(addressCSV, "utf8")
        .split("\n")
        .slice(1)
        .filter(line => line.trim() !== "")
        .map(line => {
            const [address, privateKey] = line.split(",");
            return { address, privateKey };
        });
    
    const connection = new Connection(config.rpcUrl);
    
    for (const addr of addresses) {
        const keypair = Keypair.fromSecretKey(Buffer.from(addr.privateKey, "hex"));
        const balance = await connection.getBalance(new PublicKey(addr.address));
        
        if (balance > 0) {
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: new PublicKey(addr.address),
                    toPubkey: new PublicKey(config.receiverAddress),
                    lamports: balance,
                })
            );
            
            const signature = await sendAndConfirmTransaction(connection, transaction, [keypair]);
            console.log(`归集成功: ${addr.address} -> ${signature}`);
        }
    }
}