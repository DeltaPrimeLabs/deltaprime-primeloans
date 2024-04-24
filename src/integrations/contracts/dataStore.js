import { BigNumber } from "ethers";

import { ethers } from "ethers";

export function hashData(dataTypes, dataValues) {
  const bytes = ethers.utils.defaultAbiCoder.encode(dataTypes, dataValues);
  const hash = ethers.utils.keccak256(ethers.utils.arrayify(bytes));

  return hash;
}

export function hashString(string) {
  return hashData(["string"], [string]);
}


export const POSITION_IMPACT_FACTOR_KEY = hashString("POSITION_IMPACT_FACTOR");
export const MAX_POSITION_IMPACT_FACTOR_KEY = hashString("MAX_POSITION_IMPACT_FACTOR");
export const POSITION_IMPACT_EXPONENT_FACTOR_KEY = hashString("POSITION_IMPACT_EXPONENT_FACTOR");
export const POSITION_FEE_FACTOR_KEY = hashString("POSITION_FEE_FACTOR");
export const SWAP_IMPACT_FACTOR_KEY = hashString("SWAP_IMPACT_FACTOR");
export const SWAP_IMPACT_EXPONENT_FACTOR_KEY = hashString("SWAP_IMPACT_EXPONENT_FACTOR");
export const SWAP_FEE_FACTOR_KEY = hashString("SWAP_FEE_FACTOR");
export const FEE_RECEIVER_DEPOSIT_FACTOR_KEY = hashString("FEE_RECEIVER_DEPOSIT_FACTOR");
export const BORROWING_FEE_RECEIVER_FACTOR_KEY = hashString("BORROWING_FEE_RECEIVER_FACTOR");
export const FEE_RECEIVER_WITHDRAWAL_FACTOR_KEY = hashString("FEE_RECEIVER_WITHDRAWAL_FACTOR");
export const FEE_RECEIVER_SWAP_FACTOR_KEY = hashString("FEE_RECEIVER_SWAP_FACTOR");
export const FEE_RECEIVER_POSITION_FACTOR_KEY = hashString("FEE_RECEIVER_POSITION_FACTOR");
export const OPEN_INTEREST_KEY = hashString("OPEN_INTEREST");
export const OPEN_INTEREST_IN_TOKENS_KEY = hashString("OPEN_INTEREST_IN_TOKENS");
export const POOL_AMOUNT_KEY = hashString("POOL_AMOUNT");
export const MAX_POOL_AMOUNT_FOR_DEPOSIT_KEY = hashString("MAX_POOL_AMOUNT_FOR_DEPOSIT");
export const MAX_POOL_AMOUNT_KEY = hashString("MAX_POOL_AMOUNT");
export const RESERVE_FACTOR_KEY = hashString("RESERVE_FACTOR");
export const OPEN_INTEREST_RESERVE_FACTOR_KEY = hashString("OPEN_INTEREST_RESERVE_FACTOR");
export const NONCE_KEY = hashString("NONCE");
export const BORROWING_FACTOR_KEY = hashString("BORROWING_FACTOR");
export const BORROWING_EXPONENT_FACTOR_KEY = hashString("BORROWING_EXPONENT_FACTOR");
export const CUMULATIVE_BORROWING_FACTOR_KEY = hashString("CUMULATIVE_BORROWING_FACTOR");
export const TOTAL_BORROWING_KEY = hashString("TOTAL_BORROWING");
export const FUNDING_FACTOR_KEY = hashString("FUNDING_FACTOR");
export const FUNDING_EXPONENT_FACTOR_KEY = hashString("FUNDING_EXPONENT_FACTOR");
export const MAX_PNL_FACTOR_KEY = hashString("MAX_PNL_FACTOR");
export const MAX_PNL_FACTOR_FOR_WITHDRAWALS_KEY = hashString("MAX_PNL_FACTOR_FOR_WITHDRAWALS");
export const MAX_PNL_FACTOR_FOR_DEPOSITS_KEY = hashString("MAX_PNL_FACTOR_FOR_DEPOSITS");
export const MAX_PNL_FACTOR_FOR_TRADERS_KEY = hashString("MAX_PNL_FACTOR_FOR_TRADERS");
export const MAX_POSITION_IMPACT_FACTOR_FOR_LIQUIDATIONS_KEY = hashString(
  "MAX_POSITION_IMPACT_FACTOR_FOR_LIQUIDATIONS"
);
export const POSITION_IMPACT_POOL_AMOUNT_KEY = hashString("POSITION_IMPACT_POOL_AMOUNT");
export const SWAP_IMPACT_POOL_AMOUNT_KEY = hashString("SWAP_IMPACT_POOL_AMOUNT");
export const MIN_COLLATERAL_USD_KEY = hashString("MIN_COLLATERAL_USD");
export const MIN_COLLATERAL_FACTOR_KEY = hashString("MIN_COLLATERAL_FACTOR");
export const MIN_COLLATERAL_FACTOR_FOR_OPEN_INTEREST_MULTIPLIER_KEY = hashString(
  "MIN_COLLATERAL_FACTOR_FOR_OPEN_INTEREST_MULTIPLIER"
);
export const MIN_POSITION_SIZE_USD_KEY = hashString("MIN_POSITION_SIZE_USD");
export const MAX_LEVERAGE_KEY = hashString("MAX_LEVERAGE");
export const DEPOSIT_GAS_LIMIT_KEY = hashString("DEPOSIT_GAS_LIMIT");
export const WITHDRAWAL_GAS_LIMIT_KEY = hashString("WITHDRAWAL_GAS_LIMIT");
export const INCREASE_ORDER_GAS_LIMIT_KEY = hashString("INCREASE_ORDER_GAS_LIMIT");
export const DECREASE_ORDER_GAS_LIMIT_KEY = hashString("DECREASE_ORDER_GAS_LIMIT");
export const SWAP_ORDER_GAS_LIMIT_KEY = hashString("SWAP_ORDER_GAS_LIMIT");
export const SINGLE_SWAP_GAS_LIMIT_KEY = hashString("SINGLE_SWAP_GAS_LIMIT");
export const TOKEN_TRANSFER_GAS_LIMIT_KEY = hashString("TOKEN_TRANSFER_GAS_LIMIT");
export const NATIVE_TOKEN_TRANSFER_GAS_LIMIT_KEY = hashString("NATIVE_TOKEN_TRANSFER_GAS_LIMIT");
export const ESTIMATED_GAS_FEE_BASE_AMOUNT = hashString("ESTIMATED_GAS_FEE_BASE_AMOUNT");
export const ESTIMATED_GAS_FEE_MULTIPLIER_FACTOR = hashString("ESTIMATED_GAS_FEE_MULTIPLIER_FACTOR");
export const MARKET_LIST_KEY = hashString("MARKET_LIST");
export const POSITION_LIST_KEY = hashString("POSITION_LIST");
export const ACCOUNT_POSITION_LIST_KEY = hashString("ACCOUNT_POSITION_LIST");
export const ORDER_LIST_KEY = hashString("ORDER_LIST");
export const ACCOUNT_ORDER_LIST_KEY = hashString("ACCOUNT_ORDER_LIST");
export const CLAIMABLE_FUNDING_AMOUNT = hashString("CLAIMABLE_FUNDING_AMOUNT");
export const VIRTUAL_TOKEN_ID_KEY = hashString("VIRTUAL_TOKEN_ID");
export const VIRTUAL_MARKET_ID_KEY = hashString("VIRTUAL_MARKET_ID");
export const VIRTUAL_INVENTORY_FOR_POSITIONS_KEY = hashString("VIRTUAL_INVENTORY_FOR_POSITIONS");
export const VIRTUAL_INVENTORY_FOR_SWAPS_KEY = hashString("VIRTUAL_INVENTORY_FOR_SWAPS");
export const POOL_AMOUNT_ADJUSTMENT_KEY = hashString("POOL_AMOUNT_ADJUSTMENT");
export const AFFILIATE_REWARD_KEY = hashString("AFFILIATE_REWARD");
export const IS_MARKET_DISABLED_KEY = hashString("IS_MARKET_DISABLED");

export function positionImpactFactorKey(market, isPositive) {
  return hashData(["bytes32", "address", "bool"], [POSITION_IMPACT_FACTOR_KEY, market, isPositive]);
}

export function positionImpactExponentFactorKey(market) {
  return hashData(["bytes32", "address"], [POSITION_IMPACT_EXPONENT_FACTOR_KEY, market]);
}

export function maxPositionImpactFactorKey(market, isPositive) {
  return hashData(["bytes32", "address", "bool"], [MAX_POSITION_IMPACT_FACTOR_KEY, market, isPositive]);
}

export function positionFeeFactorKey(market, forPositiveImpact) {
  return hashData(["bytes32", "address", "bool"], [POSITION_FEE_FACTOR_KEY, market, forPositiveImpact]);
}

export function swapImpactFactorKey(market, isPositive) {
  return hashData(["bytes32", "address", "bool"], [SWAP_IMPACT_FACTOR_KEY, market, isPositive]);
}

export function swapImpactExponentFactorKey(market) {
  return hashData(["bytes32", "address"], [SWAP_IMPACT_EXPONENT_FACTOR_KEY, market]);
}

export function swapFeeFactorKey(market, forPositiveImpact) {
  return hashData(["bytes32", "address", "bool"], [SWAP_FEE_FACTOR_KEY, market, forPositiveImpact]);
}

export function openInterestKey(market, collateralToken, isLong) {
  return hashData(["bytes32", "address", "address", "bool"], [OPEN_INTEREST_KEY, market, collateralToken, isLong]);
}

export function openInterestInTokensKey(market, collateralToken, isLong) {
  return hashData(
    ["bytes32", "address", "address", "bool"],
    [OPEN_INTEREST_IN_TOKENS_KEY, market, collateralToken, isLong]
  );
}

export function poolAmountKey(market, token) {
  return hashData(["bytes32", "address", "address"], [POOL_AMOUNT_KEY, market, token]);
}

export function reserveFactorKey(market, isLong) {
  return hashData(["bytes32", "address", "bool"], [RESERVE_FACTOR_KEY, market, isLong]);
}

export function openInterestReserveFactorKey(market, isLong) {
  return hashData(["bytes32", "address", "bool"], [OPEN_INTEREST_RESERVE_FACTOR_KEY, market, isLong]);
}

export function borrowingFactorKey(market, isLong) {
  return hashData(["bytes32", "address", "bool"], [BORROWING_FACTOR_KEY, market, isLong]);
}

export function borrowingExponentFactorKey(market, isLong) {
  return hashData(["bytes32", "address", "bool"], [BORROWING_EXPONENT_FACTOR_KEY, market, isLong]);
}

export function cumulativeBorrowingFactorKey(market, isLong) {
  return hashData(["bytes32", "address", "bool"], [CUMULATIVE_BORROWING_FACTOR_KEY, market, isLong]);
}

export function totalBorrowingKey(market, isLong) {
  return hashData(["bytes32", "address", "bool"], [TOTAL_BORROWING_KEY, market, isLong]);
}

export function fundingFactorKey(market) {
  return hashData(["bytes32", "address"], [FUNDING_FACTOR_KEY, market]);
}

export function fundingExponentFactorKey(market) {
  return hashData(["bytes32", "address"], [FUNDING_EXPONENT_FACTOR_KEY, market]);
}

export function maxPnlFactorKey(pnlFactorType, market, isLong) {
  return hashData(["bytes32", "bytes32", "address", "bool"], [MAX_PNL_FACTOR_KEY, pnlFactorType, market, isLong]);
}

export function positionImpactPoolAmountKey(market) {
  return hashData(["bytes32", "address"], [POSITION_IMPACT_POOL_AMOUNT_KEY, market]);
}

export function maxPositionImpactFactorForLiquidationsKey(market) {
  return hashData(["bytes32", "address"], [MAX_POSITION_IMPACT_FACTOR_FOR_LIQUIDATIONS_KEY, market]);
}

export function swapImpactPoolAmountKey(market, token) {
  return hashData(["bytes32", "address", "address"], [SWAP_IMPACT_POOL_AMOUNT_KEY, market, token]);
}

export function orderKey(dataStoreAddress, nonce) {
  return hashData(["address", "uint256"], [dataStoreAddress, nonce]);
}

export function depositGasLimitKey(singleToken) {
  return hashData(["bytes32", "bool"], [DEPOSIT_GAS_LIMIT_KEY, singleToken]);
}

export function withdrawalGasLimitKey() {
  return hashData(["bytes32"], [WITHDRAWAL_GAS_LIMIT_KEY]);
}

export function singleSwapGasLimitKey() {
  return SINGLE_SWAP_GAS_LIMIT_KEY;
}

export function increaseOrderGasLimitKey() {
  return INCREASE_ORDER_GAS_LIMIT_KEY;
}

export function decreaseOrderGasLimitKey() {
  return DECREASE_ORDER_GAS_LIMIT_KEY;
}

export function swapOrderGasLimitKey() {
  return SWAP_ORDER_GAS_LIMIT_KEY;
}

export function accountOrderListKey(account) {
  return hashData(["bytes32", "address"], [ACCOUNT_ORDER_LIST_KEY, account]);
}

export function accountPositionListKey(account) {
  return hashData(["bytes32", "address"], [ACCOUNT_POSITION_LIST_KEY, account]);
}

export function minCollateralFactorKey(market) {
  return hashData(["bytes32", "address"], [MIN_COLLATERAL_FACTOR_KEY, market]);
}

export function minCollateralFactorForOpenInterest(market, isLong) {
  return hashData(
    ["bytes32", "address", "bool"],
    [MIN_COLLATERAL_FACTOR_FOR_OPEN_INTEREST_MULTIPLIER_KEY, market, isLong]
  );
}

export function hashedPositionKey(account, market, collateralToken, isLong) {
  return hashData(["address", "address", "address", "bool"], [account, market, collateralToken, isLong]);
}

export function claimableFundingAmountKey(market, token, account) {
  return hashData(["bytes32", "address", "address", "address"], [CLAIMABLE_FUNDING_AMOUNT, market, token, account]);
}
export function virtualTokenIdKey(token) {
  return hashData(["bytes32", "address"], [VIRTUAL_TOKEN_ID_KEY, token]);
}

export function virtualMarketIdKey(market) {
  return hashData(["bytes32", "address"], [VIRTUAL_MARKET_ID_KEY, market]);
}

export function virtualInventoryForSwapsKey(virtualMarketId, token) {
  return hashData(["bytes32", "bytes32", "address"], [VIRTUAL_INVENTORY_FOR_SWAPS_KEY, virtualMarketId, token]);
}

export function virtualInventoryForPositionsKey(virtualTokenId) {
  return hashData(["bytes32", "bytes32"], [VIRTUAL_INVENTORY_FOR_POSITIONS_KEY, virtualTokenId]);
}

export function poolAmountAdjustmentKey(market, token) {
  return hashData(["bytes32", "address", "address"], [POOL_AMOUNT_ADJUSTMENT_KEY, market, token]);
}

export function affiliateRewardKey(market, token, account) {
  return hashData(["bytes32", "address", "address", "address"], [AFFILIATE_REWARD_KEY, market, token, account]);
}

export function isMarketDisabledKey(market) {
  return hashData(["bytes32", "address"], [IS_MARKET_DISABLED_KEY, market]);
}

export function maxPoolAmountForDepositKey(market, token) {
  return hashData(["bytes32", "address", "address"], [MAX_POOL_AMOUNT_FOR_DEPOSIT_KEY, market, token]);
}

export function maxPoolAmountKey(market, token) {
  return hashData(["bytes32", "address", "address"], [MAX_POOL_AMOUNT_KEY, market, token]);
}
