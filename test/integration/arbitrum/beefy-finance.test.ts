import {ethers, waffle} from 'hardhat'
import chai, {expect} from 'chai'
import {solidity} from "ethereum-waffle";

import MockTokenManagerArtifact from '../../../artifacts/contracts/mock/MockTokenManager.sol/MockTokenManager.json';
import SmartLoansFactoryArtifact from '../../../artifacts/contracts/SmartLoansFactory.sol/SmartLoansFactory.json';
import AddressProviderArtifact from '../../../artifacts/contracts/AddressProvider.sol/AddressProvider.json';
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import TOKEN_ADDRESSES from '../../../common/addresses/arbitrum/token_addresses.json';
import {
    addMissingTokenContracts,
    Asset,
    convertAssetsListToSupportedAssets,
    convertTokenPricesMapToMockPrices,
    deployAllFacets,
    deployAndInitExchangeContract,
    deployPools,
    erc20ABI,
    formatUnits,
    fromWei,
    getFixedGasSigners,
    getRedstonePrices,
    getTokensPricesMap,
    LPAbi,
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
    SmartLoanGigaChadInterface,
    SmartLoansFactory,
    TraderJoeIntermediary,
} from "../../../typechain";
import {BigNumber, Contract} from "ethers";
import {deployDiamond} from '../../../tools/diamond/deploy-diamond';

chai.use(solidity);

const {deployContract, provider} = waffle;

describe('Smart loan', () => {
    before("Synchronize blockchain time", async () => {
        await syncTime();
    });

    describe('A loan with staking TJ LP tokens on BeefyFinance', () => {
        let exchange: TraderJoeIntermediary,
            smartLoansFactory: SmartLoansFactory,
            loan: SmartLoanGigaChadInterface,
            wrappedLoan: any,
            nonOwnerWrappedLoan: any,
            owner: SignerWithAddress,
            depositor: SignerWithAddress,
            MOCK_PRICES: any,
            hopEthLpTokenPrice: number,
            beefyHopEthLpTokenPrice: number,
            hopUsdtLpTokenPrice: number,
            beefyHopUsdtLpTokenPrice: number,
            hopDaiLpTokenPrice: number,
            beefyHopDaiLpTokenPrice: number,
            beefyHopGmxLpTokenPrice: number,
            diamondAddress: any,
            tokenManager: MockTokenManager,
            poolContracts: Map<string, Contract> = new Map(),
            tokenContracts: Map<string, Contract> = new Map(),
            lendingPools: Array<PoolAsset> = [],
            supportedAssets: Array<Asset>,
            totalValueBeforeStaking: any,
            tokensPrices: Map<string, number>;

        before("deploy factory and pool", async () => {
            [owner, depositor] = await getFixedGasSigners(10000000);
            let assetsList = ['ETH', 'USDT', 'DAI', 'HOP_ETH_LP', 'MOO_HOP_ETH_LP', 'HOP_USDT_LP', 'MOO_HOP_USDT_LP', 'HOP_DAI_LP', 'MOO_HOP_DAI_LP', 'GMX', 'MOO_GMX'];
            let poolNameAirdropList: Array<PoolInitializationObject> = [
                {name: 'ETH', airdropList: [depositor]},
            ];

            diamondAddress = await deployDiamond();

            smartLoansFactory = await deployContract(owner, SmartLoansFactoryArtifact) as SmartLoansFactory;
            await smartLoansFactory.initialize(diamondAddress);

            await deployPools(smartLoansFactory, poolNameAirdropList, tokenContracts, poolContracts, lendingPools, owner, depositor)
            tokensPrices = await getTokensPricesMap(['ETH', 'USDT', 'DAI', 'GMX'], getRedstonePrices, []);

            // TODO: Add possibility of adding custom ABIs to addMissingTokenContracts()
            tokenContracts.set('HOP_ETH_LP', new ethers.Contract(TOKEN_ADDRESSES['HOP_ETH_LP'], erc20ABI, provider));
            tokenContracts.set('MOO_HOP_ETH_LP', new ethers.Contract(TOKEN_ADDRESSES['MOO_HOP_ETH_LP'], erc20ABI, provider));
            tokenContracts.set('HOP_USDT_LP', new ethers.Contract(TOKEN_ADDRESSES['HOP_USDT_LP'], erc20ABI, provider));
            tokenContracts.set('MOO_HOP_USDT_LP', new ethers.Contract(TOKEN_ADDRESSES['MOO_HOP_USDT_LP'], erc20ABI, provider));
            tokenContracts.set('HOP_DAI_LP', new ethers.Contract(TOKEN_ADDRESSES['HOP_DAI_LP'], erc20ABI, provider));
            tokenContracts.set('MOO_HOP_DAI_LP', new ethers.Contract(TOKEN_ADDRESSES['MOO_HOP_DAI_LP'], erc20ABI, provider));
            tokenContracts.set('MOO_GMX', new ethers.Contract(TOKEN_ADDRESSES['MOO_GMX'], erc20ABI, provider));

            let ethLpTokenSupply = await tokenContracts.get('HOP_ETH_LP')!.totalSupply();
            let ethReserve = await tokenContracts.get('ETH')!.balanceOf("0x652d27c0F72771Ce5C76fd400edD61B406Ac6D97");
            hopEthLpTokenPrice = fromWei(ethReserve) * tokensPrices.get('ETH')! / fromWei(ethLpTokenSupply);
            let beefyEthLpTokenSupply = await tokenContracts.get('MOO_HOP_ETH_LP')!.totalSupply();
            let hopEthLpReserve = await tokenContracts.get('HOP_ETH_LP')!.balanceOf("0x755569159598f3702bdD7DFF6233A317C156d3Dd");
            beefyHopEthLpTokenPrice = fromWei(hopEthLpReserve) * hopEthLpTokenPrice / fromWei(beefyEthLpTokenSupply);

            let usdtLpTokenSupply = await tokenContracts.get('HOP_USDT_LP')!.totalSupply();
            let usdtReserve = await tokenContracts.get('USDT')!.balanceOf("0x18f7402B673Ba6Fb5EA4B95768aABb8aaD7ef18a");
            hopUsdtLpTokenPrice = formatUnits(usdtReserve, 6) * tokensPrices.get('USDT')! / fromWei(usdtLpTokenSupply);
            let beefyUsdtLpTokenSupply = await tokenContracts.get('MOO_HOP_USDT_LP')!.totalSupply();
            let hopUsdtLpReserve = await tokenContracts.get('HOP_USDT_LP')!.balanceOf("0x9Dd8685463285aD5a94D2c128bda3c5e8a6173c8");
            beefyHopUsdtLpTokenPrice = fromWei(hopUsdtLpReserve) * hopUsdtLpTokenPrice / fromWei(beefyUsdtLpTokenSupply);

            let daiLpTokenSupply = await tokenContracts.get('HOP_DAI_LP')!.totalSupply();
            let daiReserve = await tokenContracts.get('DAI')!.balanceOf("0xa5A33aB9063395A90CCbEa2D86a62EcCf27B5742");
            hopDaiLpTokenPrice = fromWei(daiReserve) * tokensPrices.get('DAI')! / fromWei(daiLpTokenSupply);
            let beefyDaiLpTokenSupply = await tokenContracts.get('MOO_HOP_DAI_LP')!.totalSupply();
            let hopDaiLpReserve = await tokenContracts.get('HOP_DAI_LP')!.balanceOf("0xd4D28588ac1D9EF272aa29d4424e3E2A03789D1E");
            beefyHopDaiLpTokenPrice = fromWei(hopDaiLpReserve) * hopDaiLpTokenPrice / fromWei(beefyDaiLpTokenSupply);

            tokensPrices = await getTokensPricesMap(
                [],
                getRedstonePrices,
                [
                    {symbol: 'HOP_ETH_LP', value: hopEthLpTokenPrice},
                    {symbol: 'MOO_HOP_ETH_LP', value: beefyHopEthLpTokenPrice},
                    {symbol: 'HOP_USDT_LP', value: hopUsdtLpTokenPrice},
                    {symbol: 'MOO_HOP_USDT_LP', value: beefyHopUsdtLpTokenPrice},
                    {symbol: 'HOP_DAI_LP', value: hopDaiLpTokenPrice},
                    {symbol: 'MOO_HOP_DAI_LP', value: beefyHopDaiLpTokenPrice},
                    // {symbol: 'MOO_GMX', value: beefyHopGmxLpTokenPrice},
                ],
                tokensPrices
            );
            addMissingTokenContracts(tokenContracts, assetsList);
            supportedAssets = convertAssetsListToSupportedAssets(assetsList);

            tokenManager = await deployContract(
                owner,
                MockTokenManagerArtifact,
                []
            ) as MockTokenManager;

            await tokenManager.connect(owner).initialize(supportedAssets, lendingPools);
            await tokenManager.connect(owner).setFactoryAddress(smartLoansFactory.address);

            let addressProvider = await deployContract(
                owner,
                AddressProviderArtifact,
                []
            ) as AddressProvider;

            await recompileConstantsFile(
                'local',
                "DeploymentConstants",
                [],
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

            tokensPrices = await getTokensPricesMap(['ETH', 'USDT', 'DAI', 'GMX'], getRedstonePrices, [
                {symbol: 'HOP_ETH_LP', value: hopEthLpTokenPrice},
                {symbol: 'MOO_HOP_ETH_LP', value: beefyHopEthLpTokenPrice},
                {symbol: 'HOP_USDT_LP', value: hopUsdtLpTokenPrice},
                {symbol: 'MOO_HOP_USDT_LP', value: beefyHopUsdtLpTokenPrice},
                {symbol: 'HOP_DAI_LP', value: hopDaiLpTokenPrice},
                {symbol: 'MOO_HOP_DAI_LP', value: beefyHopDaiLpTokenPrice},
                // {symbol: 'MOO_GMX', value: beefyHopGmxLpTokenPrice},
            ]);
            MOCK_PRICES = convertTokenPricesMapToMockPrices(tokensPrices);

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
    });
});

