/**
 * Create project via API to test table change notifications
 */
const fetch = require('node-fetch')

async function createProject() {
  try {
    // First authenticate
    console.log('🔐 Authenticating...')
    const authResponse = await fetch('http://localhost:8787/api/auth/sign-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ceo@widecorp.com',
        password: 'WideCorp2024!CEO'
      })
    })
    
    if (!authResponse.ok) {
      throw new Error(`Auth failed: ${authResponse.status}`)
    }
    
    const authData = await authResponse.json()
    console.log('✅ Authenticated:', authData.message)
    
    // Get session cookie
    const cookies = authResponse.headers.raw()['set-cookie']
    const sessionCookie = cookies?.find(cookie => cookie.includes('session'))
    
    if (!sessionCookie) {
      throw new Error('No session cookie found')
    }
    
    console.log('🍪 Got session cookie')
    
    // Create project
    console.log('🚀 Creating project...')
    const projectResponse = await fetch('http://localhost:8787/api/archetype/orgs/01920000-1000-7000-8000-000000000001/data/Project', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify({
        name: `API Test Project ${Date.now()}`,
        description: 'Testing table change notifications via API',
        status: 'planning',
        project_type: 'development',
        budget: 75000.00
      })
    })
    
    if (!projectResponse.ok) {
      throw new Error(`Project creation failed: ${projectResponse.status}`)
    }
    
    const projectData = await projectResponse.json()
    console.log('✅ Project created:', projectData)
    
    console.log('📊 Check server logs above for srv_table_change_notification messages!')
    console.log('🔍 Look for clientId: client_1755610419715_9fku46 in the logs')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

createProject()