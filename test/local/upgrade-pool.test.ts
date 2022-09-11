import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import VariableUtilisationRatesCalculatorArtifact
    from '../../artifacts/contracts/VariableUtilisationRatesCalculator.sol/VariableUtilisationRatesCalculator.json';
import PoolArtifact from '../../artifacts/contracts/Pool.sol/Pool.json';
import CompoundingIndexArtifact from '../../artifacts/contracts/CompoundingIndex.sol/CompoundingIndex.json';
import MockTokenArtifact from "../../artifacts/contracts/mock/MockToken.sol/MockToken.json";
import OpenBorrowersRegistryArtifact
    from '../../artifacts/contracts/mock/OpenBorrowersRegistry.sol/OpenBorrowersRegistry.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {fromWei, getFixedGasSigners, toWei} from "../_helpers";
import {
    CompoundingIndex,
    MockToken,
    MockUpgradedPool__factory,
    OpenBorrowersRegistry,
    Pool,
    Pool__factory,
    TransparentUpgradeableProxy,
    TransparentUpgradeableProxy__factory,
    VariableUtilisationRatesCalculator
} from "../../typechain";
import {Contract} from "ethers";

chai.use(solidity);

const {deployContract, provider} = waffle;

const erc20ABI = [
    'function decimals() public view returns (uint8)',
    'function balanceOf(address _owner) public view returns (uint256 balance)',
    'function approve(address _spender, uint256 _value) public returns (bool success)',
    'function allowance(address owner, address spender) public view returns (uint256)'
]

describe('Upgradeable pool', () => {

    describe('Basic upgradeability functionalities', () => {
        let pool: Pool,
            mockUsdToken: MockToken,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            depositor2: SignerWithAddress,
            borrower: SignerWithAddress,
            admin: SignerWithAddress,
            VariableUtilisationRatesCalculator: VariableUtilisationRatesCalculator,
            proxy: TransparentUpgradeableProxy,
            tokenContract: Contract;

        it("should deploy a contract behind a proxy", async () => {
            [owner, depositor, borrower, admin, depositor2] = await getFixedGasSigners(10000000);
            pool = (await deployContract(owner, PoolArtifact)) as Pool;

            proxy = await (new TransparentUpgradeableProxy__factory(owner).deploy(pool.address, admin.address, []));
            pool = await (new Pool__factory(owner).attach(proxy.address));

            mockUsdToken = (await deployContract(owner, MockTokenArtifact, [[depositor.address, depositor2.address]])) as MockToken;

            VariableUtilisationRatesCalculator = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;
            const borrowersRegistry = (await deployContract(owner, OpenBorrowersRegistryArtifact)) as OpenBorrowersRegistry;
            const depositIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;
            const borrowingIndex = (await deployContract(owner, CompoundingIndexArtifact, [pool.address])) as CompoundingIndex;

            tokenContract = new ethers.Contract(mockUsdToken.address, erc20ABI, provider);

            await pool.initialize(
                VariableUtilisationRatesCalculator.address,
                borrowersRegistry.address,
                depositIndex.address,
                borrowingIndex.address,
                mockUsdToken.address
            );
        });


        it("should deposit and borrow using proxy", async () => {
            const initialDepositorBalance = fromWei(await tokenContract.balanceOf(depositor.address));

            await tokenContract.connect(depositor).approve(pool.address, toWei("1"));
            await pool.connect(depositor).deposit(toWei("1.0"));

            expect(fromWei(await tokenContract.balanceOf(depositor.address))).to.be.closeTo(initialDepositorBalance - 1, 0.000001);

            await pool.connect(borrower).borrow(toWei("0.5"));
            expect(fromWei(await pool.getBorrowed(borrower.address))).to.be.closeTo(0.5, 0.000001);
            expect(fromWei(await tokenContract.balanceOf(pool.address))).to.be.closeTo(0.5, 0.000001);
        });


        it("should prevent non admin from upgrade", async () => {
            let mockUpgradedPool = await (new MockUpgradedPool__factory(owner).deploy());
            await expect(proxy.connect(owner).upgradeTo(mockUpgradedPool.address))
                .to.be.revertedWith("Transaction reverted: function selector was not recognized and there's no fallback function");
        });


        it("should upgrade keeping old state", async () => {
            let mockUpgradedPool = await (new MockUpgradedPool__factory(owner).deploy());

            await proxy.connect(admin).upgradeTo(mockUpgradedPool.address);

            expect(fromWei(await tokenContract.balanceOf(pool.address))).to.be.closeTo(0.5, 0.000001);
            expect(fromWei(await pool.balanceOf(depositor.address))).to.be.closeTo(1, 0.000001);
            expect(fromWei(await pool.getBorrowed(borrower.address))).to.be.closeTo(0.5, 0.000001);
        });


        it("should have new logic after upgrade", async () => {
            //Upgraded logic doubles deposits value
            await tokenContract.connect(depositor2).approve(pool.address, toWei("1.0"));
            await pool.connect(depositor2).deposit(toWei("1.0"));
            expect(fromWei(await pool.balanceOf(depositor2.address))).to.be.closeTo(2, 0.000001);
        });

        it("should allow owner-only functions after upgrade", async () => {
            let ratesCalculatorV2 = (await deployContract(owner, VariableUtilisationRatesCalculatorArtifact)) as VariableUtilisationRatesCalculator;

            //Should prevent setting new value from non-owner
            await expect(pool.connect(depositor).setRatesCalculator(ratesCalculatorV2.address))
                .to.be.revertedWith("Ownable: caller is not the owner");

            //Should allow setting new value
            await pool.connect(owner).setRatesCalculator(ratesCalculatorV2.address);
        });
    });

});
