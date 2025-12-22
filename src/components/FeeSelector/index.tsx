import './FeeSelector.css';

import Big from 'big.js';
import classNames from 'classnames';
import Box from 'components/Box';
import Row from 'components/Row';
import Text from 'components/Text';
import _ from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import transferer from 'services/transfer/transferer';
import loggerFactory from 'services/util/logger-factory';
import { BridgeFee, IToken, SupportedChain } from 'types';

import { fetchTokenPriceData } from 'services/oracle';

const logger = loggerFactory.getLogger('[FeeSelector]');

type FeeSelectorProps = {
  fromChain: SupportedChain,
  toChain: SupportedChain,
  selectedToken: IToken,
  balance: string,
  amount: string,
  select: (fee: BridgeFee) => void,
  selectedFee?: BridgeFee
}

function getPriceDenom (selectedToken: IToken): string {
  if (selectedToken.erc20) {
    return selectedToken.erc20.priceDenom || selectedToken.erc20.symbol;
  } else if (selectedToken.cosmos) {
    return selectedToken.cosmos.priceDenom || selectedToken.cosmos.denom;
  }
  return '';
}

const FeeSelector: React.FC<FeeSelectorProps> = ({ fromChain, toChain, selectedToken, amount, balance, select, selectedFee }) => {
  const priceDenom = getPriceDenom(selectedToken);
  const [tokenPrice, setTokenPrice] = useState<string>('');
  const [manualPrice, setManualPrice] = useState<string>('');
  const [needsManualPrice, setNeedsManualPrice] = useState<boolean>(false);
  const [fees, setFees] = useState<BridgeFee[]>([]);
  const [priceLoading, setPriceLoading] = useState<boolean>(true);
  const [feesLoading, setFeesLoading] = useState<boolean>(true);
  const [feeError, setFeeError] = useState<string | null>(null);

  // Fetch token price on token change
  useEffect(() => {
    const fetchPrice = async (): Promise<void> => {
      setPriceLoading(true);
      setNeedsManualPrice(false);
      setManualPrice('');
      setFees([]);
      setFeeError(null);

      try {
        const tokenPriceData = await fetchTokenPriceData(selectedToken);

        if (tokenPriceData === null) {
          // No price data available - need manual entry
          setNeedsManualPrice(true);
          setTokenPrice('');
          setPriceLoading(false);
          setFeesLoading(false);
        } else {
          setTokenPrice(tokenPriceData.price.toString());
          setNeedsManualPrice(false);
          setPriceLoading(false);
          setFeesLoading(false);
        }
      } catch (error) {
        logger.error('Error fetching price:', error);
        setNeedsManualPrice(true);
        setPriceLoading(false);
        setFeesLoading(false);
      }
    };

    fetchPrice();
  }, [selectedToken]);

  // Fetch fees when we have a price (either from API or manual entry)
  useEffect(() => {
    const fetchFees = async (): Promise<void> => {
      const priceToUse = needsManualPrice ? manualPrice : tokenPrice;

      if (!priceToUse || parseFloat(priceToUse) <= 0) {
        setFees([]);
        setFeesLoading(false);
        setFeeError(null);
        return;
      }

      try {
        setFeesLoading(true);
        setFeeError(null);
        const fetchedFees = await transferer.getFees(fromChain, toChain, selectedToken, priceToUse);
        setFees(fetchedFees);
        setFeesLoading(false);
      } catch (error) {
        logger.error('Error fetching fees:', error);
        setFees([]);
        setFeesLoading(false);
        // Check if the error is related to wallet connection
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('wallet') || errorMessage.includes('gas price')) {
          setFeeError('Connect Ethereum wallet to calculate fees');
        } else {
          setFeeError('Error calculating fees');
        }
      }
    };

    if (!priceLoading) {
      fetchFees();
    }
  }, [fromChain, toChain, selectedToken, tokenPrice, manualPrice, needsManualPrice, priceLoading]);

  logger.info('denom:', priceDenom, 'Fees:', fees);

  useEffect(() => {
    if (selectedFee) {
      const fee = _.find(fees, { id: selectedFee.id });
      if (fee && !isSameFee(fee, selectedFee)) {
        select(fee);
      }
    } else if (!_.isEmpty(fees)) {
      select(fees[0]);
    }
  }, [fromChain, selectedToken, selectedFee, fees]);

  const onClickFee = useCallback((fee) => {
    logger.info('Selected Fee:', fee);
    select(fee);
  }, [select]);

  const onManualPriceChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (/^[0-9]*[.]?[0-9]*$/.test(value)) {
      setManualPrice(value);
    }
  }, []);

  const disableds: boolean[] = _.map(fees, (fee) => {
    try {
      return Big(fee.amount).add(amount || '0').gt(balance);
    } catch (error) {
      logger.error(error, fee);
      return true;
    }
  });

  const tokenSymbol = selectedToken.erc20?.symbol || selectedToken.cosmos?.symbol || '';

  return (
    <Box className="fee-selector-container" density={1} depth={1}>
      {needsManualPrice
        ? (
          <Row depth={1}>
            <div className="manual-price-container">
              <Text size="small" muted>Token Price (USD)</Text>
              <Text size="tiny" muted className="manual-price-hint">
                Price data unavailable for {tokenSymbol}. Please enter the current price.
              </Text>
              <div className="manual-price-input-wrapper">
                <span className="manual-price-prefix">$</span>
                <input
                  type="text"
                  className="manual-price-input"
                  value={manualPrice}
                  onChange={onManualPriceChange}
                  placeholder="0.00"
                  inputMode="decimal"
                  autoComplete="off"
                  autoCorrect="off"
                />
                <span className="manual-price-suffix">per {tokenSymbol}</span>
              </div>
            </div>
          </Row>
          )
        : <></>
      }
      <Row depth={1}>
        <div className="fee-selector-heading-container">
          <Text size="small" muted>Bridge Fee</Text>
        </div>
      </Row>
      <Row depth={1}>
        <div className="fee-selector-button-container">
          {priceLoading || feesLoading
            ? (
              <div className="loader"></div>
              )
            : needsManualPrice && (!manualPrice || parseFloat(manualPrice) <= 0)
              ? (
                <Text size="tiny" muted className="fee-selector-message">
                  Enter token price above to calculate fees
                </Text>
                )
              : feeError
                ? (
                  <Text size="tiny" muted className="fee-selector-message">
                    {feeError}
                  </Text>
                  )
                : fees.length === 0
                  ? (
                    <Text size="tiny" muted className="fee-selector-message">
                      Connect Ethereum wallet to calculate fees
                    </Text>
                    )
                  : (
                      fees.map((fee, i) => (
                        <button
                          key={fee.id}
                          className={classNames('fee-selector-fee-button', { selected: fee.id === selectedFee?.id })}
                          onClick={onClickFee.bind(null, fee)}
                          disabled={disableds[i]}
                        >
                          <Text size="tiny" className="fee-button-text" muted={disableds[i]}>
                            {fee.label}
                          </Text>
                          <Text size="tiny" className="fee-button-text" muted={disableds[i]}>
                            {fee.amount} {_.upperCase(fee.denom)}
                          </Text>
                          <Text size="tiny" className="fee-button-text" muted>
                            ${fee.amountInCurrency}
                          </Text>
                        </button>
                      ))
                    )}
        </div>
      </Row>
    </Box>
  );
};

function isSameFee (feeA: BridgeFee, feeB: BridgeFee): boolean {
  return _.join(_.values(feeA), ':') === _.join(_.values(feeB), ':');
}

export default FeeSelector;
