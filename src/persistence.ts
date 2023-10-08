import fs from 'fs';
import { TokenPairPrices } from './index';

const persist = (tokenPairPrices: TokenPairPrices) => {
  const timestamp = tokenPairPrices.timestamp;
  const year = timestamp.getUTCFullYear();
  const month = `0${timestamp.getUTCMonth()}`.substring(-2);
  const day = `0${timestamp.getUTCDate()}`.substring(-2);

  const outputDir = (process.env.OUTPUT_DIR ?? './output') + `/${year}/${month}`;
  fs.mkdirSync(`${outputDir}`, { recursive: true });

  const outputFile = `${outputDir}/${tokenPairPrices.symbol1}-${tokenPairPrices.symbol2}_${year}-${month}-${day}.json`;
  const data = {
    unix: Math.floor(timestamp.getTime() / 1000),
    iso: timestamp.toISOString(),
    amount1: tokenPairPrices.amount1.toString(),
    amount2: tokenPairPrices.amount2.toString(),
    decimals1: tokenPairPrices.decimals1,
    decimals2: tokenPairPrices.decimals2,
    '1to2': tokenPairPrices.price1To2.toString(),
    '2to1': tokenPairPrices.price2To1.toString(),
  };

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

export default persist;
