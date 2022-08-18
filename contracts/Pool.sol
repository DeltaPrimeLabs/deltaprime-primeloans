// SPDX-License-Identifier: UNLICENSED
// Last deployed from commit: c5c938a0524b45376dd482cd5c8fb83fa94c2fcc;
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "./interfaces/IIndex.sol";
import "./interfaces/IRatesCalculator.sol";
import "./interfaces/IBorrowersRegistry.sol";


/**
 * @title Pool
 * @dev Contract allowing user to deposit to and borrow from a single smart contract
 * Depositors are rewarded with the interest rates collected from borrowers.
 * The interest rates calculation is delegated to an external calculator contract.
 */
contract Pool is OwnableUpgradeable, ReentrancyGuardUpgradeable, IERC20 {
  using TransferHelper for address payable;

  uint256 public constant MAX_POOL_UTILISATION_FOR_BORROWING = 0.95e18;

  mapping(address => mapping(address => uint256)) private _allowed;
  mapping(address => uint256) internal _deposited;

  mapping(address => uint256) public borrowed;

  IRatesCalculator public ratesCalculator;
  IBorrowersRegistry public borrowersRegistry;

  IIndex public depositIndex;
  IIndex public borrowIndex;

  address payable public tokenAddress;

  function initialize(IRatesCalculator ratesCalculator_, IBorrowersRegistry borrowersRegistry_, IIndex depositIndex_, IIndex borrowIndex_, address payable tokenAddress_) public initializer {
    require(AddressUpgradeable.isContract(address(ratesCalculator_)), "RatesCalculator must be a contract");
    require(AddressUpgradeable.isContract(address(borrowersRegistry_)), "BorrowersRegistry must be a contract");
    require(AddressUpgradeable.isContract(address(depositIndex_)), "DepositIndex must be a contract");
    require(AddressUpgradeable.isContract(address(borrowIndex_)), "BorrowIndex must be a contract");

    borrowersRegistry = borrowersRegistry_;
    ratesCalculator = ratesCalculator_;
    depositIndex = depositIndex_;
    borrowIndex = borrowIndex_;
    tokenAddress = tokenAddress_;

    __Ownable_init();
    __ReentrancyGuard_init();
    _updateRates();
  }

  /* ========== SETTERS ========== */

  /**
   * Sets the new rate calculator.
   * The calculator is an external contract that contains the logic for calculating deposit and borrowing rates.
   * Only the owner of the Contract can execute this function.
   * @dev ratesCalculator the address of rates calculator
   **/
  function setRatesCalculator(IRatesCalculator ratesCalculator_) external onlyOwner {
    // setting address(0) ratesCalculator_ freezes the pool
    require(AddressUpgradeable.isContract(address(ratesCalculator_)) || address(ratesCalculator_) == address(0), "Must be a contract");
    ratesCalculator = ratesCalculator_;
    if (address(ratesCalculator_) != address(0)) {
      _updateRates();
    }

    emit RatesCalculatorChanged(address(ratesCalculator_), block.timestamp);
  }

  /**
   * Sets the new borrowers registry contract.
   * The borrowers registry decides if an account can borrow funds.
   * Only the owner of the Contract can execute this function.
   * @dev borrowersRegistry the address of borrowers registry
   **/
  function setBorrowersRegistry(IBorrowersRegistry borrowersRegistry_) external onlyOwner {
    require(AddressUpgradeable.isContract(address(borrowersRegistry_)), "Must be a contract");

    borrowersRegistry = borrowersRegistry_;
    emit BorrowersRegistryChanged(address(borrowersRegistry_), block.timestamp);
  }

  /* ========== MUTATIVE FUNCTIONS ========== */
  function transfer(address recipient, uint256 amount) external override returns (bool) {
    require(recipient != address(0), "ERC20: cannot transfer to the zero address");
    require(recipient != address(this), "ERC20: cannot transfer to the pool address");

    _accumulateDepositInterest(msg.sender);

    require(_deposited[msg.sender] >= amount, "ERC20: transfer amount exceeds balance");

    // (this is verified in "require" above)
    unchecked {
      _deposited[msg.sender] -= amount;
    }

    _accumulateDepositInterest(recipient);
    _deposited[recipient] += amount;

    emit Transfer(msg.sender, recipient, amount);

    return true;
  }

  function allowance(address owner, address spender) external view override returns (uint256) {
    return _allowed[owner][spender];
  }

  function increaseAllowance(address spender, uint256 addedValue) external returns (bool) {
    require(spender != address(0), "Allowance spender cannot be a zero address");
    uint256 newAllowance = _allowed[msg.sender][spender] + addedValue;
    _allowed[msg.sender][spender] = newAllowance;

    emit Approval(msg.sender, spender, newAllowance);
    return true;
  }

  function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool) {
    require(spender != address(0), "Allowance spender cannot be a zero address");
    uint256 currentAllowance = _allowed[msg.sender][spender];
    require(currentAllowance >= subtractedValue, "Current allowance is smaller than the subtractedValue");

    uint256 newAllowance = currentAllowance - subtractedValue;
    _allowed[msg.sender][spender] = newAllowance;

    emit Approval(msg.sender, spender, newAllowance);
    return true;
  }

  function approve(address spender, uint256 amount) external override returns (bool) {
    require(spender != address(0), "Allowance spender cannot be a zero address");
    _allowed[msg.sender][spender] = amount;

    emit Approval(msg.sender, spender, amount);

    return true;
  }

  function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
    require(_allowed[sender][msg.sender] >= amount, "Not enough tokens allowed to transfer required amount");
    require(recipient != address(0), "ERC20: cannot transfer to the zero address");
    require(recipient != address(this), "ERC20: cannot transfer to the pool address");

    _accumulateDepositInterest(sender);

    require(_deposited[sender] >= amount, "ERC20: transfer amount exceeds balance");

    _deposited[sender] -= amount;
    _allowed[sender][msg.sender] -= amount;

    _accumulateDepositInterest(recipient);
    _deposited[recipient] += amount;

    emit Transfer(sender, recipient, amount);

    return true;
  }


  /**
   * Deposits the amount
   * It updates user deposited balance, total deposited and rates
   **/
  function deposit(uint256 amount) public virtual nonReentrant {
    _accumulateDepositInterest(msg.sender);

    _transferToPool(msg.sender, amount);

    _mint(msg.sender, amount);
    _deposited[address(this)] += amount;
    _updateRates();

    emit Deposit(msg.sender, amount, block.timestamp);
  }

  function _transferToPool(address from, uint256 amount) internal virtual {
    tokenAddress.safeTransferFrom(from, address(this), amount);
  }

  function _transferFromPool(address to, uint256 amount) internal virtual {
    tokenAddress.safeTransfer(to, amount);
  }

  /**
   * Withdraws selected amount from the user deposits
   * @dev _amount the amount to be withdrawn
   **/
  function withdraw(uint256 _amount) external nonReentrant {
    require(IERC20(tokenAddress).balanceOf(address(this)) >= _amount, "There is not enough available funds in the pool to withdraw");

    _accumulateDepositInterest(msg.sender);

    _burn(msg.sender, _amount);

    _transferFromPool(msg.sender, _amount);

    _updateRates();

    emit Withdrawal(msg.sender, _amount, block.timestamp);
  }

  /**
   * Borrows the specified amount
   * It updates user borrowed balance, total borrowed amount and rates
   * @dev _amount the amount to be borrowed
   * @dev It is only meant to be used by a SmartLoanDiamond
   **/
  function borrow(uint256 _amount) public virtual canBorrow nonReentrant {
    require(IERC20(tokenAddress).balanceOf(address(this)) >= _amount, "There is not enough funds in the pool to fund the loan");

    _accumulateBorrowingInterest(msg.sender);

    borrowed[msg.sender] += _amount;
    borrowed[address(this)] += _amount;

    _transferFromPool(msg.sender, _amount);

    _updateRates();

    emit Borrowing(msg.sender, _amount, block.timestamp);
  }

  /**
   * Repays the amount
   * It updates user borrowed balance, total borrowed amount and rates
   * @dev It is only meant to be used by a SmartLoanDiamond
   **/
  function repay(uint256 amount) external nonReentrant {
    _accumulateBorrowingInterest(msg.sender);

    require(borrowed[msg.sender] >= amount, "You are trying to repay more that was borrowed by a user");
    _transferToPool(msg.sender, amount);

    borrowed[msg.sender] -= amount;
    borrowed[address(this)] -= amount;

    _updateRates();

    emit Repayment(msg.sender, amount, block.timestamp);
  }

  /* =========


  /**
   * Returns the current borrowed amount for the given user
   * The value includes the interest rates owned at the current moment
   * @dev _user the address of queried borrower
  **/
  function getBorrowed(address _user) public view returns (uint256) {
    return borrowIndex.getIndexedValue(borrowed[_user], _user);
  }

  function totalSupply() public view override returns (uint256) {
    return balanceOf(address(this));
  }

  function totalBorrowed() public view returns (uint256) {
    return getBorrowed(address(this));
  }

  /**
   * Returns the current deposited amount for the given user
   * The value includes the interest rates earned at the current moment
   * @dev _user the address of queried depositor
   **/
  function balanceOf(address user) public view override returns (uint256) {
    return depositIndex.getIndexedValue(_deposited[user], user);
  }

  /**
   * Returns the current interest rate for deposits
   **/
  function getDepositRate() public view returns (uint256) {
    return ratesCalculator.calculateDepositRate(totalBorrowed(), totalSupply());
  }

  /**
   * Returns the current interest rate for borrowings
   **/
  function getBorrowingRate() public view returns (uint256) {
    return ratesCalculator.calculateBorrowingRate(totalBorrowed(), totalSupply());
  }

  /**
   * Recovers the surplus funds resultant from difference between deposit and borrowing rates
   **/
  function recoverSurplus(uint256 amount, address account) public onlyOwner nonReentrant {
    uint256 balance = IERC20(tokenAddress).balanceOf(address(this));
    uint256 surplus = balance + totalBorrowed() - totalSupply();

    require(amount <= balance, "Trying to recover more surplus funds than pool balance");
    require(amount <= surplus, "Trying to recover more funds than current surplus");

    _transferFromPool(account, amount);
  }

  /* ========== INTERNAL FUNCTIONS ========== */

  function _mint(address to, uint256 amount) internal {
    require(to != address(0), "ERC20: cannot mint to the zero address");

    _deposited[to] += amount;

    emit Transfer(address(0), to, amount);
  }

  function _burn(address account, uint256 amount) internal {
    require(_deposited[account] >= amount, "ERC20: burn amount exceeds user balance");
    require(_deposited[address(this)] >= amount, "ERC20: burn amount exceeds current pool indexed balance");

    // verified in "require" above
    unchecked {
      _deposited[account] -= amount;
      _deposited[address(this)] -= amount;
    }

    emit Transfer(account, address(0), amount);
  }

  function _updateRates() internal {
    require(address(ratesCalculator) != address(0), "Pool is frozen: cannot perform deposit, withdraw, borrow and repay operations");
    depositIndex.setRate(ratesCalculator.calculateDepositRate(totalBorrowed(), totalSupply()));
    borrowIndex.setRate(ratesCalculator.calculateBorrowingRate(totalBorrowed(), totalSupply()));
  }

  function _accumulateDepositInterest(address user) internal {
    uint256 interest = balanceOf(user) - _deposited[user];

    _mint(user, interest);
    _deposited[address(this)] = balanceOf(address(this));

    emit InterestCollected(user, interest, block.timestamp);

    depositIndex.updateUser(user);
    depositIndex.updateUser(address(this));
  }

  function _accumulateBorrowingInterest(address user) internal {
    borrowed[user] = getBorrowed(user);
    borrowed[address(this)] = getBorrowed(address(this));

    borrowIndex.updateUser(user);
    borrowIndex.updateUser(address(this));
  }

  /* ========== MODIFIERS ========== */

  modifier canBorrow() {
    require(address(borrowersRegistry) != address(0), "Borrowers registry is not configured");
    require(borrowersRegistry.canBorrow(msg.sender), "Only the accounts authorised by borrowers registry may borrow");
    require(totalSupply() != 0, "Cannot borrow from an empty pool");
    _;
    require((totalBorrowed() * 1e18) / totalSupply() <= MAX_POOL_UTILISATION_FOR_BORROWING, "The pool utilisation cannot be greater than 95%");
  }

  /* ========== EVENTS ========== */

  /**
   * @dev emitted after the user deposits funds
   * @param user the address performing the deposit
   * @param value the amount deposited
   * @param timestamp of the deposit
   **/
  event Deposit(address indexed user, uint256 value, uint256 timestamp);

  /**
   * @dev emitted after the user withdraws funds
   * @param user the address performing the withdrawal
   * @param value the amount withdrawn
   * @param timestamp of the withdrawal
   **/
  event Withdrawal(address indexed user, uint256 value, uint256 timestamp);

  /**
   * @dev emitted after the user borrows funds
   * @param user the address that borrows
   * @param value the amount borrowed
   * @param timestamp time of the borrowing
   **/
  event Borrowing(address indexed user, uint256 value, uint256 timestamp);

  /**
   * @dev emitted after the user repays debt
   * @param user the address that repays debt
   * @param value the amount repaid
   * @param timestamp of the repayment
   **/
  event Repayment(address indexed user, uint256 value, uint256 timestamp);

  /**
   * @dev emitted after accumulating deposit interest
   * @param user the address that the deposit interest is accumulated for
   * @param value the amount that interest is calculated from
   * @param timestamp of the interest accumulation
   **/
  event InterestCollected(address indexed user, uint256 value, uint256 timestamp);

  /**
  * @dev emitted after changing borrowers registry
  * @param registry an address of the newly set borrowers registry
  * @param timestamp of the borrowers registry change
  **/
  event BorrowersRegistryChanged(address indexed registry, uint256 timestamp);

  /**
  * @dev emitted after changing rates calculator
  * @param calculator an address of the newly set rates calculator
  * @param timestamp of the borrowers registry change
  **/
  event RatesCalculatorChanged(address indexed calculator, uint256 timestamp);
}