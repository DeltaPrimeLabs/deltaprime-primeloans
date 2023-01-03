import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';

import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';
import {
    Asset,
    deployAllFacets,
    deployAndInitializeLendingPool, formatUnits, fromBytes32,
    fromWei,
    getFixedGasSigners,
    PoolAsset,
    recompileConstantsFile,
    toBytes32,
    toWei, ZERO,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {parseUnits} from "ethers/lib/utils";
import {
    PangolinIntermediary,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
    TokenManager,
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';

chai.use(solidity);

const {deployContract, provider} = waffle;
const yakStakingTokenAddress = "0xaAc0F2d0630d1D09ab2B5A400412a4840B866d95";

const erc20ABI = [
    'function decimals() public view returns (uint8)',
    'function balanceOf(address _owner) public view returns (uint256 balance)',
    'function approve(address _spender, uint256 _value) public returns (bool success)',
    'function allowance(address owner, address spender) public view returns (uint256)',
    'function totalSupply() external view returns (uint256)',
    'function totalDeposits() external view returns (uint256)'
]

const lpABI = [
    ...erc20ABI,
    'function getReserves() public view returns (uint112, uint112, uint32)',
]

const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with liquidity provision', () => {
        let exchange: PangolinIntermediary,
            smartLoansFactory: SmartLoansFactory,
            yakStakingContract: Contract,
            lpTokenAddress: string,
            lpToken: Contract,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            nonOwnerWrappedLoan: any,
            tokenContracts: any = {},
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            MOCK_PRICES: any,
            AVAX_PRICE: number,
            USD_PRICE: number,
            lpTokenPrice: number,
            diamondAddress: any;

        before("deploy factory and pool", async () => {
            [owner, depositor] = await getFixedGasSigners(10000000);

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
            await smartLoansFactory.initialize(diamondAddress);

            let lendingPools = [];
            // TODO: Possibly further extract the body of this for loop into a separate function shared among test suits
            for (const token of [
                {'name': 'AVAX', 'airdropList': [depositor]}
            ]) {
                let {
                    poolContract,
                    tokenContract
                } = await deployAndInitializeLendingPool(owner, token.name, smartLoansFactory.address, token.airdropList);
                await tokenContract!.connect(depositor).approve(poolContract.address, toWei("1000"));
                await poolContract.connect(depositor).deposit(toWei("1000"));
                lendingPools.push(new PoolAsset(toBytes32(token.name), poolContract.address));
                tokenContracts[token.name] = tokenContract;
            }

            AVAX_PRICE = (await redstone.getPrice('AVAX', {provider: "redstone-avalanche-prod-1"})).value;
            USD_PRICE = (await redstone.getPrice('USDC', {provider: "redstone-avalanche-prod-1"})).value;

            tokenContracts['PNG_AVAX_USDC_LP'] = new ethers.Contract(TOKEN_ADDRESSES['PNG_AVAX_USDC_LP'], lpABI, provider);

            let lpTokenTotalSupply = await tokenContracts['PNG_AVAX_USDC_LP'].totalSupply();
            let [lpTokenToken0Reserve, lpTokenToken1Reserve] = (await tokenContracts['PNG_AVAX_USDC_LP'].getReserves());

            let token0USDValue = fromWei(lpTokenToken0Reserve) * AVAX_PRICE;
            let token1USDValue = formatUnits(lpTokenToken1Reserve, BigNumber.from("6")) * USD_PRICE;


            lpTokenPrice = (token0USDValue + token1USDValue) / fromWei(lpTokenTotalSupply);

            let supportedAssets = [
                new Asset(toBytes32('AVAX'), TOKEN_ADDRESSES['AVAX']),
                new Asset(toBytes32('USDC'), TOKEN_ADDRESSES['USDC']),
                new Asset(toBytes32('PNG_AVAX_USDC_LP'), TOKEN_ADDRESSES['PNG_AVAX_USDC_LP'])
            ]

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [],
                ZERO,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );

            delete require.cache[require.resolve('../../../artifacts/contracts/TokenManager.sol/TokenManager.json')]
            const TokenManagerArtifact = require('../../../artifacts/contracts/TokenManager.sol/TokenManager.json');

            let tokenManager = await deployContract(
                owner,
                TokenManagerArtifact,
                []
            ) as TokenManager;

            await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);

            yakStakingContract = await new ethers.Contract(yakStakingTokenAddress, erc20ABI, provider);

            let exchangeFactory = await ethers.getContractFactory("PangolinIntermediary");
            exchange = (await exchangeFactory.deploy()).connect(owner) as PangolinIntermediary;
            await exchange.initialize(pangolinRouterAddress, tokenManager.address, supportedAssets.map(asset => asset.assetAddress));

            lpTokenAddress = await exchange.connect(owner).getPair(TOKEN_ADDRESSES['AVAX'], TOKEN_ADDRESSES['USDC']);
            lpToken = new ethers.Contract(lpTokenAddress, erc20ABI, provider);

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

            MOCK_PRICES = [
                {
                    dataFeedId: 'USDC',
                    value: USD_PRICE
                },
                {
                    dataFeedId: 'AVAX',
                    value: AVAX_PRICE
                },
                {
                    dataFeedId: 'PNG_AVAX_USDC_LP',
                    value: lpTokenPrice
                },
            ]

            wrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan)
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });

            nonOwnerWrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan.connect(depositor))
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: MOCK_PRICES,
                });
        });

        it("should swap", async () => {
            await tokenContracts['AVAX'].connect(owner).deposit({value: toWei("500")});
            await tokenContracts['AVAX'].connect(owner).approve(wrappedLoan.address, toWei("500"));
            await wrappedLoan.fund(toBytes32("AVAX"), toWei("500"));
            await wrappedLoan.borrow(toBytes32("AVAX"), toWei("1"));

            await wrappedLoan.swapPangolin(
                toBytes32('AVAX'),
                toBytes32('USDC'),
                toWei('200'),
                0
            );
        });

        it("should provide liquidity", async () => {
            const initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            expect(await lpToken.balanceOf(wrappedLoan.address)).to.be.equal(0);

            expect(await loanOwnsAsset("PNG_AVAX_USDC_LP")).to.be.false;
            await wrappedLoan.addLiquidityPangolin(
                toBytes32('AVAX'),
                toBytes32('USDC'),
                toWei("180"),
                parseUnits((AVAX_PRICE * 180).toFixed(6), BigNumber.from("6")),
                toWei("160"),
                parseUnits((AVAX_PRICE * 160).toFixed(6), BigNumber.from("6"))
            );
            expect(await loanOwnsAsset("PNG_AVAX_USDC_LP")).to.be.true;

            expect(await lpToken.balanceOf(wrappedLoan.address)).to.be.gt(0);

            await expect(initialTotalValue - fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(0, 0.1);
            expect(await lpToken.balanceOf(wrappedLoan.address)).to.be.gt(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 0.1);
        });

        it("should remove liquidity", async () => {
            const initialTotalValue = fromWei(await wrappedLoan.getTotalValue());
            let initialHR = fromWei(await wrappedLoan.getHealthRatio());
            let initialTWV = fromWei(await wrappedLoan.getThresholdWeightedValue());

            expect(await lpToken.balanceOf(wrappedLoan.address)).not.to.be.equal(0);

            expect(await loanOwnsAsset("PNG_AVAX_USDC_LP")).to.be.true;
            await wrappedLoan.removeLiquidityPangolin(
                toBytes32('AVAX'),
                toBytes32('USDC'),
                await lpToken.balanceOf(wrappedLoan.address),
                toWei("160"),
                parseUnits((AVAX_PRICE * 160).toFixed(6), BigNumber.from("6"))
            );
            expect(await loanOwnsAsset("PNG_AVAX_USDC_LP")).to.be.false;


            await expect(initialTotalValue - fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(0, 0.1);
            expect(await lpToken.balanceOf(wrappedLoan.address)).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(initialHR, 0.01);
            expect(fromWei(await wrappedLoan.getThresholdWeightedValue())).to.be.closeTo(initialTWV, 0.1);
        });

        async function loanOwnsAsset(asset: string) {
            let ownedAssets =  await wrappedLoan.getAllOwnedAssets();
            for(const ownedAsset of ownedAssets){
                if(fromBytes32(ownedAsset) == asset){
                    return true;
                }
            }
            return false;
        }
    });
});

