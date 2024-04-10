import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import VariableUtilisationRatesCalculatorArtifact
    from '../../artifacts/contracts/mock/MockVariableUtilisationRatesCalculator.sol/MockVariableUtilisationRatesCalculator.json';
import OpenBorrowersRegistryArtifact
    from '../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json';
import MockTokenManagerArtifact from '../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import LinearIndexArtifact from '../../artifacts/contracts/LinearIndex.sol/LinearIndex.json';
import VPrimeArtifact from '../../artifacts/contracts/tokens/vPrime.sol/vPrime.json';
import VPrimeControllerArtifact from '../../artifacts/contracts/tokens/vPrimeController.sol/vPrimeController.json';
import sPrimeMockArtifact from '../../artifacts/contracts/tokens/mock/sPrimeMock.sol/SPrimeMock.json';
import SmartLoansFactoryArtifact from '../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import MockTokenArtifact from "../../artifacts/contracts/mock/MockToken.sol/MockToken.json";
import PoolArtifact from '../../artifacts/contracts/Pool.sol/Pool.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
    Asset,
    convertTokenPricesMapToMockPrices,
    customError,
    fromWei,
    getFixedGasSigners, PoolAsset,
    time, toBytes32,
    toWei
} from "../_helpers";
import {deployMockContract} from '@ethereum-waffle/mock-contract';
import {
    LinearIndex,
    MockToken,
    MockTokenManager,
    OpenBorrowersRegistry,
    Pool,
    SmartLoansFactory
} from "../../typechain";
import {BigNumber, Contract} from "ethers";
import {WrapperBuilder} from "@redstone-finance/evm-connector";
import {toBytes} from "viem";
import {token} from "@redstone-finance/evm-connector/dist/typechain-types/@openzeppelin/contracts";

chai.use(solidity);
const ZERO = ethers.constants.AddressZero;

const {deployContract} = waffle;

describe('Pool with variable utilisation interest rates', () => {
    let poolContract: Pool,
        vPrimeContract: Contract,
        vPrimeControllerContract: Contract,
        sPrimeContract: Contract,
        smartLoansFactory: SmartLoansFactory,
        owner: SignerWithAddress,
        depositor: SignerWithAddress,
        depositor2: SignerWithAddress,
        depositor3: SignerWithAddress,
        mockToken: Contract,
        MOCK_PRICES: any,
        mockVariableUtilisationRatesCalculator;

    before(async () => {
        [owner, depositor, depositor2, depositor3] = await getFixedGasSigners(10000000);
        mockVariableUtilisationRatesCalculator = await deployMockContract(owner, VariableUtilisationRatesCalculatorArtifact.abi);
        mockToken = (await deployContract(owner, MockTokenArtifact, [[depositor.address, depositor2.address, depositor3.address]])) as MockToken;
        let supportedAssets = [new Asset(toBytes32("MOCK_TOKEN"), mockToken.address)];
        await mockVariableUtilisationRatesCalculator.mock.calculateDepositRate.returns(toWei("0.05"));
        await mockVariableUtilisationRatesCalculator.mock.calculateBorrowingRate.returns(toWei("0.05"));

        poolContract = (await deployContract(owner, PoolArtifact)) as Pool;
        let lendingPools = [new PoolAsset(toBytes32("MOCK_TOKEN"), poolContract.address)];
        smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;

        let tokenManager = await deployContract(
            owner,
            MockTokenManagerArtifact,
            []
        ) as MockTokenManager;

        await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);
        await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

        await smartLoansFactory.initialize(ethers.constants.AddressZero, tokenManager.address);

        let tokensMap = new Map();
        tokensMap.set("MOCK_TOKEN", 1.0);
        MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensMap);

        sPrimeContract = await deployContract(
            owner,
            sPrimeMockArtifact,
            ["MOCK_S_PRIME", "S_PRIME", 2]
        ) as Contract;

        sPrimeContract = WrapperBuilder.wrap(
            sPrimeContract.connect(owner)
        ).usingSimpleNumericMock({
            mockSignersCount: 3,
            dataPoints: MOCK_PRICES,
        });

        vPrimeContract = await deployContract(
            owner,
            VPrimeArtifact,
            [[poolContract.address], smartLoansFactory.address]
        ) as Contract;

        await vPrimeContract.updateWhitelistedSPrimes([sPrimeContract.address]);

        vPrimeControllerContract = await deployContract(
            owner,
            VPrimeControllerArtifact,
            [[poolContract.address], [sPrimeContract.address], tokenManager.address, vPrimeContract.address]
        ) as Contract;
        vPrimeControllerContract = WrapperBuilder.wrap(
            vPrimeControllerContract
        ).usingSimpleNumericMock({
            mockSignersCount: 3,
            dataPoints: MOCK_PRICES,
        });

        await vPrimeContract.updateWhitelistedSPrimes([vPrimeControllerContract.address]);
        console.log(`vPrimeControllerContract: ${vPrimeControllerContract.address}`)

        await sPrimeContract.setVPrimeControllerContract(vPrimeControllerContract.address);


        const borrowersRegistry = (await deployContract(owner, OpenBorrowersRegistryArtifact)) as OpenBorrowersRegistry;
        const depositIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
        await depositIndex.initialize(poolContract.address);
        const borrowingIndex = (await deployContract(owner, LinearIndexArtifact)) as LinearIndex;
        await borrowingIndex.initialize(poolContract.address);

        await poolContract.initialize(
            mockVariableUtilisationRatesCalculator.address,
            borrowersRegistry.address,
            depositIndex.address,
            borrowingIndex.address,
            mockToken.address,
            ZERO,
            0
        );
    });

    it("should check initial pool, vPrime, sPrime balances and vPrimePairsCount", async () => {
        expect(await poolContract.balanceOf(depositor.address)).to.equal(0);
        expect(await poolContract.balanceOf(depositor2.address)).to.equal(0);
        expect(await poolContract.balanceOf(depositor3.address)).to.equal(0);

        expect(await vPrimeContract.balanceOf(depositor.address)).to.equal(0);
        expect(await vPrimeContract.balanceOf(depositor2.address)).to.equal(0);
        expect(await vPrimeContract.balanceOf(depositor3.address)).to.equal(0);

        expect(await sPrimeContract.balanceOf(depositor.address)).to.equal(0);
        expect(await sPrimeContract.balanceOf(depositor2.address)).to.equal(0);
        expect(await sPrimeContract.balanceOf(depositor3.address)).to.equal(0);

        expect(await vPrimeControllerContract.getDepositorVPrimePairsCount(depositor.address)).to.equal(0);
        expect(await vPrimeControllerContract.getDepositorVPrimePairsCount(depositor2.address)).to.equal(0);
        expect(await vPrimeControllerContract.getDepositorVPrimePairsCount(depositor3.address)).to.equal(0);

        expect(await vPrimeControllerContract.getUserDepositDollarValueAcrossWhiteListedPools(depositor.address)).to.equal(0);
        expect(await vPrimeControllerContract.getUserDepositDollarValueAcrossWhiteListedPools(depositor2.address)).to.equal(0);
        expect(await vPrimeControllerContract.getUserDepositDollarValueAcrossWhiteListedPools(depositor3.address)).to.equal(0);

        expect(await vPrimeControllerContract.getUserSPrimeDollarValue(depositor.address)).to.equal(0);
        expect(await vPrimeControllerContract.getUserSPrimeDollarValue(depositor2.address)).to.equal(0);
        expect(await vPrimeControllerContract.getUserSPrimeDollarValue(depositor3.address)).to.equal(0);

        expect((await vPrimeControllerContract.getDepositorVPrimeRateAndMaxCap(depositor.address)).map(bn => bn.toString())).to.deep.equal(["0" ,"0"]);
        expect((await vPrimeControllerContract.getDepositorVPrimeRateAndMaxCap(depositor2.address)).map(bn => bn.toString())).to.deep.equal(["0" ,"0"]);
        expect((await vPrimeControllerContract.getDepositorVPrimeRateAndMaxCap(depositor3.address)).map(bn => bn.toString())).to.deep.equal(["0" ,"0"]);

    });

    it("depositor should deposit 10 MOCK_TOKENs", async () => {
        let wrappedPool = WrapperBuilder
            // @ts-ignore
            .wrap(poolContract.connect(depositor))
            .usingSimpleNumericMock({
                mockSignersCount: 3,
                dataPoints: MOCK_PRICES,
            });
        await mockToken.connect(depositor).approve(poolContract.address, toWei("10"));
        await wrappedPool.deposit(toWei("10"));
        expect(await mockToken.balanceOf(poolContract.address)).to.equal(toWei("10"));

        const currentDeposits = await poolContract.balanceOf(depositor.address);
        expect(fromWei(currentDeposits)).to.equal(10);

        expect(await vPrimeContract.balanceOf(depositor.address)).to.equal(0);
        expect(await sPrimeContract.balanceOf(depositor.address)).to.equal(0);
        expect(await vPrimeControllerContract.getDepositorVPrimePairsCount(depositor.address)).to.equal(0);
        expect(fromWei(await vPrimeControllerContract.getUserDepositDollarValueAcrossWhiteListedPools(depositor.address))).to.equal(10);
        expect(await vPrimeControllerContract.getUserSPrimeDollarValue(depositor.address)).to.equal(0);
        expect((await vPrimeControllerContract.getDepositorVPrimeRateAndMaxCap(depositor.address)).map(bn => bn.toString())).to.deep.equal(["0" ,"0"]);
    });

    it("depositor should deposit $2 worth of sPRIME", async () => {
        await sPrimeContract.increaseBalance(depositor.address, toWei("1"));

        expect(await vPrimeContract.balanceOf(depositor.address)).to.equal(0);
        expect(fromWei(await sPrimeContract.balanceOf(depositor.address))).to.equal(1);
        expect(await vPrimeControllerContract.getDepositorVPrimePairsCount(depositor.address)).to.equal(1);
        expect(fromWei(await vPrimeControllerContract.getUserDepositDollarValueAcrossWhiteListedPools(depositor.address))).to.closeTo(10, 1e-6);
        expect(fromWei(await vPrimeControllerContract.getUserSPrimeDollarValue(depositor.address))).to.equal(2);
        let rateAndMaxCap = await vPrimeControllerContract.getDepositorVPrimeRateAndMaxCap(depositor.address);
        let rate = rateAndMaxCap[0];
        let maxCap = rateAndMaxCap[1];
        expect(maxCap.toNumber()).to.closeTo(15, 1e-6);
        expect(rate).to.closeTo(158548959918, 1);
    });

});