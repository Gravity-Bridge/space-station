import axios from 'axios';
import { IToken } from 'types';

type FetchTokenPriceDataResponse = {
  price: number;
} | null;

// API response type - using snake_case to match API
interface TokenMetadata {
  symbol: string;
  // eslint-disable-next-line camelcase
  exchange_rate: number;
}

/**
 * Fetches token price data from the Gravity Chain Info API.
 * Returns null if the token price is not available.
 *
 * @param token - The token to fetch price data for
 * @returns The token price data or null if not available
 */
export const fetchTokenPriceData = async (token: IToken): Promise<FetchTokenPriceDataResponse> => {
  let symbol: string | undefined;

  if (token.erc20) {
    symbol = token.erc20.symbol;
  } else if (token.cosmos) {
    symbol = token.cosmos.symbol;
  }

  if (!symbol) {
    return null;
  }

  try {
    const response = await axios.get('https://info.gravitychain.io:9000/erc20_metadata');
    const data = response.data as TokenMetadata[];

    let tokenData: TokenMetadata | undefined;

    if (symbol === 'USDC') {
      // USDC has multiple entries, choose the second one
      const usdcData = data.filter((item) => item.symbol === 'USDC');
      tokenData = usdcData[1];
    } else {
      tokenData = data.find((item) => item.symbol === symbol);
    }

    if (!tokenData) {
      // Token not found in Gravity Chain API
      return null;
    }

    const price = tokenData.exchange_rate / 1e6; // Convert to USD

    // Validate the price is a valid positive number
    if (isNaN(price) || price <= 0) {
      return null;
    }

    return { price };
  } catch (error) {
    // API error - return null to allow manual price entry
    return null;
  }
};

/**
 * Checks if a token has price data available from the Gravity Chain API.
 *
 * @param token - The token to check
 * @returns True if price data is available, false otherwise
 */
export const hasTokenPriceData = async (token: IToken): Promise<boolean> => {
  const priceData = await fetchTokenPriceData(token);
  return priceData !== null;
};
