"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createLink = createLink;
exports.validateLink = validateLink;

var _constants = require("./constants");

var _ethereum = _interopRequireDefault(require("./blockchains/ethereum"));

var _conflux = _interopRequireDefault(require("./blockchains/conflux"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const findDID = did => did.match(/(did:(3|muport):[a-zA-Z0-9])\w+/)[0];

const handlers = {
  [_constants.ADDRESS_TYPES.ethereumEOA]: _ethereum.default,
  [_constants.ADDRESS_TYPES.erc1271]: _ethereum.default,
  [_constants.ADDRESS_TYPES.conflux]: _conflux.default
};
const typeDetectors = [_conflux.default.typeDetector, _ethereum.default.typeDetector];

async function detectType(address, provider) {
  for (const detector of typeDetectors) {
    const type = await detector(address, provider);
    if (type) return type;
  }
}

async function createLink(did, address, provider, opts = {}) {
  const type = opts.type || (await detectType(address, provider));
  if (!handlers[type]) throw new Error(`creating link with type ${type}, not supported`);
  const produceProof = handlers[type].createLink;
  const proof = await produceProof(did, address, type, provider, opts);

  if (proof) {
    return proof;
  } else {
    throw new Error(`Unable to create proof with type ${type}`);
  }
}

async function validateLink(proof, did) {
  const validate = handlers[proof.type].validateLink;
  if (typeof validate !== 'function') throw new Error(`proof with type ${proof.type} not supported`);
  const validProof = await validate(proof);

  if (validProof) {
    validProof.did = findDID(validProof.message);
    return validProof;
  } else {
    return null;
  }
}