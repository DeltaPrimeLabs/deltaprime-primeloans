import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
    addMissingTokenContracts,
    Asset,
    calculateStakingTokensAmountBasedOnAvaxValue,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployPools, erc20ABI, fromBytes32,
    fromWei,
    getFixedGasSigners,
    getRedstonePrices,
    getTokensPricesMap,
    PoolAsset,
    PoolInitializationObject,
    recompileConstantsFile,
    toBytes32,
    toWei,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {parseUnits} from "ethers/lib/utils";
import {
    AddressProvider,
    MockTokenManager,
    PangolinIntermediary,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {deployDiamond, replaceFacet} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from "../../../common/addresses/avax/token_addresses.json";
import web3Abi from "web3-eth-abi";

chai.use(solidity);

const {deployContract, provider} = waffle;
const balancerTokenAddress = TOKEN_ADDRESSES['BAL_sAVAX_WAVAX_BPT'];
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with staking operations', () => {
        let smartLoansFactory: SmartLoansFactory,
            exchange: PangolinIntermediary,
            balancerTokenContract: Contract,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            nonOwnerWrappedLoan: any,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            liquidator: SignerWithAddress,
            diamondAddress: any,
            MOCK_PRICES: any,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            tokensPrices: Map<string, number>;

        before("deploy factory and pool", async () => {
            [owner, depositor, liquidator] = await getFixedGasSigners(10000000);
            let assetsList = ['AVAX', 'sAVAX', 'QI', 'USDC', 'BAL_sAVAX_WAVAX_BPT'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'AVAX', airdropList: [depositor]},
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor);
            tokensPrices = await getTokensPricesMap(
                ['AVAX', 'sAVAX', 'USDC', 'QI'],
                "avalanche",
                getRedstonePrices,
                [
                    //TODO: put price that makes sense
                    {symbol: 'BAL_sAVAX_WAVAX_BPT', value: 1000},
                ]
            );
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);
            addMissingTokenContracts(tokenContracts, assetsList);

            balancerTokenContract = await new ethers.Contract(balancerTokenAddress, erc20ABI, provider);

            let tokenManager = await deployContract(
                owner,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);
            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

            await smartLoansFactory.initialize(diamondAddress, tokenManager.address);

            exchange = await deployAndInitExchangeContract(owner, pangolinRouterAddress, tokenManager.address, supportedAssets, "PangolinIntermediary") as PangolinIntermediary;

            let addressProvider = await deployContract(
                owner,
                AddressProviderArtifact,
                []
            ) as AddressProvider;

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [
                    {
                        facetPath: './contracts/facets/avalanche/PangolinDEXFacet.sol',
                        contractAddress: exchange.address,
                    }
                ],
                tokenManager.address,
                addressProvider.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );

            await deployAllFacets(diamondAddress)
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
                .wrap(loan.connect(liquidator))
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });
        });

        it("should fund a loan and swap to sAVAX", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.equal(1.157920892373162e+59);

            await tokenContracts.get('AVAX')!.connect(owner).deposit({value: toWei("200")});
            await tokenContracts.get('AVAX')!.connect(owner).approve(wrappedLoan.address, toWei("200"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("200"));
            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("1"));

            await wrappedLoan.swapPangolin(toBytes32("AVAX"), toBytes32("sAVAX"), toWei("50"), 0);

            //TODO: high slippage on Pangolin
            // expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(151 * tokensPrices.get('AVAX')! + 50 * tokensPrices.get('sAVAX')!, 0.01);
            // expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(167.5, 0.01);
        });

        it("should fail to stake as a non-owner", async () => {

            let userData = ethers.utils.defaultAbiCoder.encode(
            ['uint256', 'uint256[]', 'uint256'],
        [
                    1,
                    [
                        toWei("10"), //try with no
                        0,
                        0
                    ],
                    0
                ]
            );

            //https://docs.balancer.fi/reference/joins-and-exits/pool-joins.html#userdata
            await expect(nonOwnerWrappedLoan.joinPoolAndStakeBalancerV2(
                [
                    "0xa154009870e9b6431305f19b09f9cfd7284d4e7a000000000000000000000013",
                    [
                        "0x2b2c81e08f1af8835a78bb2a90ae924ace0ea4be",
                        "0x7275c131b1f67e8b53b4691f92b0e35a4c1c6e22",
                    ],
                    [
                        toWei("10"), //try with no
                        0
                    ],
                    //TODO: check slippage
                    toWei('0.0001')
                ]

            )).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });

        it("should stake sAVAX in Balancer vault", async () => {
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let initialStakedBalance = await balancerTokenContract.balanceOf(wrappedLoan.address);
            expect(initialStakedBalance).to.be.equal(0);


            //https://docs.balancer.fi/reference/joins-and-exits/pool-joins.html
            let userData = ethers.utils.defaultAbiCoder.encode(
                ['uint256', 'uint256[]', 'uint256'],
                [
                    1,
                    [
                        toWei("10"), //try with no
                        0 //2 ELEMENTS INSTEAD OF 3!
                    ],
                    0
                ]
            );

            await wrappedLoan.joinPoolAndStakeBalancerV2(
                [
                    "0xa154009870e9b6431305f19b09f9cfd7284d4e7a000000000000000000000013",
                    [
                        "0x2b2c81e08f1af8835a78bb2a90ae924ace0ea4be",
                        "0x7275c131b1f67e8b53b4691f92b0e35a4c1c6e22",
                    ],
                    [
                        toWei("10"), //try with no
                        0
                    ],
                    //TODO: check slippage
                    toWei('0.0001')
                ]
        );

            let balanceAfterStake = fromWei(await balancerTokenContract.balanceOf(wrappedLoan.address));
            expect(balanceAfterStake).to.be.gt(0);

            //TODO: uncomment after RS feed is ready
            // expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 20);
            // expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 300);
        });

        it("should claim rewards", async () => {
            await expect(wrappedLoan.claimRewardsBalancerV2(
                "0xa154009870e9b6431305f19b09f9cfd7284d4e7a000000000000000000000013",
            )).not.to.be.reverted;
        });

        it("should not allow staking in a non-whitelisted Balancer vault", async () => {
            await expect(wrappedLoan.joinPoolAndStakeBalancerV2(
                [
                    "0xb06fdbd2941d2f42d60accee85086198ac72923600020000000000000000001a",
                    [
                        "0x502580fc390606b47FC3b741d6D49909383c28a9",
                        "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
                    ],
                    [
                        0,
                        toWei("10")
                    ],
                    //TODO: check slippage
                    toWei('0.0001')
                ]
            )).to.be.revertedWith('BalancerV2PoolNotWhitelisted()');
        });

        it("should not allow staking a non-whitelisted asset", async () => {
            await expect(wrappedLoan.joinPoolAndStakeBalancerV2(
                [
                    "0xa154009870e9b6431305f19b09f9cfd7284d4e7a000000000000000000000013",
                    [
                        "0x2b2c81e08f1af8835a78bb2a90ae924ace0ea4be",
                        "0x7275c131b1f67e8b53b4691f92b0e35a4c1c6e22",
                    ],
                    [
                        0,
                        toWei("10")
                    ],
                    //TODO: check slippage
                    toWei('0.0001')
                ]
            )).to.be.revertedWith('DepositingInactiveToken()');
        });

        it("should unstake part of sAVAX", async () => {
            let initialTotalValue = await wrappedLoan.getTotalValue();
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            let userData = ethers.utils.defaultAbiCoder.encode(
                ['uint256', 'uint256', 'uint256'],
                [
                    0, // first exit strat - just one token
                    (await balancerTokenContract.balanceOf(wrappedLoan.address)).div(2),
                    0 //index of the token- sAVAX
                ]
            );

            await wrappedLoan.unstakeAndExitPoolBalancerV2(
                [
                    "0xa154009870e9b6431305f19b09f9cfd7284d4e7a000000000000000000000013",
                    "0x2b2c81e08f1af8835a78bb2a90ae924ace0ea4be",
                    toWei("9"), //max. slippage = 10%,
                    await balancerTokenContract.balanceOf(wrappedLoan.address)
                ]
        );

            //TODO: uncomment after RS feed is ready
            // expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(fromWei(initialTotalValue), 25);
            // expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 4);
            // expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 60);
        });
    });
});
