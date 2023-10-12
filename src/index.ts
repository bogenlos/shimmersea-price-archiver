import axios from 'axios';
import Big from 'big.js';
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

const getTimestampWithoutSeconds = () => {
  const timestamp = new Date();
  timestamp.setSeconds(0, 0);
  return timestamp;
};

const printTokenPairPrices = (tokenPairPrices: TokenPairPrices) => {
  console.log(`${tokenPairPrices.timestamp.toUTCString()}`);
  console.log(
    `${tokenPairPrices.amount1} ${tokenPairPrices.symbol1} = ${Big(tokenPairPrices.price1To2.toString())
      .div(Big(10).pow(tokenPairPrices.decimals2))
      .toFixed(tokenPairPrices.decimals2)} ${tokenPairPrices.symbol2}`,
  );
  console.log(
    `${tokenPairPrices.amount2} ${tokenPairPrices.symbol2} = ${Big(tokenPairPrices.price2To1.toString())
      .div(Big(10).pow(tokenPairPrices.decimals1))
      .toFixed(tokenPairPrices.decimals1)} ${tokenPairPrices.symbol1}`,
  );
  console.log('----------');
};

const readSmrUsdPrice = async (timestamp: Date) => {
  try {
    const response = await axios.get<undefined, { data: { mid: number; timestamp: number } }>(
      'https://api.bitfinex.com/v1/pubticker/smrusd',
    );
    const tokenPairPrices = {
      timestamp,
      symbol1: 'SMR',
      symbol2: 'USD',
      amount1: 1n,
      amount2: 1n,
      decimals1: 6,
      decimals2: 6,
      price1To2: BigInt(
        Big(response.data.mid.toString())
          .mul(10 ** 6)
          .toFixed(0),
      ),
      price2To1: BigInt(
        Big(1)
          .div(Big(response.data.mid.toString()))
          .mul(10 ** 6)
          .toFixed(0),
      ),
    };
    await persist(tokenPairPrices);
    printTokenPairPrices(tokenPairPrices);
  } catch (e) {
    console.error('Error fetching smr/usd from ', e);
  }
};

const readTokenPairPrices = async (timestamp: Date) => {
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
      timestamp,
      symbol1: token1.symbol,
      symbol2: token2.symbol,
      amount1: BigInt(token1.amount),
      amount2: BigInt(token2.amount),
      decimals1: token1.decimals,
      decimals2: token2.decimals,
      price1To2: token1ToToken2[1],
      price2To1: token2ToToken1[1],
    };
    await persist(tokenPairPrices);
    printTokenPairPrices(tokenPairPrices);
  }
};

const cronExpression = process.env.CRON ?? '*/10 * * * *';
cron.schedule(cronExpression, async () => {
  const timestamp = getTimestampWithoutSeconds();
  await Promise.all([readSmrUsdPrice(timestamp), readTokenPairPrices(timestamp)]);
});

console.log('Running with config:');
console.log(`  CRON: ${cronExpression}`);
console.log(`  OUTPUT_DIR ${process.env.OUTPUT_DIR ?? './output'}`);
console.log('----------');

(async () => {
  const timestamp = getTimestampWithoutSeconds();
  await Promise.all([readSmrUsdPrice(timestamp), readTokenPairPrices(timestamp)]);
})();
