import 'dotenv/config';
import { Contract, JsonRpcProvider } from 'ethers';
import cron from 'node-cron';
import config from './config.json';
import persist from './persistence';
import shimmerSeaRouterAbi from './shimmerSeaRouterAbi.json';

export interface TokenPairPrices {
  timestamp: Date;
  symbol1: string;
  symbol2: string;
  amount1: bigint;
  amount2: bigint;
  decimals1: number;
  decimals2: number;
  price1To2: bigint;
  price2To1: bigint;
}

const RPC_ENDPOINT = 'https://json-rpc.evm.shimmer.network';
const SHIMMER_SEA_ROUTER_ADDRESS = '0x3EdAFd0258F75E0F49d570B1b28a1F7A042bcEC3';

const getEtherumContractProvider = async () => {
  const jsonRpcProvider = new JsonRpcProvider(RPC_ENDPOINT);
  const shimmerSeaRouterContract = new Contract(SHIMMER_SEA_ROUTER_ADDRESS, shimmerSeaRouterAbi, jsonRpcProvider);
  const getAmountsOut = shimmerSeaRouterContract.getFunction('getAmountsOut');

  for (const { token1, token2 } of config.tokensPairs) {
    const token1ToToken2 = await getAmountsOut.call(getAmountsOut, BigInt(token1.amount) * 10n ** BigInt(token1.decimals), [
      token1.address,
      token2.address,
    ]);
    const token2ToToken1 = await getAmountsOut.call(getAmountsOut, BigInt(token2.amount) * 10n ** BigInt(token2.decimals), [
      token2.address,
      token1.address,
    ]);

    const tokenPairPrices = {
      timestamp: new Date(),
      symbol1: token1.symbol,
      symbol2: token2.symbol,
      amount1: BigInt(token1.amount),
      amount2: BigInt(token2.amount),
      decimals1: token1.decimals,
      decimals2: token2.decimals,
      price1To2: token1ToToken2[1],
      price2To1: token2ToToken1[1],
    };
    persist(tokenPairPrices);

    console.log(`${tokenPairPrices.timestamp.toUTCString()}`);
    console.log(`${token1.amount.toString()} ${token1.symbol} = ${token1ToToken2[1].toString()} ${token2.symbol}`);
    console.log(`${token2.amount.toString()} ${token2.symbol} = ${token2ToToken1[1].toString()} ${token1.symbol}`);
    console.log('----------');
  }
};

const cronExpression = process.env.CRON ?? '*/10 * * * *';
cron.schedule(cronExpression, async () => {
  await getEtherumContractProvider();
});

console.log('Running with config:');
console.log(`  CRON: ${cronExpression}`);
console.log(`  OUTPUT_DIR ${process.env.OUTPUT_DIR ?? './output'}`);
console.log('----------');

(async () => {
  await getEtherumContractProvider();
})();
