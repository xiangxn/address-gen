import { ethers } from "ethers";
import fs from "fs";

/**
 * 查询指定地址的 Token 余额
 */
// Multicall3 合约地址（BSC 测试网）
let MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";

/**
 * 统计功能：查询地址列表的 nonce 和 Token 余额，并计算价值
 * @param {string} configPath - 配置文件路径
 * @param {string} addressCSV - 地址列表文件路径
 * @param {string} tokenAddress - 要统计的 Token 合约地址
 */
export async function statEvmAddresses(configPath, addressCSV, tokenAddress = null) {
    // 读取配置文件
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    let quoteSymbol = config.quoteSymbol;
    MULTICALL3_ADDRESS = ethers.isAddress(config.multicall3Address) ? config.multicall3Address : MULTICALL3_ADDRESS;

    let useTokenAddress = false;
    // 如果 tokenAddress 为 null，使用配置文件中的 tokenAddress
    if (tokenAddress === null || !ethers.isAddress(tokenAddress)) {
        tokenAddress = config.tokenAddress;
    } else {
        useTokenAddress = true
    }

    // 读取地址列表文件
    const addresses = fs.readFileSync(addressCSV, "utf8")
        .split("\n")
        .slice(1) // 跳过表头
        .filter(line => line.trim() !== "")
        .map(line => {
            const [address] = line.split(",");
            return address;
        });

    // 初始化统计结果
    let totalTokenBalance = BigInt(0);
    let totalEthBalance = BigInt(0);
    let hasTokenBalanceCount = 0;
    let noTokenBalanceCount = 0;

    const tokenSymbol = await getTokenSymbol(provider, tokenAddress);
    // 批量查询所有地址的 Token 余额
    const tokenBalances = await getTokenBalances(provider, tokenAddress, addresses);
    const ethBalances = await getEthBalance(provider, addresses);

    // 统计 Token 余额分布
    for (let i = 0; i < addresses.length; i++) {
        const tokenBalance = tokenBalances[i];

        // 统计 Token 余额分布
        if (tokenBalance > 0) {
            hasTokenBalanceCount++;
        } else {
            noTokenBalanceCount++;
        }

        // 累加 Token 余额
        totalTokenBalance = totalTokenBalance + tokenBalance;
        totalEthBalance = totalEthBalance + ethBalances[i];
    }

    // 计算 Token 价值（假设 quoteToken 是 BNB）
    const tokenValue = await calculateTokenValue(provider, config.quoteTokenAddress, tokenAddress, totalTokenBalance, config);

    if (useTokenAddress) {
        quoteSymbol = tokenValue.symbol;
    }
    // 输出统计结果
    console.info(`统计结果：`);
    console.info(`- 有 ${tokenSymbol} 余额的地址数量: ${hasTokenBalanceCount}`);
    console.info(`- 无 ${tokenSymbol} 余额的地址数量: ${noTokenBalanceCount}`);
    console.info(`- 总 ${quoteSymbol} 余额: ${ethers.formatEther(totalEthBalance)}`);
    console.info(`- 总 ${tokenSymbol} 余额: ${ethers.formatEther(totalTokenBalance)}`);
    console.info(`- 总 ${tokenSymbol} 价值: ${ethers.formatEther(tokenValue.value)} ${quoteSymbol}`);
    console.info(`- 总价值: ${ethers.formatEther(tokenValue.value + totalEthBalance)} ${quoteSymbol}`);
}



/**
 * 批量查询 Token 余额
 */
async function getTokenBalances(provider, tokenAddress, walletAddresses) {
    const multicall = new ethers.Contract(
        MULTICALL3_ADDRESS,
        ["function aggregate((address,bytes)[]) view returns (uint256, bytes[])"],
        provider
    );

    const tokenContract = new ethers.Interface(["function balanceOf(address) view returns (uint256)"]);

    // 每批最多查询的地址数量
    const BATCH_SIZE = 300;
    const batches = [];

    // 将地址列表拆分为多个批次
    for (let i = 0; i < walletAddresses.length; i += BATCH_SIZE) {
        batches.push(walletAddresses.slice(i, i + BATCH_SIZE));
    }

    // 并行查询所有批次
    const results = await Promise.all(
        batches.map(async batch => {
            const calls = batch.map(address => [
                tokenAddress,
                tokenContract.encodeFunctionData("balanceOf", [address])
            ]);

            try {
                // 确保 calls 是数组且格式正确
                const result = await multicall.aggregate(calls);
                // 处理返回结果
                const batchResults = result && (result.results || (Array.isArray(result) ? result[1] : null));
                return batchResults.map((data, index) => {
                    try {
                        if (!data || data === "0x") {
                            console.error(`地址 ${batch[index]} 返回数据为空`);
                            return BigInt(0);
                        }
                        return tokenContract.decodeFunctionResult("balanceOf", data)[0];
                    } catch (error) {
                        console.error(`解码地址 ${batch[index]} 余额失败: ${error.message}`);
                        return BigInt(0);
                    }
                });
            } catch (error) {
                console.error(`批量查询失败: ${error.message}`);
                return batch.map(() => BigInt(0));
            }
        })
    );

    // 合并所有批次的查询结果
    return results.flat();
}

/**
 * 批量查询 ETH/BNB 余额（原生代币）
 */
async function getEthBalance(provider, walletAddresses) {
    const multicall = new ethers.Contract(
        MULTICALL3_ADDRESS,
        ["function aggregate((address,bytes)[]) view returns (uint256, bytes[])"],
        provider
    );

    const tokenContract = new ethers.Interface(["function getEthBalance(address) public view returns (uint256)"]);

    // 每批最多查询的地址数量
    const BATCH_SIZE = 300;
    const batches = [];

    // 将地址列表拆分为多个批次
    for (let i = 0; i < walletAddresses.length; i += BATCH_SIZE) {
        batches.push(walletAddresses.slice(i, i + BATCH_SIZE));
    }

    // 并行查询所有批次
    const results = await Promise.all(
        batches.map(async batch => {
            const calls = batch.map(address => [
                MULTICALL3_ADDRESS, // 使用 Multicall3 合约查询原生代币余额
                tokenContract.encodeFunctionData("getEthBalance", [address])
            ]);

            const [, batchResults] = await multicall.aggregate(calls);
            return batchResults.map((data, index) => {
                try {
                    // 解码原生代币余额（Multicall3 返回的是 uint256）
                    // return ethers.BigNumber.from(data);
                    return tokenContract.decodeFunctionResult("getEthBalance", data)[0];
                } catch (error) {
                    console.error(`解码地址 ${batch[index]} 原生代币余额失败: ${error.message}`);
                    return BigInt(0);
                }
            });
        })
    );

    // 合并所有批次的查询结果
    return results.flat();
}

/**
 * 计算 Token 价值（通过 quoteToken 的价格）
 */
async function getTokenSymbol(provider, tokenAddress) {
    const tokenContract = new ethers.Contract(
        tokenAddress,
        ["function symbol() view returns (string)"],
        provider
    );
    return await tokenContract.symbol();
}

async function calculateTokenValue(provider, quoteTokenAddress, tokenAddress, tokenAmount, config) {
    // 获取 quoteToken 的 symbol
    const quoteSymbol = await getTokenSymbol(provider, quoteTokenAddress);

    // 初始化路由合约
    const routerContract = new ethers.Contract(
        config.routerAddress,
        ["function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)"],
        provider
    );

    // 定义兑换路径
    const path = [tokenAddress, quoteTokenAddress];

    // 获取兑换价格
    const amounts = await routerContract.getAmountsOut(tokenAmount, path);
    const quoteTokenAmount = amounts[1];

    return {
        value: quoteTokenAmount,
        symbol: quoteSymbol
    };
}