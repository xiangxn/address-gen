# 功能概述
## 命令行参数解析：
使用 commander 库解析命令行参数。
支持以下选项：
- -m, --mnemonic ：指定助记词。
- -g, --generate ：随机生成一个新的 24 词助记词。
- -n, --number ：指定生成的地址数量（默认 10）。
- -t, --time ：指定时间范围（小时），用于在未来随机时间点生成地址。
- -f, --file ：导出地址和私钥到 CSV 文件。
- -T, --type ：指定地址类型（sol/evm，默认为 sol）。

## 助记词处理：
如果用户指定 --generate ，则使用 bip39 库生成一个新的 24 词助记词。
验证助记词的有效性（ bip39.validateMnemonic ）。

## 地址生成逻辑：
- Solana 地址：
  - 如果指定了 --time ，则生成未来随机时间点的地址（通过 setTimeout 实现）。
  - 如果未指定 --time ，则一次性生成所有地址。
  - 使用 ed25519-hd-key 派生路径，路径格式为 `m/44'/501'/{i}'/0'`。
  - 使用 @solana/web3.js 生成 Solana 钱包地址。

- EVM 地址：
  - 如果指定了 --time ，则生成未来随机时间点的地址（通过 setTimeout 实现）。
  - 如果未指定 --time ，则一次性生成所有地址。
  - 使用 @ethereumjs/wallet 的 hdkey 派生路径，路径格式为 `m/44'/60'/0'/0/{i}`。

## 导出功能：
支持通过 --file 参数将生成的地址和私钥导出为 CSV 文件，格式为 `Address,Private Key`。

## 技术栈：
- 使用 bip39 处理助记词。
- 使用 ed25519-hd-key 派生 Solana 地址路径。
- 使用 @solana/web3.js 生成 Solana 钱包地址。
- 使用 @ethereumjs/wallet 生成 EVM 地址。

## 运行环境:
- 安装nodejs 18.0.0+。
- 安装yarn 4.5.2+。
- 运行 yarn install 安装依赖。
- 运行 yarn start 启动程序。

## 命令例子:
```
yarn start -g -n 10 -f 234.csv -T sol
```