import Big from 'big.js';

/**
 * Chain fee rate for Gravity Bridge: 20 basis points (0.2%)
 */
export const CHAIN_FEE_RATE = 0.002;

/**
 * Calculates the chain fee for a given bridge amount.
 * Chain fee is 20 basis points (0.2%) of the bridged amount.
 *
 * @param bridgeAmount - The amount being bridged (in token units)
 * @returns The chain fee amount
 */
export function calculateChainFee (bridgeAmount: string | number): Big {
  return new Big(bridgeAmount).times(CHAIN_FEE_RATE);
}

/**
 * Calculates the maximum amount that can be bridged given a balance and bridge fee.
 *
 * The relationship is:
 *   balance = bridgeAmount + bridgeFee + chainFee
 *   chainFee = bridgeAmount * CHAIN_FEE_RATE
 *
 * Solving for bridgeAmount:
 *   balance = bridgeAmount + bridgeFee + (bridgeAmount * CHAIN_FEE_RATE)
 *   balance - bridgeFee = bridgeAmount * (1 + CHAIN_FEE_RATE)
 *   bridgeAmount = (balance - bridgeFee) / (1 + CHAIN_FEE_RATE)
 *
 * @param balance - The user's token balance
 * @param bridgeFee - The selected bridge fee amount (Ethereum relay fee)
 * @param decimals - Number of decimal places to round to (default: 6)
 * @returns The maximum bridge amount
 */
export function calculateMaxBridgeAmount (
  balance: string | number,
  bridgeFee: string | number,
  decimals = 6
): Big {
  const availableForBridge = new Big(balance).sub(bridgeFee);
  if (availableForBridge.lte(0)) {
    return new Big(0);
  }
  return availableForBridge.div(1 + CHAIN_FEE_RATE).round(decimals, Big.roundDown);
}

/**
 * Calculates the total cost of a bridge transaction.
 * Total = bridgeAmount + bridgeFee + chainFee
 *
 * @param bridgeAmount - The amount being bridged
 * @param bridgeFee - The bridge fee amount
 * @returns The total cost
 */
export function calculateTotalBridgeCost (
  bridgeAmount: string | number,
  bridgeFee: string | number
): Big {
  const amount = new Big(bridgeAmount);
  const fee = new Big(bridgeFee);
  const chainFee = calculateChainFee(bridgeAmount);
  return amount.add(fee).add(chainFee);
}

/**
 * Validates that a user has sufficient balance for a bridge transaction.
 *
 * @param balance - The user's token balance
 * @param bridgeAmount - The amount being bridged
 * @param bridgeFee - The bridge fee amount
 * @returns True if balance is sufficient, false otherwise
 */
export function hasInsufficientBalance (
  balance: string | number,
  bridgeAmount: string | number,
  bridgeFee: string | number
): boolean {
  const totalCost = calculateTotalBridgeCost(bridgeAmount, bridgeFee);
  return new Big(balance).lt(totalCost);
}

export default {
  CHAIN_FEE_RATE,
  calculateChainFee,
  calculateMaxBridgeAmount,
  calculateTotalBridgeCost,
  hasInsufficientBalance
};
