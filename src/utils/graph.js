import config from '@/config';
import ApolloClient, {gql} from 'apollo-boost';
import {fromWei} from './calculate';


export async function fetchEventsForSmartLoan(address) {
  let query = `
    {
      smartLoanEvents(where: { smartLoan: "${address.toString()}"}, orderBy: timestamp) {
        id
        name
        toAsset
        amount
        timestamp
      }
    }
   `;

  const client = new ApolloClient({
    uri: config.subgraph
  });

  return (await client.query({query: gql(query)})).data.smartLoanEvents;
}

export async function fetchCollateralFromPayments(address) {
  let query = `
    {   
        smartLoan(id: "${address}") {
            collateralFromPayments
        }
    }
   `;

  const client = new ApolloClient({
    uri: config.subgraph
  });

  const response = await client.query({query: gql(query)});
  console.log(response);
  return fromWei(response.data.smartLoan.collateralFromPayments);
}

export async function fetchEventsForPool(address) {
  let query = `
    {
      poolEvents(where: { user: "${address.toString()}"}, orderBy: timestamp) {
        id
        name
        amount
        timestamp
      }
    }
   `;

  const client = new ApolloClient({
    uri: config.subgraph
  });

  return (await client.query({query: gql(query)})).data.poolEvents;
}

export async function fetchDepositFromPayments(address) {
  let query = `
    {   
        poolUser(id: "${address}") {
            depositFromPayments
        }
    }
   `;

  const client = new ApolloClient({
    uri: config.subgraph
  });

  let user = (await client.query({query: gql(query)})).data.poolUser;
  if (user) {
    return fromWei((await client.query({query: gql(query)})).data.poolUser.depositFromPayments);
  } else return 0;
}