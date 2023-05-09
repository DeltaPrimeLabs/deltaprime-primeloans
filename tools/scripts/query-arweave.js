const { request, gql } = require("graphql-request");

const ARWEAVE_GRAPHQL_API_ENDPOINT = "https://arweave.net/graphql";

const buildGraphQlQuery = (timestamp, nodeAddress, after) => {
    return gql`
        query {
            transactions(
                first: 10,
                ${after ? 'after: "' + after + '",' : ''}
                tags: [
                    {
                        name: "timestamp",
                        values: ["${timestamp}"]
                    },
                    {
                        name: "signerAddress",
                        values: ${JSON.stringify(nodeAddress)}
                    }])
            {
                edges {
                    cursor,
                    node {
                        id
                        owner {
                            address
                        }
                        data {
                            size
                            type
                        }
                        tags{
                            name
                            value
                        }
                    }
                }
            }
        }
    `;
};

async function queryArweave(timestamp, nodeAddress) {
    let after;
    let response = [];

    while (true) {
        const query = buildGraphQlQuery(timestamp, nodeAddress, after);
        const arweaveResponse = await request(ARWEAVE_GRAPHQL_API_ENDPOINT, query);

        const edges = arweaveResponse.transactions.edges;

        if (edges.length === 0) return response;

        response.push(...edges);
        const lastEdge = edges[edges.length-1];
        after = lastEdge.cursor;
    }

    return response;
}

export const queryHistoricalFeeds = async (timestamp, nodeAddress) => {
    try {
        return await queryArweave(timestamp, nodeAddress);
    } catch (error) {
        console.log(error);
    }
};