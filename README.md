# 功能概述

## 子命令说明

### 1. `generate`：生成助记词和地址
**功能**：
- 生成助记词（随机或指定）。
- 生成 Solana 或 EVM 地址。
- 支持导出地址和私钥到 CSV 文件。

**参数**：
- `-m, --mnemonic <string>`：指定助记词。
- `-g, --generate`：随机生成一个新的 24 词助记词。
- `-n, --number <number>`：生成的地址数量（默认 10）。
- `-t, --time <hours>`：时间范围（小时），用于在未来随机时间点生成地址。
- `-f, --file <string>`：导出地址和私钥到 CSV 文件。
- `-T, --type <string>`：地址类型（`sol` 或 `evm`，默认为 `sol`）。

---

### 2. `trade`：执行交易功能
**功能**：
- 在 EVM 链上执行交易。

**参数**：
- `--config <path>`：交易配置文件路径（必填）。
- `--file <path>`：地址 CSV 文件路径（必填）。
- `--start-address <address>`：起始交易地址（必填）。
- `-T, --type <string>`：地址类型（仅支持 `evm`）。

---

### 3. `collect`：资金归集功能
**功能**：
- 在 EVM 链上归集资金。

**参数**：
- `--config <path>`：交易配置文件路径（必填）。
- `--file <path>`：地址 CSV 文件路径（必填）。
- `-T, --type <string>`：地址类型（仅支持 `evm`）。

## 技术栈
- **助记词处理**：`bip39`
- **Solana 地址生成**：`@solana/web3.js` + `ed25519-hd-key`
- **EVM 地址生成**：`@ethereumjs/wallet`
- **命令行解析**：`commander`

## 运行环境
- Node.js 18.0.0+
- Yarn 4.5.2+

## 命令示例
```bash
# 生成 Solana 地址
yarn start generate -g -n 10 -f sol_addresses.csv -T sol

# 生成 EVM 地址
yarn start generate -m "your mnemonic" -n 5 -f evm_addresses.csv -T evm

# 执行 EVM 交易
yarn start trade --config trade_config.json --file evm_addresses.csv --start-address 0x123...

# 归集 EVM 资金
yarn start collect --config collect_config.json --file evm_addresses.csv
```