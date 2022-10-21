import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";
import {AssetBalanceLeverage, Debt, getLiquidationAmounts, Repayment} from "../_helpers";

chai.use(solidity);

describe('Helper methods', () => {

    describe('Calculating liquidation amounts', async () => {
        const TEST_TABLE = [
            {
                id: 1,
                balances: [
                    new AssetBalanceLeverage('AVAX', 300, 0.8333333),
                    new AssetBalanceLeverage('BTC', 0, 0.8333333),
                    new AssetBalanceLeverage('USDC', 0, 0.8333333),
                    new AssetBalanceLeverage('ETH', 0, 0.8333333)
                ],
                debts: [
                    new Debt('AVAX', 250),
                    new Debt('BTC', 0),
                    new Debt('USDC', 0),
                    new Debt('ETH', 0)
                ],
                repayAmounts: [
                    new Repayment('AVAX', 10)
                ],
                deliveredAmounts: [
                ],
                targetHealthRatio: 1.04,
                action: 'LIQUIDATE'
            },
        ];

        const MOCK_PRICES = [
            {
                symbol: 'AVAX',
                value: 20
            },
            {
                symbol: 'USDC',
                value: 1
            },
            {
                symbol: 'ETH',
                value: 1000
            },
            {
                symbol: 'BTC',
                value: 20000
            }
        ];

        TEST_TABLE.forEach(
            testCase => {
                it(`liquidation test case number ${testCase.id}`, async function () {
                    let {repayAmounts, deliveredAmounts} = getLiquidationAmounts(
                        'LIQUIDATE',
                        testCase.debts,
                        testCase.balances,
                        MOCK_PRICES,
                        testCase.targetHealthRatio
                    );

                    console.log(repayAmounts)
                    console.log(deliveredAmounts)

                    repayAmounts.forEach(
                        calculated => {
                            let expected = testCase.repayAmounts.find(el => el.symbol == calculated.symbol)!;

                            console.log('repaid ', expected.symbol, ` calculated ${calculated.amount}, expected ${expected.amount}`);

                            expect(calculated.amount).to.be.closeTo(expected.amount, 0.001);
                        }
                    );

                    if (testCase.deliveredAmounts && testCase.deliveredAmounts.length > 0) {
                        deliveredAmounts.forEach(
                            calculated => {
                                //@ts-ignore
                                let expected = testCase.deliveredAmounts.find(el => el!.symbol == calculated.symbol)!;
                                //@ts-ignore
                                console.log('delievered ', expected.symbol, ` calculated ${calculated.amount}, expected ${expected.amount}`);
                                //@ts-ignore
                                expect(calculated.amount).to.be.closeTo(expected.amount, 0.001);
                            }
                        );
                    }
                });
            }
        )
    });
});

