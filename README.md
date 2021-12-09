# DeltaPrime - Smart Loans on the Avalanche blockchain

Lending is by far the most popular use case in the currently booming Decentralised Finance sector. The second-generation lending protocols like Aave and Compound allow users to deposit and borrow from a lending pool automatically setting the interest rates to balance capital supply and demand. However, both of them suffer from liquidity crunch as borrowers need to provide collateral that significantly exceeds their loan size. It causes the collateral funds to remain idle in the pool. From the macroeconomic perspective, it means that approximately **70% of the funds stay unproductive** and is not used for assets investment, trading or staking activity.

Smart Loans are the next generation lending platform on Avalanche that will allow under-collateral borrowing from pooled deposits. The core innovation is lending funds not to a personal account but a special purpose smart-contract. The contract automatically guards solvency and every activity needs to undergo a series of checks. This mechanism blocks transactions which could cause the smart-loan valuation to drop below a safe threshold. The insolvency risk is further mitigated by a decentralised liquidation mechanism allowing anyone to forcibly repay part of the loan due to assets price movements caused by external factors. Wrapping loans with smart contracts reduces the collateral need, improving the money supply in the entire Avalanche ecosystem. Patient capital holders will earn interest on the funds provided, while borrowers could use extra capital for investment in high-grow assets.

# Features

## Depositing

A user deposits funds by calling the [deposit](https://github.com/ava-loan/avaloan/blob/master/contracts/Pool.sol#L144) method from the Pool contract.
The deposited amount is taken from the message value and recorded on the user's balance.
It immediately starts to accumulate interest based on the current rates.

## Borrowing

A user borrows funds by calling the [borrow](https://github.com/ava-loan/avaloan/blob/master/contracts/Pool.sol#L175) method from the Pool contract.
The borrowed amount is specified as the parameter to the function call and is transferred to the user account provided there are enough funds available in the pool.

## Accumulating interest

The interest are accumulated every second and compounding on the depositors' account. To save the gas costs the Pool contract uses the [CompoundingIndex](https://github.com/ava-loan/avaloan/blob/master/contracts/CompoundingIndex.sol) helper contract which manages the balances using virtual indices and updates the state only after user interaction.

Borrowing interest is higher than deposit interest. Flexible borrowing/deposit rates give a possibility of adjusting
pool for a demand and optimize it for better performance. For shorter periods of time a pool should be balanced, but in 
a longer term positive surplus can arise. Total deposited value in a pool must be always lower or equal to total borrowed
value plus a current pool balance.

## Insolvency protection

Every loan provides a real-time solvency score accessible by the [getLTV](https://github.com/ava-loan/avaloan/blob/master/contracts/SmartLoan.sol#L297) method. The score is calculated as a ratio between the total debt value and current amount of user's collateral (total value of assets minus debt). The total value may change in time based on the current prices of assets owned by the loan. The solvency score must always remain below the [MAX_LTV](https://github.com/ava-loan/avaloan/blob/master/contracts/SmartLoan.sol#L28) parameter.

There are two mechanisms to enforce the solvency:

* Reactive - every method that changes loan structure satisfy the [remainsSolvent](https://github.com/ava-loan/avaloan/blob/master/contracts/SmartLoan.sol#L381) modifier with ensures that the loan is always left in a solvent state

* Active - if a loan becomes insolvent due to external factors, like assets price movement, anyone is allowed to liquidate a part of the loan by calling the (liquidate) method and forcing loan repayment. To incentivize liquidators to monitor loans and cover gas costs there is a liquidation bonus paid for every successful liquidation calculated as a percentage of the liquidation amount and paid from the smart loan balance.

## Loan adjustment

A user can manage the current solvency ratio by changing the debt or the margin level. The loan margin could be increased by calling the [fund](https://github.com/ava-loan/avaloan/blob/master/contracts/SmartLoan.sol#L51) method and passing the AVAX tokens along with the message. Similarly, a user may call the [withdraw](https://github.com/ava-loan/avaloan/blob/master/contracts/SmartLoan.sol#L186) to remove funds from the smart loans. This method allows investors to cash-out profits in the assets valuation increses.


## Additional tools and scripts

Loan monitoring and liquidation could be automated to enable 24/7 screening and ensure effortless execution. The project contains additional scripts & tools located in the [tools folder](https://github.com/ava-loan/avaloan/tree/master/tools) which could be invoked from a command line.

The liquidation logic is provided in the [liquidate](https://github.com/ava-loan/avaloan/blob/master/tools/monitor-with-sellout.js) nodejs module. A user may invoke the [calculateLiquidationAmount](https://github.com/ava-loan/avaloan/blob/master/tools/liquidate.js#L37) method to compute the maximum amount that could be safely liquidated based on the current loan state. The liquidation is executed by calling the [liquidate](https://github.com/ava-loan/avaloan/blob/master/tools/liquidate.js#L27) method.

The monitoring scripts are located in the [monitoring](https://github.com/ava-loan/avaloan/tree/master/tools/monitor) subfolder. The [monitor-with-logs](https://github.com/ava-loan/avaloan/blob/master/tools/monitor/monitor-with-logs.js) one fetches all the active loans and print their current status that shows: total value, current debt, solvency ratio and solvency status. The [monitor-with-liquidation](https://github.com/ava-loan/avaloan/blob/master/tools/monitor/monitor-with-liquidation.js) one automatically liquidates the loans which are insolvent.

The monitoring scripts could be invoked from the command line and the user may pass an additional `--interval` parameter to specify the refresh period.


# User interface

## Pool dashboard

![Pool UI](https://raw.githubusercontent.com/ava-loan/avaloan/master/static/pool-ui.png)

In the top section the dashboard contains a bar showing **global state** of the pool:
* Your deposits - sum of user's deposits
* Deposit rate - yearly interest rate earned currently by depositors
* Your deposits - sum of deposits of all users

In the middle of the screen, there is a widget allowing user to make one of actions:
* Deposit
* Withdraw

Below user can see deposits history chart and lists of all his deposit-related actions.

## Smart loan view

![smart-loan-ui](https://raw.githubusercontent.com/ava-loan/avaloan/master/static/smart-loan-ui.png)

In the top section there are 3 widgets:
* Loan - the amount of funds borrowed by this loan from the pool denominated in AVAX / USD and the current borrowing costs (APR)
* LTC - shows a ratio between the total loan value and the collateral (total assets value minus debt)
* Collateral - the current value of user collateral (total assets value minus debt)

In the bottom section, there is a table showing the current allocation of the borrowed funds and investment possibilities.
It lists assets available for investment, their price and current holdings displayed in absolute values and as portfolio percentage.
Every investable asset could be bought and sold by clicking on plus and minus buttons.
There is also an option to see the asset's historical performance by clicking on the "magnifier" button.

# Smart-contracts architecture

![Pool UI](https://github.com/ava-loan/avaloan/blob/master/static/smart-contracts-diagram.png)

The smart contracts could be divided into two main groups:

### Lending

* **Pool.sol** - a contract that aggregates deposits and borrowings.
It keeps track of the balance and liabilities of every user.
It accumulates the interest in the real-time based on the rates model connected by the [setRatesCalculator](https://github.com/ava-loan/avaloan/blob/master/contracts/Pool.sol#L62).
The borrowers are verified by the linked [BorrowersRegistry](https://github.com/ava-loan/avaloan/blob/master/contracts/Pool.sol#L75) contract.

* **CompoundingIndex.sol** - a helper contract that facilitates the calculation of deposits and loans interest rates. It uses a global index, that has a snapshot on every user interaction to achieve a O(1) complexity balance updates.

* **VariableUtilisationRatesCalculator.sol** - an interest rates calculation model that automatically adjust the rates based on the current pool utilisation defined as a ratio between borrowed and deposited funds. The mechanism helps to balance the capital supply and demand because a higher need for loans means that the users will need to pay higher interest rates which should reduce the borrowers' appetite.

* **IBorrowersRegistry.sol** - an interface that keeps track of borrowers and their loans by maintaining a bidirectional mapping. It also answers if an account is allowed to borrow funds by calling the [canBorrow](https://github.com/ava-loan/avaloan/blob/master/contracts/IBorrowersRegistry.sol#L11) method.

### Investment

* **SmartLoan.sol** - a core loan contract that manages borrowings, investments and guards solvency.
Borrowing activity is performed by the [borrow](https://github.com/ava-loan/avaloan/blob/master/contracts/SmartLoan.sol#L229) and the [repay](https://github.com/ava-loan/avaloan/blob/master/contracts/SmartLoan.sol#L240) methods which interact with the [Pool](https://github.com/ava-loan/avaloan/blob/master/contracts/Pool.sol#33) contract.
Investment activity is implemented in the [invest](https://github.com/ava-loan/avaloan/blob/master/contracts/SmartLoan.sol#L201) and the [redeem](https://github.com/ava-loan/avaloan/blob/master/contracts/SmartLoan.sol#L216) methods which interact with the [Assets Exchange](https://github.com/ava-loan/avaloan/blob/master/contracts/SmartLoan.sol#L32) contract.
All of the methods mentioned are wrapped by the [remainsSolvent](https://github.com/ava-loan/avaloan/blob/master/contracts/SmartLoan.sol#L381) modifier which doesn't allow the solvency to exceed the specified [maximum ltv](https://github.com/ava-loan/avaloan/blob/master/contracts/SmartLoan.sol#L28).
The solvency level is calculated as the ratio between the debt value and the current collateral value in the real-time using the [getLTV](https://github.com/ava-loan/avaloan/blob/master/contracts/SmartLoan.sol#L297) function.
If the solvency ratio exceeds a safe level anyone could liquidate the loan calling the [liquidate](https://github.com/ava-loan/avaloan/blob/master/contracts/SmartLoan.sol#L146) function. This pays back part of the debt and a percentage of the liquidated amount is transferred to the caller as a reward for monitoring the loan status.
A user can reduce the liquidation risk adjusting amount of personal funds deposited to the loan (margin) by calling the [fund](https://github.com/ava-loan/avaloan/blob/master/contracts/SmartLoan.sol#L51) method. If the LTV ratio is considerably low, a user may withdraw part of the funds calling the [withdraw](https://github.com/ava-loan/avaloan/blob/master/contracts/SmartLoan.sol#L186) function.

* **SmartLoansFactory.sol** - a helper contract that orchestrates loans creation and initial funding in one transaction. It also manages data about loan creators acting as a Borrowers Registry.

* **PangolinExchange.sol** - an exchange contract that allows investing AVAX into other popular crypto-tokens on Pangolin DEX.

# Building and running UI

1. To build the application please install first all of the dependencies by running:

    yarn install

2. Create a `.secret` file in the root of the project with a mnemonic phrase of your account.

3. Make sure that all of the smart-contracts are compiled before trying to deploy the dApp:

    npx truffle compile

4. Setup your local network (e.g. like [here](#forked-test-node)) and migrate contracts

5. <a id="configure-chainid"></a>  Depending on your environment set a proper `chainId` in `src/config.js`. It must match the chain id returned
by the network and be set up in your Metamask configuration of network as well.

6. To deploy the front-end on your local machine please type in your command line:

    yarn serve

7. The application needs a Metamask plugin active and connected to a proper network. Remember to reset your account nonce if you restart or change your network.

# Running forked test node <a id="forked-test-node"></a>

1. Run a forked node

    yarn forked-test-node

2. Migrate contracts (in a separate terminal window)

    npx truffle migrate --network local

Your default chain id is 31337. [Set it up](#configure-chainid) in the UI application and your Metamask account.

# Testing

1. Smart contracts test could be executed by typing:

    npx hardhat test

# Development

This project was funded by the Avalanche-X grant programme.
