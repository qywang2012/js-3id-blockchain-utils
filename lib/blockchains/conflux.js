"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _constants = require("../constants");

var _utils = require("../utils");

var _wallet = require("@ethersproject/wallet");

var _jsConfluxSdk = require("js-conflux-sdk");

const isCfxAddress = address => /^0x[a-fA-F0-9]{40}$/.test(address);

function getCfxProvider(chainId) {
  const network = providers.getNetwork(chainId);
  if (!network._defaultProvider) throw new Error(`Network with chainId ${chainId} is not supported`);
  return network._defaultProvider(providers);
}

async function getChainId(provider) {
  const payload = (0, _utils.encodeRpcCall)('cfx_chainId', []);
  const chainIdHex = await safeSend(payload, provider);
  return parseInt(chainIdHex, 16);
}

async function getCode(address, provider) {
  const payload = (0, _utils.encodeRpcCall)('cfx_getCode', [address, 'latest']);
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

async function createCfxLink(did, address, provider, opts = {}) {
  const {
    message,
    timestamp
  } = (0, _utils.getConsentMessage)(did, !opts.skipTimestamp);
  const payload = (0, _utils.encodeRpcCall)('personal_sign', [message, address]);
  const signature = await safeSend(payload, provider);
  const proof = {
    version: 1,
    type: _constants.ADDRESS_TYPES.conflux,
    message,
    signature,
    address
  };
  if (!opts.skipTimestamp) proof.timestamp = timestamp;
  return proof;
}

async function typeDetector(address, provider) {
  if (!isCfxAddress(address)) {
    return false;
  }

  const bytecode = await getCode(address, provider).catch(() => null);

  if (!bytecode || bytecode === '0x' || bytecode === '0x0' || bytecode === '0x00') {
    return _constants.ADDRESS_TYPES.conflux;
  }

  return _constants.ADDRESS_TYPES.conflux;
}

async function createLink(did, address, type, provider, opts) {
  address = address.toLowerCase();

  if (type === _constants.ADDRESS_TYPES.conflux) {
    return createCfxLink(did, address, provider, opts);
  }
} // async function verifyMessage(message, signature) {
//     //TODO: conflux signature verify
// }


async function validateCfxLink(proof) {
  const recoveredAddr = (0, _wallet.verifyMessage)(proof.message, proof.signature).toLowerCase();

  if (proof.address && proof.address !== recoveredAddr) {
    return null;
  } else {
    proof.address = recoveredAddr;
  }

  return proof;
}

async function validateLink(proof) {
  if (proof.type === _constants.ADDRESS_TYPES.conflux) {
    return validateCfxLink(proof);
  }
}

var _default = {
  validateLink,
  createLink,
  typeDetector
};
exports.default = _default;