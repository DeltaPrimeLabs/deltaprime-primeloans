# Functions to save the historical and current loan data to database

## helper.js
Helper methods. Need to uncomment the method to use it. Run `node helper.js`.

`fillTimestamps` - method to fill timestamps in `timestamps.json` file based on defined conditions. This file is 
later used by `fetch-loan.js`for fetching needed data points.

`fillFailedTimestamps` - method to fill timestamps in `timestamps.json` file based on failed data points 
from `failed-loans.json.

`fetchLoanAddresses` - fetch current loan addresses and save them to `loan-addresses.json`.

## fetch-loan.js
Fetches historical data for a defined loan according to timestamps from `timestamps.json` and saves them in `results` folder. Unsuccessful datapoints
are saved to `failed-loans.json`.

Run `node fetch-loan.js LOAN_ADDRESS`

## fetch-loans.js
Fetches historical data for loans from `loan-addresses.json`.

Run `node fetch-loans.js`

## index.js > saveLoansStatusFromFile
Saves historical data to firestore from `results` folder.

