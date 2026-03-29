# Secure Time-Based Multi-Key Question Paper Protection System

A full-stack web application for securely storing and distributing examination question papers using multiple layers of cryptography.

## Security Architecture

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **File Encryption** | AES-256-GCM | Encrypts uploaded PDFs/images |
| **Key Protection** | RSA-2048 (OAEP + SHA-256) | Encrypts AES key for HOD |
| **Key Splitting** | Shamir's Secret Sharing (2,2) | Splits AES key into 2 shares |
| **Share Storage** | AES-encrypted files on disk | No raw shares in database |
| **Key Exchange** | ECDH (P-256) | Secure share transfer HOD → Staff |
| **Image Protection** | Visual Cryptography (2,2) | Splits images into 2 visual shares |
| **Time Lock** | Server-side time gate | Papers locked until exam time |
| **Authentication** | JWT + bcrypt | User authentication |

### Key Security Guarantees

- ✅ **No raw keys in MongoDB** — Shamir shares are AES-encrypted on the filesystem
- ✅ **No raw files in MongoDB** — All encrypted blobs stored on filesystem
- ✅ **ECDH key exchange** — Staff's DH private key never leaves the browser
- ✅ **HOD's DH private key is ephemeral** — Used only during approval, never stored
- ✅ **Time-gated access** — Decryption blocked until configured unlock time

## Tech Stack

- **Backend**: Node.js, Express, MongoDB (Mongoose)
- **Frontend**: React (Vite), Tailwind CSS
- **Crypto**: Node `crypto`, `secrets.js-grempe`, Web Crypto API, `jimp`

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)

### Setup

```bash
# Clone
git clone https://github.com/Jeeva3-SR/secure-paper-system.git
cd secure-paper-system

# Server
cd server
cp .env.example .env       # Edit with your MongoDB URI and JWT secret
npm install
node seed.js               # Creates HOD user + RSA keys
npm start                  # Runs on :5000

# Client (new terminal)
cd client
npm install
npm run dev                # Runs on :5173
```

### Default Credentials (from seed.js)

| Role | Username | Password |
|------|----------|----------|
| HOD  | hod      | hod123   |

> ⚠️ Change default passwords in production!

## Project Structure

```
secure-paper-system/
├── server/
│   ├── keys/                  # RSA keys + share master key (gitignored)
│   ├── uploads/
│   │   ├── encrypted/         # AES-encrypted file blobs (gitignored)
│   │   ├── shares/            # Visual cryptography shares (gitignored)
│   │   └── key_shares/        # Encrypted Shamir shares (gitignored)
│   ├── models/                # Mongoose schemas
│   ├── routes/                # Express routes
│   ├── utils/                 # Crypto, audit utilities
│   └── server.js
├── client/
│   ├── src/
│   │   ├── pages/             # React pages
│   │   ├── context/           # Auth context
│   │   └── utils/             # Browser crypto (ECDH)
│   └── index.html
└── .gitignore
```

## Decryption Flows

### Mode A — HOD Only
HOD uses their RSA private key to decrypt the AES key → decrypts the paper.

### Mode B — HOD + Staff (Multi-Key)
1. **Staff** generates ECDH keypair in browser, sends public key with access request
2. **HOD** approves → server generates HOD ECDH keypair, encrypts HOD's Shamir share with DH shared secret
3. **Staff** retrieves encrypted share, computes DH shared secret in browser, decrypts HOD share
4. **Server** combines both Shamir shares → reconstructs AES key → decrypts paper
5. After first exchange, staff can decrypt again without repeating DH

## License

MIT
