//npx hardhat test test/integration/celo/ubeswap.test.ts --network localhost

import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';
import {JsonRpcSigner} from "@ethersproject/providers";
import TokenManagerArtifact from '../../../artifacts/contracts/TokenManager.sol/TokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {WrapperBuilder} from "redstone-evm-connector";
import {
    Asset,
    deployAllFacets,
    deployAndInitializeLendingPool,
    extractAssetNameBalances,
    fromWei,
    getFixedGasSigners,
    PoolAsset,
    recompileConstantsFile,
    toBytes32,
    toWei
} from "../../_helpers";
import {
    RedstoneConfigManager__factory,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
    TokenManager,
    UbeswapIntermediary,
} from "../../../typechain";
import {Wallet} from "ethers";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from '../../../common/addresses/celo/token_addresses.json';

chai.use(solidity);

const {deployContract, provider} = waffle;
const ubeswapRouterAddress = '0xE3D8bd6Aed4F159bc8000a9cD47CffDb95F96121';

const erc20ABI = [
    'function transfer(address recipient, uint256 amount) returns (bool)',
    'function decimals() public view returns (uint8)',
    'function balanceOf(address _owner) public view returns (uint256 balance)',
    'function approve(address _spender, uint256 _value) public returns (bool success)',
    'function allowance(address owner, address spender) public view returns (uint256)'
]

describe('Smart loan', () => {

    describe('A loan without debt', () => {
        let exchange: UbeswapIntermediary,
            smartLoansFactory: SmartLoansFactory,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            owner: JsonRpcSigner,
            depositor: Wallet,
            random: SignerWithAddress,
            tokenContracts: any = {},
            MOCK_PRICES: any,
            CELO_PRICE: number,
            USD_PRICE: number,
            ETH_PRICE: number;

        before("deploy factory, exchange, WrappedNativeTokenPool and usdPool", async () => {
            [random] = await getFixedGasSigners(6500000);

            owner = provider.getSigner('0x5839Dd13ad2C78dDcF3365D54302D65764619737');
            depositor = ethers.Wallet.createRandom().connect(provider);

            await random.sendTransaction({
                to: depositor.address,
                value: toWei("20")
            })

            await random.sendTransaction({
                to: await owner.getAddress(),
                value: toWei("20")
            })

            tokenContracts['CELO'] = new ethers.Contract(TOKEN_ADDRESSES['CELO'], erc20ABI, provider);
            tokenContracts['mcUSD'] = new ethers.Contract(TOKEN_ADDRESSES['mcUSD'], erc20ABI, provider);
            tokenContracts['ETH'] = new ethers.Contract(TOKEN_ADDRESSES['ETH'], erc20ABI, provider);

            let redstoneConfigManager = await (new RedstoneConfigManager__factory(owner).deploy(["0xFE71e9691B9524BC932C23d0EeD5c9CE41161884"]));

            let lendingPools = [];
            for (const token of [
                {'name': 'CELO', 'airdropList': []}
            ]) {
                let {
                    poolContract,
                    tokenContract
                } = await deployAndInitializeLendingPool(owner, token.name, token.airdropList, 'CELO');
                await tokenContract!.connect(depositor).approve(poolContract.address, toWei("10"));
                await poolContract.connect(depositor).deposit(toWei("10"));
                lendingPools.push(new PoolAsset(toBytes32(token.name), poolContract.address));
                tokenContracts[token.name] = tokenContract;
            }

            let supportedAssets = [
                new Asset(toBytes32('CELO'), TOKEN_ADDRESSES['CELO']),
                new Asset(toBytes32('mcUSD'), TOKEN_ADDRESSES['mcUSD']),
                new Asset(toBytes32('ETH'), TOKEN_ADDRESSES['ETH'])
            ]

            let tokenManager = await deployContract(
                owner,
                TokenManagerArtifact,
                [
                    supportedAssets,
                    lendingPools
                ]
            ) as TokenManager;

            let diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
            await smartLoansFactory.initialize(diamondAddress);

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [],
                tokenManager.address,
                redstoneConfigManager.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib',
                undefined,
                undefined,
                undefined,
                'CELO'
            );

            let exchangeFactory = await ethers.getContractFactory("UbeswapIntermediary");
            exchange = (await exchangeFactory.deploy()).connect(owner) as UbeswapIntermediary;
            await exchange.initialize(ubeswapRouterAddress, supportedAssets.map(asset => asset.assetAddress));

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [
                    {
                        facetPath: './contracts/facets/celo/PangolinDEXFacet.sol',
                        contractAddress: exchange.address,
                    }
                ],
                tokenManager.address,
                redstoneConfigManager.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );

            await deployAllFacets(diamondAddress, 'CELO')
        });

        it("should deploy a smart loan", async () => {
            CELO_PRICE = (await redstone.getPrice('CELO')).value;
            USD_PRICE = (await redstone.getPrice('USDC')).value;
            ETH_PRICE = (await redstone.getPrice('ETH')).value;

            MOCK_PRICES = [
                {
                    symbol: 'CELO',
                    value: CELO_PRICE
                },
                {
                    symbol: 'mcUSD',
                    value: USD_PRICE
                },
                {
                    symbol: 'ETH',
                    value: ETH_PRICE
                }
            ];

            await smartLoansFactory.connect(owner).createLoan();

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(await owner.getAddress());

            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, owner);

            wrappedLoan = WrapperBuilder
                .mockLite(loan)
                .using(
                    () => {
                        return {
                            prices: MOCK_PRICES,
                            timestamp: Date.now()
                        }
                    })
        });

        it("should fund a loan", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.equal(0);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(await wrappedLoan.getLTV()).to.be.equal(0);

            await tokenContracts['ETH'].connect(owner).approve(wrappedLoan.address, toWei("10"));
            await wrappedLoan.fund(toBytes32("ETH"), toWei("10"));

            expect(fromWei(await tokenContracts['ETH'].balanceOf(wrappedLoan.address))).to.be.closeTo(10, 0.1);

            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(ETH_PRICE * 10, 0.01);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(await wrappedLoan.getLTV()).to.be.equal(0);
        });

        it("should fail to swap from a non-owner account", async () => {
            let nonOwnerWrappedLoan = WrapperBuilder
                .mockLite(loan.connect(depositor))
                .using(
                    () => {
                        return {
                            prices: MOCK_PRICES,
                            timestamp: Date.now()
                        }
                    })
            await expect(nonOwnerWrappedLoan.swapUbeswap(
                toBytes32('ETH'), toBytes32('mcUSD'), 0, 0)).to.be.revertedWith("DiamondStorageLib: Must be contract owner");
        });


        it("should buy an asset from funded", async () => {
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(ETH_PRICE * 10, 2);

            const slippageTolerance = 0.1;
            const swappedEthAmount = 3;
            const expectedUSDAmount = ETH_PRICE * swappedEthAmount / (1 + slippageTolerance);

            expect(fromWei(await tokenContracts['ETH'].balanceOf(wrappedLoan.address))).to.be.closeTo(10, 0.1);

            await wrappedLoan.swapUbeswap(
                toBytes32('ETH'),
                toBytes32('mcUSD'),
                toWei(swappedEthAmount.toString()),
                toWei(expectedUSDAmount.toString())
            )

            expect(fromWei(await tokenContracts['ETH'].balanceOf(wrappedLoan.address))).to.be.closeTo(10 - swappedEthAmount, 0.1);
            expect(fromWei((await extractAssetNameBalances(wrappedLoan))["ETH"])).to.be.closeTo(10 - swappedEthAmount, 0.05);
            expect(fromWei(await tokenContracts['mcUSD'].balanceOf(wrappedLoan.address))).to.be.closeTo(expectedUSDAmount, 400);
            expect(fromWei((await extractAssetNameBalances(wrappedLoan))["mcUSD"])).to.be.closeTo(expectedUSDAmount, 400);

            // total value should stay similar to before swap
            expect(fromWei(await wrappedLoan.getTotalValue())).to.be.closeTo(ETH_PRICE * 10, 300);
            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(await wrappedLoan.getLTV()).to.be.equal(0);
        });

        it("should swap back", async () => {
            const initialUsdTokenBalance = (await extractAssetNameBalances(wrappedLoan))["mcUSD"];

            const slippageTolerance = 0.1;

            const ethAmount = fromWei(initialUsdTokenBalance) / ETH_PRICE / (1 + slippageTolerance);

            await wrappedLoan.swapUbeswap(
                toBytes32('mcUSD'),
                toBytes32('ETH'),
                initialUsdTokenBalance,
                toWei(ethAmount.toString())
            );

            const currentUsdTokenBalance = (await extractAssetNameBalances(wrappedLoan))["mcUSD"];

            expect(fromWei(currentUsdTokenBalance)).to.be.closeTo(0, 1);

            expect(fromWei(await wrappedLoan.getDebt())).to.be.equal(0);
            expect(await wrappedLoan.getLTV()).to.be.equal(0);
        });
    });
});

