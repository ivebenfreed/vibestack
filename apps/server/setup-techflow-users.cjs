/**
 * Set up TechFlow users with proper passwords for user-scoped sync testing
 */

async function setupTechFlowUsers() {
  console.log('🔐 Setting up TechFlow users for user-scoped sync testing...');
  
  const users = [
    {
      email: 'sarah.admin.test@techflow.com',
      name: 'Sarah Admin Test',
      password: 'AdminTest123!',
      role: 'admin',
      expectedOrgRole: 'admin'
    },
    {
      email: 'michael.manager.test@techflow.com', 
      name: 'Michael Manager Test',
      password: 'ManagerTest456!',
      role: 'manager',
      expectedOrgRole: 'manager'
    },
    {
      email: 'emily.member.test@techflow.com',
      name: 'Emily Member Test', 
      password: 'MemberTest789!',
      role: 'member',
      expectedOrgRole: 'member'
    }
  ];

  let successCount = 0;
  
  for (const user of users) {
    try {
      console.log(`\n📝 Setting up ${user.role}: ${user.email}`);
      
      // Try to sign up the user (this will create password if user exists without one)
      const signUpResponse = await fetch('http://localhost:8787/api/auth/sign-up/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          password: user.password,
          name: user.name
        })
      });

      if (signUpResponse.ok) {
        console.log(`✅ ${user.role} account created successfully`);
        successCount++;
      } else if (signUpResponse.status === 422) {
        console.log(`ℹ️  ${user.role} account already exists, trying to update password...`);
        
        // User exists, let's try to sign in to test password
        const signInResponse = await fetch('http://localhost:8787/api/auth/sign-in/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: user.email,
            password: user.password
          })
        });

        if (signInResponse.ok) {
          console.log(`✅ ${user.role} can sign in with existing password`);
          successCount++;
        } else {
          console.log(`❌ ${user.role} cannot sign in - password may need reset`);
          const errorText = await signInResponse.text();
          console.log(`   Error: ${errorText}`);
        }
      } else {
        const errorText = await signUpResponse.text();
        console.log(`❌ ${user.role} setup failed: ${signUpResponse.status} - ${errorText}`);
      }
      
    } catch (error) {
      console.log(`❌ ${user.role} setup error: ${error.message}`);
    }
  }
  
  console.log(`\n📊 Setup Summary:`);
  console.log(`✅ Successfully set up: ${successCount}/${users.length} users`);
  
  if (successCount === users.length) {
    console.log('\n🎉 All TechFlow users are ready for user-scoped sync testing!');
    
    console.log('\n📋 Test Users Ready:');
    users.forEach(user => {
      console.log(`   ${user.role.toUpperCase()}: ${user.email} (${user.password})`);
    });
    
    return true;
  } else {
    console.log('\n⚠️  Some users need manual setup. Check the errors above.');
    return false;
  }
}

// Run the setup
setupTechFlowUsers()
  .then(success => {
    if (success) {
      console.log('\n✅ TechFlow user setup completed successfully');
      process.exit(0);
    } else {
      console.log('\n❌ TechFlow user setup had issues');
      process.exit(1);
    }
  })
  .catch(error => {
    console.log(`💥 Setup error: ${error.message}`);
    process.exit(1);
  });