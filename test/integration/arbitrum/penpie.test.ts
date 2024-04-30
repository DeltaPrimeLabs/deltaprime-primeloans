import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import {constructSimpleSDK, ContractMethod, SimpleFetchSDK, SwapSide} from '@paraswap/sdk';
import axios from 'axios';

import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
    addMissingTokenContracts,
    Asset,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployPools,
    fromBytes32,
    fromWei,
    getFixedGasSigners,
    getRedstonePrices,
    getTokensPricesMap,
    parseParaSwapRouteData,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    toBytes32,
    toWei,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {AddressProvider, MockTokenManager, SmartLoanGigaChadInterface, SmartLoansFactory,} from "../../../typechain";
import {BigNumber, BigNumberish, Contract} from "ethers";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from '../../../common/addresses/arbitrum/token_addresses.json';

chai.use(solidity);

const {deployContract, provider} = waffle;

const pendleApiBaseUrl = "https://api-v2.pendle.finance/sdk/api";

const ezETHMarket = "0x5e03c94fc5fb2e21882000a96df0b63d2c4312e2";
const wstETHMarket = "0xfd8aee8fcc10aac1897f8d5271d112810c79e022";
const eETHMarket = "0x952083cde7aaa11ab8449057f7de23a970aa8472";
const rsETHMarket = "0x6ae79089b2cf4be441480801bb741a531d94312b";
const wstETHSiloMarket = "0xaccd9a7cb5518326bed715f90bd32cdf2fec2d14";
// const eETHSiloMarket = "0x99e9028e274FEAFA2E1D8787E1eE6DE39C6F7724";

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with Penpie staking operations', () => {
        let smartLoansFactory: SmartLoansFactory,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            nonOwnerWrappedLoan: any,
            wstEthBalance: BigNumber,
            weEthBalance: BigNumber,
            rsEthBalance: BigNumber,
            tokenManager: MockTokenManager,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>,
            owner: SignerWithAddress,
            nonOwner: SignerWithAddress,
            depositor: SignerWithAddress,
            paraSwapMin: SimpleFetchSDK,
            liquidityRouter: Contract,
            MOCK_PRICES: any,
            diamondAddress: any;

        const getSwapData = async (srcToken: keyof typeof TOKEN_ADDRESSES, destToken: keyof typeof TOKEN_ADDRESSES, srcDecimals: number, destDecimals: number, srcAmount: any) => {
            const priceRoute = await paraSwapMin.swap.getRate({
                srcToken: TOKEN_ADDRESSES[srcToken],
                destToken: TOKEN_ADDRESSES[destToken],
                srcDecimals,
                destDecimals,
                amount: srcAmount.toString(),
                userAddress: wrappedLoan.address,
                side: SwapSide.SELL,
                options: {
                    includeContractMethods: [ContractMethod.simpleSwap]
                }
            });
            const txParams = await paraSwapMin.swap.buildTx({
                srcToken: priceRoute.srcToken,
                destToken: priceRoute.destToken,
                srcDecimals,
                destDecimals,
                srcAmount: priceRoute.srcAmount,
                slippage: 300,
                priceRoute,
                userAddress: wrappedLoan.address,
                partner: 'anon',
            }, {
                ignoreChecks: true,
            });
            const swapData = parseParaSwapRouteData(txParams);
            return swapData;
        };

        before("deploy factory and pool", async () => {
            paraSwapMin = constructSimpleSDK({ chainId: 42161, axios });

            [owner, nonOwner, depositor] = await getFixedGasSigners(10000000);
            let penpieLpTokens = ['PENDLE_EZ_ETH_LP', 'PENDLE_WSTETH_LP', 'PENDLE_E_ETH_LP', 'PENDLE_RS_ETH_LP', 'PENDLE_SILO_ETH_WSTETH_LP'];
            let assetsList = ['ETH', 'ezETH', 'wstETH', 'weETH', 'rsETH', ...penpieLpTokens];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'ETH', airdropList: [depositor]}
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor, 1000, 'ARBITRUM');

            tokensPrices = await getTokensPricesMap(assetsList, "arbitrum", getRedstonePrices, []);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            addMissingTokenContracts(tokenContracts, assetsList, 'ARBITRUM');
            supportedAssets = convertAssetsListToSupportedAssets(assetsList, [], 'ARBITRUM');

            tokenManager = await deployContract(
                owner,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);
            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

            const exposureGroups = [
                "ETH_GROUP", "ezETH_GROUP", "wstETH_GROUP", "weETH_GROUP", "rsETH_GROUP",
                "PENDLE_EZ_ETH_LP_GROUP", "PENDLE_WSTETH_LP_GROUP", "PENDLE_E_ETH_LP_GROUP",
                "PENDLE_RS_ETH_LP_GROUP", "PENDLE_SILO_ETH_WSTETH_LP_GROUP"
            ];

            const identifiers = [
                "ETH", "ezETH", "wstETH", "weETH", "rsETH",
                "PENDLE_EZ_ETH_LP", "PENDLE_WSTETH_LP", "PENDLE_E_ETH_LP",
                "PENDLE_RS_ETH_LP", "PENDLE_SILO_ETH_WSTETH_LP"
            ];

            await tokenManager.setIdentifiersToExposureGroups(
                identifiers.map(toBytes32),
                exposureGroups.map(toBytes32)
            );

            await tokenManager.setMaxProtocolsExposure(
                exposureGroups.map(toBytes32),
                Array(exposureGroups.length).fill(toWei("5000"))
            );

            await smartLoansFactory.initialize(diamondAddress, tokenManager.address);

            let addressProvider = await deployContract(
                owner,
                AddressProviderArtifact,
                []
            ) as AddressProvider;

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [],
                tokenManager.address,
                addressProvider.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib',
                5000,
                "1.042e18",
                200,
                "ETH",
                "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
            );

            await deployAllFacets(diamondAddress, true, 'ARBITRUM');
        });

        it("should deploy a smart loan", async () => {
            await smartLoansFactory.connect(owner).createLoan();
            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(owner.address);
            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, owner);

            wrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });

            nonOwnerWrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan.connect(nonOwner))
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });
        });

        it("should swap and fund", async () => {
            await tokenContracts.get('ETH')!.connect(owner).deposit({value: toWei("100")});
            await tokenContracts.get('ETH')!.connect(owner).approve(wrappedLoan.address, toWei("100"));
            await wrappedLoan.fund(toBytes32("ETH"), toWei("100"));

            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = await wrappedLoan.getHealthRatio();
            let initialTWV = await wrappedLoan.getThresholdWeightedValue();

            let swapData = await getSwapData('ETH', 'wstETH', 18, 18, toWei('2'));
            await wrappedLoan.paraSwapV2(swapData.selector, swapData.data, TOKEN_ADDRESSES['ETH'], toWei('2'), TOKEN_ADDRESSES['wstETH'], 1);
            wstEthBalance = await tokenContracts.get('wstETH')!.balanceOf(wrappedLoan.address);

            swapData = await getSwapData('ETH', 'weETH', 18, 18, toWei('2'));
            await wrappedLoan.paraSwapV2(swapData.selector, swapData.data, TOKEN_ADDRESSES['ETH'], toWei('2'), TOKEN_ADDRESSES['weETH'], 1);
            weEthBalance = await tokenContracts.get('weETH')!.balanceOf(wrappedLoan.address);

            swapData = await getSwapData('ETH', 'rsETH', 18, 18, toWei('2'));
            await wrappedLoan.paraSwapV2(swapData.selector, swapData.data, TOKEN_ADDRESSES['ETH'], toWei('2'), TOKEN_ADDRESSES['rsETH'], 1);
            rsEthBalance = await tokenContracts.get('rsETH')!.balanceOf(wrappedLoan.address);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 200);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.eq(fromWei(initialHR));
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(fromWei(initialTWV), 200);
        });

        it("should fail to stake as a non-owner", async () => {
            const mockArgs = [
                toBytes32("ETH"),
                0,
                ethers.constants.AddressZero,
                0,
                {
                    guessMin: 0,
                    guessMax: 0,
                    guessOffchain: 0,
                    maxIteration: 0,
                    eps: 0,
                },
                {
                    tokenIn: ethers.constants.AddressZero,
                    netTokenIn: 0,
                    tokenMintSy: ethers.constants.AddressZero,
                    pendleSwap:  ethers.constants.AddressZero,
                    swapData: {
                        swapType: 0,
                        extRouter: ethers.constants.AddressZero,
                        extCalldata: "0x",
                        needScale: false
                    }
                },
                {
                    limitRouter: ethers.constants.AddressZero,
                    epsSkipMarket: 0,
                    normalFills: [],
                    flashFills: [],
                    optData: "0x"
                }
            ];
            await expect(nonOwnerWrappedLoan.depositToPendleAndStakeInPenpie(...mockArgs)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should fail to unstake as a non-owner", async () => {
            const mockArgs = [
                toBytes32("ETH"),
                0,
                ethers.constants.AddressZero,
                0,
                {
                    tokenOut: ethers.constants.AddressZero,
                    minTokenOut: 0,
                    tokenRedeemSy: ethers.constants.AddressZero,
                    pendleSwap: ethers.constants.AddressZero,
                    swapData: {
                        swapType: 0,
                        extRouter: ethers.constants.AddressZero,
                        extCalldata: "0x",
                        needScale: false
                    }
                },
                {
                    limitRouter: ethers.constants.AddressZero,
                    epsSkipMarket: 0,
                    normalFills: [],
                    flashFills: [],
                    optData: "0x"
                }
            ];
            await expect(nonOwnerWrappedLoan.unstakeFromPenpieAndWithdrawFromPendle(...mockArgs)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should stake", async () => {
            const stakeTests = [
                { asset: "ETH", market: ezETHMarket, amount: toWei('2'), minLpOut: 1, lpToken: "PENDLE_EZ_ETH_LP" },
                { asset: "wstETH", market: wstETHMarket, amount: wstEthBalance, minLpOut: 1, lpToken: "PENDLE_WSTETH_LP" },
                { asset: "weETH", market: eETHMarket, amount: weEthBalance, minLpOut: 1, lpToken: "PENDLE_E_ETH_LP" },
                { asset: "rsETH", market: rsETHMarket, amount: rsEthBalance, minLpOut: 1, lpToken: "PENDLE_RS_ETH_LP" },
                { asset: "ETH", market: wstETHSiloMarket, amount: toWei('2'), minLpOut: 1, lpToken: "PENDLE_SILO_ETH_WSTETH_LP" },
                // { asset: "ETH", market: eETHSiloMarket, amount: toWei('2'), minLpOut: 1, lpToken: "PENPIE_EETHSILO_LP" }
            ];

            for (const test of stakeTests) {
                console.log(`Testing staking ${test.asset}...`)
                await testStake(test.asset, test.market, test.amount, test.minLpOut, test.lpToken);
            }
        });

        it("should unstake", async () => {
            const unstakeTests = [
                { asset: "ezETH", market: ezETHMarket, amount: await tokenContracts.get('PENDLE_EZ_ETH_LP')!.balanceOf(wrappedLoan.address), minOut: 1, lpToken: "PENDLE_EZ_ETH_LP" },
                { asset: "wstETH", market: wstETHMarket, amount: await tokenContracts.get('PENDLE_WSTETH_LP')!.balanceOf(wrappedLoan.address), minOut: 1, lpToken: "PENDLE_WSTETH_LP" },
                { asset: "weETH", market: eETHMarket, amount: await tokenContracts.get('PENDLE_E_ETH_LP')!.balanceOf(wrappedLoan.address), minOut: 1, lpToken: "PENDLE_E_ETH_LP" },
                { asset: "rsETH", market: rsETHMarket, amount: await tokenContracts.get('PENDLE_RS_ETH_LP')!.balanceOf(wrappedLoan.address), minOut: 1, lpToken: "PENDLE_RS_ETH_LP" },
                { asset: "ETH", market: wstETHSiloMarket, amount: await tokenContracts.get('PENDLE_SILO_ETH_WSTETH_LP')!.balanceOf(wrappedLoan.address), minOut: 1, lpToken: "PENDLE_SILO_ETH_WSTETH_LP" },
                // { asset: "ETH", market: eETHSiloMarket, amount: await tokenContracts.get('PENPIE_EETHSILO_LP')!.balanceOf(wrappedLoan.address), minOut: 1, lpToken: "PENPIE_EETHSILO_LP" }
            ];

            for (const test of unstakeTests) {
                console.log(`Testing unstaking ${test.asset}...`)
                await testUnstake(test.asset, test.market, test.amount, test.minOut, test.lpToken);
            }
        });

        async function testStake(asset: string, market: string, amount: BigNumber, minLpOut: BigNumberish, lpToken: string) {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = await wrappedLoan.getHealthRatio();
            let initialTWV = await wrappedLoan.getThresholdWeightedValue();

            const queryParams = new URLSearchParams({
                chainId: "42161",
                receiverAddr: wrappedLoan.address,
                marketAddr: market,
                tokenInAddr: TOKEN_ADDRESSES[asset],
                amountTokenIn: amount.toString(),
                slippage: "0.05"
            });
            const { data: { contractCallParams: { 3: guessPtReceivedFromSy, 4: input, 5: limit } } } = await axios.get(`${pendleApiBaseUrl}/v1/addLiquiditySingleToken?${queryParams}`);

            const beforeLpExposure = await getAssetExposure(lpToken);
            const beforeTokenExposure = await getAssetExposure(asset);
            expect(await loanOwnsAsset(lpToken)).to.be.false;

            console.log(`Depositing ${fromWei(amount)} ${asset} - $${tokensPrices.get(asset)! * fromWei(amount)}`);

            await wrappedLoan.depositToPendleAndStakeInPenpie(toBytes32(asset), amount, market, minLpOut, guessPtReceivedFromSy, input, limit);

            const received = await tokenContracts.get(lpToken)!.balanceOf(wrappedLoan.address);
            console.log(`Received ${fromWei(received)} ${lpToken} - $${tokensPrices.get(lpToken)! * fromWei(received)}`);

            console.log(`Expected amount: ${tokensPrices.get(asset)! * fromWei(amount) / tokensPrices.get(lpToken)!}`);

            expect(await loanOwnsAsset(lpToken)).to.be.true;
            const afterLpExposure = await getAssetExposure(lpToken);
            const afterTokenExposure = await getAssetExposure(asset);

            expect(beforeTokenExposure.current.sub(afterTokenExposure.current)).to.be.eq(amount);
            expect(afterLpExposure.current).to.be.gt(beforeLpExposure.current);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 100);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(fromWei(initialHR), 0.0001);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(fromWei(initialTWV), 100);
        }

        async function testUnstake(asset: string, market: string, amount: BigNumber, minOut: BigNumberish, lpToken: string) {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = await wrappedLoan.getHealthRatio();

            const queryParams = new URLSearchParams({
                chainId: "42161",
                receiverAddr: wrappedLoan.address,
                marketAddr: market,
                amountLpToRemove: amount.toString(),
                tokenOutAddr: TOKEN_ADDRESSES[asset],
                slippage: "0.05"
            });
            const { data: { contractCallParams: { 3: output, 4: limit } } } = await axios.get(`${pendleApiBaseUrl}/v1/removeLiquiditySingleToken?${queryParams}`);

            const beforeLpExposure = await getAssetExposure(lpToken);
            const beforeTokenExposure = await getAssetExposure(asset);
            expect(await loanOwnsAsset(lpToken)).to.be.true;

            await wrappedLoan.unstakeFromPenpieAndWithdrawFromPendle(toBytes32(asset), amount, market, minOut, output, limit);

            expect(await loanOwnsAsset(lpToken)).to.be.false;
            const afterLpExposure = await getAssetExposure(lpToken);
            const afterTokenExposure = await getAssetExposure(asset);

            expect(beforeLpExposure.current.sub(afterLpExposure.current)).to.be.eq(amount);
            expect(afterTokenExposure.current).to.be.gt(beforeTokenExposure.current);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 100);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(fromWei(initialHR), 0.01);
        }

        async function loanOwnsAsset(asset: string) {
            let ownedAssets =  await wrappedLoan.getAllOwnedAssets();
            for(const ownedAsset of ownedAssets){
                if(fromBytes32(ownedAsset) == asset){
                    return true;
                }
            }
            return false;
        }

        async function getAssetExposure(asset: string) {
            const group = await tokenManager.identifierToExposureGroup(toBytes32(asset));
            const exposure = await tokenManager.groupToExposure(group);
            return exposure;
        }
    });
});
