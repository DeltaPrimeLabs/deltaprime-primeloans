import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import redstone from 'redstone-api';
import TokenManagerArtifact from '../../../artifacts/contracts/TokenManager.sol/TokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
    Asset, calculateHealthRatio,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployAndInitializeLendingPool,
    formatUnits,
    fromBytes32, fromWei,
    getFixedGasSigners,
    getLiquidationAmounts,
    PoolAsset,
    recompileConstantsFile,
    toBytes32,
    toWei,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "redstone-evm-connector";
import {
    PangolinIntermediary,
    Pool,
    RedstoneConfigManager__factory,
    SmartLoansFactory,
    TokenManager,
} from "../../../typechain";
import {Contract} from "ethers";
import {parseUnits} from "ethers/lib/utils";
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';

const {deployDiamond, replaceFacet} = require('../../../tools/diamond/deploy-diamond');

chai.use(solidity);

const {deployContract, provider} = waffle;
const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';

const erc20ABI = [
    'function decimals() public view returns (uint8)',
    'function symbol() public view returns (string)',
    'function balanceOf(address _owner) public view returns (uint256 balance)',
    'function approve(address _spender, uint256 _value) public returns (bool success)',
    'function allowance(address owner, address spender) public view returns (uint256)',
    'function transfer(address dst, uint wad) public returns (bool)'
]

const TEST_TABLE = [
    {
        id: 1,
        fundInUsd: {
            AVAX: 100,
            USDC: 0,
            ETH: 0,
            BTC: 0,
            LINK: 0
        },
        borrowInUsd: {
            AVAX: 550,
            USDC: 0,
            ETH: 0
        },
        maxLeverage: {
            AVAX: 0.8333333,
            USDC: 0.8333333,
            ETH: 0.8333333,
            BTC: 0.8333333,
            LINK: 0.8333333,
            YYAV3SA1: 0.8333333
        },
        targetHealthRatio: 1.03,
        action: 'LIQUIDATE'
    },
    {
        id: 2,
        fundInUsd: {
            AVAX: 100,
            USDC: 0,
            ETH: 0,
            BTC: 0,
            LINK: 0
        },
        borrowInUsd: {
            AVAX: 500,
            USDC: 0,
            ETH: 0
        },
        swaps: [
            {from: 'AVAX', to: 'USDC', all: true, amountInUsd: null}
        ],
        maxLeverage: {
            AVAX: 0.8333333,
            USDC: 0.8333333,
            ETH: 0.8333333,
            BTC: 0.8333333,
            LINK: 0.8333333,
            YYAV3SA1: 0.8333333
        },
        targetHealthRatio: 1.04,
        action: 'LIQUIDATE'
    },
    {
        id: 3,
        fundInUsd: {
            AVAX: 0,
            USDC: 0,
            ETH: 60,
            BTC: 0,
            LINK: 0
        },
        borrowInUsd: {
            AVAX: 0,
            USDC: 200,
            ETH: 200
        },
        swaps: [
            {from: 'USDC', to: 'BTC', amountInUsd: null, all: true},
            {from: 'ETH', to: 'LINK', amountInUsd: null, all: true}
        ],
        maxLeverage: {
            AVAX: 0.8333333,
            USDC: 0.8333333,
            ETH: 0.8333333,
            BTC: 0.8333333,
            LINK: 0.8333333,
            YYAV3SA1: 0.8333333
        },
        targetHealthRatio: 1.035,
        action: 'LIQUIDATE'
    },
    {
        id: 4,
        fundInUsd: {
            AVAX: 0,
            USDC: 0,
            ETH: 80,
            BTC: 0,
            LINK: 0
        },
        borrowInUsd: {
            AVAX: 0,
            USDC: 300,
            ETH: 280
        },
        swaps: [
            {from: 'USDC', to: 'AVAX', amountInUsd: 200, all: false},
            {from: 'USDC', to: 'BTC', amountInUsd: 90, all: false},
            {from: 'ETH', to: 'LINK', amountInUsd: 200, all: false},
            {from: 'ETH', to: 'AVAX', amountInUsd: 90, all: false}
        ],
        maxLeverage: {
            AVAX: 0.8333333,
            USDC: 0.8333333,
            ETH: 0.8333333,
            BTC: 0.8333333,
            LINK: 0.8333333,
            YYAV3SA1: 0.8333333
        },
        targetHealthRatio: 1.04,
        action: 'LIQUIDATE'
    },
    {
        id: 5,
        fundInUsd: {
            AVAX: 100,
            USDC: 0,
            ETH: 0,
            BTC: 0,
            LINK: 0
        },
        borrowInUsd: {
            AVAX: 550,
            USDC: 0,
            ETH: 0
        },
        stakeInUsd: {
            YAK: 640
        },
        maxLeverage: {
            AVAX: 0.8333333,
            USDC: 0.8333333,
            ETH: 0.8333333,
            BTC: 0.8333333,
            LINK: 0.8333333,
            YYAV3SA1: 0.8333333
        },
        targetHealthRatio: 1.04,
        action: 'LIQUIDATE'
    },
    {
        id: 6,
        fundInUsd: {
            AVAX: 0,
            USDC: 0,
            ETH: 0,
            BTC: 0,
            LINK: 50
        },
        borrowInUsd: {
            AVAX: 0,
            USDC: 350,
            ETH: 350
        },
        swaps: [
            {from: 'USDC', to: 'AVAX', all: true, amountInUsd: null},
            {from: 'ETH', to: 'AVAX', all: true, amountInUsd: null},
        ],
        stakeInUsd: {
            YAK: 690
        },
        maxLeverage: {
            AVAX: 0.8333333,
            USDC: 0.8333333,
            ETH: 0.8333333,
            BTC: 0.8333333,
            LINK: 0.8333333,
            YYAV3SA1: 0.8333333
        },
        targetHealthRatio: 1.04,
        action: 'LIQUIDATE'
    },
    {
        id: 7,
        fundInUsd: {
            AVAX: 0,
            USDC: 0,
            ETH: 0,
            BTC: 0,
            LINK: 0
        },
        borrowInUsd: {
            USDC: 300,
            AVAX: 0,
            ETH: 0
        },
        withdrawInUsd: {
            USDC: 50
        },
        maxLeverage: {
            AVAX: 0.8333333,
            USDC: 0.8333333,
            ETH: 0.8333333,
            BTC: 0.8333333,
            LINK: 0.8333333,
            YYAV3SA1: 0.8333333
        },
        //Solidity uint256 max
        targetHealthRatio: 1.157920892373162e+59,
        ratioPrecision: 0,
        action: 'HEAL'
    },
    {
        id: 8,
        fundInUsd: {
            AVAX: 0,
            USDC: 0,
            ETH: 0,
            BTC: 20,
            LINK: 20
        },
        borrowInUsd: {
            USDC: 200,
            AVAX: 200,
            ETH: 200
        },
        withdrawInUsd: {
            USDC: 50,
            AVAX: 50,
            ETH: 50
        },
        maxLeverage: {
            AVAX: 0.8333333,
            USDC: 0.8333333,
            ETH: 0.8333333,
            BTC: 0.8333333,
            LINK: 0.8333333,
            YYAV3SA1: 0.8333333
        },
        //Solidity uint256 max
        targetHealthRatio: 1.157920892373162e+59,
        ratioPrecision: 0,
        action: 'HEAL'
    },
    {
        id: 9,
        fundInUsd: {
            AVAX: 0,
            USDC: 0,
            ETH: 0,
            BTC: 0,
            LINK: 0
        },
        borrowInUsd: {
            USDC: 300,
            AVAX: 0,
            ETH: 0
        },
        withdrawInUsd: {
            USDC: 50
        },
        maxLeverage: {
            AVAX: 0.8333333,
            USDC: 0.8333333,
            ETH: 0.8333333,
            BTC: 0.8333333,
            LINK: 0.8333333,
            YYAV3SA1: 0.8333333
        },
        //Solidity uint256 max
        targetHealthRatio: 1.157920892373162e+59,
        ratioPrecision: 0,
        action: 'CLOSE'
    }
]

describe('Smart loan - real prices', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('An insolvent loan', () => {
        let exchange: PangolinIntermediary,
            loan: Contract,
            wrappedLoan: any,
            owner: SignerWithAddress,
            borrower: SignerWithAddress,
            depositor: SignerWithAddress,
            admin: SignerWithAddress,
            liquidator: SignerWithAddress,
            smartLoansFactory: SmartLoansFactory,
            supportedAssets: Array<Asset>,
            redstoneConfigManager: any,
            tokenContracts: any = {},
            poolContracts: any = {},
            tokenManager: any,
            MOCK_PRICES: any,
            AVAX_PRICE: number,
            LINK_PRICE: number,
            USD_PRICE: number,
            ETH_PRICE: number,
            YYAV3SA1_PRICE: number,
            BTC_PRICE: number,
            diamondAddress: any;

        before("deploy provider, exchange and pool", async () => {
            [owner, depositor, borrower, admin, liquidator] = await getFixedGasSigners(10000000);

            redstoneConfigManager = await (new RedstoneConfigManager__factory(owner).deploy(["0xFE71e9691B9524BC932C23d0EeD5c9CE41161884"]));
            let lendingPools = [];
            for (const token of [
                {'name': 'USDC', 'airdropList': [], 'autoPoolDeposit': false},
                {'name': 'AVAX', 'airdropList': [depositor, borrower], 'autoPoolDeposit': true},
                {'name': 'ETH', 'airdropList': [], 'autoPoolDeposit': false},
            ]) {
                let {
                    poolContract,
                    tokenContract
                } = await deployAndInitializeLendingPool(owner, token.name, token.airdropList);
                if (token.autoPoolDeposit) {
                    await tokenContract!.connect(depositor).approve(poolContract.address, toWei("1000"));
                    await poolContract.connect(depositor).deposit(toWei("1000"));
                }
                lendingPools.push(new PoolAsset(toBytes32(token.name), poolContract.address));
                poolContracts[token.name] = poolContract;
                tokenContracts[token.name] = tokenContract;
            }
            tokenContracts['BTC'] = new ethers.Contract(TOKEN_ADDRESSES['BTC'], erc20ABI, provider);
            tokenContracts['LINK'] = new ethers.Contract(TOKEN_ADDRESSES['LINK'], erc20ABI, provider);
            tokenContracts['YYAV3SA1'] = new ethers.Contract(TOKEN_ADDRESSES['YYAV3SA1'], erc20ABI, provider);

            supportedAssets = [
                new Asset(toBytes32('AVAX'), TOKEN_ADDRESSES['AVAX']),
                new Asset(toBytes32('USDC'), TOKEN_ADDRESSES['USDC']),
                new Asset(toBytes32('LINK'), TOKEN_ADDRESSES['LINK']),
                new Asset(toBytes32('ETH'), TOKEN_ADDRESSES['ETH']),
                new Asset(toBytes32('BTC'), TOKEN_ADDRESSES['BTC']),
                new Asset(toBytes32('YYAV3SA1'), TOKEN_ADDRESSES['YYAV3SA1']),
            ];

            tokenManager = await deployContract(
                owner,
                TokenManagerArtifact,
                [
                    supportedAssets,
                    lendingPools
                ]
            ) as TokenManager;

            diamondAddress = await deployDiamond();

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [],
                tokenManager.address,
                redstoneConfigManager.address,
                diamondAddress,
                ethers.constants.AddressZero,
                'lib'
            );

            exchange = await deployAndInitExchangeContract(owner, pangolinRouterAddress, supportedAssets, "PangolinIntermediary") as PangolinIntermediary;

            AVAX_PRICE = (await redstone.getPrice('AVAX', {provider: "redstone-avalanche-prod-1"})).value;
            USD_PRICE = (await redstone.getPrice('USDC', {provider: "redstone-avalanche-prod-1"})).value;
            LINK_PRICE = (await redstone.getPrice('LINK', {provider: "redstone-avalanche-prod-1"})).value;
            ETH_PRICE = (await redstone.getPrice('ETH', {provider: "redstone-avalanche-prod-1"})).value;
            BTC_PRICE = (await redstone.getPrice('BTC', {provider: "redstone-avalanche-prod-1"})).value;
            YYAV3SA1_PRICE = (await redstone.getPrice('YYAV3SA1', {provider: "redstone-avalanche-prod-1"})).value;

            //TODO: why do we mock prices? maybe we can use wrapLite?
            MOCK_PRICES = [
                {
                    symbol: 'AVAX',
                    value: AVAX_PRICE
                },
                {
                    symbol: 'USDC',
                    value: USD_PRICE
                },
                {
                    symbol: 'LINK',
                    value: LINK_PRICE
                },
                {
                    symbol: 'ETH',
                    value: ETH_PRICE
                },
                {
                    symbol: 'BTC',
                    value: BTC_PRICE
                },
                {
                    symbol: 'YYAV3SA1',
                    value: YYAV3SA1_PRICE
                }
            ];

            //deposit other tokens
            await depositToPool("USDC", tokenContracts['USDC'], poolContracts.USDC, 10000, USD_PRICE);
            await depositToPool("ETH", tokenContracts['ETH'], poolContracts.ETH, 1, ETH_PRICE);

            await topupUser(liquidator);
            await topupUser(borrower);

            async function depositToPool(symbol: string, tokenContract: Contract, pool: Pool, amount: number, price: number) {
                const initialTokenDepositWei = parseUnits(amount.toString(), await tokenContract.decimals());
                let requiredAvax = toWei((amount * price * 1.5 / AVAX_PRICE).toString());

                await tokenContracts['AVAX'].connect(depositor).deposit({value: requiredAvax});
                await tokenContracts['AVAX'].connect(depositor).transfer(exchange.address, requiredAvax);
                await exchange.connect(depositor).swap(tokenContracts['AVAX'].address, tokenContracts[symbol].address, requiredAvax, initialTokenDepositWei);

                await tokenContract.connect(depositor).approve(pool.address, initialTokenDepositWei);
                await pool.connect(depositor).deposit(initialTokenDepositWei);
            }

            async function topupUser(user: SignerWithAddress) {
                await tokenContracts['AVAX'].connect(user).deposit({value: toWei((25000 / AVAX_PRICE).toString())});

                const amountSwapped = toWei((5000 / AVAX_PRICE).toString());
                await tokenContracts['AVAX'].connect(user).transfer(exchange.address, amountSwapped);
                await exchange.connect(user).swap(tokenContracts['AVAX'].address, tokenContracts['USDC'].address, amountSwapped, 0);

                await tokenContracts['AVAX'].connect(user).transfer(exchange.address, amountSwapped);
                await exchange.connect(user).swap(tokenContracts['AVAX'].address, tokenContracts['ETH'].address, amountSwapped, 0);

                await tokenContracts['AVAX'].connect(user).transfer(exchange.address, amountSwapped);
                await exchange.connect(user).swap(tokenContracts['AVAX'].address, tokenContracts['BTC'].address, amountSwapped, 0);

                await tokenContracts['AVAX'].connect(user).transfer(exchange.address, amountSwapped);
                await exchange.connect(user).swap(tokenContracts['AVAX'].address, tokenContracts['LINK'].address, amountSwapped, 0);
            }
        });

        before("prepare smart loan facets", async () => {
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
                redstoneConfigManager.address,
                diamondAddress,
                ethers.constants.AddressZero,
                'lib'
            );
            await deployAllFacets(diamondAddress);

            //this facet is used to override max data timestamp delay
            await replaceFacet('MockSolvencyFacet', diamondAddress, ['isSolvent', 'getDebt', 'getTotalValue', 'getTotalAssetsValue', 'getHealthRatio', 'getPrices']);
        });

        beforeEach("create a loan", async () => {
            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
            await smartLoansFactory.initialize(diamondAddress);

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
                redstoneConfigManager.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );

            await replaceFacet('MockSolvencyFacetAlwaysSolvent', diamondAddress, ['isSolvent']);

            await smartLoansFactory.connect(borrower).createLoan();

            const loan_proxy_address = await smartLoansFactory.getLoanForOwner(borrower.address);

            loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, borrower);

            wrappedLoan = WrapperBuilder
                .mockLite(loan)
                .using(
                    () => {
                        return {
                            prices: MOCK_PRICES,
                            timestamp: Date.now()
                        }
                    });
        });


        TEST_TABLE.forEach(
            async testCase => {
                it(`Testcase ${testCase.id}:\n
        fund AVAX: ${testCase.fundInUsd.AVAX}, USDC: ${testCase.fundInUsd.USDC}, ETH: ${testCase.fundInUsd.ETH}, BTC: ${testCase.fundInUsd.BTC}, LINK: ${testCase.fundInUsd.LINK}\n
        borrow AVAX: ${testCase.borrowInUsd.AVAX}, USDC: ${testCase.borrowInUsd.USDC}, ETH: ${testCase.borrowInUsd.ETH}`,
                    async () => {
                        //fund
                        for (const [symbol, value] of Object.entries(testCase.fundInUsd)) {
                            if (value > 0) {
                                let contract = getTokenContract(symbol)!;
                                let tokenDecimals = await contract.decimals();

                                let requiredAvax = toWei((value * 1.3 / AVAX_PRICE).toString());
                                await tokenContracts['AVAX'].connect(borrower).deposit({value: requiredAvax});

                                if (symbol !== 'AVAX') {
                                    await tokenContracts['AVAX'].connect(borrower).transfer(exchange.address, requiredAvax);

                                    let amountOfToken = value / getPrice(symbol)!;

                                    await exchange.connect(borrower).swap(tokenContracts['AVAX'].address, tokenContracts[symbol].address, requiredAvax, parseUnits(amountOfToken.toFixed(tokenDecimals), tokenDecimals));
                                }

                                let amountOfTokens = value / getPrice(symbol)!;
                                await contract.connect(borrower).approve(wrappedLoan.address, parseUnits(amountOfTokens.toFixed(tokenDecimals), tokenDecimals));
                                await wrappedLoan.fund(toBytes32(symbol), parseUnits(amountOfTokens.toFixed(tokenDecimals), tokenDecimals));
                            }
                        }
                        // borrow
                        for (const [symbol, value] of Object.entries(testCase.borrowInUsd)) {
                            if (value > 0) {
                                let contract = getTokenContract(symbol)!;
                                let decimals = await contract.decimals();
                                let amountOfTokens = value / getPrice(symbol)!;

                                await wrappedLoan.borrow(toBytes32(symbol), toWei(amountOfTokens.toFixed(decimals) ?? 0, decimals));
                            }
                        }

                        if (testCase.withdrawInUsd) {
                            for (const [symbol, value] of Object.entries(testCase.withdrawInUsd)) {
                                if (value > 0) {
                                    let contract = getTokenContract(symbol)!;
                                    let decimals = await contract.decimals();
                                    let amountOfTokens = value / getPrice(symbol)!;

                                    await wrappedLoan.withdraw(toBytes32(symbol), toWei(amountOfTokens.toFixed(decimals) ?? 0, decimals));
                                }
                            }
                        }

                        if (testCase.swaps) {
                            for (const swap of testCase.swaps) {
                                let contract = getTokenContract(swap.from)!;
                                let tokenDecimals = await contract.decimals();
                                if (swap.all) {
                                    await wrappedLoan.swapPangolin(toBytes32(swap.from), toBytes32(swap.to), await wrappedLoan.getBalance(toBytes32(swap.from)), 0);
                                } else if (swap.amountInUsd) {
                                    let amountOfTokens = 0.99 * swap.amountInUsd / getPrice(swap.from)!;
                                    await wrappedLoan.swapPangolin(toBytes32(swap.from), toBytes32(swap.to), toWei(amountOfTokens.toFixed(tokenDecimals), tokenDecimals), 0);
                                }
                            }
                        }

                        if (testCase.stakeInUsd) {
                            //YAK AVAX
                            let amountOfTokens = testCase.stakeInUsd.YAK / getPrice("AVAX")!;
                            await wrappedLoan.stakeAVAXYak(toWei(amountOfTokens.toString()));
                        }

                        let maxBonus = 0.05;


                        // const bonus = calculateBonus(
                        //     testCase.action,
                        //     fromWei(await wrappedLoan.getDebt()),
                        //     fromWei(await wrappedLoan.getTotalValue()),
                        //     testCase.targetLtv,
                        //     maxBonus
                        // );

                        const bonus = maxBonus;

                        const weiDebts = (await wrappedLoan.getDebts());
                        const debts: any[] = [];
                        for (let debt of weiDebts) {
                            let symbol = fromBytes32(debt.name);
                            debts.push(
                                {
                                    name: symbol,
                                    debt: formatUnits(debt.debt, await getTokenContract(symbol)!.decimals())
                                }
                            )
                        }

                        const balances: any[] = [];

                        const weiBalances = (await wrappedLoan.getAllAssetsBalances());
                        for (let balance of weiBalances) {
                            let symbol = fromBytes32(balance.name);
                            balances.push(
                                {
                                    name: symbol,
                                    //@ts-ignore
                                    maxLeverage: testCase.maxLeverage[symbol],
                                    balance: formatUnits(balance.balance, await getTokenContract(symbol)!.decimals())
                                }
                            )
                        }

                        let loanIsBankrupt = await wrappedLoan.getTotalValue() < await wrappedLoan.getDebt();

                        let {repayAmounts, deliveredAmounts} = getLiquidationAmounts(
                            'LIQUIDATE',
                            debts,
                            balances,
                            MOCK_PRICES,
                            testCase.targetHealthRatio,
                            bonus,
                            loanIsBankrupt
                        );

                        const performer = testCase.action === 'CLOSE' ? borrower : liquidator;

                        let performerBalanceBefore = await liquidatingAccountBalanceInUsd(testCase, performer.address);

                        await action(wrappedLoan, testCase.action, deliveredAmounts, repayAmounts, bonus, testCase.stakeInUsd, performer);

                        let performerBalanceAfter = await liquidatingAccountBalanceInUsd(testCase, performer.address);

                        if (loanIsBankrupt) {
                            let funded = 0;

                            if (testCase.fundInUsd) {
                                for (const [, value] of Object.entries(testCase.fundInUsd)) {
                                    funded += value;
                                }
                            }

                            let withdrawn = 0;

                            if (testCase.withdrawInUsd) {
                                for (const [, value] of Object.entries(testCase.withdrawInUsd)) {
                                    withdrawn += value;
                                }
                            }

                            let badDebt = withdrawn - funded;

                            expect(performerBalanceBefore - performerBalanceAfter).to.be.closeTo(badDebt, 0.05);
                        }

                        // if (!loanIsBankrupt) {
                        //     expect(performerBalanceAfter - performerBalanceBefore).to.be.closeTo(bonus * neededToRepay, 0.05);
                        // }

                        // @ts-ignore
                        expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(testCase.targetHealthRatio, testCase.ratioPrecision ?? 0.001);
                });
            }
        );


        async function action(
            wrappedLoan: Contract,
            performedAction: string,
            allowanceAmounts: any[],
            repayAmounts: any[],
            bonus: number,
            stake: any,
            performer: any
        ) {

            //this facet is used to override max data timestamp delay
            await replaceFacet('MockSolvencyFacet', diamondAddress, ['isSolvent', 'getDebt', 'getTotalValue', 'getTotalAssetsValue', 'getHealthRatio', 'getPrices']);

            const initialStakedYakTokensBalance = await tokenContracts['YYAV3SA1'].balanceOf(performer.address);

            wrappedLoan = WrapperBuilder
                .mockLite(loan.connect(performer))
                .using(
                    () => {
                        return {
                            prices: MOCK_PRICES,
                            timestamp: Date.now()
                        }
                    })

            expect(await wrappedLoan.isSolvent()).to.be.false;

            let amountsToRepayInWei = [];
            let assetsToRepay = [];
            for (const repayment of repayAmounts) {
                let decimals = await tokenContracts[repayment.name].decimals();
                amountsToRepayInWei.push(parseUnits((Number(repayment.amount).toFixed(decimals) ?? 0).toString(), decimals));
                assetsToRepay.push(toBytes32(repayment.name));
            }

            for (const allowance of allowanceAmounts) {
                let decimals = await tokenContracts[allowance.name].decimals();
                let delivered = parseUnits((Number(1.001 * allowance.amount).toFixed(decimals) ?? 0).toString(), decimals);
                await tokenContracts[allowance.name].connect(performer).approve(wrappedLoan.address, delivered);
            }


            const bonusInWei = (bonus * 1000).toFixed(0);

            switch (performedAction) {
                case 'LIQUIDATE':
                    await wrappedLoan.liquidateLoan(assetsToRepay, amountsToRepayInWei, bonusInWei);
                    break;
                case 'HEAL':
                    await wrappedLoan.unsafeLiquidateLoan(assetsToRepay, amountsToRepayInWei, bonusInWei);
                    break;
                case 'CLOSE':
                    await wrappedLoan.unsafeLiquidateLoan(assetsToRepay, amountsToRepayInWei, bonusInWei);
                    break;
            }

            expect(await wrappedLoan.isSolvent()).to.be.true;
            if (stake) {
                expect(await tokenContracts['YYAV3SA1'].balanceOf(performer.address)).to.be.gt(initialStakedYakTokensBalance);
            }
        }

        function getTokenContract(symbol: string) {
            if (symbol == "AVAX") return tokenContracts['AVAX'];
            if (symbol == "USDC") return tokenContracts['USDC'];
            if (symbol == "ETH") return tokenContracts['ETH'];
            if (symbol == "LINK") return tokenContracts['LINK'];
            if (symbol == "BTC") return tokenContracts['BTC'];
            if (symbol == "YYAV3SA1") return tokenContracts['YYAV3SA1'];
        }

        function getPrice(symbol: string) {
            if (symbol == "AVAX") return AVAX_PRICE;
            if (symbol == "USDC") return USD_PRICE;
            if (symbol == "ETH") return ETH_PRICE;
            if (symbol == "LINK") return LINK_PRICE;
            if (symbol == "BTC") return BTC_PRICE;
            if (symbol == "YYAV3SA1") return YYAV3SA1_PRICE;
        }

        async function liquidatingAccountBalanceInUsd(testCase: any, account: string) {
            let balanceInUsd = 0;
            for (const [asset,] of Object.entries(testCase.fundInUsd)) {
                balanceInUsd += formatUnits(await tokenContracts[asset].balanceOf(account), await tokenContracts[asset].decimals()) * getPrice(asset)!;
            }

            if (testCase.stakeInUsd) {
                balanceInUsd += formatUnits(await tokenContracts['YYAV3SA1'].balanceOf(account), await tokenContracts['YYAV3SA1'].decimals()) * getPrice('YYAV3SA1')!
            }

            return balanceInUsd;
        }
    });
});