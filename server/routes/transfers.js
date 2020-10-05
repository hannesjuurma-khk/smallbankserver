const express = require("express");
const router = express.Router();
const verifyUser = require('./authorizations/authUser');
const fetch = require('node-fetch');
const AbortController = require('abort-controller');

// Set up an abort controller
const controller = new AbortController();
const signal = controller.signal;
// Set a 5 sec timeout for the request
setTimeout(() => { controller.abort(); }, 5000);

// Import validation
const { transferValidation } = require('./validations/validations');

const Transfer = require("../models/Transfer");
const Account = require("../models/Account");
const RemoteBank = require("../models/RemoteBank");

// Transactions - local transactions / money from my bank to other bank / money from other bank to my bank
router.post('/', verifyUser, async (req, res) => {

  // Validate incoming request's parameters
  const { error } = transferValidation(req.body);

  if(error) {
    return res.status(400).send(error.details[0].message);
  };

  // Create a new transfer
  const newTransfer = new Transfer({
    accountFrom: req.body.accountFrom,
    accountTo: req.body.accountTo,
    amount: req.body.amount
  });

  try {
    // Cut away/isolate the bank prefixes
    const accountFromBankPrefix = req.body.accountFrom.slice(0,3);
    const accountToBankPrefix = req.body.accountTo.slice(0,3);

    // Check if the transaction is LOCAL
    if (accountFromBankPrefix == process.env.BANK_PREFIX && accountToBankPrefix == process.env.BANK_PREFIX) {

      // Get current user's account number and balance.
      const currAccountNumber = await Account.findOne({'user': req.user._id}).select('accountnumber balance');

      // Check if accountFrom has enough money
      if (currAccountNumber.balance < req.body.amount) return res.status(409).json({error: "Insufficent funds!"});

      // Find the receiving local bank
      const accountToExists = await Account.findOne({'accountnumber': req.body.accountTo});

      // If account number can't be found (doesn't exist or error in data), account number does not match logged in user's account number (logged in account saved at "req.user"), accountTo can't be found (doesn't exist or error in data), return an error.
      if (!currAccountNumber || req.body.accountFrom !== currAccountNumber.accountnumber || !accountToExists) return res.send('Please enter correct account numbers!')

      // If data is correct, send the money away from accountFrom
      const giveMoney = await Account.updateOne(
        currAccountNumber,
      {
        $inc: {
          balance: -req.body.amount
        }
      });

      // Recieve the money from accountFrom
      const getMoney = await Account.updateOne(
        accountToExists,
      {
        $inc: {
          balance: req.body.amount
        }
      });

      newTransfer.save();
      res.send('Local transfer completed!');
    };

    // Check if the bank account is REMOTE

    // Create a model for remote bank's collection
    const remoteBank = new RemoteBank();

    // Store the logged in local account's information
    const localAccountFrom = await Account.findOne({'user': req.user._id}).select('accountnumber balance');

    // Store being sent to local account's information
    const localAccountTo = await Account.findOne({'accountnumber': req.body.accountTo}).select('accountnumber balance');

    // CASE 1: If local bank is sending money and account to is (possibly) a remote bank
    if (accountFromBankPrefix == process.env.BANK_PREFIX && accountToBankPrefix != process.env.BANK_PREFIX) {

      // Check if logged in local account does exist, return error if doesn't
      if(req.body.accountFrom != localAccountFrom.accountnumber) return res.status(400).send("Your account number is wrong!");

      // Check if accountFrom has enough money
      if (localAccountFrom.balance < req.body.amount) return res.status(409).json({error: "Insufficent funds!"});

      // Find "accountTo" bank prefix from local "remotebanks" collection
      const isBankARemoteBankFrom = await RemoteBank.findOne({bankPrefix: accountToBankPrefix});

      if (!isBankARemoteBankFrom) {
        // If not a single match is found, delete the whole "remotebanks" collection and update it with new information
        try {
          const deleteBanks = await RemoteBank.deleteMany({});

        // Fetch all the banks from central bank, with the required "api-key"
        fetch('http://localhost:3000/banks', {
          headers: { 'api-key' : process.env.API_KEY},
          signal
          })
          // Convert the answer into JSON
          .then(res => res.json())
          // Run over each of the json object and save it to local "remotebanks" collection
          .then(json => json.forEach(bank => {
            const remoteBank = new RemoteBank({
                name: bank.name,
                transactionUrl: bank.transactionUrl,
                bankPrefix: bank.bankPrefix,
                owners: bank.owners
            });

            remoteBank.save();
          }));

          // Check again if bank with that specific prefix is found after the update (NB! Update takes 2 tries.)
          const isBankARemoteBankFromUpdated = await RemoteBank.findOne({bankPrefix: accountToBankPrefix}).select('transactionUrl');

          if(!isBankARemoteBankFromUpdated) return res.status(400).send("This prefix is not any of our banks!")
        }
        catch(errors) {
          res.send("Something wrong!")
        }
      }

      // If both exist, send a post fetch to transaction URL with data.
      const bodyData = {
        "accountFrom": req.body.accountFrom,
        "accountTo": req.body.accountTo,
        "amount": req.body.amount
      }

      let responseStatus;

      // fetch("isBankARemoteBankFrom.transactionUrl", {
      fetch("http://localhost:10000/transaction", {
        method: 'post',
        body:    JSON.stringify(bodyData),
        headers: { 'Content-Type': 'application/json' },
        signal
        })
        .then(res => {
          // Keep track of post response status
          responseStatus = res.status;
          return res.json();
        })
        .then(json => {
          // If post was successful, take they money away from local account
          if(responseStatus == 200) {
            // "Send" the money away from accountFrom
            const giveMoney = Account.updateOne(
              localAccountFrom,
            {
              $inc: {
                 balance: -req.body.amount
              }
            }).exec();

            res.json({message: "Money transferred to " + req.body.accountTo + ". New balance is " + (localAccountFrom.balance - req.body.amount)})
          }

          return res.json({message: "No account found!"})
        })
        // If response is aborted, end it
        .catch(err => {
          if(err.name == "AbortError") {
            console.log('Fetch aborted');
            res.end();
          } else {
            console.error('Uh oh, an error!', err);
            res.end();
          }
        })

    }

    // CASE 2: If local account receives the money.
    if (accountFromBankPrefix != process.env.BANK_PREFIX && accountToBankPrefix == process.env.BANK_PREFIX) {


      // Check if logged in local account does exist, return error if doesn't
      if(!localAccountTo) return res.status(400).send("Your account number is wrong!");

      // Check if sending account's prefix is part of central bank
      const isBankARemoteBankTo = await RemoteBank.findOne({bankPrefix: accountToBankPrefix});

      if (!isBankARemoteBankTo) {
        // If not a single match is found, delete the whole "remotebanks" collection and update it with new information
        try {
          const deleteBanks = await RemoteBank.deleteMany({});

        // Fetch all the banks from central bank, with the required "api-key"
        fetch('http://localhost:3000/banks', {
          headers: { 'api-key' : process.env.API_KEY},
          signal
          })
          // Convert the answer into JSON
          .then(res => res.json())
          // Run over each of the json object and save it to local "remotebanks" collection
          .then(json => json.forEach(bank => {
            const remoteBank = new RemoteBank({
                name: bank.name,
                transactionUrl: bank.transactionUrl,
                bankPrefix: bank.bankPrefix,
                owners: bank.owners
            });

            remoteBank.save();
          }));

          // Check again if bank with that specific prefix is found after the update (NB! Update takes 2 tries.)
          const isBankARemoteBankToUpdated = await RemoteBank.findOne({bankPrefix: accountToBankPrefix}).select('transactionUrl');

          if(!isBankARemoteBankToUpdated) return res.status(400).send("This prefix is not any of our banks!")
        }
        catch(errors) {
          res.send("Something wrong!")
        }
      }

      // If the local bank exists and remote bank is legit, do the transaction
      const getMoney = await Account.updateOne(
        localAccountTo,
      {
        $inc: {
          balance: req.body.amount
        }
      }).exec();
      console.log("Sees");
      newTransfer.save();
      res.json({message: "Money transferred to " + req.body.localAccountTo + ". New balance is " + (localAccountTo.balance + req.body.amount)})
    }

    // CASE 3 : If both of the accounts are not local.
    if (accountFromBankPrefix != process.env.BANK_PREFIX && accountToBankPrefix != process.env.BANK_PREFIX) {
      res.status(400).send("This bank is not part of this transaction!")
    }

    //res.send("Bank exists :)");

  } catch(err) {
    res.status(400).send('Could not do a transfer!');
  };
});

  // Remote bank transactions
    // Make sure if the account that is sending money is local or remote.

      // If the account is local and accountTo is remote, go through with all of the process as above -> find accountTo's bank prefix from the "remotebanks" collection. If the bank prefix is legit, try to post to it's transaction URL. If the response is positive, subtract the amount from your local account. If the response is negative, it's probably because that account does not exist.

      // If the account is remote and the accountTo is local, it means that someone has pinged my transaction URL with accountFrom, accountTo and amount. Validate if the accountTo prefix exists in the "remotebanks" and if accountTo (local) exists in the database. If it does, add money to the local account and give a positive result.

      // If the account is remote and accountTo is remote, return that the transaction takes place in the wrong bank.

  // Remote transactions:
    // Local -> remote
    // Remote -> local


module.exports = router;