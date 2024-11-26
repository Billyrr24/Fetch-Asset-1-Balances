const polkadotApi = require('@polkadot/api');

(async function () {
  const { ApiPromise, WsProvider } = polkadotApi;

  try {
    const wsProvider = new WsProvider('wss://rpc-mainnet.vtrs.io:443');
    const api = await ApiPromise.create({ provider: wsProvider });

    console.log("Connected to Substrate!");

    // Define the asset ID (u128)
    const assetId = 1; // Replace this with your actual asset ID

    // Query all accounts holding the specified asset
    console.log("Fetching accounts for asset ID:", assetId);

    // Fetch all keys for the asset
    const keys = await api.query.assets.account.keys(assetId);

    // Extract the account details
    const accounts = await Promise.all(
      keys.map(async (key) => {
        const accountId = key.args[1].toHuman(); // Get the AccountId20 part
        const accountInfo = await api.query.assets.account(assetId, accountId);

        if (accountInfo.isSome) {
          const accountDetails = accountInfo.unwrap(); // Unwrap the Option

          return {
            assetId,
            accountId,
            balance: accountDetails.balance.toString(),
            status: accountDetails.status.toHuman(),
          };
        } else {
          return {
            assetId,
            accountId,
            balance: "0",
            status: "None",
          };
        }
      })
    );

    // Log the fetched accounts and balances
    console.log("Accounts holding asset ID", assetId, ":", accounts);

    process.exit(0); // Exit the script when done
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1); // Exit with an error code
  }
})();
