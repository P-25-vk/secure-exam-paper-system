const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const User = require('./models/User');
const { generateRSAKeyPair } = require('./utils/crypto');
const dotenv = require('dotenv');

dotenv.config();

// ONLY the HOD is seeded. All other users must be created by the HOD through the Admin Panel.
const seedDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/secure-exam-paper-system');
        console.log('✅ Connected to DB');

        await User.deleteMany();
        console.log('🗑️  Cleared all existing users');

        // ── Generate RSA Key Pair for HOD ─────────────────────────────────
        console.log('🔑 Generating RSA-2048 key pair for HOD...');
        const { publicKey, privateKey } = generateRSAKeyPair();

        // Save private key to filesystem (NEVER in DB)
        const keysDir = path.join(__dirname, 'keys');
        if (!fs.existsSync(keysDir)) {
            fs.mkdirSync(keysDir, { recursive: true });
        }
        fs.writeFileSync(path.join(keysDir, 'hod_private.pem'), privateKey, 'utf8');
        fs.writeFileSync(path.join(keysDir, 'hod_public.pem'), publicKey, 'utf8');
        console.log('✅ HOD RSA keys saved to server/keys/');

        // ── Create HOD user with RSA public key ───────────────────────────
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash('Hod@2024!', salt);

        await User.create({
            name: 'Dr. Priya HOD',
            email: 'hod@exam.edu',
            password: hashedPassword,
            role: 'HOD',
            department: 'Computer Science',
            isActive: true,
            mustChangePassword: false,
            rsaPublicKey: publicKey  // Store RSA public key in DB
        });

        console.log('\n✅ Database Seeded — HOD Account Created\n');
        console.log('┌────────────────────────────────────────────────────┐');
        console.log('│              HOD (ADMIN) CREDENTIALS               │');
        console.log('├────────────────────────────────────────────────────┤');
        console.log('│  Email:    hod@exam.edu                            │');
        console.log('│  Password: Hod@2024!                               │');
        console.log('├────────────────────────────────────────────────────┤');
        console.log('│  🔐 RSA-2048 key pair generated                   │');
        console.log('│  • Public key  → stored in MongoDB (User.rsaPublicKey) │');
        console.log('│  • Private key → server/keys/hod_private.pem      │');
        console.log('│  ⚠  NEVER store private key in database!          │');
        console.log('├────────────────────────────────────────────────────┤');
        console.log('│  Staff and Coordinators must be ADDED by HOD      │');
        console.log('│  via the Admin Panel after first login.            │');
        console.log('└────────────────────────────────────────────────────┘');

        process.exit(0);
    } catch (err) {
        console.error('❌ Seed error:', err);
        process.exit(1);
    }
};

seedDB();
