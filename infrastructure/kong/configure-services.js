#!/usr/bin/env node

/**
 * Kong Gateway Configuration Script
 * Configures all WMS-NKS microservices in Kong
 */

const axios = require('axios');

const KONG_ADMIN_URL = process.env.KONG_ADMIN_URL || 'http://localhost:8001';

const services = [
  {
    name: 'auth-service',
    url: 'http://auth-service:3000',
    routes: [{ paths: ['/auth'], strip_path: false }]
  },
  {
    name: 'inventory-service',
    url: 'http://inventory-service:3000',
    routes: [{ paths: ['/inventory'], strip_path: false }]
  },
  {
    name: 'scanner-service',
    url: 'http://scanner-service:3000',
    routes: [{ paths: ['/scanner'], strip_path: false }]
  },
  {
    name: 'cutting-service',
    url: 'http://cutting-service:3014',
    routes: [{ paths: ['/cutting'], strip_path: false }]
  },
  {
    name: 'sewing-service',
    url: 'http://sewing-service:3014',
    routes: [{ paths: ['/sewing'], strip_path: false }]
  },
  {
    name: 'qc-service',
    url: 'http://qc-service:3015',
    routes: [{ paths: ['/qc'], strip_path: false }]
  },
  {
    name: 'shipments-service',
    url: 'http://shipments-service:3016',
    routes: [{ paths: ['/shipments'], strip_path: false }]
  },
  {
    name: 'notifications-service',
    url: 'http://notifications-service:3017',
    routes: [{ paths: ['/notifications'], strip_path: false }]
  }
];

async function configureService(service) {
  try {
    console.log(`\n🔧 Configuring ${service.name}...`);

    // Create or update service
    let serviceResponse;
    try {
      serviceResponse = await axios.get(`${KONG_ADMIN_URL}/services/${service.name}`);
      console.log(`   ✓ Service exists, updating...`);
      await axios.patch(`${KONG_ADMIN_URL}/services/${service.name}`, {
        url: service.url
      });
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`   + Creating service...`);
        serviceResponse = await axios.post(`${KONG_ADMIN_URL}/services`, {
          name: service.name,
          url: service.url
        });
      } else {
        throw error;
      }
    }

    // Configure routes
    for (const route of service.routes) {
      try {
        const routeName = `${service.name}-route`;
        try {
          await axios.get(`${KONG_ADMIN_URL}/routes/${routeName}`);
          console.log(`   ✓ Route exists, updating...`);
          await axios.patch(`${KONG_ADMIN_URL}/routes/${routeName}`, {
            paths: route.paths,
            strip_path: route.strip_path
          });
        } catch (error) {
          if (error.response?.status === 404) {
            console.log(`   + Creating route: ${route.paths.join(', ')}`);
            await axios.post(`${KONG_ADMIN_URL}/services/${service.name}/routes`, {
              name: routeName,
              paths: route.paths,
              strip_path: route.strip_path
            });
          } else {
            throw error;
          }
        }
      } catch (error) {
        console.error(`   ✗ Route error:`, error.message);
      }
    }

    console.log(`   ✅ ${service.name} configured successfully`);
    return true;
  } catch (error) {
    console.error(`   ❌ Failed to configure ${service.name}:`, error.message);
    return false;
  }
}

async function configureRateLimiting() {
  console.log('\n🔧 Configuring rate limiting...');
  
  for (const service of services) {
    try {
      // Check if rate limiting plugin exists
      const plugins = await axios.get(`${KONG_ADMIN_URL}/services/${service.name}/plugins`);
      const rateLimitPlugin = plugins.data.data.find(p => p.name === 'rate-limiting');
      
      if (rateLimitPlugin) {
        console.log(`   ✓ Rate limiting exists for ${service.name}`);
      } else {
        await axios.post(`${KONG_ADMIN_URL}/services/${service.name}/plugins`, {
          name: 'rate-limiting',
          config: {
            minute: 100,
            hour: 5000,
            policy: 'local'
          }
        });
        console.log(`   + Added rate limiting to ${service.name}`);
      }
    } catch (error) {
      console.log(`   ⚠ Could not add rate limiting to ${service.name}: ${error.message}`);
    }
  }
}

async function configureCORS() {
  console.log('\n🔧 Configuring CORS...');
  
  for (const service of services) {
    try {
      const plugins = await axios.get(`${KONG_ADMIN_URL}/services/${service.name}/plugins`);
      const corsPlugin = plugins.data.data.find(p => p.name === 'cors');
      
      if (corsPlugin) {
        console.log(`   ✓ CORS exists for ${service.name}`);
      } else {
        await axios.post(`${KONG_ADMIN_URL}/services/${service.name}/plugins`, {
          name: 'cors',
          config: {
            origins: ['*'],
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            headers: ['Accept', 'Authorization', 'Content-Type'],
            exposed_headers: ['X-Auth-Token'],
            credentials: true,
            max_age: 3600
          }
        });
        console.log(`   + Added CORS to ${service.name}`);
      }
    } catch (error) {
      console.log(`   ⚠ Could not add CORS to ${service.name}: ${error.message}`);
    }
  }
}

async function printSummary() {
  console.log('\n📊 Configuration Summary\n');
  console.log('═══════════════════════════════════════════════');
  
  for (const service of services) {
    try {
      const response = await axios.get(`${KONG_ADMIN_URL}/services/${service.name}`);
      const routesResponse = await axios.get(`${KONG_ADMIN_URL}/services/${service.name}/routes`);
      const pluginsResponse = await axios.get(`${KONG_ADMIN_URL}/services/${service.name}/plugins`);
      
      console.log(`\n✅ ${service.name}`);
      console.log(`   URL: ${response.data.url}`);
      console.log(`   Routes: ${routesResponse.data.data.map(r => r.paths.join(', ')).join('; ')}`);
      console.log(`   Plugins: ${pluginsResponse.data.data.map(p => p.name).join(', ') || 'None'}`);
    } catch (error) {
      console.log(`\n❌ ${service.name} - Not configured`);
    }
  }
  
  console.log('\n═══════════════════════════════════════════════');
}

async function main() {
  console.log('🚀 Starting Kong Gateway Configuration');
  console.log(`📡 Kong Admin API: ${KONG_ADMIN_URL}`);
  
  // Test Kong connection
  try {
    await axios.get(`${KONG_ADMIN_URL}/status`);
    console.log('✅ Kong is reachable\n');
  } catch (error) {
    console.error('❌ Cannot connect to Kong Admin API');
    console.error('   Make sure Kong is running: docker-compose up -d kong');
    process.exit(1);
  }

  // Configure all services
  let successCount = 0;
  for (const service of services) {
    const success = await configureService(service);
    if (success) successCount++;
  }

  // Configure plugins
  await configureRateLimiting();
  await configureCORS();

  // Print summary
  await printSummary();

  console.log(`\n✨ Configuration complete: ${successCount}/${services.length} services configured\n`);
  
  if (successCount === services.length) {
    console.log('🎉 All services configured successfully!');
    console.log('🔗 Gateway URL: http://localhost:8000');
    console.log('📊 Admin API: http://localhost:8001');
    console.log('🖥️  Konga UI: http://localhost:1337\n');
  } else {
    console.log('⚠️  Some services failed to configure. Check logs above.\n');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('\n💥 Fatal error:', error.message);
  process.exit(1);
});
