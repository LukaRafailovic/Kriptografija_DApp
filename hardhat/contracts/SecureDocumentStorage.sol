// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract DocumentManager  {
    struct Document {
        uint256 id;
        bytes32 hash;
        address owner;
        string ipfsHash;
        bytes iv; // AES IV (stored as bytes)
        uint256 timestamp;
        mapping(address => bytes) encryptedKeys; // encrypted AES key per user
    }

    uint256 private docCounter;
    mapping(uint256 => Document) private documents;

    event DocumentRegistered(uint256 indexed id, address indexed owner, string ipfsHash, bytes iv, uint256 timestamp);
    event AccessShared(uint256 indexed id, address indexed owner, address indexed user, bool granted, bytes encryptedKey);
    event IntegrityVerified(uint256 indexed id, bool valid);

    modifier onlyOwner(uint256 _id) {
        require(msg.sender == documents[_id].owner, "Not the document owner");
        _;
    }

    function registerDocument(bytes32 _hash, string memory _ipfsHash, bytes memory _iv) external {
        docCounter++;
        Document storage doc = documents[docCounter];
        doc.id = docCounter;
        doc.hash = _hash;
        doc.owner = msg.sender;
        doc.ipfsHash = _ipfsHash;
        doc.iv = _iv;
        doc.timestamp = block.timestamp;

        emit DocumentRegistered(doc.id, msg.sender, _ipfsHash, _iv, block.timestamp);
    }

    function shareAccess(uint256 _id, address _user, bool _grant, bytes memory _encryptedKey) external onlyOwner(_id) {
        if (_grant) {
            documents[_id].encryptedKeys[_user] = _encryptedKey;
        } else {
            delete documents[_id].encryptedKeys[_user];
        }
        emit AccessShared(_id, msg.sender, _user, _grant, _encryptedKey);
    }

    function hasAccess(uint256 _id, address _user) public view returns (bool) {
        Document storage doc = documents[_id];
        return (doc.owner == _user || documents[_id].encryptedKeys[_user].length > 0);
    }

    function getEncryptedKey(uint256 _id, address _user) external view returns (bytes memory) {
        require(hasAccess(_id, _user), "No access");
        return documents[_id].encryptedKeys[_user];
    }

    function verifyIntegrity(uint256 _id, bytes32 _hash) external returns (bool) {
        bool valid = (documents[_id].hash == _hash);
        emit IntegrityVerified(_id, valid);
        return valid;
    }

    function getDocumentInfo(uint256 _id) external view returns (address owner, string memory ipfsHash, bytes memory iv, uint256 timestamp) {
        require(hasAccess(_id, msg.sender), "Access denied");
        Document storage doc = documents[_id];
        return (doc.owner, doc.ipfsHash, doc.iv, doc.timestamp);
    }
}
