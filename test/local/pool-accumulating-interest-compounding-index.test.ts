import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import VariableUtilisationRatesCalculatorArtifact
    from '../../artifacts/contracts/mock/MockVariableUtilisationRatesCalculator.sol/MockVariableUtilisationRatesCalculator.json';
import CompoundingIndexArtifact from '../../artifacts/contracts/CompoundingIndex.sol/CompoundingIndex.json';
import PoolArtifact from '../../artifacts/contracts/Pool.sol/Pool.json';
import MockTokenArtifact from "../../artifacts/contracts/mock/MockToken.sol/MockToken.json";
import OpenBorrowersRegistryArtifact
    from '../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, time, toWei} from "../_helpers";
import {
    CompoundingIndex,
    MockToken,
    OpenBorrowersRegistry,
    Pool,
    MockVariableUtilisationRatesCalculator
} from "../../typechain";
import {Contract} from "ethers";

chai.use(solidity);
const ZERO = ethers.constants.AddressZero;

const {deployContract} = waffle;

//results: https://docs.google.com/spreadsheets/d/1foJvQ03Mp3jXil4OyB6UyKeO4P7ho7aXu9WA-TYxeB0/edit#gid=0
const TEST_ACTIONS = [
    {
        id: 1,
        delay: 0,
        deposit1: 6,
        expectedDeposited: 6,
        expectedBorrowed: 0,
        expectedDepositAPR: 0,
        expectedBorrowAPR: 0.03,
    },
    {
        id: 2,
        delay: 0,
        deposit2: 4,
        expectedDeposited: 10,
        expectedBorrowed: 0,
        expectedDepositAPR: 0,
        expectedBorrowAPR: 0.03,
    },
    {
        id: 3,
        borrow1: 3,
        expectedDeposited: 10,
        expectedBorrowed: 3,
        expectedDepositAPR: 0.008999991,
        expectedBorrowAPR: 0.03,
    },
    {
        id: 4,
        borrow2: 2,
        expectedDeposited: 10,
        expectedBorrowed: 5,
        expectedDepositAPR: 0.014999985,
        expectedBorrowAPR: 0.03,
    },
    {
        id: 5,
        delay: 31536000,
        expectedDeposited: 10.1511305,
        expectedBorrowed: 5.152272662,
        expectedDepositAPR: 0.01522668094,
        expectedBorrowAPR: 0.03,
    },
    {
        id: 6,
        repay1: 2,
        expectedDeposited: 10.1511305,
        expectedBorrowed: 3.152272662,
        expectedDepositAPR: 0.00931601513,
        expectedBorrowAPR: 0.03,
    },
    {
        id: 7,
        delay: 31536000,
        expectedDeposited: 10.24614042,
        expectedBorrowed: 3.248273651,
        expectedDepositAPR: 0.009510714092,
        expectedBorrowAPR: 0.03,
    },
    {
        id: 8,
        borrow1: 3,
        expectedDeposited: 10.24614042,
        expectedBorrowed: 6.248273651,
        expectedDepositAPR: 0.02098853866,
        expectedBorrowAPR: 0.03441778344,
    },
    {
        id: 9,
        delay: 31536000,
        expectedDeposited: 10.46346465,
        expectedBorrowed: 6.46706901,
        expectedDepositAPR: 0.02356535608,
        expectedBorrowAPR: 0.03812786232,
    },
    {
        id: 10,
        withdraw1: 1,
        expectedDeposited: 9.463464647,
        expectedBorrowed: 6.46706901,
        expectedDepositAPR: 0.04613954361,
        expectedBorrowAPR: 0.06751750688,
    },
    {
        id: 11,
        delay: 31536000,
        expectedDeposited: 9.910334532,
        expectedBorrowed: 6.918787237,
        expectedDepositAPR: 0.05177556772,
        expectedBorrowAPR: 0.07416237734,
    },
    {
        id: 12,
        borrow2: 1,
        expectedDeposited: 9.910334532,
        expectedBorrowed: 7.918787237,
        expectedDepositAPR: 0.0955411404,
        expectedBorrowAPR: 0.1195695226,
    },
    {
        id: 13,
        delay: 31536000,
        expectedDeposited: 10.90388606,
        expectedBorrowed: 8.924565014,
        expectedDepositAPR: 0.1458507667,
        expectedBorrowAPR: 0.1781982348,
    }
]
describe('Pool testing suite with accumulating interest', () => {
    let sut: Pool,
        owner: SignerWithAddress,
        depositor1: SignerWithAddress,
        depositor2: SignerWithAddress,
        borrower1: SignerWithAddress,
        borrower2: SignerWithAddress,
        mockToken: Contract,
        MockVariableUtilisationRatesCalculator: MockVariableUtilisationRatesCalculator;

    before("Deploy Pool contract", async () => {
        [owner, depositor1, depositor2, borrower1, borrower2] = await getFixedGasSigners(10000000);
        sut = (await deployContract(owner, PoolArtifact)) as Pool;

        MockVariableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as MockVariableUtilisationRatesCalculator;
        const borrowersRegistry = (await deployContract(owner, OpenBorrowersRegistryArtifact)) as OpenBorrowersRegistry;

        const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [sut.address])) as CompoundingIndex;
        const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [sut.address])) as CompoundingIndex;

        mockToken = (await deployContract(owner, MockTokenArtifact, [[depositor1.address, depositor2.address]])) as MockToken;

        await sut.initialize(
            MockVariableUtilisationRatesCalculator.address,
            borrowersRegistry.address,
            depositIndex.address,
            borrowingIndex.address,
            mockToken.address,
            ZERO,
            0
        );
    });

    describe('Should perform test suite', () =>

        TEST_ACTIONS.forEach(
            (action, i) => {
                it(`should perform action ${action.id}`, async () => {

                        if (action.delay) {
                            await time.increase(action.delay);
                        }

                        if (action.deposit1) {
                            await mockToken.connect(depositor1).approve(sut.address, toWei(action.deposit1.toString()));
                            await sut.connect(depositor1).deposit(toWei(action.deposit1.toString()));
                        }

                        if (action.deposit2) {
                            await mockToken.connect(depositor2).approve(sut.address, toWei(action.deposit2.toString()));
                            await sut.connect(depositor2).deposit(toWei(action.deposit2.toString()));
                        }

                        if (action.withdraw1) {
                            await sut.connect(depositor1).withdraw(toWei(action.withdraw1.toString()));
                        }

                        if (action.borrow1) {
                            await sut.connect(borrower1).borrow(toWei(action.borrow1.toString()));
                        }

                        if (action.borrow2) {
                            await sut.connect(borrower2).borrow(toWei(action.borrow2.toString()));
                        }

                        if (action.repay1) {
                            await mockToken.connect(borrower1).approve(sut.address, toWei(action.repay1.toString()));
                            await sut.connect(borrower1).repay(toWei(action.repay1.toString()));
                        }

                        let deposited = fromWei(await sut.totalSupply());
                        expect(deposited).to.be.closeTo(action.expectedDeposited, 0.000001);

                        let borrowed = fromWei(await sut.totalBorrowed());
                        expect(borrowed).to.be.closeTo(action.expectedBorrowed, 0.000001);

                        let depositRate = fromWei(await sut.getDepositRate());
                        expect(depositRate).to.be.closeTo(action.expectedDepositAPR, 0.000001);

                        let borrowingRate = fromWei(await sut.getBorrowingRate());
                        expect(borrowingRate).to.be.closeTo(action.expectedBorrowAPR, 0.000001);
                    }
                );
            })
    );
});