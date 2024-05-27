pragma solidity ^0.8.17;

interface IWombatFacet {
    function depositSavaxToAvaxSavax(uint256 amount, uint256 minLpOut) external;

    function withdrawSavaxFromAvaxSavax(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut);

    function sAvaxBalanceAvaxSavax()
        external
        view
        returns (uint256 _stakedBalance);

    function depositGgavaxToAvaxGgavax(uint256 amount, uint256 minLpOut) external;

    function withdrawGgavaxFromAvaxGgavax(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut);

    function ggAvaxBalanceAvaxGgavax()
        external
        view
        returns (uint256 _stakedBalance);

    function depositAvaxToAvaxSavax(uint256 amount, uint256 minLpOut) external;

    function withdrawAvaxFromAvaxSavax(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut);

    function avaxBalanceAvaxSavax()
        external
        view
        returns (uint256 _stakedBalance);

    function depositAvaxToAvaxGgavax(uint256 amount, uint256 minLpOut) external;

    function withdrawAvaxFromAvaxGgavax(
        uint256 amount,
        uint256 minOut
    ) external returns (uint256 amountOut);

    function avaxBalanceAvaxGgavax()
        external
        view
        returns (uint256 _stakedBalance);

    function depositAvaxSavaxSavaxLp(uint256 amount) external;

    function withdrawAvaxSavaxSavaxLp(uint256 amount) external;

    function depositAvaxSavaxAvaxLp(uint256 amount) external;

    function withdrawAvaxSavaxAvaxLp(
        uint256 amount
    ) external returns (uint256 amountOut);

    function depositAvaxGgavaxGgavaxLp(uint256 amount) external;

    function withdrawAvaxGgavaxGgavaxLp(
        uint256 amount
    ) external returns (uint256 amountOut);

    function depositAvaxGgavaxAvaxLp(uint256 amount) external;

    function withdrawAvaxGgavaxAvaxLp(
        uint256 amount
    ) external returns (uint256 amountOut);
}
