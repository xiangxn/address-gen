import { ethers } from "ethers";
import fs from "fs";

// 购买Token函数
async function buyToken(wallet, bnbAmount, config) {
    const routerContract = new ethers.Contract(
        config.routerAddress,
        [
            "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)"
        ],
        wallet
    );

    const path = [
        config.quoteTokenAddress, // 结算token地址
        config.tokenAddress
    ];

    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20分钟后过期

    const tx = await routerContract.swapExactETHForTokens(
        0, // 最小输出Token数量
        path,
        wallet.address,
        deadline,
        { value: bnbAmount }
    );

    return tx;
}

// 卖出Token函数
async function sellToken(wallet, tokenAmount, config) {
    const routerContract = new ethers.Contract(
        config.routerAddress,
        [
            "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
        ],
        wallet
    );

    const tokenContract = new ethers.Contract(
        config.tokenAddress,
        [
            "function approve(address spender, uint256 amount) returns (bool)",
            "function allowance(address owner, address spender) public view override returns (uint256)"
        ],
        wallet
    );

    // 授权路由合约使用Token
    const approveTx = await tokenContract.approve(config.routerAddress, tokenAmount);
    await approveTx.wait();
    console.info(`授权成功: ${approveTx.hash}`);

    // 检查授权是否成功
    const allowance = await tokenContract.allowance(wallet.address, config.routerAddress);
    if (allowance < tokenAmount) {
        throw new Error(`授权额度不足: ${ethers.formatEther(allowance)} < ${ethers.formatEther(tokenAmount)}`);
    }

    const path = [
        config.tokenAddress,
        config.quoteTokenAddress // 结算token地址
    ];

    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20分钟后过期

    // 获取动态 Gas 费用
    const feeData = await wallet.provider.getFeeData();
    const tx = await routerContract.swapExactTokensForETH(
        tokenAmount,
        0, // 最小输出BNB数量
        path,
        wallet.address,
        deadline,
        { gasPrice: feeData.gasPrice }
    );

    return tx;
}

async function applyFunding(prevAddress, currentAddress, provider, config) {
    if (!prevAddress) return 0;
    try {
        // 没有BNB余额，从前一个地址转入
        const prevWallet = new ethers.Wallet(prevAddress.privateKey, provider);
        const [prevBalance, feeData] = await Promise.all([provider.getBalance(prevAddress.address), provider.getFeeData()]);

        // 检查前一个地址的BNB余额是否足够
        if (prevBalance <= ethers.parseEther(config.minBnbBalance)) {
            console.log(`前一个地址 ${prevAddress.address} BNB余额不足 ${config.minBnbBalance}, 停止交易`);
            return -1;
        }

        // 扣除Gas后全额转入
        const gasPrice = feeData.gasPrice;
        const gasLimit = BigInt(21000);
        const gasCost = gasPrice * gasLimit;
        const amount = prevBalance - gasCost;

        if (amount > BigInt(0)) {
            const tx = {
                to: currentAddress.address,
                value: amount,
                gasLimit,
                gasPrice
            };
            const txResponse = await prevWallet.sendTransaction(tx);
            await txResponse.wait();
            console.info(`转入BNB成功: ${txResponse.hash}`);
        } else {
            return -1;
        }
    } catch (error) {
        console.error(`转入BNB失败: ${error.message}`);
        return -2;
    }
    return 1;
}

export async function startEvmTrading(configPath, addressCSV, startAddress) {
    let lastAddressIndex = null;
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

    // 初始化Provider
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);

    // 找到起始地址
    let currentIndex = addresses.findIndex(addr => addr.address === startAddress);
    if (currentIndex === -1) {
        throw new Error(`起始地址 ${startAddress} 未找到`);
    }

    // 交易循环
    while (currentIndex < addresses.length) {
        const currentAddress = addresses[currentIndex];
        let bnbBalance, tokenBalance, tokenContract, wallet

        try {
            wallet = new ethers.Wallet(currentAddress.privateKey, provider);
            // 查询Token余额
            tokenContract = new ethers.Contract(
                config.tokenAddress,
                ["function balanceOf(address) view returns (uint256)"],
                provider
            );

            // 查询BNB余额/Token余额
            [bnbBalance, tokenBalance] = await Promise.all([
                provider.getBalance(currentAddress.address),
                tokenContract.balanceOf(currentAddress.address)
            ]);
            console.warn(`地址 ${currentAddress.address} BNB余额: ${ethers.formatEther(bnbBalance)}, Token余额: ${ethers.formatEther(tokenBalance)}`);
        } catch (error) {
            console.error(`查询余额失败: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, 5 * 1000));
            continue;
        }
        // if (tokenBalance > BigInt(0) && tokenBalance <= ethers.parseEther(config.minTokenBalance)) {
        //     // 如果token余额大于0，小于等于配置值，就跳过
        //     currentIndex = Math.floor(Math.random() * addresses.length);
        //     console.log(`地址 ${currentAddress.address} Token余额进入最小保留区间 ${config.minTokenBalance}, 跳过`);
        //     await new Promise(resolve => setTimeout(resolve, 1000));
        //     continue;
        // }

        // 如果是起始地址且BNB余额小于等于配置值，就退出
        if (bnbBalance <= ethers.parseEther(config.minBnbBalance)) {
            if (lastAddressIndex === null) {
                console.log(`地址 ${currentAddress.address} BNB余额不足 ${config.minBnbBalance}, 停止交易`);
                break;
            }
        }
        if (tokenBalance === BigInt(0) || tokenBalance < ethers.parseEther(config.minTokenBalance)) {
            // 有BNB但没有Token，随机购买Token
            const amount = ethers.parseEther(
                (Math.random() * (config.amountRange[1] - config.amountRange[0]) + config.amountRange[0]).toFixed(10)
            );

            try {
                let flag = await applyFunding(addresses[lastAddressIndex], currentAddress, provider, config);
                if (flag === -1) {
                    break;
                } else if (flag === -2) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                } else if (flag === 1) {
                    lastAddressIndex = currentIndex;
                } else {
                    if (lastAddressIndex === null) {
                        lastAddressIndex = currentIndex;
                    }
                }

                const txResponse = await buyToken(wallet, amount, config);
                console.info(`购买Token ${ethers.formatEther(amount)} 成功: ${txResponse.hash}`);
            } catch (error) {
                console.error(`购买Token失败: ${error.message}`);
            }
        } else {
            // 两者都有，随机保留Token并卖出其余
            const keepAmount = ethers.parseEther(
                (Math.random() * (config.balanceRange[1] - config.balanceRange[0]) + config.balanceRange[0]).toFixed(10)
            );

            if (keepAmount > tokenBalance) {
                // 保留值大于余额，不交易
                if (bnbBalance > BigInt(0)) {
                    lastAddressIndex = currentIndex;
                }
                console.log(`保留值 ${ethers.formatEther(keepAmount)} 大于余额 ${ethers.formatEther(tokenBalance)}, 不交易`);
            } else if (keepAmount === BigInt(0)) {
                // 如果保留值为0, 全部卖出
                const sellAmount = tokenBalance;
                try {
                    let flag = await applyFunding(addresses[lastAddressIndex], currentAddress, provider, config);
                    if (flag === -1) {
                        break;
                    } else if (flag === -2) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        continue;
                    } else if (flag === 1) {
                        lastAddressIndex = currentIndex;
                    } else {
                        if (lastAddressIndex === null) {
                            lastAddressIndex = currentIndex;
                        }
                    }
                    const txResponse = await sellToken(wallet, sellAmount);
                    console.info(`全部卖出Token ${ethers.formatEther(sellAmount)} 成功: ${txResponse.hash}`);
                } catch (error) {
                    console.error(`卖出Token失败: ${error.message}`);
                }
            } else {
                // 保留部分，卖出其余
                const sellAmount = tokenBalance - keepAmount;
                try {
                    let flag = await applyFunding(addresses[lastAddressIndex], currentAddress, provider, config);
                    if (flag === -1) {
                        break;
                    } else if (flag === -2) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        continue;
                    } else if (flag === 1) {
                        lastAddressIndex = currentIndex;
                    } else {
                        if (lastAddressIndex === null) {
                            lastAddressIndex = currentIndex;
                        }
                    }
                    const txResponse = await sellToken(wallet, sellAmount, config);
                    console.info(`部分卖出Token ${ethers.formatEther(sellAmount)} 成功: ${txResponse.hash}`);
                } catch (error) {
                    console.error(`卖出Token失败: ${error.message}`);
                }
            }
        }

        // 随机选择下一个地址
        currentIndex = Math.floor(Math.random() * addresses.length);

        // 添加交易间隔（从区间中随机选择）
        const randomInterval = Math.floor(Math.random() * (config.interval[1] - config.interval[0] + 1)) + config.interval[0];
        console.log(`交易完成，等待 ${randomInterval} 秒...`);
        await new Promise(resolve => setTimeout(resolve, randomInterval * 1000));
    }
}

export async function collectEvmFunds(configPath, addressCSV) {
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

    const provider = new ethers.JsonRpcProvider(config.rpcUrl);

    for (const addr of addresses) {
        try {
            const wallet = new ethers.Wallet(addr.privateKey, provider);
            const [balance, feeData] = await Promise.all([provider.getBalance(addr.address), provider.getFeeData()]);

            if (balance === BigInt(0)) {
                const gasPrice = feeData.gasPrice;
                const gasLimit = BigInt(21000);
                const gasCost = gasPrice * gasLimit;
                const amount = balance - gasCost;

                if (amount > BigInt(0)) {
                    const tx = {
                        to: config.receiverAddress,
                        value: amount,
                        gasLimit: gasLimit,
                        gasPrice: gasPrice
                    };
                    const txResponse = await wallet.sendTransaction(tx);
                    await txResponse.wait();
                    console.log(`归集成功: ${addr.address} -> ${txResponse.hash}`);
                }
            }
        } catch (error) {
            console.error(`归集失败: ${addr.address} - ${error.message}`);
        }
    }
}