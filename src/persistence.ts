import { InfluxDB, Point } from '@influxdata/influxdb-client';
import 'dotenv/config';
import fs from 'fs';
import { TokenPairPrices } from './index';

const url = process.env.INFLUXDB_URL;
const token = process.env.INFLUXDB_ADMIN_TOKEN;
const org = process.env.INFLUXDB_ORG;
const bucket = process.env.INFLUXDB_BUCKET;

const maxUInt64 = 2n ** 64n - 1n;

const toMaxUInt64 = (value: bigint, decimals: number) => {
  let valueUInt64 = value;
  let reducedDecimals = decimals;
  while (valueUInt64 > maxUInt64) {
    valueUInt64 = valueUInt64 / 10n;
    reducedDecimals--;
  }
  console.log(`Converted ${value} with ${decimals} decimals to ${valueUInt64} with ${reducedDecimals} decimals`);
  return { valueUInt64, reducedDecimals };
};

const persistToInflux = async (tokenPairPrices: TokenPairPrices) => {
  const writeApi = new InfluxDB({ url, token }).getWriteApi(org, bucket, 's');

  const uint64_1to2 = toMaxUInt64(tokenPairPrices.price1To2, tokenPairPrices.decimals2);
  const uint64_2to1 = toMaxUInt64(tokenPairPrices.price2To1, tokenPairPrices.decimals1);

  const pricePoint = new Point('price')
    .tag('symbol1', tokenPairPrices.symbol1)
    .tag('symbol2', tokenPairPrices.symbol2)
    .uintField('amount1', tokenPairPrices.amount1)
    .uintField('amount2', tokenPairPrices.amount2)
    .uintField('1to2', uint64_1to2.valueUInt64)
    .uintField('2to1', uint64_2to1.valueUInt64)
    .intField('1to2decimals', uint64_1to2.reducedDecimals)
    .intField('2to1decimals', uint64_2to1.reducedDecimals)
    .intField('decimals1_str', tokenPairPrices.decimals1)
    .intField('decimals2_str', tokenPairPrices.decimals2)
    .stringField('1to2_str', tokenPairPrices.price1To2.toString())
    .stringField('2to1_str', tokenPairPrices.price2To1.toString())
    .timestamp(tokenPairPrices.timestamp);

  writeApi.writePoint(pricePoint);
  await writeApi.flush();
  console.log(`Persisted ${tokenPairPrices.symbol1}-${tokenPairPrices.symbol2} to InfluxDB`);
};

const persistToFile = async (tokenPairPrices: TokenPairPrices) => {
  const timestamp = tokenPairPrices.timestamp;
  const year = timestamp.getUTCFullYear();
  let month = `0${timestamp.getUTCMonth() + 1}`;
  month = month.length > 2 ? month.substring(1) : month;
  let day = `0${timestamp.getUTCDate()}`;
  day = day.length > 2 ? day.substring(1) : day;

  const data = {
    unix: Math.floor(tokenPairPrices.timestamp.getTime() / 1000),
    iso: tokenPairPrices.timestamp.toISOString(),
    amount1: tokenPairPrices.amount1.toString(),
    amount2: tokenPairPrices.amount2.toString(),
    decimals1: tokenPairPrices.decimals1,
    decimals2: tokenPairPrices.decimals2,
    '1to2': tokenPairPrices.price1To2.toString(),
    '2to1': tokenPairPrices.price2To1.toString(),
  };

  const outputDir = (process.env.OUTPUT_DIR ?? './output') + `/${year}/${month}`;
  fs.mkdirSync(`${outputDir}`, { recursive: true });

  const outputFile = `${outputDir}/${tokenPairPrices.symbol1}-${tokenPairPrices.symbol2}_${year}-${month}-${day}.json`;

  if (!fs.existsSync(outputFile)) {
    fs.writeFileSync(outputFile, JSON.stringify([data]));
  } else {
    const file = fs.readFileSync(outputFile, 'utf8');
    const fileData = JSON.parse(file);
    fileData.push(data);
    fs.writeFileSync(outputFile, JSON.stringify(fileData), 'utf8');
  }
  console.log(`Persisted ${tokenPairPrices.symbol1}-${tokenPairPrices.symbol2} to ${outputFile}`);
};

const persist = async (tokenPairPrices: TokenPairPrices) => {
  await persistToFile(tokenPairPrices);
  if (process.env.INFLUXDB_URL) {
    try {
      await persistToInflux(tokenPairPrices);
    } catch (e) {
      console.error('Error persisting to InfluxDB', e);
    }
  }
};

export default persist;
