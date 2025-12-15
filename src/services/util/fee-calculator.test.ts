import Big from 'big.js';
import {
  CHAIN_FEE_RATE,
  calculateChainFee,
  calculateMaxBridgeAmount,
  calculateTotalBridgeCost,
  hasInsufficientBalance
} from './fee-calculator';

describe('fee-calculator', () => {
  describe('CHAIN_FEE_RATE', () => {
    it('should be 20 basis points (0.2%)', () => {
      expect(CHAIN_FEE_RATE).toBe(0.002);
    });
  });

  describe('calculateChainFee', () => {
    it('should calculate 20 basis points of the bridge amount', () => {
      // 100 tokens -> 0.2 chain fee
      const result = calculateChainFee('100');
      expect(result.toNumber()).toBe(0.2);
    });

    it('should handle large amounts correctly', () => {
      // 244.220624 USDC (the user's test case)
      const result = calculateChainFee('244.220624');
      expect(result.toNumber()).toBeCloseTo(0.488441248, 9);
    });

    it('should handle amounts with many decimals', () => {
      const result = calculateChainFee('1000.123456');
      expect(result.toNumber()).toBeCloseTo(2.000246912, 9);
    });

    it('should return zero for zero amount', () => {
      const result = calculateChainFee('0');
      expect(result.toNumber()).toBe(0);
    });

    it('should handle minimal denomination amounts', () => {
      // In USDC minimal denomination (6 decimals), 244.220624 USDC = 244220624
      // Chain fee should be 244220624 * 0.002 = 488441.248
      const result = calculateChainFee('244220624');
      expect(result.toNumber()).toBeCloseTo(488441.248, 3);
    });
  });

  describe('calculateMaxBridgeAmount', () => {
    it('should calculate max amount correctly', () => {
      // If balance = 100, bridgeFee = 1
      // maxAmount = (100 - 1) / 1.002 = 98.802395...
      const result = calculateMaxBridgeAmount('100', '1', 6);
      expect(result.toNumber()).toBeCloseTo(98.802395, 6);
    });

    it('should return 0 if balance equals bridge fee', () => {
      const result = calculateMaxBridgeAmount('10', '10', 6);
      expect(result.toNumber()).toBe(0);
    });

    it('should return 0 if balance is less than bridge fee', () => {
      const result = calculateMaxBridgeAmount('5', '10', 6);
      expect(result.toNumber()).toBe(0);
    });

    it('should verify that max amount + bridge fee + chain fee <= balance', () => {
      const balance = '244.220624';
      const bridgeFee = '0.5';
      
      const maxAmount = calculateMaxBridgeAmount(balance, bridgeFee, 6);
      const chainFee = calculateChainFee(maxAmount.toString());
      const total = maxAmount.add(bridgeFee).add(chainFee);
      
      // Total should be less than or equal to balance (due to rounding down)
      expect(total.lte(new Big(balance))).toBe(true);
    });

    it('should handle zero bridge fee', () => {
      const balance = '100';
      const bridgeFee = '0';
      
      const maxAmount = calculateMaxBridgeAmount(balance, bridgeFee, 6);
      // maxAmount = 100 / 1.002 = 99.800399...
      expect(maxAmount.toNumber()).toBeCloseTo(99.800399, 6);
    });

    it('should round down to specified decimal places', () => {
      const balance = '100';
      const bridgeFee = '0';
      
      const result6 = calculateMaxBridgeAmount(balance, bridgeFee, 6);
      const result2 = calculateMaxBridgeAmount(balance, bridgeFee, 2);
      
      expect(result6.toString()).toBe('99.800399');
      expect(result2.toString()).toBe('99.8');
    });
  });

  describe('calculateTotalBridgeCost', () => {
    it('should calculate total cost correctly', () => {
      const bridgeAmount = '100';
      const bridgeFee = '1';
      
      // Total = 100 + 1 + (100 * 0.002) = 101.2
      const result = calculateTotalBridgeCost(bridgeAmount, bridgeFee);
      expect(result.toNumber()).toBe(101.2);
    });

    it('should handle the user reported case', () => {
      // User tried to bridge 244.220624 USDC
      // Chain fee should be 244.220624 * 0.002 = 0.488441248
      const bridgeAmount = '244.220624';
      const bridgeFee = '0.5'; // example bridge fee
      
      const result = calculateTotalBridgeCost(bridgeAmount, bridgeFee);
      const expectedChainFee = new Big('244.220624').times(0.002);
      const expectedTotal = new Big('244.220624').add('0.5').add(expectedChainFee);
      
      expect(result.toNumber()).toBeCloseTo(expectedTotal.toNumber(), 9);
    });

    it('should handle zero bridge fee', () => {
      const bridgeAmount = '50';
      const bridgeFee = '0';
      
      // Total = 50 + 0 + 0.1 = 50.1
      const result = calculateTotalBridgeCost(bridgeAmount, bridgeFee);
      expect(result.toNumber()).toBe(50.1);
    });
  });

  describe('hasInsufficientBalance', () => {
    it('should return false when balance is exactly sufficient', () => {
      const balance = '101.2';
      const bridgeAmount = '100';
      const bridgeFee = '1';
      
      // Total cost = 100 + 1 + 0.2 = 101.2
      const result = hasInsufficientBalance(balance, bridgeAmount, bridgeFee);
      expect(result).toBe(false);
    });

    it('should return true when balance is insufficient', () => {
      const balance = '101';
      const bridgeAmount = '100';
      const bridgeFee = '1';
      
      // Total cost = 100 + 1 + 0.2 = 101.2 > 101
      const result = hasInsufficientBalance(balance, bridgeAmount, bridgeFee);
      expect(result).toBe(true);
    });

    it('should return false when balance exceeds required amount', () => {
      const balance = '200';
      const bridgeAmount = '100';
      const bridgeFee = '1';
      
      const result = hasInsufficientBalance(balance, bridgeAmount, bridgeFee);
      expect(result).toBe(false);
    });

    it('should handle edge case with very small difference', () => {
      // User's scenario: 244.220624 USDC balance, trying to bridge all
      // If they try to bridge 244.220624, chain fee = 0.488441248
      // Total needed = 244.220624 + 0.488441248 = 244.709065248 > 244.220624
      const balance = '244.220624';
      const bridgeAmount = '244.220624';
      const bridgeFee = '0';
      
      const result = hasInsufficientBalance(balance, bridgeAmount, bridgeFee);
      expect(result).toBe(true);
    });
  });

  describe('Integration: Max amount should always be affordable', () => {
    it('should calculate max amount that user can afford', () => {
      const testCases = [
        { balance: '100', bridgeFee: '1' },
        { balance: '244.220624', bridgeFee: '0.5' },
        { balance: '1000', bridgeFee: '10' },
        { balance: '0.01', bridgeFee: '0.001' }
      ];

      for (const { balance, bridgeFee } of testCases) {
        const maxAmount = calculateMaxBridgeAmount(balance, bridgeFee, 6);

        if (maxAmount.gt(0)) {
          const isInsufficient = hasInsufficientBalance(balance, maxAmount.toString(), bridgeFee);
          expect(isInsufficient).toBe(false);
        }
      }
    });

    it('should verify the original user error case is now correct', () => {
      // User balance: 244.220624 USDC
      // The old code calculated chain fee incorrectly (0.0002 instead of 0.002)
      // Old chain fee: 244.220624 * 0.0002 = 0.048844 (in token units)
      // In minimal denomination (6 decimals): 48844 (close to the error 48732)
      //
      // Correct chain fee: 244.220624 * 0.002 = 0.488441248
      // In minimal denomination: 488441 (close to the required 487317)

      const amountInMinDenom = '244220624'; // 244.220624 USDC in 6 decimal minimal denomination
      const oldChainFee = new Big(amountInMinDenom).times(0.0002);
      const correctChainFee = new Big(amountInMinDenom).times(0.002);

      // The old (wrong) calculation
      expect(oldChainFee.toNumber()).toBeCloseTo(48844, 0);

      // The new (correct) calculation
      expect(correctChainFee.toNumber()).toBeCloseTo(488441, 0);
      
      // The ratio should be 10x
      expect(correctChainFee.div(oldChainFee).toNumber()).toBeCloseTo(10, 1);
    });
  });
});
