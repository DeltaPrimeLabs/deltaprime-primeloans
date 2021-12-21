import {ethers, waffle} from 'hardhat';
import chai from 'chai';
import {BigNumber, Contract} from 'ethers';
import {solidity} from "ethereum-waffle";

import PangolinExchangeArtifact from '../../artifacts/contracts/PangolinExchange.sol/PangolinExchange.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {PangolinExchange} from '../../typechain';
import {Asset, fromBytes32, getFixedGasSigners, toBytes32, toWei, syncTime} from "../_helpers";

chai.use(solidity);

const {deployContract, provider} = waffle;
const {expect} = chai;

const pangolinRouterAddress = '0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106';
const daiTokenAddress = '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70';
const WAVAXTokenAddress = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';

const ERC20Abi = [
  'function decimals() public view returns (uint8)',
  'function balanceOf(address _owner) public view returns (uint256 balance)',
  'function approve(address _spender, uint256 _value) public returns (bool success)',
  'function transfer(address _to, uint256 _value) public returns (bool success)'
]

const pangolinRouterAbi = [
  'function getAmountsIn (uint256 amountOut, address[] path) view returns (uint256[])',
  'function getAmountsOut (uint256 amountIn, address[] path) view returns (uint256[])'
]


describe('PangolinExchange', () => {
  before("Synchronize blockchain time", async () => {
    await syncTime();
  });

  describe('Test buying and selling an asset', () => {
    let sut: PangolinExchange,
      daiToken: Contract,
      pangolinRouter: Contract,
      owner: SignerWithAddress;

    before('Deploy the PangolinExchange contract', async () => {
      [,owner] = await getFixedGasSigners(10000000);

      sut = await deployContract(owner, PangolinExchangeArtifact) as PangolinExchange;
      await sut.initialize(pangolinRouterAddress,  [
        new Asset(toBytes32("AVAX"), WAVAXTokenAddress),
        new Asset(toBytes32("DAI"), daiTokenAddress),
      ]);

      daiToken = await new ethers.Contract(daiTokenAddress, ERC20Abi);
      pangolinRouter = await new ethers.Contract(pangolinRouterAddress, pangolinRouterAbi);
    });


    it('should check for the amount of tokens to buy to be greater than 0', async () => {
      await expect(sut.buyAsset(toBytes32('DAI'), 0)).to.be.revertedWith('InvalidTokenPurchaseAmount()');
    });


    it('should check if enough funds were provided', async () => {
      const daiTokenPurchaseAmount = 1e20;
      const estimatedAvax = (await pangolinRouter.connect(owner).getAmountsIn(daiTokenPurchaseAmount.toString(), [WAVAXTokenAddress, daiTokenAddress]))[0];

      await expect(sut.buyAsset(toBytes32('DAI'), daiTokenPurchaseAmount.toString(), {value: Math.floor(estimatedAvax*0.9).toString()})).to.be.revertedWith('NotEnoughFunds()');
    });


    it('should check if an erc20 tokens were purchased successfully', async () => {
      const daiTokenPurchaseAmount = 1e20;
      const estimatedAvax = (await pangolinRouter.connect(owner).getAmountsIn(daiTokenPurchaseAmount.toString(), [WAVAXTokenAddress, daiTokenAddress]))[0];
      const initialAvaxBalance = await provider.getBalance(owner.address);

      await sut.buyAsset(toBytes32('DAI'), daiTokenPurchaseAmount.toString(), {value: estimatedAvax.toString()});


      const currentDaiTokenBalance = await daiToken.connect(owner).balanceOf(owner.address);
      const currentAvaxBalance = await provider.getBalance(owner.address);
      const expectedAvaxBalance = BigNumber.from(initialAvaxBalance.toString()).sub(BigNumber.from(estimatedAvax.toString()));

      expect(currentDaiTokenBalance).to.equal(daiTokenPurchaseAmount.toString());
      expect(currentAvaxBalance).to.be.lte(expectedAvaxBalance);
    });


    it('should check for the amount of tokens to sell to be greater than 0', async () => {
      await expect(sut.sellAsset(toBytes32('DAI'), toWei("0"), toWei("0.01"))).to.be.revertedWith('InvalidTokenSaleAmount()');
    });


    it('should keep the same dai balance in case of an insufficient token balance transferred to an exchange', async () => {
      const initialDaiTokenBalance = await daiToken.connect(owner).balanceOf(sut.address);
      const initialAvaxBalance = await provider.getBalance(owner.address);

      expect(await provider.getBalance(sut.address)).to.be.equal(0);
      const estimatedAvaxReceived = (await pangolinRouter.connect(owner).getAmountsOut(toWei("100").toString(), [daiTokenAddress, WAVAXTokenAddress]))[1];

      await sut.sellAsset(toBytes32('DAI'), toWei("100"), estimatedAvaxReceived);

      let newDaiBalance = await daiToken.connect(owner).balanceOf(sut.address);

      expect(await provider.getBalance(sut.address)).to.be.equal(0);
      expect(newDaiBalance).to.be.equal(initialDaiTokenBalance);
      expect(await provider.getBalance(owner.address)).to.be.gt(BigNumber.from(initialAvaxBalance.toString()).sub(BigNumber.from(estimatedAvaxReceived.toString())))
    });


    it('should check if an erc20 tokens were sold successfully', async () => {
      const initialDAITokenBalance = await daiToken.connect(owner).balanceOf(owner.address);
      const initialAvaxBalance = await provider.getBalance(owner.address);
      const daiTokenAmount = 1e20;

      await daiToken.connect(owner).transfer(sut.address, daiTokenAmount.toString());
      await sut.sellAsset(toBytes32('DAI'), daiTokenAmount.toString(), 1);

      const currentDAITokenBalance = await daiToken.connect(owner).balanceOf(owner.address);
      const currentAvaxBalance = await provider.getBalance(owner.address);
      const daiTokenExpectedBalance = BigNumber.from(initialDAITokenBalance.toString()).sub(BigNumber.from(daiTokenAmount.toString()));

      expect(currentDAITokenBalance).to.be.equal(daiTokenExpectedBalance);
      expect(currentAvaxBalance).to.be.gt(initialAvaxBalance);
    });
  });

  describe('Set and read assets', () => {
    let sut: PangolinExchange;

    const token1Address = '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70';
    const token2Address = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';
    const token3Address = '0x5947bb275c521040051d82396192181b413227a3';

    before("deploy a contract with a predefined supported assets", async () => {
      let contract: PangolinExchange,
        owner: SignerWithAddress;

      [owner] = await getFixedGasSigners(10000000);
      let token1 = "TOKEN_1";
      sut = await deployContract(owner, PangolinExchangeArtifact) as PangolinExchange;
      await sut.initialize(pangolinRouterAddress,
        [
          new Asset(toBytes32("AVAX"), WAVAXTokenAddress),
          new Asset(toBytes32(token1), token1Address)
        ]);
    });

    it("should add asset at a contract deploy", async () => {
      await expect((fromBytes32((await sut.getAllAssets())[0])))
        .to.be.equal("AVAX");
      await expect((fromBytes32((await sut.getAllAssets())[1])))
          .to.be.equal("TOKEN_1");
    });

    it("should add new assets without changing the sequence of previous ones", async () => {
      let token2 = "TOKEN_2";

      await sut.updateAssets([new Asset(toBytes32(token2), token2Address)]);

      await expect((fromBytes32((await sut.getAllAssets())[0])))
        .to.be.equal("AVAX");

      await expect((fromBytes32((await sut.getAllAssets())[1])))
        .to.be.equal("TOKEN_1");

      await expect((fromBytes32((await sut.getAllAssets())[2])))
        .to.be.equal(token2);

      await expect((await sut.getAssetAddress(toBytes32("AVAX"))))
        .to.be.equal(WAVAXTokenAddress);

      await expect((await sut.getAssetAddress(toBytes32("TOKEN_1"))))
        .to.be.equal(token1Address);

      await expect((await sut.getAssetAddress(toBytes32(token2))))
        .to.be.equal(token2Address);
    });


    it("should correctly remove an asset", async () => {
      await sut.updateAssets([
        new Asset(toBytes32("TOKEN_1"), token1Address),
        new Asset(toBytes32("TOKEN_2"), token2Address),
        new Asset(toBytes32("TOKEN_3"), token3Address)
      ]);

      await sut.removeAssets([toBytes32("TOKEN_2")]);

      await expect((await sut.getAllAssets()).includes("TOKEN_2"))
        .to.be.false
      await expect(((await sut.getAllAssets()).map(
        el => fromBytes32(el)
      )).join(","))
        .to.be.equal("AVAX,TOKEN_1,TOKEN_3")
      await expect(sut.getAssetAddress(toBytes32("TOKEN_2")))
        .to.be.revertedWith("Asset not supported.");
    });


    it("should not add a new asset if already supported", async () => {
      await expect(((await sut.getAllAssets()).map(
        el => fromBytes32(el)
      )).join(","))
        .to.be.equal("AVAX,TOKEN_1,TOKEN_3");

      await sut.updateAssets([new Asset(toBytes32("TOKEN_1"), token1Address)]);

      await expect(((await sut.getAllAssets()).map(
        el => fromBytes32(el)
      )).join(","))
        .to.be.equal("AVAX,TOKEN_1,TOKEN_3")
    });


    it("should update asset address", async () => {
      const newToken1Address = "0xb794F5eA0ba39494cE839613fffBA74279579268";
      await sut.updateAssets([new Asset(toBytes32("TOKEN_1"), newToken1Address)]);

      await expect((await sut.getAssetAddress(toBytes32("TOKEN_1"))).toString()).to.be.equal(newToken1Address);
    });


    it("should update one token and a add new one", async () => {
      const newToken2Address = "0x06012c8cf97BEaD5deAe237070F9587f8E7A266d";
      const token4Address = "0xB155f7e2769a24f1D3E76ACdCed934950f5da410";
      await sut.updateAssets([
        new Asset(toBytes32("TOKEN_2"), newToken2Address),
        new Asset(toBytes32("TOKEN_4"), token4Address)
      ]);

      await expect((await sut.getAssetAddress(toBytes32("TOKEN_2"))).toString()).to.be.equal(newToken2Address);
      await expect((await sut.getAssetAddress(toBytes32("TOKEN_4"))).toString()).to.be.equal(token4Address);
    });


    it("should correctly remove multiple assets", async () => {
      await expect(((await sut.getAllAssets()).map(
        el => fromBytes32(el)
      )).join(","))
        .to.be.equal("AVAX,TOKEN_1,TOKEN_3,TOKEN_2,TOKEN_4")

      await sut.removeAssets([toBytes32("TOKEN_2"), toBytes32("TOKEN_3")]);

      await expect((await sut.getAllAssets()).includes("TOKEN_2"))
        .to.be.false;
      await expect((await sut.getAllAssets()).includes("TOKEN_3"))
        .to.be.false;

      await expect(((await sut.getAllAssets()).map(
        el => fromBytes32(el)
      )).join(","))
        .to.be.equal("AVAX,TOKEN_1,TOKEN_4")

      await expect(sut.getAssetAddress(toBytes32("TOKEN_2")))
        .to.be.revertedWith("Asset not supported.");
      await expect(sut.getAssetAddress(toBytes32("TOKEN_3")))
        .to.be.revertedWith("Asset not supported.");
    });


    it("should not add any assets if one of them is corrupted", async () => {
      await expect(((await sut.getAllAssets()).map(
        el => fromBytes32(el)
      )).join(","))
        .to.be.equal("AVAX,TOKEN_1,TOKEN_4")

      await expect(sut.updateAssets([
        new Asset(toBytes32(""), token1Address),
        new Asset(toBytes32("TOKEN_5"), token1Address)
      ]))
        .to.be.revertedWith("Cannot set an empty string asset.");

      await expect(((await sut.getAllAssets()).map(
        el => fromBytes32(el)
      )).join(","))
        .to.be.equal("AVAX,TOKEN_1,TOKEN_4")
    });


    it("should correctly remove assets even if some don't exist", async () => {
      await expect(((await sut.getAllAssets()).map(
        el => fromBytes32(el)
      )).join(","))
        .to.be.equal("AVAX,TOKEN_1,TOKEN_4")

      await sut.removeAssets([toBytes32("TOKEN_4"), toBytes32("TOKEN_THAT_NOT_EXISTS")]);

      await expect(((await sut.getAllAssets()).map(
        el => fromBytes32(el)
      )).join(","))
        .to.be.equal("AVAX,TOKEN_1")
    });


    it("should not set an empty string asset", async () => {
      await expect(sut.updateAssets([new Asset(toBytes32(""), token1Address)]))
        .to.be.revertedWith("Cannot set an empty string asset.");
    });


    it("should revert for a wrong format address", async () => {
      await expect(sut.updateAssets([new Asset(toBytes32("TOKEN_4"), "bad_address")]))
        .to.be.reverted;
    });


    it("should revert for a zero address", async () => {
      await expect(sut.updateAssets([new Asset(toBytes32("TOKEN_4"), "0x")]))
        .to.be.reverted;
    });


    it("should revert for a not supported asset", async () => {
      await expect(sut.getAssetAddress(toBytes32("TOKEN_NOT_DEFINED")))
        .to.be.revertedWith("Asset not supported.");
    });


    it("should deploy a contract with an empty asset array", async () => {
      let owner2: SignerWithAddress,
        sut2: PangolinExchange;

      [,owner2] = await getFixedGasSigners(10000000);

      sut2 = await deployContract(owner2, PangolinExchangeArtifact) as PangolinExchange;
      await sut2.initialize(pangolinRouterAddress, []);
      expect(await sut2.getAllAssets()).to.be.empty;
    });
  });
});
