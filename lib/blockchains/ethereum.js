"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _constants = require("../constants");

var _utils = require("../utils");

var _wallet = require("@ethersproject/wallet");

var _contracts = require("@ethersproject/contracts");

var providers = _interopRequireWildcard(require("@ethersproject/providers"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

const ERC1271_ABI = ['function isValidSignature(bytes _messageHash, bytes _signature) public view returns (bytes4 magicValue)'];
const MAGIC_ERC1271_VALUE = '0x20c13b0b';

const isEthAddress = address => /^0x[a-fA-F0-9]{40}$/.test(address);

function getEthersProvider(chainId) {
  const network = providers.getNetwork(chainId);
  if (!network._defaultProvider) throw new Error(`Network with chainId ${chainId} is not supported`);
  return network._defaultProvider(providers);
}

async function getChainId(provider) {
  const payload = (0, _utils.encodeRpcCall)('eth_chainId', []);
  const chainIdHex = await safeSend(payload, provider);
  return parseInt(chainIdHex, 16);
}

async function getCode(address, provider) {
  const payload = (0, _utils.encodeRpcCall)('eth_getCode', [address, 'latest']);
  const code = await safeSend(payload, provider);
  return code;
}

async function safeSend(data, provider) {
  const send = (Boolean(provider.sendAsync) ? provider.sendAsync : provider.send).bind(provider);
  return new Promise((resolve, reject) => {
    send(data, function (err, result) {
      if (err) reject(err);else if (result.error) reject(result.error);else resolve(result.result);
    });
  });
}

async function createEthLink(did, address, provider, opts = {}) {
  const {
    message,
    timestamp
  } = (0, _utils.getConsentMessage)(did, !opts.skipTimestamp);
  const payload = (0, _utils.encodeRpcCall)('personal_sign', [message, address]);
  const signature = await safeSend(payload, provider);
  const proof = {
    version: 1,
    type: _constants.ADDRESS_TYPES.ethereumEOA,
    message,
    signature,
    address
  };
  if (!opts.skipTimestamp) proof.timestamp = timestamp;
  return proof;
}

async function createErc1271Link(did, address, provider, opts) {
  const res = await createEthLink(did, address, provider, opts);
  const chainId = await getChainId(provider);
  return Object.assign(res, {
    type: _constants.ADDRESS_TYPES.erc1271,
    chainId
  });
}

async function typeDetector(address, provider) {
  if (!isEthAddress(address)) {
    return false;
  }

  const bytecode = await getCode(address, provider).catch(() => null);

  if (!bytecode || bytecode === '0x' || bytecode === '0x0' || bytecode === '0x00') {
    return _constants.ADDRESS_TYPES.ethereumEOA;
  }

  return _constants.ADDRESS_TYPES.erc1271;
}

async function createLink(did, address, type, provider, opts) {
  address = address.toLowerCase();

  if (type === _constants.ADDRESS_TYPES.ethereumEOA) {
    return createEthLink(did, address, provider, opts);
  } else if (type === _constants.ADDRESS_TYPES.erc1271) {
    return createErc1271Link(did, address, provider, opts);
  }
}

async function validateEoaLink(proof) {
  const recoveredAddr = (0, _wallet.verifyMessage)(proof.message, proof.signature).toLowerCase();

  if (proof.address && proof.address !== recoveredAddr) {
    return null;
  } else {
    proof.address = recoveredAddr;
  }

  return proof;
}

async function validateErc1271Link(proof) {
  const provider = getEthersProvider(proof.chainId);
  const contract = new _contracts.Contract(proof.address, ERC1271_ABI, provider);
  const message = '0x' + Buffer.from(proof.message, 'utf8').toString('hex');
  const returnValue = await contract.isValidSignature(message, proof.signature);
  return returnValue === MAGIC_ERC1271_VALUE ? proof : null;
}

async function validateLink(proof) {
  if (proof.type === _constants.ADDRESS_TYPES.ethereumEOA) {
    return validateEoaLink(proof);
  } else if (proof.type === _constants.ADDRESS_TYPES.erc1271) {
    return validateErc1271Link(proof);
  }
}

var _default = {
  validateLink,
  createLink,
  typeDetector
};
exports.default = _default;