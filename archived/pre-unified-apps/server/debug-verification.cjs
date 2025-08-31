// Quick debug script to check verification tokens
const { getKysely } = require('./src/lib/kysely');

const env = {
  DATABASE_URL: process.env.DATABASE_URL || 'postgres://postgres:postgres@db.localtest.me:4444/vibestack_dev',
  ENVIRONMENT: 'development'
};

async function checkVerificationTokens() {
  const db = getKysely(env);
  
  try {
    // Check the verification table for our test user
    const verifications = await db
      .selectFrom('verification')
      .selectAll()
      .where('identifier', '=', 'linktest-1755277469@gmail.com')
      .orderBy('createdAt', 'desc')
      .limit(3)
      .execute();
    
    console.log('Verification records for linktest-1755277469@gmail.com:');
    console.log(JSON.stringify(verifications, null, 2));
    
    if (verifications.length > 0) {
      const latest = verifications[0];
      console.log('\n🔗 Latest verification token:', latest.value);
      console.log('📅 Expires at:', latest.expiresAt);
      console.log('🔍 Verification URL would be:', `http://localhost:5173/api/auth/verify-email?token=${latest.value}&callbackURL=/dashboard`);
    }
  } catch (error) {
    console.error('Error checking verification tokens:', error);
  }
}

checkVerificationTokens();