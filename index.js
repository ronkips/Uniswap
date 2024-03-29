const { default: BigNumber } = require("bignumber.js");
const Web3 = require("web3");
const { qs } = require("qs");
let currentTrade = {};
let currentSelectSide;
let tokens;

async function init() {
  await listAvailableTokens();
}

async function listAvailableTokens() {
  console.log("initializing");
  let response = await fetch("https://tokens.coingecko.com/uniswap/all.json");
  let tokenListJSON = await response.json();
  console.log("listing available tokens..");
  console.log(tokenListJSON);
  tokens = tokenListJSON.tokens;
  console.log("tokens:", tokens);

  // create token list for modal
  let parent = document.getElementById("token_list");
  // Loop through all the tokens inside the token list JSON object
  for (const i in tokens) {
    // create a token row in the modal token list
    let div = document.createElement("div");
    div.className = "token_row";
    // For each row , display the token image and symbol
    let html = `
    <img class="token_list_img" src="${tokens[i].logoURI}">
      <span class="token_list_text">${tokens[i].symbol}</span>
      `;
    div.innerHTML = html;
    // selectToken() will be called when a token is clicked
    div.onclick = () => {
      selectToken(tokens[i]);
    };
    parent.appendChild(div);
  }
}

function selectToken(token) {
  // When selected automatically closes the modal
  closeModal();
  // Track which side of the trade we are on - from/to
  currentTrade[currentSelectSide] = token;
  // Log the selected token
  console.log("currentTrade:", currentTrade);
  renderInterface();
}
//Function to display the image and token symbols
function renderInterface() {
  if (currentTrade.from) {
    console.log(currentTrade.from);
    // Set the form token image
    document.getElementById("from_token_img").src = currentTrade.from.logoURI;
    // Set the form token symbol text
    document.getElementById("from_token_text").innerHTML =
      currentTrade.from.symbol;
  }
  if (currentTrade.to) {
    console.log(currentTrade.to);
    // Set the to token image
    document.getElementById("to_token_img").src = currentTrade.to.logoURI;
    // Set the to token symbol text
    document.getElementById("to_token_text").innerHTML = currentTrade.to.symbol;
  }
}

async function connect() {
  if (typeof window.ethereum !== "undefined") {
    try {
      console.log("connecting...");
      await ethereum.request({ method: "eth_requestAccounts" });
    } catch (error) {
      console.log(error);
    } // If connected change button to connected
    document.getElementById("login_button").innerHTML = "Connected:";
    // If conneceted, enable "Swap" button
    document.getElementById("swap_button").disabled = false;
  } //  Ask user to Install Metamask if it's not detected
  else {
    document.getElementById("login_button").innerHTML =
      "Please install MetaMask";
  }
}

function openModal(side) {
  // Store whether the user has selected a token on the from or to side
  currentSelectSide = side;
  document.getElementById("token_modal").style.display = "block";
}

function closeModal() {
  document.getElementById("token_modal").style.display = "none";
}

async function getPrice() {
  console.log("Getting Price..");
  // Only fetch price if from token, to token, and from token amount have ben filled in
  if (
    !currentTrade.from ||
    !currentTrade.to ||
    !document.getElementById("from_amount").value
  )
    return;
  // The amount is calculeted from the smallest base unit of the token.
  //We get this by multiplying the (from amount)  * (to the poer of the number of decimal places)
  let amount = Number(
    document.getElementById("from_amount").value *
      10 ** currentTrade.from.decimals
  );

  const params = {
    sellToken: currentTrade.from.address,
    buyToken: currentTrade.to.address,
    sellAmount: amount
  };

  // Fetch the swap price.
  const response = await fetch(
    `https://goerli.api.0x.org/swap/v1/price?${qs.stringify(params)}`
  );
  // Await a parse the JSON response
  swapPriceJSON = await response.json();
  console.log("Price: ", swapPriceJSON);

  document.getElementById("to_amount").value =
    swapPriceJSON.buyAmount / 10 ** currentTrade.to.decimals;
  document.getElementById("gas_estimate").innerHTML =
    swapPriceJSON.estimatedGas;
}
//function to get the quote using  /swap/v1/quote . We will pass in the user's Metamask as the tareAddress
async function getQuote(account) {
  console.log("Getting Quote");

  if (
    !currentTrade.from ||
    !currentTrade.to ||
    !document.getElementById("from_amount").value
  )
    return;
  let amount = Number(
    document.getElementById("from_amount").value *
      10 ** currentTrade.from.decimals
  );

  const params = {
    sellToken: currentTrade.from.address,
    buyToken: currentTrade.to.address,
    sellAmount: amount,
    // Set takerAddress to account
    takerAddress: account
  };

  // Fetch the swap quote.
  const response = await fetch(
    `https://goerli.api.0x.org/swap/v1/quote?${qs.stringify(params)}`
  );

  swapQuoteJSON = await response.json();
  console.log("Quote: ", swapQuoteJSON);

  document.getElementById("to_amount").value =
    swapQuoteJSON.buyAmount / 10 ** currentTrade.to.decimals;
  document.getElementById("gas_estimate").innerHTML =
    swapQuoteJSON.estimatedGas;

  return swapQuoteJSON;
}

async function trySwap() {
  // The address, if any , of the most recently used account that the caller is permitted to access
  let accounts = await ethereum.request({ method: "eth_accounts" });
  let takerAddress = accounts[0];
  // Log the most recently used address in our Metamask wallet
  console.log("takerAddress: ", takerAddress);
  // Pass this as the account param into getQuote() . this will return a JSON object trade order
  const swapQuoteJSON = await getQuote(takerAddress);

  //   // Set Token Allowance
  //   // Interact with the ERC20TokenContract
  const erc20abi = [
    {
      inputs: [
        { internalType: "string", name: "name", type: "string" },
        { internalType: "string", name: "symbol", type: "string" },
        { internalType: "uint256", name: "max_supply", type: "uint256" }
      ],
      stateMutability: "nonpayable",
      type: "constructor"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "owner",
          type: "address"
        },
        {
          indexed: true,
          internalType: "address",
          name: "spender",
          type: "address"
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "value",
          type: "uint256"
        }
      ],
      name: "Approval",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "address",
          name: "from",
          type: "address"
        },
        { indexed: true, internalType: "address", name: "to", type: "address" },
        {
          indexed: false,
          internalType: "uint256",
          name: "value",
          type: "uint256"
        }
      ],
      name: "Transfer",
      type: "event"
    },
    {
      inputs: [
        { internalType: "address", name: "owner", type: "address" },
        { internalType: "address", name: "spender", type: "address" }
      ],
      name: "allowance",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        { internalType: "address", name: "spender", type: "address" },
        { internalType: "uint256", name: "amount", type: "uint256" }
      ],
      name: "approve",
      outputs: [{ internalType: "bool", name: "", type: "bool" }],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [{ internalType: "address", name: "account", type: "address" }],
      name: "balanceOf",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
      name: "burn",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        { internalType: "address", name: "account", type: "address" },
        { internalType: "uint256", name: "amount", type: "uint256" }
      ],
      name: "burnFrom",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [],
      name: "decimals",
      outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        { internalType: "address", name: "spender", type: "address" },
        { internalType: "uint256", name: "subtractedValue", type: "uint256" }
      ],
      name: "decreaseAllowance",
      outputs: [{ internalType: "bool", name: "", type: "bool" }],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        { internalType: "address", name: "spender", type: "address" },
        { internalType: "uint256", name: "addedValue", type: "uint256" }
      ],
      name: "increaseAllowance",
      outputs: [{ internalType: "bool", name: "", type: "bool" }],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [],
      name: "name",
      outputs: [{ internalType: "string", name: "", type: "string" }],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "symbol",
      outputs: [{ internalType: "string", name: "", type: "string" }],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [],
      name: "totalSupply",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function"
    },
    {
      inputs: [
        { internalType: "address", name: "recipient", type: "address" },
        { internalType: "uint256", name: "amount", type: "uint256" }
      ],
      name: "transfer",
      outputs: [{ internalType: "bool", name: "", type: "bool" }],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        { internalType: "address", name: "sender", type: "address" },
        { internalType: "address", name: "recipient", type: "address" },
        { internalType: "uint256", name: "amount", type: "uint256" }
      ],
      name: "transferFrom",
      outputs: [{ internalType: "bool", name: "", type: "bool" }],
      stateMutability: "nonpayable",
      type: "function"
    }
  ];
  // Set up approval amount for the token we want to trade from
  const fromTokenAddress = currentTrade.from.address;
  // In order for us to interact with a ERC20 contract's method's, need to create a web3 object
  const web3 = new Web3(Web3.givenProvider);
  const ERC20TokenContract = new web3.eth.Contract(erc20abi, fromTokenAddress);

  console.log("setup ERC20TokenContract: ", ERC20TokenContract);
  //The max approval is set here
  const maxApproval = new BigNumber(2).pow(256).minus(1);
  console.log("The approval amount is:", maxApproval);
  //  // Grant the allowance target (the 0x Exchange Proxy) an  allowance to spend our tokens
  const tx = await ERC20TokenContract.methods
    .approve(swapQuoteJSON.allowanceTarget, maxApproval)
    .send({ from: takerAddress })
    .then((tx) => {
      console.log("tx: ", tx);
    });

  // Perform the swap
  const receipt = await web3.eth.sendTransaction(swapQuoteJSON);
  console.log("receipt: ", receipt);
}

init();
// Call the connect function when the login_button is clicked
document.getElementById("login_button").onclick = connect;
document.getElementById("from_token_select").onclick = () => {
  openModal("from");
};
document.getElementById("to_token_select").onclick = () => {
  openModal("to");
};
document.getElementById("modal_close").onclick = closeModal;
document.getElementById("from_amount").onblur = getPrice;
document.getElementById("swap_button").onclick = trySwap;
