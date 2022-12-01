import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import TokenManagerArtifact from '../../../artifacts/contracts/TokenManager.sol/TokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
    Asset,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployAndInitializeLendingPool, formatUnits, fromBytes32, fromWei,
    getFixedGasSigners,
    getLiquidationAmounts,
    PoolAsset,
    recompileConstantsFile,
    toBytes32,
    toWei,
} from "../../_helpers";
import {syncTime} from "../../_syncTime"
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {
    TraderJoeIntermediary,
    Pool,
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
    TokenManager,
} from "../../../typechain";
import {Contract} from "ethers";
import {parseUnits} from "ethers/lib/utils";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';
import TOKEN_ADDRESSES from '../../../common/addresses/avax/token_addresses.json';

chai.use(solidity);

const {deployContract, provider} = waffle;
const traderJoeRouterAddress = '0x60aE616a2155Ee3d9A68541Ba4544862310933d4';

const erc20ABI = [
    'function decimals() public view returns (uint8)',
    'function balanceOf(address _owner) public view returns (uint256 balance)',
    'function approve(address _spender, uint256 _value) public returns (bool success)',
    'function allowance(address owner, address spender) public view returns (uint256)',
    'function transfer(address dst, uint wad) public returns (bool)'
]

const INITIAL_PRICES = {
    AVAX: 15,
    USDC: 1,
    ETH: 1000,
    BTC: 20000,
    YY_AAVE_AVAX: 15.2,
}

const TEST_TABLE = [
    {
        id: 1,
        fund: {
            AVAX: 20,
            USDC: 0,
            ETH: 0,
            BTC: 0
        },
        borrow: {
            AVAX: 0,
            USDC: 1200,
            ETH: 0
        },
        pricesDuringLiquidation: {
            AVAX: 8
        },
        maxLeverage: {
            AVAX: 0.8333333,
            USDC: 0.8333333,
            ETH: 0.8333333,
            BTC: 0.8333333,
            YY_AAVE_AVAX: 0.8333333
        },
        targetHealthRatio: 1.04,
        action: 'LIQUIDATE'
    },
    {
        id: 2,
        fund: {
            AVAX: 0,
            USDC: 0,
            ETH: 0,
            BTC: 0.01
        },
        borrow: {
            AVAX: 10,
            USDC: 150,
            ETH: 0.2
        },
        pricesDuringLiquidation: {
            BTC: 10000
        },
        maxLeverage: {
            AVAX: 0.8333333,
            USDC: 0.8333333,
            ETH: 0.8333333,
            BTC: 0.8333333,
            YY_AAVE_AVAX: 0.8333333
        },
        targetHealthRatio: 1.035,
        action: 'LIQUIDATE'
    },
    {
        id: 3,
        fund: {
            AVAX: 0,
            USDC: 0,
            ETH: 0.1,
            BTC: 0
        },
        borrow: {
            AVAX: 20,
            USDC: 0,
            ETH: 0
        },
        stake: {
            YAK: 18
        },
        pricesDuringLiquidation: {
            ETH: 600
        },
        maxLeverage: {
            AVAX: 0.8333333,
            USDC: 0.8333333,
            ETH: 0.8333333,
            BTC: 0.8333333,
            YY_AAVE_AVAX: 0.8333333
        },
        targetHealthRatio: 1.04,
        action: 'LIQUIDATE'
    },
    //TODO: this is an edge scenario, because "collateral" is super close to 0
    {
        id: 4,
        fund: {
            AVAX: 0,
            USDC: 300,
            ETH: 0,
            BTC: 0
        },
        borrow: {
            AVAX: 40,
            USDC: 0,
            ETH: 0
        },
        pricesDuringLiquidation: {
            USDC: 0.000001// changed from 1
            //Black swan event
        },
        maxLeverage: {
            AVAX: 0.8333333,
            USDC: 0.8333333,
            ETH: 0.8333333,
            BTC: 0.8333333,
            YY_AAVE_AVAX: 0.8333333
        },
        targetHealthRatio: 1.04,
        //needs more margin because of accumulation of interest when repaying the loan (affects debt and final LTV)
        ratioPrecision: 0.01,
        action: 'LIQUIDATE'
    }
]

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('An insolvent loan - mock prices', () => {
        let exchange: TraderJoeIntermediary,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            owner: SignerWithAddress,
            borrowers: SignerWithAddress[],
            borrower: SignerWithAddress,
            borrower1: SignerWithAddress,
            borrower2: SignerWithAddress,
            borrower3: SignerWithAddress,
            borrower4: SignerWithAddress,
            depositor: SignerWithAddress,
            admin: SignerWithAddress,
            liquidator: SignerWithAddress,
            smartLoansFactory: SmartLoansFactory,
            tokenContracts: any = {},
            poolContracts: any = {},
            supportedAssets: Array<Asset>,
            INITIAL_MOCK_PRICES: any,
            newPrices: [],
            tokenManager: any,
            diamondAddress: any;

        before("deploy provider, exchange and pool", async () => {
            [owner, depositor, borrower1, borrower2, borrower3, borrower4, admin, liquidator] = await getFixedGasSigners(10000000);

            borrowers = [borrower1, borrower2, borrower3, borrower4];

            diamondAddress = await deployDiamond();
            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
            await smartLoansFactory.initialize(diamondAddress);

            let lendingPools = [];
            for (const token of [
                {'name': 'USDC', 'airdropList': [], 'autoPoolDeposit': false},
                {'name': 'AVAX', 'airdropList': [depositor, borrower1, borrower2, borrower3, borrower4], 'autoPoolDeposit': true},
                {'name': 'ETH', 'airdropList': [], 'autoPoolDeposit': false},
            ]) {
                let {
                    poolContract,
                    tokenContract
                } = await deployAndInitializeLendingPool(owner, token.name, smartLoansFactory.address, token.airdropList);
                if (token.autoPoolDeposit) {
                    await tokenContract!.connect(depositor).approve(poolContract.address, toWei("1000"));
                    await poolContract.connect(depositor).deposit(toWei("1000"));
                }
                lendingPools.push(new PoolAsset(toBytes32(token.name), poolContract.address));
                poolContracts[token.name] = poolContract;
                tokenContracts[token.name] = tokenContract;
            }
            tokenContracts['BTC'] = new ethers.Contract(TOKEN_ADDRESSES['BTC'], erc20ABI, provider);
            tokenContracts['YY_AAVE_AVAX'] = new ethers.Contract(TOKEN_ADDRESSES['YY_AAVE_AVAX'], erc20ABI, provider);

            supportedAssets = [
                new Asset(toBytes32('AVAX'), TOKEN_ADDRESSES['AVAX']),
                new Asset(toBytes32('USDC'), TOKEN_ADDRESSES['USDC']),
                new Asset(toBytes32('ETH'), TOKEN_ADDRESSES['ETH']),
                new Asset(toBytes32('BTC'), TOKEN_ADDRESSES['BTC']),
                new Asset(toBytes32('YY_AAVE_AVAX'), TOKEN_ADDRESSES['YY_AAVE_AVAX']),
            ];

            INITIAL_MOCK_PRICES = [
                {
                    dataFeedId: 'AVAX',
                    value: INITIAL_PRICES.AVAX
                },
                {
                    dataFeedId: 'USDC',
                    value: INITIAL_PRICES.USDC
                },
                {
                    dataFeedId: 'ETH',
                    value: INITIAL_PRICES.ETH
                },
                {
                    dataFeedId: 'BTC',
                    value: INITIAL_PRICES.BTC
                },
                {
                    dataFeedId: 'YY_AAVE_AVAX',
                    value: INITIAL_PRICES.YY_AAVE_AVAX
                },
            ];

            tokenManager = await deployContract(
                owner,
                TokenManagerArtifact,
                [
                    supportedAssets,
                    lendingPools
                ]
            ) as TokenManager;

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [],
                tokenManager.address,
                diamondAddress,
                ethers.constants.AddressZero,
                'lib'
            );

            exchange = await deployAndInitExchangeContract(owner, traderJoeRouterAddress, supportedAssets, "TraderJoeIntermediary") as TraderJoeIntermediary;
            //deposit other tokens
            await depositToPool("USDC", tokenContracts['USDC'], poolContracts.USDC, 10000, INITIAL_PRICES.USDC);
            await depositToPool("ETH", tokenContracts['ETH'], poolContracts.ETH, 1, INITIAL_PRICES.ETH);

            await topupUser(liquidator);

            for (let user of borrowers) {
                await topupUser(user);
            }

            async function depositToPool(symbol: string, tokenContract: Contract, pool: Pool, amount: number, price: number) {
                const initialTokenDepositWei = parseUnits(amount.toString(), await tokenContract.decimals());
                let requiredAvax = toWei((amount * price * 1.5 / INITIAL_PRICES.AVAX).toString());

                await tokenContracts['AVAX'].connect(depositor).deposit({value: requiredAvax});
                await tokenContracts['AVAX'].connect(depositor).transfer(exchange.address, requiredAvax);
                await exchange.connect(depositor).swap(tokenContracts['AVAX'].address, tokenContract.address, requiredAvax, initialTokenDepositWei);

                await tokenContract.connect(depositor).approve(pool.address, initialTokenDepositWei);
                await pool.connect(depositor).deposit(initialTokenDepositWei);
            }

            async function topupUser(user: SignerWithAddress) {
                await tokenContracts['AVAX'].connect(user).deposit({value: toWei((10 * 1000 / INITIAL_PRICES.AVAX).toString())});

                const amountSwapped = toWei((1000 / INITIAL_PRICES.AVAX).toString());
                await tokenContracts['AVAX'].connect(user).transfer(exchange.address, amountSwapped);
                await exchange.connect(user).swap(tokenContracts['AVAX'].address, tokenContracts['USDC'].address, amountSwapped, 0);

                await tokenContracts['AVAX'].connect(user).transfer(exchange.address, amountSwapped);
                await exchange.connect(user).swap(tokenContracts['AVAX'].address, tokenContracts['ETH'].address, amountSwapped, 0);

                await tokenContracts['AVAX'].connect(user).transfer(exchange.address, amountSwapped);
                await exchange.connect(user).swap(tokenContracts['AVAX'].address, tokenContracts['BTC'].address, amountSwapped, 0);
            }
        });

        before("prepare smart loan implementations", async () => {
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
                ethers.constants.AddressZero,
                'lib'
            );

            await deployAllFacets(diamondAddress)
        });

        beforeEach("create a loan", async () => {
            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [
                    {
                        facetPath: './contracts/facets/avalanche/TraderJoeDEXFacet.sol',
                        contractAddress: exchange.address,
                    }
                ],
                tokenManager.address,
                diamondAddress,
                smartLoansFactory.address,
                'lib'
            );
        });

        TEST_TABLE.forEach(
            async testCase => {
                //TODO: re-fucking-move
                if (testCase.id) {
                    it(`Testcase ${testCase.id}:\n
        fund AVAX: ${testCase.fund.AVAX}, USDC: ${testCase.fund.USDC}, ETH: ${testCase.fund.ETH}, BTC: ${testCase.fund.BTC}\n
        borrow AVAX: ${testCase.borrow.AVAX}, USDC: ${testCase.borrow.USDC}, ETH: ${testCase.borrow.ETH}`,
                    async () => {
                        //create loan
                        borrower = borrowers[testCase.id - 1];

                        await smartLoansFactory.connect(borrower).createLoan();

                        const loan_proxy_address = await smartLoansFactory.getLoanForOwner(borrower.address);

                        loan = await ethers.getContractAt("SmartLoanGigaChadInterface", loan_proxy_address, borrower);

                        wrappedLoan = WrapperBuilder
                            // @ts-ignore
                            .wrap(loan)
                            .usingSimpleNumericMock({
                                mockSignersCount: 10,
                                dataPoints: INITIAL_MOCK_PRICES,
                            });
                        //fund
                        for (const [symbol, value] of Object.entries(testCase.fund)) {
                            if (value > 0) {
                                let contract = getTokenContract(symbol)!;
                                let tokenDecimals = await contract.decimals();

                                let requiredAvax = toWei((value * getPrice(symbol)! * 1.5 / INITIAL_PRICES.AVAX).toString());
                                await tokenContracts['AVAX'].connect(borrower).deposit({value: requiredAvax});

                                if (symbol !== 'AVAX') {
                                    await tokenContracts['AVAX'].connect(borrower).transfer(exchange.address, requiredAvax);
                                    await exchange.connect(borrower).swap(tokenContracts['AVAX'].address, tokenContracts[symbol].address, requiredAvax, toWei(value.toString(), tokenDecimals));
                                }

                                await contract.connect(borrower).approve(wrappedLoan.address, toWei(value.toString(), tokenDecimals));
                                await wrappedLoan.fund(toBytes32(symbol), toWei(value.toString(), tokenDecimals));
                            }
                        }

                        //borrow
                        for (const [symbol, value] of Object.entries(testCase.borrow)) {
                            if (value > 0) {
                                let contract = getTokenContract(symbol)!;
                                let decimals = await contract.decimals();
                                await wrappedLoan.borrow(toBytes32(symbol), toWei(value.toFixed(decimals) ?? 0, decimals));
                            }
                        }

                        if (testCase.stake) {
                            //YAK AVAX
                            // @ts-ignore
                            await wrappedLoan.stakeAVAXYak(toWei(testCase.stake.YAK.toString()));
                        }

                        newPrices = INITIAL_MOCK_PRICES.map(
                            (asset: any) => {
                                // @ts-ignore
                                let newPrice = testCase.pricesDuringLiquidation[asset.dataFeedId];

                                return {
                                    dataFeedId: asset.dataFeedId,
                                    value: newPrice ?? asset.value
                                };
                            }
                        )

                        wrappedLoan = WrapperBuilder
                            // @ts-ignore
                            .wrap(loan)
                            .usingSimpleNumericMock({
                                mockSignersCount: 10,
                                dataPoints: newPrices,
                            });

                        let maxBonus = 0.1;


                        //TODO: BONUS CALCULATION
                        // const bonus = calculateBonus(
                        //     testCase.action,
                        //     fromWei(await wrappedLoan.getDebt()),
                        //     fromWei(await wrappedLoan.getTotalValue()),
                        //     testCase.targetLtv,
                        //     maxBonus
                        // );

                        const bonus = Math.abs(fromWei(await wrappedLoan.getTotalValue()) - fromWei(await wrappedLoan.getDebt())) < 0.1 ? 0 : maxBonus;

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
                            newPrices,
                            testCase.targetHealthRatio,
                            bonus,
                            loanIsBankrupt
                        );

                        await action(wrappedLoan, testCase.action, deliveredAmounts, repayAmounts, bonus, testCase.stake);
                        // @ts-ignore
                        expect(fromWei(await wrappedLoan.getHealthRatio())).to.be.closeTo(testCase.targetHealthRatio, testCase.ratioPrecision ?? 0.005);
                    });

            }}
        );


        async function action(
            wrappedLoan: Contract,
            performedAction: string,
            allowanceAmounts: any[],
            repayAmounts: any[],
            bonus: number,
            stake: any
        ) {
            const performer = performedAction === 'CLOSE' ? borrower : liquidator;
            const initialStakedYakTokensBalance = await tokenContracts['YY_AAVE_AVAX'].balanceOf(performer.address);
            expect(await wrappedLoan.isSolvent()).to.be.false;


            // @ts-ignore
            wrappedLoan = WrapperBuilder
                // @ts-ignore
                .wrap(loan.connect(performer))
                .usingSimpleNumericMock({
                    mockSignersCount: 10,
                    dataPoints: newPrices,
                });

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
            }


            //TODO remove
            let balances: any[] = [];
            for (let balance of await wrappedLoan.getAllAssetsBalances()) {
                let token = fromBytes32(balance.name);
                let amount = formatUnits(balance.balance,
                    await getTokenContract(token)!.decimals());
                balances.push({
                    name: token,
                    balance: amount,
                    maxLeverage: 0.8333333
                })
            }

            let debts: any[] = [];
            for (let debt of await wrappedLoan.getDebts()) {
                let token = fromBytes32(debt.name);
                let amount = formatUnits(debt.debt,
                    await getTokenContract(token)!.decimals());
                debts.push({
                    name: token,
                    debt: amount
                })
            }

            expect(await wrappedLoan.isSolvent()).to.be.true;
            if (stake) {
                expect(await tokenContracts['YY_AAVE_AVAX'].balanceOf(performer.address)).to.be.gt(initialStakedYakTokensBalance);
            }
        }

        function getTokenContract(symbol: string) {
            if (symbol == "AVAX") return tokenContracts['AVAX'];
            if (symbol == "USDC") return tokenContracts['USDC'];
            if (symbol == "ETH") return tokenContracts['ETH'];
            if (symbol == "BTC") return tokenContracts['BTC'];
            if (symbol == "YY_AAVE_AVAX") return tokenContracts['YY_AAVE_AVAX'];
        }

        function getPrice(symbol: string) {
            if (symbol == "AVAX") return INITIAL_PRICES.AVAX;
            if (symbol == "USDC") return INITIAL_PRICES.USDC;
            if (symbol == "ETH") return INITIAL_PRICES.ETH;
            if (symbol == "BTC") return INITIAL_PRICES.BTC;
            if (symbol == "YY_AAVE_AVAX") return INITIAL_PRICES.YY_AAVE_AVAX;
        }
    });
});

